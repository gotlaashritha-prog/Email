/**
 * Shared Type Definitions for Deliverability Checking
 */

export type ClassificationStatus = 'Likely Delivered' | 'Likely to Bounce' | 'Unknown';

export type ReasonCode =
  | 'VALID_MX_FOUND'
  | 'FALLBACK_A_FOUND'
  | 'SYNTAX_INVALID'
  | 'NO_MAIL_ROUTE'
  | 'DNS_TIMEOUT'
  | 'DNS_TEMPORARY_FAILURE'
  | 'CATCH_ALL_DETECTED'
  | 'SMTP_MAILBOX_REJECTED'
  | 'SMTP_INCONCLUSIVE'
  | 'SMTP_TIMEOUT_OR_BLOCKED'
  | 'SMTP_DISABLED_UNKNOWN';

export interface MXRecord {
  exchange: string;
  priority: number;
}

export interface DeliverabilityResultItem {
  row_number: number;
  original_input: string;
  normalized_email: string | null;
  local_part: string | null;
  domain: string | null;
  is_duplicate: boolean;
  duplicate_count: number;
  status: ClassificationStatus;
  reason_code: ReasonCode;
  explanation: string;
  syntax_valid: boolean;
  syntax_error: string | null;
  dns_checked: boolean;
  mx_records: MXRecord[];
  fallback_records: string[];
  dns_status: 'ok' | 'no_route' | 'timeout' | 'temporary_failure' | 'skipped';
  smtp_checked: boolean;
  smtp_status: 'not_performed' | 'mailbox_verified' | 'mailbox_rejected' | 'catch_all' | 'inconclusive' | 'blocked_or_timeout' | 'error';
  checks_performed: string[];
  warning: string | null;
}

export interface SummaryCounts {
  likely_delivered: number;
  likely_to_bounce: number;
  unknown: number;
}

export interface CheckEmailsResponse {
  total_submitted: number;
  unique_count: number;
  duplicate_count: number;
  valid_syntax_count: number;
  invalid_syntax_count: number;
  summary: SummaryCounts;
  results: DeliverabilityResultItem[];
  execution_time_ms: number;
  smtp_enabled: boolean;
  timestamp: string;
}

export interface CapabilitiesResponse {
  service: string;
  version: string;
  max_batch_size: number;
  dns_check_enabled: boolean;
  smtp_check_enabled: boolean;
  fallback_routing_supported: boolean;
  rate_limit_per_minute: number;
  notes: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptime_seconds?: number;
}
