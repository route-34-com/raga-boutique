import logging

log = logging.getLogger("raga.otp")


class ConsoleSender:
    """Demo sender: no SMS, the code is logged and shown on screen."""

    def send(self, phone: str, code: str) -> None:
        log.warning("OTP for %s is %s", phone, code)
