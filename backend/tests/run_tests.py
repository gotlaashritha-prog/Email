#!/usr/bin/env python3
"""
MailCheck Automated Test Suite Runner.
Executes all unit and integration tests across the 18 required scenarios:
1. Valid email syntax
2. Invalid email syntax
3. Address with usable MX record
4. Domain with no usable mail route
5. DNS timeout
6. Temporary DNS failure (SERVFAIL)
7. Inconclusive SMTP response
8. SMTP connection timeout
9. Catch-all mail server scenario
10. Multiple addresses in one batch
11. Duplicate addresses
12. Empty input
13. Malformed JSON / missing request fields
14. Batch-size limit enforcement
15. Correct status summary counts
16. CSV export escaping
17. Unknown classification when SMTP is unavailable
18. API health and capabilities endpoints
"""
import sys
import os
import unittest

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

def main():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Load test modules
    from backend.tests.test_validation import TestValidation
    from backend.tests.test_dns import TestDNS
    from backend.tests.test_classifier import TestClassifier
    from backend.tests.test_api import TestAPI

    suite.addTests(loader.loadTestsFromTestCase(TestValidation))
    suite.addTests(loader.loadTestsFromTestCase(TestDNS))
    suite.addTests(loader.loadTestsFromTestCase(TestClassifier))
    suite.addTests(loader.loadTestsFromTestCase(TestAPI))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "="*60)
    print(f"Total Tests Run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*60)
    
    if result.wasSuccessful():
        print("ALL 18 REQUIRED TEST CRITERIA PASSED SUCCESSFULLY.")
        sys.exit(0)
    else:
        print("TEST SUITE ENCOUNTERED FAILURES.")
        sys.exit(1)

if __name__ == "__main__":
    main()
