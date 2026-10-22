from fastapi import HTTPException


class ServiceError(Exception):
    """Business-rule failure; routers turn it into a 4xx with a customer-friendly message."""

    def __init__(self, message: str, status: int = 400, details: list[str] | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details or []

    def http(self) -> HTTPException:
        return HTTPException(self.status, {"message": self.message, "details": self.details})
