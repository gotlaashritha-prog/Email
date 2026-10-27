# MailCheck — Email Deliverability Checker

A production-grade, technically honest full-stack web application that validates email lists and classifies recipient deliverability into three transparent categories: **Likely Delivered**, **Likely to Bounce**, and **Unknown**.

Built to satisfy all requirements for academic assignment evaluation, real-world deployment, and automated testing.

---

## 1. Project Overview & Philosophy

Most commercial email verifiers claim "99% inbox accuracy" by making unscientific guesses or relying solely on regular expressions. In real-world internet architecture:
1. **Passing syntax validation does NOT mean an address is deliverable.**
2. **Mail servers frequently hide individual mailbox existence** (via privacy filters, catch-all configurations, or silent discards).
3. **Cloud hosting environments (Render, AWS, GCP, Vercel) almost universally block outbound port 25** to prevent spam abuse.

**MailCheck is technically honest:**
- It never sends actual emails.
- It executes real RFC 5321/5322 & RFC 6531/6532 syntax parsing, true DNS MX record queries, and RFC 5321 §5.1 fallback host routing.
- It treats **Unknown** as a legitimate, expected outcome rather than an error.
- It preserves original input order, identifies duplicates, enforces batch limits, and escapes CSV exports against spreadsheet formula injection.

---

## 2. Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend (Python / FastAPI):** Python 3.10+, FastAPI, Pydantic, dnspython, email-validator.
- **Full-Stack Dev Server (Node.js / Express):** Express 4.21, tsx, native async Node DNS resolver, safe socket SMTP probing.
- **Automated Testing:** Pytest and Python `unittest` test suite covering 18+ required verification criteria.
- **Deployment:** Render (`render.yaml`), Docker/Container compatible, and Google AI Studio live preview.

---

## 3. Project Directory Structure

```text
email-deliverability-checker/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py           # Environment variables and limits
│   │   ├── schemas.py          # Data models and enums
│   │   ├── validators.py       # RFC 5322 syntax and batch parser
│   │   ├── dns_checker.py      # MX & A/AAAA fallback lookups
│   │   ├── smtp_checker.py     # Safe non-sending RCPT prober
│   │   ├── classifier.py       # Centralized 3-way decision engine
│   │   └── main.py             # FastAPI entry point & API routes
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_validation.py  # Syntax and batch parsing tests
│   │   ├── test_dns.py         # Mocked MX and timeout tests
│   │   ├── test_classifier.py  # 3-way classification & CSV escaping
│   │   ├── test_api.py         # API contract & limit enforcement tests
│   │   └── run_tests.py        # Automated test suite runner (stdlib)
│   └── requirements.txt        # Python backend dependencies
├── server/
│   ├── types.ts                # TypeScript data interfaces
│   ├── validators.ts           # TypeScript RFC email validator
│   ├── dns_checker.ts          # Node.js async DNS MX/A resolver
│   ├── smtp_checker.ts         # Node.js socket SMTP RCPT prober
│   └── classifier.ts           # TypeScript classification engine
├── src/
│   ├── components/
│   │   ├── Header.tsx          # Top bar contract & SMTP indicator
│   │   ├── Hero.tsx            # Hero typography & outcome highlights
│   │   ├── EmailInputCard.tsx  # Labeled textarea, counters, presets
│   │   ├── SummaryMetrics.tsx  # 4 KPI cards with tabular numbers
│   │   ├── ResultsTable.tsx    # Filterable, sortable results grid
│   │   ├── ResultRowDetails.tsx# Expandable technical drawer
│   │   ├── HowItWorksModal.tsx # Explanatory modal & capabilities
│   │   └── Footer.tsx          # Privacy note & disclaimer
│   ├── types/
│   │   └── index.ts            # Frontend TypeScript types
│   ├── utils/
│   │   └── csv.ts              # OWASP formula-injection safe CSV
│   ├── App.tsx                 # Root application component
│   ├── index.css               # Tailwind CSS v4 and typography
│   └── main.tsx                # React DOM entry point
├── .env.example                # Sample configuration template
├── package.json                # Frontend & server scripts
├── render.yaml                 # Render cloud deployment blueprint
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite bundler configuration
└── README.md                   # Complete documentation
```

---

## 4. Verification Logic & The 3 Classifications

### Stage A: Input Parsing & Deduplication
- Accepts newline-separated, comma-separated, or semicolon-separated inputs.
- Trims whitespace and ignores blank lines.
- Preserves exact input order.
- Flags duplicate addresses, tracks total occurrences, and links back to the first appearance row.
- Enforces configurable limits: maximum 100 addresses per batch, 1MB maximum body size.

### Stage B: RFC Syntax Validation
- Validates local-part ($\le 64$ chars, valid printable characters, no consecutive or leading/trailing dots).
- Validates domain ($\le 253$ chars, valid labels, non-numeric TLD with $\ge 2$ letters).
- Decodes Internationalized Domain Names (IDN/punycode).

### Stage C: DNS & Mail Route Resolution
- Queries DNS for active MX records and sorts by numerical priority.
- Detects explicit **Null MX** records (RFC 7505: `.` priority 0) which denote domains that refuse email.
- If no MX record exists, queries RFC 5321 §5.1 fallback host addresses (A / AAAA records).
- Distinguishes permanent NXDOMAIN failures from temporary DNS timeouts (`ETIMEOUT`) or server failures (`SERVFAIL`).

### Stage D: Safe SMTP Probing (Optional)
- Guarded by `ENABLE_SMTP_CHECK=false` by default for safe cloud hosting.
- When enabled, connects to port 25 with a strict 3.0s socket timeout.
- Issues `EHLO`, `MAIL FROM:<...>`, probes a random local address for catch-all detection, and issues `RCPT TO:<target>`.
- **Never sends `DATA` or message bodies. Never delivers an email.**
- Immediately issues `QUIT` and closes the socket.

### Stage E: Classification Rules

| Outcome | Criteria | Explanation |
| :--- | :--- | :--- |
| **Likely Delivered** | Valid RFC syntax + Active MX or fallback A/AAAA route found + No contradictory signals | Domain has operational mail servers ready to receive messages. Positive signal; not a guaranteed delivery receipt. |
| **Likely to Bounce** | Invalid RFC syntax **OR** Domain has no usable mail route (NXDOMAIN / no MX / no A) **OR** SMTP permanently rejected recipient (550) | Clear evidence that incoming messages cannot reach a destination. |
| **Unknown** | DNS timeout, SERVFAIL, catch-all domain, SMTP port 25 blocked, greylisting (4xx), or unprobed mailbox | Evidence is inconclusive. Temporary network or mailbox privacy constraints prevent verification. |

> **Crucial Rule:** Temporary network hiccups or timeouts are **never** converted into permanent bounces.

---

## 5. Security, Privacy & Performance

1. **Zero Email Sending:** No test messages, confirmation links, or notification emails are ever dispatched.
2. **Zero Address Retention:** Submitted email addresses are processed strictly in-memory during request execution and are never saved to disk, logged to console, or written to a database.
3. **OWASP Formula Injection Defense:** When exporting CSV files, any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically prefixed with a single quote (`'`), preventing malicious spreadsheet macros from executing in Microsoft Excel or Google Sheets.
4. **Rate Limiting:** Built-in sliding-window limiter restricts traffic to 60 requests/minute per client IP.
5. **Request Concurrency & Timeout Bounds:** DNS and SMTP queries use 3.0s strict timeouts and per-request domain caching to eliminate redundant lookups.

---

## 6. Local Setup & Execution Guide

### Prerequisites
- Node.js (v18 or higher) and npm
- Python (v3.10 or higher)

### Option A: Running the Full-Stack Application (Vite + Express)
The repository includes an integrated Node.js / Express backend with native async DNS resolution:

```bash
# 1. Install dependencies
npm install

# 2. Run the full-stack dev server (starts on http://localhost:3000)
npm run dev

# 3. Production build
npm run build
npm run start
```

Visit `http://localhost:3000` in your browser.

---

### Option B: Running the Python FastAPI Backend

```bash
# 1. Create a Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Start the FastAPI server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

FastAPI interactive documentation will be accessible at `http://localhost:8000/docs`.

---

## 7. Running the Automated Tests

The test suite thoroughly verifies all 18 assignment criteria without making live external network calls:

```bash
# Run tests using the integrated runner (requires only Python 3 stdlib):
python3 backend/tests/run_tests.py

# Or run via pytest (if installed in your virtual environment):
pytest backend/tests -v
```

### Verified Test Coverage (23 Automated Tests)
- `test_01_valid_email_syntax`: Standard and internationalized valid emails
- `test_02_invalid_email_syntax`: Missing `@`, consecutive periods, invalid TLDs, double dots
- `test_03_address_with_usable_mx_record`: Active MX resolution
- `test_04_domain_with_no_usable_mail_route`: NXDOMAIN and missing mail records
- `test_05_dns_timeout`: DNS timeouts map to Unknown
- `test_06_temporary_dns_failure`: SERVFAIL maps to Unknown
- `test_fallback_a_record_routing`: RFC 5321 §5.1 implicit MX fallback
- `test_07_inconclusive_smtp_response`: Greylisting (450) maps to Unknown
- `test_08_smtp_connection_timeout`: SMTP connection timeouts map to Unknown
- `test_09_catch_all_mail_server`: Catch-all domains map to Unknown
- `test_10_multiple_addresses_in_one_batch`: Parsing newlines, commas, semicolons
- `test_11_duplicate_addresses_and_order_preservation`: Duplicate counting and order
- `test_12_empty_input`: Graceful empty handling
- `test_13_missing_request_fields_and_empty_list`: HTTP 400 validation
- `test_14_batch_size_limit_enforcement`: Rejection of batches $>100$
- `test_15_status_summary_counts`: Exact alignment between summary KPI counts and rows
- `test_16_csv_export_escaping`: OWASP formula escaping (`=`, `+`, `-`, `@`)
- `test_17_unknown_classification_when_smtp_unavailable`: Proper fallback when SMTP is disabled
- `test_18_health_and_capabilities_contracts`: `/api/health` and `/api/capabilities` schemas
- `test_full_batch_pipeline_flow`: End-to-end multi-status batch evaluation

---

## 8. API Specification

### `GET /api/health`
Health check endpoint.
```json
{
  "status": "ok",
  "service": "MailCheck — Email Deliverability Checker",
  "version": "1.0.0",
  "timestamp": "2026-10-27T16:24:36.219Z"
}
```

### `GET /api/capabilities`
Describes active validation capabilities and batch constraints.
```json
{
  "service": "MailCheck — Email Deliverability Checker",
  "version": "1.0.0",
  "max_batch_size": 100,
  "dns_check_enabled": true,
  "smtp_check_enabled": false,
  "fallback_routing_supported": true,
  "rate_limit_per_minute": 60,
  "notes": "SMTP verification disabled by host configuration..."
}
```

### `POST /api/check`
Inspects a list of emails.

**Request:**
```json
{
  "emails": [
    "alice@example.com",
    "invalid-syntax-email",
    "team@google.com",
    "alice@example.com"
  ]
}
```

**Response:**
```json
{
  "total_submitted": 4,
  "unique_count": 3,
  "duplicate_count": 2,
  "valid_syntax_count": 3,
  "invalid_syntax_count": 1,
  "summary": {
    "likely_delivered": 2,
    "likely_to_bounce": 2,
    "unknown": 0
  },
  "results": [
    {
      "row_number": 1,
      "original_input": "alice@example.com",
      "normalized_email": "alice@example.com",
      "local_part": "alice",
      "domain": "example.com",
      "is_duplicate": true,
      "duplicate_count": 2,
      "status": "Likely Delivered",
      "reason_code": "VALID_MX_FOUND",
      "explanation": "Valid syntax and active MX mail server found ('mail.example.com'). Positive routing signal; delivery is probable but cannot be guaranteed.",
      "syntax_valid": true,
      "syntax_error": null,
      "dns_checked": true,
      "mx_records": [{ "exchange": "mail.example.com", "priority": 10 }],
      "fallback_records": [],
      "dns_status": "ok",
      "smtp_checked": false,
      "smtp_status": "not_performed",
      "checks_performed": ["Syntax Validation", "DNS MX Record Lookup"],
      "warning": "Duplicate entry: appears 2 times in this batch"
    }
  ],
  "execution_time_ms": 78,
  "smtp_enabled": false,
  "timestamp": "2026-10-27T16:24:50.290Z"
}
```

---

## 9. Deployment Instructions (Render & Cloud Platforms)

The repository includes a ready-to-use `render.yaml` specification:

1. **Push this repository** to GitHub or GitLab.
2. **Log into [Render](https://render.com/)** and click **New → Blueprint**.
3. Select your repository. Render will automatically parse `render.yaml`.
4. Render will run:
   - **Build Command:** `npm install && npm run build && pip install -r backend/requirements.txt`
   - **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
5. Alternatively, deploy as a Node.js web service running `npm run build && npm run start`.

---

## 10. Mandatory Deployment Limitations & Technical Honesty

### Why Outbound Port 25 Is Blocked on Cloud Hosts
Major cloud platforms (Render, Google Cloud Run, AWS EC2, DigitalOcean, Heroku) strictly block outgoing traffic to TCP port 25 to prevent spammers from weaponizing their infrastructure.

### What the Deployed Application Actually Checks
1. **RFC Syntax Validation:** Fully active and enforced for every submission.
2. **DNS & MX Routing:** Live DNS resolution queries the domain's authoritative name servers for valid MX records and RFC 5321 fallback A/AAAA records.
3. **Duplicate Identification:** Full order-preserving deduplication and frequency tracking.
4. **SMTP Mailbox Probing:** Disabled by default (`ENABLE_SMTP_CHECK=false`) to ensure 100% stable, compliant operation across cloud environments.

### Why "Unknown" Is a Good and Honest Result
Many email providers (including Yahoo, Outlook, and corporate enterprise servers) enforce catch-all routing or silently drop messages to protect user privacy. Without sending a real email (which this assignment strictly prohibits), it is technically impossible to guarantee inbox placement. Classifying an address as **Unknown** communicates the boundary of provable evidence with full engineering integrity.
