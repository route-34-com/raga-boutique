from app.core.config import get_settings
from app.services.otp.base import OtpSender
from app.services.otp.console import ConsoleSender
from app.services.otp.msg91 import Msg91Sender

SENDERS: dict[str, type] = {"console": ConsoleSender, "msg91": Msg91Sender}


def get_sender() -> OtpSender:
    return SENDERS[get_settings().otp_provider]()
