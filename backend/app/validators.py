"""
Email parsing and syntax validation routines.
Implements RFC 5321/5322 and RFC 6531/6532 parsing rules.
"""
import re
from typing import List, Tuple, Dict, Any, Optional

# Regular expressions for strict RFC validation
# Local part allows alphanumeric, and printable characters !#$%&'*+-/=?^_`{|}~ and dot (not consecutive)
LOCAL_PART_PATTERN = re.compile(r"^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$")
# Domain label allows alphanumeric and hyphen (not leading or trailing)
DOMAIN_LABEL_PATTERN = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$")

def parse_input_string(raw_text: str) -> List[str]:
    """
    Parses raw user input into individual candidate email strings.
    Supports newline-separated, comma-separated, and semicolon-separated lists.
    Trims whitespace and ignores empty entries while preserving exact order.
    """
    if not raw_text:
        return []
    
    # Split by newline, comma, or semicolon
    raw_tokens = re.split(r"[\r\n,;]+", raw_text)
    cleaned = []
    for token in raw_tokens:
        item = token.strip()
        if item:
            cleaned.append(item)
    return cleaned

def validate_syntax(email_str: str) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    Validates email syntax against RFC 5322 / RFC 6532 standards.
    Returns: (is_valid, local_part, domain, error_message)
    """
    if not email_str:
        return False, None, None, "Email address is empty"
    
    if len(email_str) > 254:
        return False, None, None, f"Total email length ({len(email_str)}) exceeds RFC 5321 maximum of 254 characters"
    
    if "@" not in email_str:
        return False, None, None, "Missing '@' symbol in email address"
    
    # Check for multiple '@' symbols
    parts = email_str.split("@")
    if len(parts) != 2:
        return False, None, None, "Email contains multiple '@' characters"
    
    local_part, domain = parts
    
    # Validate local-part
    if not local_part:
        return False, None, None, "Local part (username before '@') is empty"
    
    if len(local_part) > 64:
        return False, None, None, f"Local part length ({len(local_part)}) exceeds maximum of 64 characters"
    
    if local_part.startswith(".") or local_part.endswith("."):
        return False, None, None, "Local part cannot start or end with a period"
    
    if ".." in local_part:
        return False, None, None, "Local part cannot contain consecutive periods"
    
    # Support quoted local-part or standard unquoted local-part
    is_quoted = local_part.startswith('"') and local_part.endswith('"') and len(local_part) >= 2
    if not is_quoted and not LOCAL_PART_PATTERN.match(local_part):
        return False, None, None, "Local part contains invalid characters"
    
    # Validate domain
    if not domain:
        return False, None, None, "Domain part (after '@') is empty"
    
    if len(domain) > 253:
        return False, None, None, f"Domain length ({len(domain)}) exceeds maximum of 253 characters"

    if domain.startswith(".") or domain.endswith("."):
        return False, None, None, "Domain cannot start or end with a period"
    
    if ".." in domain:
        return False, None, None, "Domain cannot contain consecutive periods"

    # Support internationalized domains (IDN) by encoding to ASCII (punycode)
    try:
        ascii_domain = domain.encode("idna").decode("ascii").lower()
    except Exception as e:
        return False, None, None, f"Invalid domain internationalization (IDN) encoding: {str(e)}"
    
    if ascii_domain.startswith(".") or ascii_domain.endswith("."):
        return False, None, None, "Domain cannot start or end with a period"
    
    if ".." in ascii_domain:
        return False, None, None, "Domain cannot contain consecutive periods"
    
    labels = ascii_domain.split(".")
    if len(labels) < 2:
        return False, None, None, "Domain must contain at least one dot separating labels (e.g., example.com)"
    
    for label in labels:
        if not label:
            return False, None, None, "Domain label cannot be empty"
        if len(label) > 63:
            return False, None, None, f"Domain label '{label}' exceeds maximum 63 characters"
        if not DOMAIN_LABEL_PATTERN.match(label):
            return False, None, None, f"Domain label '{label}' contains invalid characters or hyphens at ends"
    
    # Top-level domain (last label) must not be all-numeric
    tld = labels[-1]
    if tld.isdigit():
        return False, None, None, "Top-level domain cannot be entirely numeric"
    
    if len(tld) < 2:
        return False, None, None, f"Top-level domain '{tld}' must be at least 2 characters long"
    
    # Normalized representation
    normalized = f"{local_part}@{ascii_domain}"
    return True, local_part, ascii_domain, None

def process_batch_entries(raw_emails: List[str]) -> List[Dict[str, Any]]:
    """
    Processes a list of raw email strings, identifies duplicates,
    performs syntax validation, and returns initial parsed state.
    """
    seen_counts: Dict[str, int] = {}
    first_seen_index: Dict[str, int] = {}
    
    # Count occurrences
    for idx, raw in enumerate(raw_emails):
        key = raw.strip().lower()
        if key in seen_counts:
            seen_counts[key] += 1
        else:
            seen_counts[key] = 1
            first_seen_index[key] = idx
    
    processed = []
    current_counts: Dict[str, int] = {}
    
    for idx, raw in enumerate(raw_emails):
        key = raw.strip().lower()
        is_dup = seen_counts[key] > 1
        current_counts[key] = current_counts.get(key, 0) + 1
        dup_index = current_counts[key]
        
        is_valid, local_p, dom, error_msg = validate_syntax(raw.strip())
        
        warning = None
        if is_dup:
            if dup_index == 1:
                warning = f"Duplicate entry: appears {seen_counts[key]} times in this batch"
            else:
                warning = f"Duplicate entry (#{dup_index}): first appeared at row {first_seen_index[key] + 1}"
        
        normalized = f"{local_p}@{dom}" if is_valid and local_p and dom else None
        
        processed.append({
            "row_number": idx + 1,
            "original_input": raw,
            "normalized_email": normalized,
            "local_part": local_p,
            "domain": dom,
            "is_duplicate": is_dup,
            "duplicate_count": seen_counts[key],
            "syntax_valid": is_valid,
            "syntax_error": error_msg,
            "warning": warning,
        })
        
    return processed
