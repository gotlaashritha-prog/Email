/**
 * Centralized Deliverability Classification Engine (TypeScript)
 * Implements Stage E rules:
 * - Likely Delivered: Valid syntax + usable mail route (MX or fallback A) + non-contradictory signals
 * - Likely to Bounce: Invalid syntax OR permanent delivery failure (no route, or 550 mailbox rejection)
 * - Unknown: DNS timeout, SERVFAIL, catch-all, SMTP timeout/blocked, greylisting, or unconfirmed mailbox
 */

import { DeliverabilityResultItem, ClassificationStatus, ReasonCode } from './types.ts';
import { DNSResolutionResult } from './dns_checker.ts';
import { SMTPProbeResult } from './smtp_checker.ts';

export function classifyEmail(params: {
  row_number: number;
  original_input: string;
  syntax_valid: boolean;
  local_part: string | null;
  domain: string | null;
  syntax_error: string | null;
  is_duplicate: boolean;
  duplicate_count: number;
  dns_result: DNSResolutionResult | null;
  smtp_result: SMTPProbeResult | null;
  warning: string | null;
}): DeliverabilityResultItem {
  const {
    row_number,
    original_input,
    syntax_valid,
    local_part,
    domain,
    syntax_error,
    is_duplicate,
    duplicate_count,
    dns_result,
    smtp_result,
    warning,
  } = params;

  const checks_performed: string[] = ['Syntax Validation'];

  // 1. Syntax Check
  if (!syntax_valid) {
    return {
      row_number,
      original_input,
      normalized_email: null,
      local_part: null,
      domain: null,
      is_duplicate,
      duplicate_count,
      status: 'Likely to Bounce',
      reason_code: 'SYNTAX_INVALID',
      explanation: `Invalid email syntax: ${syntax_error || 'Does not conform to RFC 5322 specifications'}.`,
      syntax_valid: false,
      syntax_error,
      dns_checked: false,
      mx_records: [],
      fallback_records: [],
      dns_status: 'skipped',
      smtp_checked: false,
      smtp_status: 'not_performed',
      checks_performed,
      warning,
    };
  }

  const normalized_email = local_part && domain ? `${local_part}@${domain}` : original_input;

  // 2. DNS Check
  if (!dns_result) {
    return {
      row_number,
      original_input,
      normalized_email,
      local_part,
      domain,
      is_duplicate,
      duplicate_count,
      status: 'Unknown',
      reason_code: 'DNS_TEMPORARY_FAILURE',
      explanation: 'DNS lookup was not performed.',
      syntax_valid: true,
      syntax_error: null,
      dns_checked: false,
      mx_records: [],
      fallback_records: [],
      dns_status: 'skipped',
      smtp_checked: false,
      smtp_status: 'not_performed',
      checks_performed,
      warning,
    };
  }

  checks_performed.push('DNS MX Record Lookup');
  if (dns_result.fallback_records.length > 0) {
    checks_performed.push('Fallback A/AAAA Lookup');
  }

  // DNS Timeout -> Unknown (NEVER bounce!)
  if (dns_result.status === 'timeout') {
    return {
      row_number,
      original_input,
      normalized_email,
      local_part,
      domain,
      is_duplicate,
      duplicate_count,
      status: 'Unknown',
      reason_code: 'DNS_TIMEOUT',
      explanation: `DNS query for domain '${domain}' timed out. Network or nameserver issue prevented verification.`,
      syntax_valid: true,
      syntax_error: null,
      dns_checked: true,
      mx_records: [],
      fallback_records: [],
      dns_status: 'timeout',
      smtp_checked: false,
      smtp_status: 'not_performed',
      checks_performed,
      warning,
    };
  }

  // DNS Temporary Failure / SERVFAIL -> Unknown
  if (dns_result.status === 'temporary_failure') {
    return {
      row_number,
      original_input,
      normalized_email,
      local_part,
      domain,
      is_duplicate,
      duplicate_count,
      status: 'Unknown',
      reason_code: 'DNS_TEMPORARY_FAILURE',
      explanation: `Temporary DNS failure / SERVFAIL resolving domain '${domain}': ${dns_result.error_detail || 'Nameserver error'}.`,
      syntax_valid: true,
      syntax_error: null,
      dns_checked: true,
      mx_records: [],
      fallback_records: [],
      dns_status: 'temporary_failure',
      smtp_checked: false,
      smtp_status: 'not_performed',
      checks_performed,
      warning,
    };
  }

  // No Usable Mail Route -> Likely to Bounce
  if (!dns_result.has_usable_route || dns_result.status === 'no_route') {
    return {
      row_number,
      original_input,
      normalized_email,
      local_part,
      domain,
      is_duplicate,
      duplicate_count,
      status: 'Likely to Bounce',
      reason_code: 'NO_MAIL_ROUTE',
      explanation: `Domain '${domain}' has no usable mail route (${dns_result.error_detail || 'No MX or fallback host records found'}). Emails will bounce.`,
      syntax_valid: true,
      syntax_error: null,
      dns_checked: true,
      mx_records: dns_result.mx_records,
      fallback_records: dns_result.fallback_records,
      dns_status: 'no_route',
      smtp_checked: false,
      smtp_status: 'not_performed',
      checks_performed,
      warning,
    };
  }

  // 3. SMTP Check (if performed)
  if (smtp_result && smtp_result.performed) {
    checks_performed.push('SMTP Mailbox Verification');

    if (smtp_result.status === 'mailbox_rejected') {
      return {
        row_number,
        original_input,
        normalized_email,
        local_part,
        domain,
        is_duplicate,
        duplicate_count,
        status: 'Likely to Bounce',
        reason_code: 'SMTP_MAILBOX_REJECTED',
        explanation: `Mail server permanently rejected recipient mailbox (SMTP ${smtp_result.response_code || 550}): ${smtp_result.detail}`,
        syntax_valid: true,
        syntax_error: null,
        dns_checked: true,
        mx_records: dns_result.mx_records,
        fallback_records: dns_result.fallback_records,
        dns_status: 'ok',
        smtp_checked: true,
        smtp_status: 'mailbox_rejected',
        checks_performed,
        warning,
      };
    }

    if (smtp_result.status === 'catch_all') {
      return {
        row_number,
        original_input,
        normalized_email,
        local_part,
        domain,
        is_duplicate,
        duplicate_count,
        status: 'Unknown',
        reason_code: 'CATCH_ALL_DETECTED',
        explanation: 'Domain operates catch-all routing (accepts arbitrary recipients). Mailbox existence cannot be individually determined.',
        syntax_valid: true,
        syntax_error: null,
        dns_checked: true,
        mx_records: dns_result.mx_records,
        fallback_records: dns_result.fallback_records,
        dns_status: 'ok',
        smtp_checked: true,
        smtp_status: 'catch_all',
        checks_performed,
        warning,
      };
    }

    if (smtp_result.status === 'blocked_or_timeout' || smtp_result.status === 'error') {
      return {
        row_number,
        original_input,
        normalized_email,
        local_part,
        domain,
        is_duplicate,
        duplicate_count,
        status: 'Unknown',
        reason_code: 'SMTP_TIMEOUT_OR_BLOCKED',
        explanation: `Mail route exists, but SMTP probe timed out or outbound port 25 is restricted: ${smtp_result.detail}`,
        syntax_valid: true,
        syntax_error: null,
        dns_checked: true,
        mx_records: dns_result.mx_records,
        fallback_records: dns_result.fallback_records,
        dns_status: 'ok',
        smtp_checked: true,
        smtp_status: smtp_result.status,
        checks_performed,
        warning,
      };
    }

    if (smtp_result.status === 'inconclusive') {
      return {
        row_number,
        original_input,
        normalized_email,
        local_part,
        domain,
        is_duplicate,
        duplicate_count,
        status: 'Unknown',
        reason_code: 'SMTP_INCONCLUSIVE',
        explanation: `SMTP verification inconclusive (greylisting or anti-spam response): ${smtp_result.detail}`,
        syntax_valid: true,
        syntax_error: null,
        dns_checked: true,
        mx_records: dns_result.mx_records,
        fallback_records: dns_result.fallback_records,
        dns_status: 'ok',
        smtp_checked: true,
        smtp_status: 'inconclusive',
        checks_performed,
        warning,
      };
    }
  }

  // 4. Standard Positive Signal: Usable mail route exists
  if (dns_result.mx_records.length > 0) {
    const primary = dns_result.mx_records[0].exchange;
    return {
      row_number,
      original_input,
      normalized_email,
      local_part,
      domain,
      is_duplicate,
      duplicate_count,
      status: 'Likely Delivered',
      reason_code: 'VALID_MX_FOUND',
      explanation: `Valid syntax and active MX mail server found ('${primary}'). Positive routing signal; delivery is probable but cannot be guaranteed.`,
      syntax_valid: true,
      syntax_error: null,
      dns_checked: true,
      mx_records: dns_result.mx_records,
      fallback_records: [],
      dns_status: 'ok',
      smtp_checked: Boolean(smtp_result && smtp_result.performed),
      smtp_status: smtp_result ? smtp_result.status : 'not_performed',
      checks_performed,
      warning,
    };
  }

  if (dns_result.fallback_records.length > 0) {
    return {
      row_number,
      original_input,
      normalized_email,
      local_part,
      domain,
      is_duplicate,
      duplicate_count,
      status: 'Likely Delivered',
      reason_code: 'FALLBACK_A_FOUND',
      explanation: `Valid syntax and RFC 5321 fallback A/AAAA host address found ('${dns_result.fallback_records[0]}'). Delivery is probable.`,
      syntax_valid: true,
      syntax_error: null,
      dns_checked: true,
      mx_records: [],
      fallback_records: dns_result.fallback_records,
      dns_status: 'ok',
      smtp_checked: Boolean(smtp_result && smtp_result.performed),
      smtp_status: smtp_result ? smtp_result.status : 'not_performed',
      checks_performed,
      warning,
    };
  }

  return {
    row_number,
    original_input,
    normalized_email,
    local_part,
    domain,
    is_duplicate,
    duplicate_count,
    status: 'Unknown',
    reason_code: 'SMTP_DISABLED_UNKNOWN',
    explanation: 'Routing status could not be conclusively determined.',
    syntax_valid: true,
    syntax_error: null,
    dns_checked: true,
    mx_records: [],
    fallback_records: [],
    dns_status: 'ok',
    smtp_checked: false,
    smtp_status: 'not_performed',
    checks_performed,
    warning,
  };
}
