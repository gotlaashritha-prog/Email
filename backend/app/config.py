"""
MailCheck Configuration Settings
"""
import os

class Settings:
    PROJECT_NAME: str = "MailCheck — Email Deliverability Checker"
    VERSION: str = "1.0.0"
    MAX_BATCH_SIZE: int = int(os.getenv("MAX_BATCH_SIZE", "100"))
    MAX_BODY_SIZE_BYTES: int = int(os.getenv("MAX_BODY_SIZE_BYTES", "1048576")) # 1MB
    DNS_TIMEOUT_SECONDS: float = float(os.getenv("DNS_TIMEOUT_SECONDS", "3.0"))
    ENABLE_SMTP_CHECK: bool = os.getenv("ENABLE_SMTP_CHECK", "false").lower() in ("true", "1", "yes")
    SMTP_TIMEOUT_SECONDS: float = float(os.getenv("SMTP_TIMEOUT_SECONDS", "3.0"))
    SMTP_HELO_DOMAIN: str = os.getenv("SMTP_HELO_DOMAIN", "mailcheck.local")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "verify@mailcheck.local")

settings = Settings()
