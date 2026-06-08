import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

logger = logging.getLogger(__name__)


class IEmailSender(Protocol):
    async def send(self, subject: str, body: str, to: list[str]) -> None: ...


class SmtpEmailSender:
    """Sends plain-text email over SMTP. Uses SMTP_SSL when use_tls=True (port 465),
    plain SMTP otherwise — suitable for smtp4dev on dev (port 2525)."""

    def __init__(self, host: str, port: int, from_addr: str, use_tls: bool = False) -> None:
        self.host = host
        self.port = port
        self.from_addr = from_addr
        self.use_tls = use_tls

    async def send(self, subject: str, body: str, to: list[str]) -> None:
        await asyncio.to_thread(self._send_sync, subject, body, to)

    def _send_sync(self, subject: str, body: str, to: list[str]) -> None:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.from_addr
        msg["To"] = ", ".join(to)
        msg.set_content(body)
        if self.use_tls:
            with smtplib.SMTP_SSL(self.host, self.port) as smtp:
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(self.host, self.port) as smtp:
                smtp.send_message(msg)
