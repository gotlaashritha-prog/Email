"""
Centralized classification engine for deliverability outcomes.
Strictly implements Stage E rules:
- Likely Delivered: Valid syntax + usable mail route + non-contradictory signals.
- Likely to Bounce: Syntax invalid OR definitive permanent failure (no route, or 550 rejection).
- Unknown: DNS timeout, SERVFAIL, catch-all, SMTP timeout/blocked, greylisting, or unconfirmed mailbox.
"""
from typing import Dict, Any, List
from backend.app.schemas import ClassificationStatus, ReasonCode, DeliverabilityResultItem
from backend.app.dns_checker import DNSResult
from backend.app.smtp_checker import SMTPResult

def classify_email(
    row_number: int,
    original_input: str,
    syntax_valid: bool,
    local_part: str = None,
    domain: str = None,
    syntax_error: str = None,
    is_duplicate: bool = False,
    duplicate_count: int = 1,
    dns_result: DNSResult = None,
    smtp_result: SMTPResult = None,
    warning: str = None
) -> DeliverabilityResultItem:
    """
    Centralized classification function with transparent, technically honest rules.
    """
    checks_performed: List[str] = ["Syntax Validation"]
    
    # 1. Check syntax first
    if not syntax_valid:
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=None,
            local_part=None,
            domain=None,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.LIKELY_TO_BOUNCE,
            reason_code=ReasonCode.SYNTAX_INVALID,
            explanation=f"Invalid email syntax: {syntax_error or 'Does not conform to RFC 5322 specifications'}.",
            syntax_valid=False,
            syntax_error=syntax_error,
            dns_checked=False,
            smtp_checked=False,
            checks_performed=checks_performed,
            warning=warning
        )
    
    normalized_email = f"{local_part}@{domain}"
    
    # 2. Check DNS evidence
    if dns_result is None:
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.UNKNOWN,
            reason_code=ReasonCode.DNS_TEMPORARY_FAILURE,
            explanation="DNS lookup was not performed.",
            syntax_valid=True,
            dns_checked=False,
            checks_performed=checks_performed,
            warning=warning
        )
        
    checks_performed.append("DNS MX Record Lookup")
    if dns_result.fallback_records:
        checks_performed.append("Fallback A/AAAA Lookup")
        
    # DNS Timeout -> Unknown (NEVER convert temporary to permanent bounce)
    if dns_result.status == "timeout":
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.UNKNOWN,
            reason_code=ReasonCode.DNS_TIMEOUT,
            explanation=f"DNS query for domain '{domain}' timed out. Network or nameserver issue prevented verification.",
            syntax_valid=True,
            dns_checked=True,
            dns_status="timeout",
            checks_performed=checks_performed,
            warning=warning
        )
        
    # DNS Temporary Failure / SERVFAIL -> Unknown
    if dns_result.status == "temporary_failure":
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.UNKNOWN,
            reason_code=ReasonCode.DNS_TEMPORARY_FAILURE,
            explanation=f"Temporary DNS failure / SERVFAIL resolving domain '{domain}': {dns_result.error_detail or 'Server failure'}.",
            syntax_valid=True,
            dns_checked=True,
            dns_status="temporary_failure",
            checks_performed=checks_performed,
            warning=warning
        )
        
    # No usable mail route (no MX and no A fallback, or NXDOMAIN) -> Likely to Bounce
    if not dns_result.has_usable_route or dns_result.status == "no_route":
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.LIKELY_TO_BOUNCE,
            reason_code=ReasonCode.NO_MAIL_ROUTE,
            explanation=f"Domain '{domain}' has no usable mail route ({dns_result.error_detail or 'No MX or fallback records found'}). Emails to this domain will bounce.",
            syntax_valid=True,
            dns_checked=True,
            dns_status="no_route",
            mx_records=dns_result.mx_records,
            fallback_records=dns_result.fallback_records,
            checks_performed=checks_performed,
            warning=warning
        )

    # 3. Check SMTP evidence (if probed)
    if smtp_result and smtp_result.performed:
        checks_performed.append("SMTP Mailbox Verification")
        
        # Explicit permanent rejection -> Likely to Bounce
        if smtp_result.status == "mailbox_rejected":
            return DeliverabilityResultItem(
                row_number=row_number,
                original_input=original_input,
                normalized_email=normalized_email,
                local_part=local_part,
                domain=domain,
                is_duplicate=is_duplicate,
                duplicate_count=duplicate_count,
                status=ClassificationStatus.LIKELY_TO_BOUNCE,
                reason_code=ReasonCode.SMTP_MAILBOX_REJECTED,
                explanation=f"Mail server permanently rejected recipient mailbox (SMTP {smtp_result.response_code}): {smtp_result.detail}",
                syntax_valid=True,
                dns_checked=True,
                dns_status="ok",
                mx_records=dns_result.mx_records,
                fallback_records=dns_result.fallback_records,
                smtp_checked=True,
                smtp_status="mailbox_rejected",
                checks_performed=checks_performed,
                warning=warning
            )
            
        # Catch-all -> Unknown
        if smtp_result.status == "catch_all":
            return DeliverabilityResultItem(
                row_number=row_number,
                original_input=original_input,
                normalized_email=normalized_email,
                local_part=local_part,
                domain=domain,
                is_duplicate=is_duplicate,
                duplicate_count=duplicate_count,
                status=ClassificationStatus.UNKNOWN,
                reason_code=ReasonCode.CATCH_ALL_DETECTED,
                explanation="Domain operates catch-all routing (accepts any local-part). Mailbox existence cannot be individually determined.",
                syntax_valid=True,
                dns_checked=True,
                dns_status="ok",
                mx_records=dns_result.mx_records,
                fallback_records=dns_result.fallback_records,
                smtp_checked=True,
                smtp_status="catch_all",
                checks_performed=checks_performed,
                warning=warning
            )
            
        # SMTP timeout or port 25 blocked -> Unknown (NEVER bounce!)
        if smtp_result.status in ("blocked_or_timeout", "error"):
            return DeliverabilityResultItem(
                row_number=row_number,
                original_input=original_input,
                normalized_email=normalized_email,
                local_part=local_part,
                domain=domain,
                is_duplicate=is_duplicate,
                duplicate_count=duplicate_count,
                status=ClassificationStatus.UNKNOWN,
                reason_code=ReasonCode.SMTP_TIMEOUT_OR_BLOCKED,
                explanation=f"Mail route exists, but SMTP probe timed out or outbound port 25 is restricted: {smtp_result.detail}",
                syntax_valid=True,
                dns_checked=True,
                dns_status="ok",
                mx_records=dns_result.mx_records,
                fallback_records=dns_result.fallback_records,
                smtp_checked=True,
                smtp_status=smtp_result.status,
                checks_performed=checks_performed,
                warning=warning
            )
            
        # Inconclusive (greylisting / 4xx) -> Unknown
        if smtp_result.status == "inconclusive":
            return DeliverabilityResultItem(
                row_number=row_number,
                original_input=original_input,
                normalized_email=normalized_email,
                local_part=local_part,
                domain=domain,
                is_duplicate=is_duplicate,
                duplicate_count=duplicate_count,
                status=ClassificationStatus.UNKNOWN,
                reason_code=ReasonCode.SMTP_INCONCLUSIVE,
                explanation=f"SMTP verification inconclusive (greylisting or anti-spam response): {smtp_result.detail}",
                syntax_valid=True,
                dns_checked=True,
                dns_status="ok",
                mx_records=dns_result.mx_records,
                fallback_records=dns_result.fallback_records,
                smtp_checked=True,
                smtp_status="inconclusive",
                checks_performed=checks_performed,
                warning=warning
            )

    # 4. Standard Positive Signal: Usable mail route exists
    # If MX records are present
    if dns_result.mx_records:
        primary_mx = dns_result.mx_records[0]["exchange"]
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.LIKELY_DELIVERED,
            reason_code=ReasonCode.VALID_MX_FOUND,
            explanation=f"Valid syntax and active MX mail server found ('{primary_mx}'). Positive routing signal; delivery is probable but cannot be guaranteed.",
            syntax_valid=True,
            dns_checked=True,
            dns_status="ok",
            mx_records=dns_result.mx_records,
            fallback_records=[],
            smtp_checked=bool(smtp_result and smtp_result.performed),
            smtp_status=smtp_result.status if smtp_result else "not_performed",
            checks_performed=checks_performed,
            warning=warning
        )
    elif dns_result.fallback_records:
        return DeliverabilityResultItem(
            row_number=row_number,
            original_input=original_input,
            normalized_email=normalized_email,
            local_part=local_part,
            domain=domain,
            is_duplicate=is_duplicate,
            duplicate_count=duplicate_count,
            status=ClassificationStatus.LIKELY_DELIVERED,
            reason_code=ReasonCode.FALLBACK_A_FOUND,
            explanation=f"Valid syntax and RFC 5321 fallback A/AAAA host address found ('{dns_result.fallback_records[0]}'). Delivery is probable.",
            syntax_valid=True,
            dns_checked=True,
            dns_status="ok",
            mx_records=[],
            fallback_records=dns_result.fallback_records,
            smtp_checked=bool(smtp_result and smtp_result.performed),
            smtp_status=smtp_result.status if smtp_result else "not_performed",
            checks_performed=checks_performed,
            warning=warning
        )
    
    # Fallback to Unknown if anything was indeterminate
    return DeliverabilityResultItem(
        row_number=row_number,
        original_input=original_input,
        normalized_email=normalized_email,
        local_part=local_part,
        domain=domain,
        is_duplicate=is_duplicate,
        duplicate_count=duplicate_count,
        status=ClassificationStatus.UNKNOWN,
        reason_code=ReasonCode.SMTP_DISABLED_UNKNOWN,
        explanation="Routing status could not be conclusively determined.",
        syntax_valid=True,
        dns_checked=True,
        dns_status="ok",
        checks_performed=checks_performed,
        warning=warning
    )
