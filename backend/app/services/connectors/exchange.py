"""
Exchange / Outlook email connector.
Supports two protocols:
  - EWS (Exchange Web Services) via exchangelib
  - IMAP via the standard imaplib (Python stdlib)
Ingests email body + attachments as documents with sender/date/subject metadata.
"""

import imaplib
import logging

from app.services.connectors.base import BaseConnector, ConnectionResult, FileInfo, SyncResult

logger = logging.getLogger(__name__)

# Supported attachment MIME types for ingestion
SUPPORTED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "text/plain",
    "text/html",
}


class ExchangeConnector(BaseConnector):
    """
    Connector for Exchange / Outlook mailboxes.
    Uses exchangelib for EWS and imaplib for IMAP.
    """

    def __init__(self, source_id: str, config: dict):
        super().__init__(source_id, config)
        self.server: str = config.get("server", "")
        self.username: str = config.get("username", "")
        self.password: str = config.get("password", "")
        self.folder_path: str = config.get("folder_path", "Inbox")
        self.protocol: str = config.get("protocol", "ews")

    # ── EWS helpers ───────────────────────────────────────────────────────────

    def _ews_account(self):
        """Build an exchangelib Account object for EWS access."""
        try:
            from exchangelib import DELEGATE, Account, Configuration, Credentials  # type: ignore[import]
        except ImportError:
            raise RuntimeError("exchangelib is not installed. Add 'exchangelib' to requirements.txt.")

        creds = Credentials(self.username, self.password)
        config = Configuration(server=self.server, credentials=creds)
        return Account(self.username, config=config, autodiscover=False, access_type=DELEGATE)

    def _ews_folder(self, account):
        """Navigate to the configured mail folder within the account."""
        folder = account.inbox.parent  # start at mailbox root
        for part in self.folder_path.split("/"):
            part = part.strip()
            if not part or part.lower() == "inbox":
                folder = account.inbox
            else:
                folder = folder / part
        return folder

    # ── IMAP helpers ──────────────────────────────────────────────────────────

    def _imap_connect(self):
        """Connect and authenticate via IMAP SSL."""
        conn = imaplib.IMAP4_SSL(self.server)
        conn.login(self.username, self.password)
        return conn

    # ── BaseConnector interface ───────────────────────────────────────────────

    async def test_connection(self) -> ConnectionResult:
        """Verify credentials and return an approximate message count."""
        try:
            if self.protocol == "ews":
                account = self._ews_account()
                folder = self._ews_folder(account)
                count = folder.total_count
            else:
                conn = self._imap_connect()
                conn.select(self.folder_path)
                _, data = conn.search(None, "ALL")
                count = len(data[0].split()) if data[0] else 0
                conn.logout()

            return ConnectionResult(
                success=True,
                message=f"Connected — {count} messages in {self.folder_path}",
                files_found=count,
            )
        except Exception as e:
            logger.error("Exchange test_connection failed: %s", e)
            return ConnectionResult(success=False, message=str(e))

    async def list_files(self) -> list[FileInfo]:
        """
        Return a FileInfo per email in the configured folder.
        The 'file_id' for EWS is the item.item_id; for IMAP it's the message number.
        """
        files: list[FileInfo] = []

        if self.protocol == "ews":
            try:
                from exchangelib import Message  # type: ignore[import]

                account = self._ews_account()
                folder = self._ews_folder(account)
                for item in folder.filter().order_by("-datetime_received")[:500]:
                    if not isinstance(item, Message):
                        continue
                    files.append(
                        FileInfo(
                            file_id=item.item_id,
                            name=f"{item.subject or 'No Subject'}.eml",
                            size=0,
                            modified_at=item.datetime_received.replace(tzinfo=None) if item.datetime_received else None,
                            extra={
                                "sender": str(item.sender.email_address) if item.sender else "",
                                "subject": item.subject or "",
                            },
                        )
                    )
            except Exception as e:
                logger.error("EWS list_files error: %s", e)
        else:
            # IMAP
            try:
                conn = self._imap_connect()
                conn.select(self.folder_path)
                _, data = conn.search(None, "ALL")
                msg_ids = data[0].split() if data[0] else []
                for msg_id in msg_ids[-500:]:  # last 500 messages
                    _, msg_data = conn.fetch(msg_id, "(ENVELOPE)")
                    files.append(
                        FileInfo(
                            file_id=msg_id.decode(),
                            name=f"email_{msg_id.decode()}.eml",
                            size=0,
                        )
                    )
                conn.logout()
            except Exception as e:
                logger.error("IMAP list_files error: %s", e)

        return files

    async def download_file(self, file_id: str) -> bytes:
        """Fetch raw email bytes by ID."""
        if self.protocol == "ews":
            account = self._ews_account()
            item = account.fetch(ids=[(file_id, None)])
            msg = list(item)[0]
            # Build minimal .eml representation
            lines = [
                f"From: {msg.sender.email_address if msg.sender else ''}",
                f"Subject: {msg.subject or ''}",
                f"Date: {msg.datetime_received}",
                "",
                msg.text_body or msg.body or "",
            ]
            return "\n".join(lines).encode("utf-8")
        else:
            conn = self._imap_connect()
            conn.select(self.folder_path)
            _, data = conn.fetch(file_id.encode(), "(RFC822)")
            conn.logout()
            return data[0][1] if data and data[0] else b""

    async def sync(self) -> SyncResult:
        """Fetch emails from the configured folder and ingest them."""
        from app.services.ingestion import ingest_bytes  # late import

        try:
            files = await self.list_files()
        except Exception as e:
            return SyncResult(success=False, error=str(e))

        processed = 0
        failed = 0

        for file_info in files:
            try:
                content = await self.download_file(file_info.file_id)
                await ingest_bytes(
                    content=content,
                    filename=file_info.name,
                    source_id=self.source_id,
                    metadata=file_info.extra,
                )
                processed += 1
            except Exception as e:
                failed += 1
                logger.error("Failed to ingest email %s: %s", file_info.name, e)

        return SyncResult(
            success=failed == 0,
            files_processed=processed,
            files_failed=failed,
            error=f"{failed} emails failed" if failed else None,
        )
