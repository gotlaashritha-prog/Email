"""
Safe SMTP verification module.
Only invoked when ENABLE_SMTP_CHECK=true and environment supports outbound port 25.
Never sends email, message body, or test content.
"""
import smtplib
import socket
import uuid
from typing import Dict, Any, Optional
from backend.app.config import settings

class SMTPResult:
    def __init__(
        self,
        performed: bool,
        status: str, # "not_performed", "mailbox_verified", "mailbox_rejected", "catch_all", "inconclusive", "blocked_or_timeout", "error"
        response_code: Optional[int] = None,
        response_message: Optional[str] = None,
        is_catch_all: bool = False,
        detail: str = ""
    ):
        self.performed = performed
        self.status = status
        self.response_code = response_code
        self.response_message = response_message
        self.is_catch_all = is_catch_all
        self.detail = detail

    def to_dict(self) -> Dict[str, Any]:
        return {
            "performed": self.performed,
            "status": self.status,
            "response_code": self.response_code,
            "response_message": self.response_message,
            "is_catch_all": self.is_catch_all,
            "detail": self.detail
        }

def probe_smtp(
    email: str,
    mx_host: str,
    timeout: Optional[float] = None
) -> SMTPResult:
    """
    Safely probes target mail server using SMTP RCPT command without sending any message.
    Strictly adheres to safety rules:
    - Never issues DATA or sends message bodies.
    - Uses short connection timeout.
    - Probes for catch-all behavior to prevent false positives.
    - Treats timeouts, connection refusals, and 4xx responses as Unknown/inconclusive.
    """
    if not settings.ENABLE_SMTP_CHECK:
        return SMTPResult(
            performed=False,
            status="not_performed",
            detail="SMTP verification is disabled by host configuration (ENABLE_SMTP_CHECK=false)."
        )
    
    timeout = timeout or settings.SMTP_TIMEOUT_SECONDS
    smtp = None
    
    try:
        # Establish connection to MX host on port 25
        smtp = smtplib.SMTP(timeout=timeout)
        code, msg = smtp.connect(mx_host, 25)
        
        # Issue EHLO or HELO
        try:
            smtp.ehlo(settings.SMTP_HELO_DOMAIN)
        except Exception:
            smtp.helo(settings.SMTP_HELO_DOMAIN)
            
        # Optional: check if domain is catch-all by checking a non-existent random address
        # e.g., probe_catchall_abc123xyz@domain
        domain = email.split("@")[-1] if "@" in email else ""
        random_local = f"mailcheck-probe-{uuid.uuid4().hex[:12]}"
        random_test_email = f"{random_local}@{domain}"
        
        # Test random recipient for catch-all detection
        smtp.mail(settings.SMTP_FROM_EMAIL)
        catch_code, catch_msg = smtp.rcpt(random_test_email)
        
        # Reset transaction (RSET)
        smtp.rset()
        
        # If random address returned 250, domain is catch-all
        if catch_code == 250:
            smtp.quit()
            return SMTPResult(
                performed=True,
                status="catch_all",
                response_code=catch_code,
                response_message=str(catch_msg),
                is_catch_all=True,
                detail="Domain operates a catch-all mailbox policy. Individual mailbox existence cannot be confirmed."
            )
            
        # Now probe target address
        smtp.mail(settings.SMTP_FROM_EMAIL)
        rcpt_code, rcpt_msg = smtp.rcpt(email)
        rcpt_msg_str = rcpt_msg.decode("utf-8", errors="replace") if isinstance(rcpt_msg, bytes) else str(rcpt_msg)
        
        smtp.quit()
        
        # Permanent mailbox rejection (550, 551, 552, 553)
        if rcpt_code in (550, 551, 552, 553):
            return SMTPResult(
                performed=True,
                status="mailbox_rejected",
                response_code=rcpt_code,
                response_message=rcpt_msg_str,
                detail=f"Mail server permanently rejected recipient mailbox (SMTP {rcpt_code}): {rcpt_msg_str}"
            )
        elif rcpt_code == 250:
            return SMTPResult(
                performed=True,
                status="mailbox_verified",
                response_code=rcpt_code,
                response_message=rcpt_msg_str,
                detail="Mail server accepted recipient address in RCPT probe (Note: this is positive evidence, not a guaranteed delivery delivery receipt)."
            )
        elif 400 <= rcpt_code < 500:
            # Temporary error / greylisting
            return SMTPResult(
                performed=True,
                status="inconclusive",
                response_code=rcpt_code,
                response_message=rcpt_msg_str,
                detail=f"Mail server returned temporary error/greylisting (SMTP {rcpt_code}): {rcpt_msg_str}"
            )
        else:
            return SMTPResult(
                performed=True,
                status="inconclusive",
                response_code=rcpt_code,
                response_message=rcpt_msg_str,
                detail=f"Mail server returned unexpected code (SMTP {rcpt_code}): {rcpt_msg_str}"
            )
            
    except (socket.timeout, smtplib.SMTPConnectError, TimeoutError):
        return SMTPResult(
            performed=True,
            status="blocked_or_timeout",
            detail=f"SMTP connection to {mx_host} timed out. Outbound port 25 may be blocked by cloud provider or firewall."
        )
    except ConnectionRefusedError:
        return SMTPResult(
            performed=True,
            status="blocked_or_timeout",
            detail=f"SMTP connection to {mx_host}:25 was refused."
        )
    except Exception as e:
        return SMTPResult(
            performed=True,
            status="error",
            detail=f"SMTP check encountered exception: {str(e)}"
        )
    finally:
        if smtp is not None:
            try:
                smtp.close()
            except Exception:
                pass
