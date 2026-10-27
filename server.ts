/**
 * MailCheck — Full-Stack Server
 * Express Server with native Vite middleware integration.
 * Performs real email deliverability checks:
 * - RFC 5321/5322 & RFC 6531/6532 syntax validation
 * - Native async DNS MX and fallback A/AAAA lookups
 * - Safe SMTP probing (when configured)
 * - Transparent 3-way classification
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { parseInputString, processBatchEntries } from './server/validators.ts';
import { lookupMailRouting, DNSResolutionResult } from './server/dns_checker.ts';
import { probeSmtp, SMTPProbeResult } from './server/smtp_checker.ts';
import { classifyEmail } from './server/classifier.ts';
import {
  CheckEmailsResponse,
  CapabilitiesResponse,
  HealthResponse,
  DeliverabilityResultItem,
} from './server/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '100', 10);
const ENABLE_SMTP_CHECK =
  process.env.ENABLE_SMTP_CHECK === 'true' || process.env.ENABLE_SMTP_CHECK === '1';

// In-memory rate limiter: max 60 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function rateLimiter(req: Request, res: Response, next: () => void) {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let clientRecord = rateLimitMap.get(ip);
  if (!clientRecord || now > clientRecord.resetTime) {
    clientRecord = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, clientRecord);
  } else {
    clientRecord.count++;
  }

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - clientRecord.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(clientRecord.resetTime / 1000));

  if (clientRecord.count > RATE_LIMIT_MAX) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again after ${Math.ceil((clientRecord.resetTime - now) / 1000)} seconds.`,
    });
    return;
  }

  next();
}

async function startServer() {
  const app = express();

  // Enforce body size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Apply rate limiting to all /api routes
  app.use('/api', rateLimiter);

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response<HealthResponse>) => {
    res.json({
      status: 'ok',
      service: 'MailCheck — Email Deliverability Checker',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
    });
  });

  // Capabilities endpoint
  app.get('/api/capabilities', (_req: Request, res: Response<CapabilitiesResponse>) => {
    res.json({
      service: 'MailCheck — Email Deliverability Checker',
      version: '1.0.0',
      max_batch_size: MAX_BATCH_SIZE,
      dns_check_enabled: true,
      smtp_check_enabled: ENABLE_SMTP_CHECK,
      fallback_routing_supported: true,
      rate_limit_per_minute: RATE_LIMIT_MAX,
      notes: ENABLE_SMTP_CHECK
        ? 'SMTP verification active. Safe RCPT probes executed with 3.0s timeout.'
        : 'SMTP verification disabled by host configuration. Deliverability determined via RFC syntax validation and DNS MX/A fallback inspection.',
    });
  });

  // Email check endpoint
  app.post('/api/check', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { emails } = req.body || {};

      if (!emails) {
        res.status(400).json({
          error: 'Validation Error',
          message: "Request must include 'emails' field containing email addresses.",
        });
        return;
      }

      let emailList: string[] = [];
      if (typeof emails === 'string') {
        emailList = parseInputString(emails);
      } else if (Array.isArray(emails)) {
        for (const item of emails) {
          if (typeof item === 'string') {
            emailList.push(...parseInputString(item));
          }
        }
      } else {
        res.status(400).json({
          error: 'Validation Error',
          message: "'emails' must be an array of strings or a single formatted string.",
        });
        return;
      }

      if (emailList.length === 0) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'No valid email addresses provided. Please enter at least one email address.',
        });
        return;
      }

      if (emailList.length > MAX_BATCH_SIZE) {
        res.status(400).json({
          error: 'Validation Error',
          message: `Batch size of ${emailList.length} exceeds maximum limit of ${MAX_BATCH_SIZE} addresses per request.`,
        });
        return;
      }

      // Stage A & B: Batch Parsing, Duplicate Tracking, and RFC Syntax Checking
      const batchEntries = processBatchEntries(emailList);

      // Per-request DNS cache so multiple emails with same domain only query once
      const dnsCache = new Map<string, Promise<DNSResolutionResult>>();

      const results: DeliverabilityResultItem[] = [];

      // Process all entries with bounded concurrency
      for (const entry of batchEntries) {
        let dnsResult: DNSResolutionResult | null = null;
        let smtpResult: SMTPProbeResult | null = null;

        if (entry.syntax_valid && entry.domain) {
          if (!dnsCache.has(entry.domain)) {
            dnsCache.set(entry.domain, lookupMailRouting(entry.domain));
          }
          dnsResult = await dnsCache.get(entry.domain)!;

          if (dnsResult.has_usable_route && ENABLE_SMTP_CHECK && dnsResult.mx_records.length > 0) {
            const primaryMx = dnsResult.mx_records[0].exchange;
            const targetEmail = entry.normalized_email || `${entry.local_part}@${entry.domain}`;
            smtpResult = await probeSmtp(targetEmail, primaryMx);
          }
        }

        const classified = classifyEmail({
          row_number: entry.row_number,
          original_input: entry.original_input,
          syntax_valid: entry.syntax_valid,
          local_part: entry.local_part,
          domain: entry.domain,
          syntax_error: entry.syntax_error,
          is_duplicate: entry.is_duplicate,
          duplicate_count: entry.duplicate_count,
          dns_result: dnsResult,
          smtp_result: smtpResult,
          warning: entry.warning,
        });

        results.push(classified);
      }

      // Calculate response summary metrics
      const total_submitted = results.length;
      const unique_count = new Set(results.map((r) => r.original_input.trim().toLowerCase())).size;
      const duplicate_count = results.filter((r) => r.is_duplicate).length;
      const valid_syntax_count = results.filter((r) => r.syntax_valid).length;
      const invalid_syntax_count = total_submitted - valid_syntax_count;

      const likely_delivered = results.filter((r) => r.status === 'Likely Delivered').length;
      const likely_to_bounce = results.filter((r) => r.status === 'Likely to Bounce').length;
      const unknown = results.filter((r) => r.status === 'Unknown').length;

      const responsePayload: CheckEmailsResponse = {
        total_submitted,
        unique_count,
        duplicate_count,
        valid_syntax_count,
        invalid_syntax_count,
        summary: {
          likely_delivered,
          likely_to_bounce,
          unknown,
        },
        results,
        execution_time_ms: Date.now() - startTime,
        smtp_enabled: ENABLE_SMTP_CHECK,
        timestamp: new Date().toISOString(),
      };

      res.json(responsePayload);
    } catch (err: any) {
      console.error('Error during email verification batch:', err.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing the verification batch.',
      });
    }
  });

  // Frontend mounting: Vite dev middleware in development, static in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MailCheck server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});
