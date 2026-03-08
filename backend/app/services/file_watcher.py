"""
File watcher service — monitors configured directories and auto-ingests new/modified files.

Uses the watchdog library to watch paths defined in the WATCHED_PATHS env var.
Each path entry has a 'path' and 'department' key, e.g.:
  [{"path": "/mnt/shares/RH", "department": "RH"}, ...]

Supported file types: .pdf, .docx, .doc, .xlsx, .xls, .txt, .md

Files are deduplicated via MD5 hash — if a file was already ingested with
the same hash, it is skipped to prevent duplicate chunks in ChromaDB.
"""

import asyncio
import json
import logging
import os
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from app.core.config import settings

logger = logging.getLogger(__name__)

# File extensions that the ingestion pipeline supports
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".md"}


class DocumentEventHandler(FileSystemEventHandler):
    """
    Watchdog event handler — queues new/modified files for ingestion.

    Uses an asyncio Queue so file events from the watchdog thread are
    handed off safely to the async ingestion coroutine.
    """

    def __init__(self, department: str, queue: asyncio.Queue) -> None:
        super().__init__()
        self.department = department
        self.queue = queue

    def _should_process(self, path: str) -> bool:
        """Return True if the file extension is supported and file exists."""
        return Path(path).suffix.lower() in SUPPORTED_EXTENSIONS and os.path.isfile(path)

    def on_created(self, event: FileSystemEvent) -> None:
        """New file detected — queue for ingestion."""
        if not event.is_directory and self._should_process(str(event.src_path)):
            logger.info(
                "File watcher: new file detected → %s [dept=%s]",
                event.src_path,
                self.department,
            )
            self.queue.put_nowait((str(event.src_path), self.department))

    def on_modified(self, event: FileSystemEvent) -> None:
        """Existing file modified — queue for re-ingestion (hash check prevents duplicate)."""
        if not event.is_directory and self._should_process(str(event.src_path)):
            logger.info(
                "File watcher: file modified → %s [dept=%s]",
                event.src_path,
                self.department,
            )
            self.queue.put_nowait((str(event.src_path), self.department))


async def _ingest_worker(queue: asyncio.Queue) -> None:
    """
    Async worker — reads file paths from the queue and calls the ingestion pipeline.

    Runs indefinitely. Each item is (file_path, department).
    Errors during ingestion are logged but do not stop the worker.
    """
    # Import here to avoid circular imports at module load time
    from app.core.ingestion import ingest_document
    from app.db.postgres import AsyncSessionLocal

    while True:
        file_path, department = await queue.get()
        logger.info("Ingestion worker: processing %s [dept=%s]", file_path, department)
        try:
            async with AsyncSessionLocal() as db:
                result = await ingest_document(file_path, department, db)
                if result == "skipped":
                    logger.info("Ingestion worker: skipped (already ingested) → %s", file_path)
                else:
                    logger.info("Ingestion worker: complete → %s (%s chunks)", file_path, result)
        except Exception as exc:
            logger.error(
                "Ingestion worker: error processing %s — %s",
                file_path,
                exc,
                exc_info=True,
            )
        finally:
            queue.task_done()


async def start_file_watcher() -> None:
    """
    Parse WATCHED_PATHS config, start watchdog observers for each path,
    and launch the async ingestion worker.

    Called from main.py lifespan on startup.
    """
    raw = settings.watched_paths.strip()
    if not raw or raw == "[]":
        logger.info("File watcher: WATCHED_PATHS is empty — no directories monitored")
        return

    try:
        paths: list[dict] = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("File watcher: invalid WATCHED_PATHS JSON — %s", exc)
        return

    if not paths:
        logger.info("File watcher: no paths configured")
        return

    # Shared queue between watchdog threads and the async ingestion worker
    queue: asyncio.Queue = asyncio.Queue()

    observer = Observer()
    watched_count = 0

    for entry in paths:
        path = entry.get("path", "").strip()
        department = entry.get("department", "general")

        if not path:
            logger.warning("File watcher: entry missing 'path' key — skipping %s", entry)
            continue

        if not os.path.isdir(path):
            logger.warning("File watcher: path does not exist or is not a directory — %s", path)
            continue

        handler = DocumentEventHandler(department=department, queue=queue)
        observer.schedule(handler, path=path, recursive=True)
        watched_count += 1
        logger.info("File watcher: monitoring %s [dept=%s]", path, department)

    # Also monitor the Passerelle drop-zone (cross-department manual uploads)
    passerelle = settings.passerelle_path.strip()
    if passerelle and os.path.isdir(passerelle):
        handler = DocumentEventHandler(department="passerelle", queue=queue)
        observer.schedule(handler, path=passerelle, recursive=False)
        watched_count += 1
        logger.info("File watcher: monitoring passerelle drop-zone → %s", passerelle)

    if watched_count == 0:
        logger.warning("File watcher: no valid paths found — watcher not started")
        return

    observer.start()
    logger.info("File watcher: started — monitoring %d path(s)", watched_count)

    # Start the async worker as a background task
    asyncio.create_task(_ingest_worker(queue))
