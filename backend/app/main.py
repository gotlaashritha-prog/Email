"""
FastAPI Application Entry Point for MailCheck API.
"""
import time
from typing import List, Dict, Any, Union
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.validators import parse_input_string, process_batch_entries
from backend.app.dns_checker import lookup_mail_routing
from backend.app.smtp_checker import probe_smtp
from backend.app.classifier import classify_email
from backend.app.schemas import ClassificationStatus

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Email Deliverability Checker backend API performing layered syntax, DNS MX/A fallback, and optional SMTP validation."
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CheckEmailsRequest(BaseModel):
    emails: Union[List[str], str] = Field(
        ...,
        description="List of email addresses or raw string containing newline/comma/semicolon separated email addresses."
    )

@app.get("/api/health")
def health_check():
    """
    Service health check endpoint.
    """
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/capabilities")
def get_capabilities():
    """
    Inspection endpoint describing available checking stages and configuration limits.
    """
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "max_batch_size": settings.MAX_BATCH_SIZE,
        "dns_check_enabled": True,
        "smtp_check_enabled": settings.ENABLE_SMTP_CHECK,
        "fallback_routing_supported": True,
        "rate_limit_per_minute": 60,
        "notes": (
            "SMTP checks are enabled and active."
            if settings.ENABLE_SMTP_CHECK
            else "SMTP checks are disabled by configuration. Deliverability classification relies on RFC syntax validation and DNS mail routing records."
        )
    }

@app.post("/api/check")
async def check_emails(request_data: CheckEmailsRequest, request: Request):
    """
    Processes email addresses through the layered validation pipeline:
    1. Input normalization and batch limits
    2. Duplicate detection (preserving original order)
    3. RFC syntax validation
    4. DNS MX record resolution and A/AAAA fallback routing
    5. Optional safe SMTP verification (if enabled)
    6. Centralized classification into Likely Delivered, Likely to Bounce, or Unknown
    """
    start_time = time.time()
    
    # 1. Parse raw input
    raw_input = request_data.emails
    if isinstance(raw_input, str):
        email_list = parse_input_string(raw_input)
    elif isinstance(raw_input, list):
        email_list = []
        for item in raw_input:
            if isinstance(item, str):
                # Support embedded newlines or commas even inside list items
                sub_items = parse_input_string(item)
                email_list.extend(sub_items)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field 'emails' must be a list of strings or a formatted string."
        )
        
    if not email_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email addresses provided. Please submit at least one email address."
        )
        
    if len(email_list) > settings.MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch size of {len(email_list)} exceeds maximum allowed limit of {settings.MAX_BATCH_SIZE} addresses per request."
        )
        
    # 2. Syntax validation and duplicate identification
    batch_entries = process_batch_entries(email_list)
    
    # Cache DNS lookups per domain to avoid duplicate queries within the same batch
    dns_cache: Dict[str, Any] = {}
    
    results = []
    
    for entry in batch_entries:
        row_num = entry["row_number"]
        raw = entry["original_input"]
        syntax_valid = entry["syntax_valid"]
        local_p = entry["local_part"]
        dom = entry["domain"]
        syntax_err = entry["syntax_error"]
        is_dup = entry["is_duplicate"]
        dup_count = entry["duplicate_count"]
        warning = entry["warning"]
        
        dns_res = None
        smtp_res = None
        
        if syntax_valid and dom:
            # Check domain DNS
            if dom not in dns_cache:
                dns_cache[dom] = lookup_mail_routing(dom)
            dns_res = dns_cache[dom]
            
            # If DNS has usable route and SMTP is enabled
            if dns_res.has_usable_route and settings.ENABLE_SMTP_CHECK and dns_res.mx_records:
                primary_mx = dns_res.mx_records[0]["exchange"]
                smtp_res = probe_smtp(f"{local_p}@{dom}", primary_mx)
                
        # Classify result item
        classified_item = classify_email(
            row_number=row_num,
            original_input=raw,
            syntax_valid=syntax_valid,
            local_part=local_p,
            domain=dom,
            syntax_error=syntax_err,
            is_duplicate=is_dup,
            duplicate_count=dup_count,
            dns_result=dns_res,
            smtp_result=smtp_res,
            warning=warning
        )
        results.append(classified_item)

    # Calculate summary metrics
    total_submitted = len(results)
    unique_count = len({r["original_input"].strip().lower() for r in results})
    duplicate_count = sum(1 for r in results if r["is_duplicate"])
    valid_syntax_count = sum(1 for r in results if r["syntax_valid"])
    invalid_syntax_count = total_submitted - valid_syntax_count
    
    likely_delivered_count = sum(1 for r in results if r["status"] == ClassificationStatus.LIKELY_DELIVERED.value)
    likely_to_bounce_count = sum(1 for r in results if r["status"] == ClassificationStatus.LIKELY_TO_BOUNCE.value)
    unknown_count = sum(1 for r in results if r["status"] == ClassificationStatus.UNKNOWN.value)
    
    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    
    return {
        "total_submitted": total_submitted,
        "unique_count": unique_count,
        "duplicate_count": duplicate_count,
        "valid_syntax_count": valid_syntax_count,
        "invalid_syntax_count": invalid_syntax_count,
        "summary": {
            "likely_delivered": likely_delivered_count,
            "likely_to_bounce": likely_to_bounce_count,
            "unknown": unknown_count
        },
        "results": results,
        "execution_time_ms": elapsed_ms,
        "smtp_enabled": settings.ENABLE_SMTP_CHECK,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
