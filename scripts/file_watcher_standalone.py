#!/usr/bin/env python3
"""
Standalone file watcher — for testing ingestion outside Docker.

Usage:
    python scripts/file_watcher_standalone.py --path /tmp/test-docs --department RH

This script runs the ingestion pipeline directly without the FastAPI server.
Useful for:
  - Verifying watchdog works on a new environment
  - Testing the ingestion pipeline on a specific directory
  - Running ingestion from the host machine instead of inside Docker

Requirements:
    pip install -r backend/requirements.txt
    Set DATABASE_URL, CHROMA_URL etc. in backend/.env
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from pathlib import Path

# Add backend to Python path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".md"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone Aiyedun file watcher")
    parser.add_argument(
        "--path",
        required=True,
        help="Directory to watch (e.g. /mnt/shares/RH)",
    )
    parser.add_argument(
        "--department",
        default="general",
        help="Department label applied to ingested documents (default: general)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Ingest existing files in the directory once, then exit (no watching)",
    )
    return parser.parse_args()


async def ingest_all_existing(directory: str, department: str) -> None:
    """
    Walk a directory and ingest every supported file found.
    Skips files already ingested (duplicate hash detection).
    """
    from app.core.ingestion import ingest_document
    from app.db.postgres import AsyncSessionLocal

    files = [
        str(p)
        for p in Path(directory).rglob("*")
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not files:
        logger.info("No supported files found in %s", directory)
        return

    logger.info("Found %d file(s) to ingest in %s", len(files), directory)

    async with AsyncSessionLocal() as db:
        for i, file_path in enumerate(files, 1):
            logger.info("[%d/%d] Ingesting %s", i, len(files), file_path)
            try:
                result = await ingest_document(file_path, department, db)
                logger.info("  → %s", "skipped (already ingested)" if result == "skipped" else f"{result} chunks")
            except Exception as exc:
                logger.error("  → ERROR: %s", exc)


async def watch_directory(directory: str, department: str) -> None:
    """Watch a directory for new/modified files and ingest them."""
    from watchdog.events import FileSystemEventHandler, FileSystemEvent
    from watchdog.observers import Observer
    from app.core.ingestion import ingest_document
    from app.db.postgres import AsyncSessionLocal

    queue: asyncio.Queue = asyncio.Queue()

    class Handler(FileSystemEventHandler):
        def on_created(self, event: FileSystemEvent) -> None:
            if not event.is_directory and Path(str(event.src_path)).suffix.lower() in SUPPORTED_EXTENSIONS:
                logger.info("New file: %s", event.src_path)
                queue.put_nowait(str(event.src_path))

        def on_modified(self, event: FileSystemEvent) -> None:
            if not event.is_directory and Path(str(event.src_path)).suffix.lower() in SUPPORTED_EXTENSIONS:
                logger.info("Modified file: %s", event.src_path)
                queue.put_nowait(str(event.src_path))

    observer = Observer()
    observer.schedule(Handler(), path=directory, recursive=True)
    observer.start()
    logger.info("Watching %s [dept=%s] — press Ctrl+C to stop", directory, department)

    try:
        while True:
            try:
                file_path = await asyncio.wait_for(queue.get(), timeout=1.0)
                async with AsyncSessionLocal() as db:
                    result = await ingest_document(file_path, department, db)
                    logger.info("Ingested: %s → %s", file_path, result)
                queue.task_done()
            except asyncio.TimeoutError:
                pass  # No new files — keep polling
    except KeyboardInterrupt:
        logger.info("Stopping watcher...")
    finally:
        observer.stop()
        observer.join()


async def main() -> None:
    args = parse_args()

    if not os.path.isdir(args.path):
        logger.error("Directory does not exist: %s", args.path)
        sys.exit(1)

    # Load .env from backend directory
    backend_env = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
    if os.path.exists(backend_env):
        from dotenv import load_dotenv
        load_dotenv(backend_env)
        logger.info("Loaded env from %s", backend_env)

    if args.once:
        logger.info("One-shot mode: ingesting existing files in %s", args.path)
        await ingest_all_existing(args.path, args.department)
        logger.info("Done.")
    else:
        # First ingest existing files, then watch for new ones
        await ingest_all_existing(args.path, args.department)
        await watch_directory(args.path, args.department)


if __name__ == "__main__":
    asyncio.run(main())
