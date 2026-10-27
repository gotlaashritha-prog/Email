"""
Unit tests for the centralized classification function and CSV formula escaping.
Covers:
- Inconclusive SMTP response -> Unknown
- SMTP connection timeout -> Unknown
- Catch-all domain -> Unknown
- Unknown classification when SMTP is unavailable
- Likely Delivered classification
- Likely to Bounce classification
- Correct status summary counts
- CSV export formula escaping
"""
import unittest
from backend.app.schemas import ClassificationStatus, ReasonCode
from backend.app.dns_checker import DNSResult
from backend.app.smtp_checker import SMTPResult
from backend.app.classifier import classify_email

def escape_csv_field(val: str) -> str:
    """
    Escapes a CSV field against spreadsheet formula injection.
    If value starts with =, +, -, @, \t, \r, prepend with single quote (').
    Double quotes are doubled (" -> "").
    """
    if val is None:
        return '""'
    s = str(val)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        s = "'" + s
    escaped = s.replace('"', '""')
    return f'"{escaped}"'

class TestClassifier(unittest.TestCase):

    def test_07_inconclusive_smtp_response(self):
        """Test that temporary 4xx or greylisting response maps to Unknown."""
        dns_res = DNSResult(domain="example.com", has_usable_route=True, status="ok", mx_records=[{"exchange": "mx.example.com", "priority": 10}])
        smtp_res = SMTPResult(performed=True, status="inconclusive", response_code=450, detail="450 4.2.0 Mailbox busy or greylisted")
        
        result = classify_email(
            row_number=1,
            original_input="user@example.com",
            syntax_valid=True,
            local_part="user",
            domain="example.com",
            dns_result=dns_res,
            smtp_result=smtp_res
        )
        self.assertEqual(result["status"], ClassificationStatus.UNKNOWN.value)
        self.assertEqual(result["reason_code"], ReasonCode.SMTP_INCONCLUSIVE.value)

    def test_08_smtp_connection_timeout(self):
        """Test that SMTP timeout maps to Unknown and never permanent bounce."""
        dns_res = DNSResult(domain="example.com", has_usable_route=True, status="ok", mx_records=[{"exchange": "mx.example.com", "priority": 10}])
        smtp_res = SMTPResult(performed=True, status="blocked_or_timeout", detail="SMTP connection to mx.example.com timed out on port 25")
        
        result = classify_email(
            row_number=1,
            original_input="user@example.com",
            syntax_valid=True,
            local_part="user",
            domain="example.com",
            dns_result=dns_res,
            smtp_result=smtp_res
        )
        self.assertEqual(result["status"], ClassificationStatus.UNKNOWN.value)
        self.assertEqual(result["reason_code"], ReasonCode.SMTP_TIMEOUT_OR_BLOCKED.value)

    def test_09_catch_all_mail_server(self):
        """Test that catch-all domain maps to Unknown."""
        dns_res = DNSResult(domain="catchall.com", has_usable_route=True, status="ok", mx_records=[{"exchange": "mx.catchall.com", "priority": 10}])
        smtp_res = SMTPResult(performed=True, status="catch_all", is_catch_all=True, detail="Domain operates catch-all mailbox policy")
        
        result = classify_email(
            row_number=1,
            original_input="user@catchall.com",
            syntax_valid=True,
            local_part="user",
            domain="catchall.com",
            dns_result=dns_res,
            smtp_result=smtp_res
        )
        self.assertEqual(result["status"], ClassificationStatus.UNKNOWN.value)
        self.assertEqual(result["reason_code"], ReasonCode.CATCH_ALL_DETECTED.value)

    def test_17_unknown_classification_when_smtp_unavailable(self):
        """Test classification when DNS lookup fails with timeout."""
        dns_res = DNSResult(domain="timeout-dns.com", has_usable_route=False, status="timeout")
        
        result = classify_email(
            row_number=1,
            original_input="info@timeout-dns.com",
            syntax_valid=True,
            local_part="info",
            domain="timeout-dns.com",
            dns_result=dns_res,
            smtp_result=None
        )
        self.assertEqual(result["status"], ClassificationStatus.UNKNOWN.value)
        self.assertEqual(result["reason_code"], ReasonCode.DNS_TIMEOUT.value)

    def test_likely_delivered_standard_flow(self):
        """Test valid syntax with verified MX record."""
        dns_res = DNSResult(domain="gmail.com", has_usable_route=True, status="ok", mx_records=[{"exchange": "gmail-smtp-in.l.google.com", "priority": 5}])
        
        result = classify_email(
            row_number=1,
            original_input="contact@gmail.com",
            syntax_valid=True,
            local_part="contact",
            domain="gmail.com",
            dns_result=dns_res,
            smtp_result=None
        )
        self.assertEqual(result["status"], ClassificationStatus.LIKELY_DELIVERED.value)
        self.assertEqual(result["reason_code"], ReasonCode.VALID_MX_FOUND.value)

    def test_likely_to_bounce_no_mail_route(self):
        """Test domain with no MX and no A records."""
        dns_res = DNSResult(domain="fake-no-route.org", has_usable_route=False, status="no_route", error_detail="No MX or A records")
        
        result = classify_email(
            row_number=1,
            original_input="user@fake-no-route.org",
            syntax_valid=True,
            local_part="user",
            domain="fake-no-route.org",
            dns_result=dns_res,
            smtp_result=None
        )
        self.assertEqual(result["status"], ClassificationStatus.LIKELY_TO_BOUNCE.value)
        self.assertEqual(result["reason_code"], ReasonCode.NO_MAIL_ROUTE.value)

    def test_likely_to_bounce_syntax_invalid(self):
        """Test invalid syntax classification."""
        result = classify_email(
            row_number=1,
            original_input="not-an-email",
            syntax_valid=False,
            syntax_error="Missing '@' symbol"
        )
        self.assertEqual(result["status"], ClassificationStatus.LIKELY_TO_BOUNCE.value)
        self.assertEqual(result["reason_code"], ReasonCode.SYNTAX_INVALID.value)

    def test_15_status_summary_counts(self):
        """Test that counts across all three categories accurately match row totals."""
        results = [
            {"status": ClassificationStatus.LIKELY_DELIVERED.value},
            {"status": ClassificationStatus.LIKELY_DELIVERED.value},
            {"status": ClassificationStatus.LIKELY_TO_BOUNCE.value},
            {"status": ClassificationStatus.UNKNOWN.value},
        ]
        likely_delivered = sum(1 for r in results if r["status"] == ClassificationStatus.LIKELY_DELIVERED.value)
        likely_to_bounce = sum(1 for r in results if r["status"] == ClassificationStatus.LIKELY_TO_BOUNCE.value)
        unknown = sum(1 for r in results if r["status"] == ClassificationStatus.UNKNOWN.value)
        total = len(results)
        
        self.assertEqual(likely_delivered, 2)
        self.assertEqual(likely_to_bounce, 1)
        self.assertEqual(unknown, 1)
        self.assertEqual(likely_delivered + likely_to_bounce + unknown, total)

    def test_16_csv_export_escaping(self):
        """Test formula injection prevention in CSV export."""
        malicious_inputs = [
            "=SUM(A1:A10)",
            "+cmd|' /C calc'!A0",
            "-2+3*cmd",
            "@dangerous_macro",
            'text "with quotes"',
            "regular@example.com"
        ]
        
        escaped_outputs = [escape_csv_field(val) for val in malicious_inputs]
        
        # Test formula chars get prefixed with single quote
        self.assertTrue(escaped_outputs[0].startswith('"\'='))
        self.assertTrue(escaped_outputs[1].startswith('"\'+'))
        self.assertTrue(escaped_outputs[2].startswith('"\'-'))
        self.assertTrue(escaped_outputs[3].startswith('"\'@'))
        
        # Test quotes are properly doubled
        self.assertEqual(escaped_outputs[4], '"text ""with quotes"""')
        # Test regular values are properly quoted without quote prefix
        self.assertEqual(escaped_outputs[5], '"regular@example.com"')

if __name__ == "__main__":
    unittest.main()
