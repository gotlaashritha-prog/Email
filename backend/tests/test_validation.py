"""
Unit tests for email syntax validation and batch processing.
Covers:
- Valid email syntax
- Invalid email syntax
- Length boundary checks
- Multiple and duplicate email batch parsing
- Empty input
"""
import unittest
from backend.app.validators import validate_syntax, parse_input_string, process_batch_entries

class TestValidation(unittest.TestCase):
    
    def test_01_valid_email_syntax(self):
        """Test standard and internationalized valid email formats."""
        valid_samples = [
            "user@example.com",
            "first.last@company.org",
            "support+tag123@sub.domain.co.uk",
            "engineering-team@dev.io",
            "user_name@service.net"
        ]
        for email in valid_samples:
            is_valid, local_p, dom, err = validate_syntax(email)
            self.assertTrue(is_valid, f"Expected {email} to be valid, got error: {err}")
            self.assertIsNotNone(local_p)
            self.assertIsNotNone(dom)
            self.assertIsNone(err)

    def test_02_invalid_email_syntax(self):
        """Test clearly invalid email syntax patterns."""
        invalid_samples = [
            ("plainaddress", "Missing '@' symbol"),
            ("@missinglocal.com", "Local part"),
            ("missingdomain@", "Domain part"),
            ("user@.leadingdot.com", "Domain cannot start or end with a period"),
            ("user@trailingdot.com.", "Domain cannot start or end with a period"),
            ("user..double@example.com", "consecutive periods"),
            ("user@domain..double.com", "consecutive periods"),
            ("user@nodot", "Domain must contain at least one dot"),
            ("user@123.456", "Top-level domain cannot be entirely numeric")
        ]
        for email, expected_substr in invalid_samples:
            is_valid, local_p, dom, err = validate_syntax(email)
            self.assertFalse(is_valid, f"Expected {email} to be invalid")
            self.assertIn(expected_substr.lower(), (err or "").lower())

    def test_10_multiple_addresses_in_one_batch(self):
        """Test batch parsing with newlines, commas, and semicolons."""
        raw_text = """
        alice@example.com
        bob@example.org, charlie@example.net;
        david@example.io
        """
        parsed = parse_input_string(raw_text)
        self.assertEqual(len(parsed), 4)
        self.assertEqual(parsed[0], "alice@example.com")
        self.assertEqual(parsed[1], "bob@example.org")
        self.assertEqual(parsed[2], "charlie@example.net")
        self.assertEqual(parsed[3], "david@example.io")

    def test_11_duplicate_addresses_and_order_preservation(self):
        """Test duplicate identification while preserving exact original order."""
        emails = [
            "team@example.com",
            "user@test.org",
            "team@example.com", # duplicate
            "other@example.com",
            "TEAM@EXAMPLE.COM"  # case-insensitive duplicate
        ]
        processed = process_batch_entries(emails)
        self.assertEqual(len(processed), 5)
        # Check original order preserved
        self.assertEqual(processed[0]["original_input"], "team@example.com")
        self.assertEqual(processed[1]["original_input"], "user@test.org")
        self.assertEqual(processed[2]["original_input"], "team@example.com")
        
        # Check duplicate flags
        self.assertTrue(processed[0]["is_duplicate"])
        self.assertFalse(processed[1]["is_duplicate"])
        self.assertTrue(processed[2]["is_duplicate"])
        self.assertTrue(processed[4]["is_duplicate"])
        self.assertEqual(processed[0]["duplicate_count"], 3)
        self.assertEqual(processed[2]["duplicate_count"], 3)

    def test_12_empty_input(self):
        """Test that empty or whitespace-only strings return empty lists."""
        self.assertEqual(parse_input_string(""), [])
        self.assertEqual(parse_input_string("   \n\n  \t  "), [])
        self.assertEqual(parse_input_string(",,,;;;"), [])

if __name__ == "__main__":
    unittest.main()
