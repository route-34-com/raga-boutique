from typing import Protocol


class OtpSender(Protocol):
    def send(self, phone: str, code: str) -> None:
        """Deliver `code` to `phone` (E.164, e.g. +919876543210). Raise on failure."""
