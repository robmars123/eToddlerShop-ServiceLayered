import logging

from app.database import settings
from app.services.email.email_sender import IEmailSender, SmtpEmailSender

logger = logging.getLogger(__name__)


class BaseEmailService:
    def __init__(self, sender: IEmailSender, recipients: list[str]) -> None:
        self._sender = sender
        self._recipients = recipients

    @classmethod
    def from_settings(cls):
        sender = SmtpEmailSender(
            host=settings.smtp_host,
            port=settings.smtp_port,
            from_addr=settings.smtp_from,
            use_tls=settings.smtp_use_tls,
        )
        recipients = [r.strip() for r in settings.smtp_to.split(",") if r.strip()]
        return cls(sender=sender, recipients=recipients)

    async def _send(self, subject: str, body: str) -> None:
        if not self._recipients:
            return
        await self._sender.send(subject, body, self._recipients)
        logger.info("Email sent: %s → %s", subject, self._recipients)
