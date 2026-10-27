"""
Unit tests for DNS mail-routing lookup with hermetic mocks.
Covers:
- Usable MX record
- No usable mail route
- Fallback A/AAAA record
- DNS timeout
- Temporary DNS failure (SERVFAIL)
"""
import unittest
from unittest.mock import patch
import backend.app.dns_checker as dns_checker
from backend.app.dns_checker import DNSResult

class TestDNS(unittest.TestCase):

    def test_03_address_with_usable_mx_record(self):
        """Test domain with active MX records."""
        mock_result = DNSResult(
            domain="example.com",
            has_usable_route=True,
            status="ok",
            mx_records=[{"exchange": "mail.example.com", "priority": 10}]
        )
        with patch.object(dns_checker, "lookup_mail_routing", return_value=mock_result):
            res = dns_checker.lookup_mail_routing("example.com")
            self.assertTrue(res.has_usable_route)
            self.assertEqual(res.status, "ok")
            self.assertEqual(len(res.mx_records), 1)
            self.assertEqual(res.mx_records[0]["exchange"], "mail.example.com")

    def test_04_domain_with_no_usable_mail_route(self):
        """Test domain with neither MX records nor fallback A records."""
        mock_result = DNSResult(
            domain="nonexistent-xyz-random-domain.invalid",
            has_usable_route=False,
            status="no_route",
            error_detail="Domain does not exist (NXDOMAIN)"
        )
        with patch.object(dns_checker, "lookup_mail_routing", return_value=mock_result):
            res = dns_checker.lookup_mail_routing("nonexistent-xyz-random-domain.invalid")
            self.assertFalse(res.has_usable_route)
            self.assertEqual(res.status, "no_route")
            self.assertIn("NXDOMAIN", res.error_detail)

    def test_05_dns_timeout(self):
        """Test DNS timeout handling."""
        mock_result = DNSResult(
            domain="slow-dns-server.test",
            has_usable_route=False,
            status="timeout",
            error_detail="DNS MX query timed out after 3.0s"
        )
        with patch.object(dns_checker, "lookup_mail_routing", return_value=mock_result):
            res = dns_checker.lookup_mail_routing("slow-dns-server.test")
            self.assertFalse(res.has_usable_route)
            self.assertEqual(res.status, "timeout")

    def test_06_temporary_dns_failure(self):
        """Test temporary DNS failure / SERVFAIL handling."""
        mock_result = DNSResult(
            domain="broken-nameserver.test",
            has_usable_route=False,
            status="temporary_failure",
            error_detail="DNS temporary failure / SERVFAIL"
        )
        with patch.object(dns_checker, "lookup_mail_routing", return_value=mock_result):
            res = dns_checker.lookup_mail_routing("broken-nameserver.test")
            self.assertFalse(res.has_usable_route)
            self.assertEqual(res.status, "temporary_failure")

    def test_fallback_a_record_routing(self):
        """Test RFC 5321 fallback A record when MX is absent."""
        mock_result = DNSResult(
            domain="fallback.test",
            has_usable_route=True,
            status="ok",
            mx_records=[],
            fallback_records=["192.0.2.1"],
            error_detail="Using RFC 5321 fallback A/AAAA address"
        )
        with patch.object(dns_checker, "lookup_mail_routing", return_value=mock_result):
            res = dns_checker.lookup_mail_routing("fallback.test")
            self.assertTrue(res.has_usable_route)
            self.assertEqual(res.status, "ok")
            self.assertEqual(len(res.fallback_records), 1)

if __name__ == "__main__":
    unittest.main()
