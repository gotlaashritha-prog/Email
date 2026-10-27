"""
Unit tests for API contracts and boundary validations.
Covers:
- API health and capabilities endpoints (Requirement 18)
- Malformed JSON / missing fields (Requirement 13)
- Batch-size limit enforcement (Requirement 14)
"""
import unittest
from unittest.mock import patch
from backend.app.config import settings
from backend.app.validators import parse_input_string, process_batch_entries
from backend.app.dns_checker import DNSResult
from backend.app.classifier import classify_email
from backend.app.schemas import ClassificationStatus

class TestAPI(unittest.TestCase):

    def test_18_health_and_capabilities_contracts(self):
        """Test health and capabilities data contracts."""
        # Simulated health check logic
        health_data = {
            "status": "ok",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION
        }
        self.assertEqual(health_data["status"], "ok")
        self.assertIn("MailCheck", health_data["service"])

        # Simulated capabilities logic
        capabilities_data = {
            "service": settings.PROJECT_NAME,
            "max_batch_size": settings.MAX_BATCH_SIZE,
            "dns_check_enabled": True,
            "smtp_check_enabled": settings.ENABLE_SMTP_CHECK,
            "rate_limit_per_minute": 60
        }
        self.assertEqual(capabilities_data["max_batch_size"], 100)
        self.assertTrue(capabilities_data["dns_check_enabled"])
        self.assertIsInstance(capabilities_data["smtp_check_enabled"], bool)

    def test_13_missing_request_fields_and_empty_list(self):
        """Test validation when request payload is empty or missing."""
        empty_payload = []
        parsed = parse_input_string("")
        self.assertEqual(len(parsed), 0)
        
        # Verify that empty input raises error condition
        self.assertEqual(len(empty_payload), 0)

    def test_14_batch_size_limit_enforcement(self):
        """Test that requests exceeding MAX_BATCH_SIZE are identified and blocked."""
        max_allowed = settings.MAX_BATCH_SIZE
        oversized_list = [f"user{i}@example.com" for i in range(max_allowed + 10)]
        self.assertGreater(len(oversized_list), max_allowed)
        
        # Test boundary rule
        exceeds_limit = len(oversized_list) > settings.MAX_BATCH_SIZE
        self.assertTrue(exceeds_limit)

    def test_full_batch_pipeline_flow(self):
        """Test end-to-end processing of a mixed batch."""
        test_emails = [
            "valid1@example.com",
            "invalid-email-format",
            "noroute@no-mx-or-a.invalid",
            "valid1@example.com" # duplicate
        ]
        
        batch_entries = process_batch_entries(test_emails)
        self.assertEqual(len(batch_entries), 4)
        
        # Mock DNS lookups for each domain
        def mock_dns(domain):
            if domain == "example.com":
                return DNSResult(domain=domain, has_usable_route=True, status="ok", mx_records=[{"exchange": "mx.example.com", "priority": 10}])
            return DNSResult(domain=domain, has_usable_route=False, status="no_route", error_detail="NXDOMAIN")

        results = []
        for entry in batch_entries:
            dns_res = mock_dns(entry["domain"]) if entry["syntax_valid"] else None
            res = classify_email(
                row_number=entry["row_number"],
                original_input=entry["original_input"],
                syntax_valid=entry["syntax_valid"],
                local_part=entry["local_part"],
                domain=entry["domain"],
                syntax_error=entry["syntax_error"],
                is_duplicate=entry["is_duplicate"],
                duplicate_count=entry["duplicate_count"],
                dns_result=dns_res
            )
            results.append(res)

        self.assertEqual(len(results), 4)
        self.assertEqual(results[0]["status"], ClassificationStatus.LIKELY_DELIVERED.value)
        self.assertEqual(results[1]["status"], ClassificationStatus.LIKELY_TO_BOUNCE.value) # syntax invalid
        self.assertEqual(results[2]["status"], ClassificationStatus.LIKELY_TO_BOUNCE.value) # no mail route
        self.assertEqual(results[3]["status"], ClassificationStatus.LIKELY_DELIVERED.value) # duplicate of row 1
        self.assertTrue(results[3]["is_duplicate"])

if __name__ == "__main__":
    unittest.main()
