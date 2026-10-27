"""
Pydantic schemas and dataclasses for Email Deliverability Checker.
"""
from enum import Enum
from typing import List, Optional, Dict, Any

class ClassificationStatus(str, Enum):
    LIKELY_DELIVERED = "Likely Delivered"
    LIKELY_TO_BOUNCE = "Likely to Bounce"
    UNKNOWN = "Unknown"

class ReasonCode(str, Enum):
    VALID_MX_FOUND = "VALID_MX_FOUND"
    FALLBACK_A_FOUND = "FALLBACK_A_FOUND"
    SYNTAX_INVALID = "SYNTAX_INVALID"
    NO_MAIL_ROUTE = "NO_MAIL_ROUTE"
    DNS_TIMEOUT = "DNS_TIMEOUT"
    DNS_TEMPORARY_FAILURE = "DNS_TEMPORARY_FAILURE"
    CATCH_ALL_DETECTED = "CATCH_ALL_DETECTED"
    SMTP_MAILBOX_REJECTED = "SMTP_MAILBOX_REJECTED"
    SMTP_INCONCLUSIVE = "SMTP_INCONCLUSIVE"
    SMTP_TIMEOUT_OR_BLOCKED = "SMTP_TIMEOUT_OR_BLOCKED"
    SMTP_DISABLED_UNKNOWN = "SMTP_DISABLED_UNKNOWN"

class MXRecord(dict):
    def __init__(self, exchange: str, priority: int):
        super().__init__(exchange=exchange, priority=priority)

class DeliverabilityResultItem(dict):
    def __init__(
        self,
        row_number: int,
        original_input: str,
        normalized_email: Optional[str] = None,
        local_part: Optional[str] = None,
        domain: Optional[str] = None,
        is_duplicate: bool = False,
        duplicate_count: int = 1,
        status: ClassificationStatus = ClassificationStatus.UNKNOWN,
        reason_code: ReasonCode = ReasonCode.SMTP_DISABLED_UNKNOWN,
        explanation: str = "",
        syntax_valid: bool = False,
        syntax_error: Optional[str] = None,
        dns_checked: bool = False,
        mx_records: Optional[List[Dict[str, Any]]] = None,
        fallback_records: Optional[List[str]] = None,
        dns_status: str = "skipped",
        smtp_checked: bool = False,
        smtp_status: str = "not_performed",
        checks_performed: Optional[List[str]] = None,
        warning: Optional[str] = None
    ):
        super().__init__(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=status.value if isinstance(status, ClassificationStatus) else str(status),
            reason_code=reason_code.value if isinstance(reason_code, ReasonCode) else str(reason_code),
            explanation=explanation,
            syntax_valid=syntax_valid,
            syntax_error=syntax_error,
            dns_checked=dns_checked,
            mx_records=mx_records or [],
            fallback_records=fallback_records or [],
            dns_status=dns_status,
            smtp_checked=smtp_checked,
            smtp_status=smtp_status,
            checks_performed=checks_performed or [],
            warning=warning
        )
