/**
 * DNS Mail-Routing Resolution Module (Node.js)
 * Queries MX records and RFC 5321 fallback A/AAAA records.
 */

import dns from 'dns';
import { MXRecord } from './types.ts';

export interface DNSResolutionResult {
  domain: string;
  has_usable_route: boolean;
  status: 'ok' | 'no_route' | 'timeout' | 'temporary_failure';
  mx_records: MXRecord[];
  fallback_records: string[];
  error_detail: string | null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const err = new Error(`DNS resolution timed out after ${timeoutMs}ms for ${label}`);
        (err as any).code = 'ETIMEOUT';
        reject(err);
      }, timeoutMs);
    }),
  ]);
}

export async function lookupMailRouting(
  domain: string,
  timeoutMs = 3000
): Promise<DNSResolutionResult> {
  // 1. Resolve MX records
  try {
    const rawMx = await withTimeout(
      dns.promises.resolveMx(domain),
      timeoutMs,
      `MX:${domain}`
    );

    const sortedMx: MXRecord[] = rawMx
      .map((r) => ({
        exchange: r.exchange.replace(/\.$/, '').toLowerCase(),
        priority: r.priority,
      }))
      .sort((a, b) => a.priority - b.priority);

    // Null MX check (RFC 7505: priority 0, exchange "." or empty)
    if (sortedMx.length === 1 && (sortedMx[0].exchange === '' || sortedMx[0].exchange === '.') && sortedMx[0].priority === 0) {
      return {
        domain,
        has_usable_route: false,
        status: 'no_route',
        mx_records: sortedMx,
        fallback_records: [],
        error_detail: 'Domain advertises explicit Null MX (RFC 7505) stating it does not accept email',
      };
    }

    if (sortedMx.length > 0) {
      return {
        domain,
        has_usable_route: true,
        status: 'ok',
        mx_records: sortedMx,
        fallback_records: [],
        error_detail: null,
      };
    }
  } catch (err: any) {
    const code = err.code || '';
    const message = (err.message || '').toLowerCase();

    if (code === 'ETIMEOUT' || message.includes('timed out')) {
      return {
        domain,
        has_usable_route: false,
        status: 'timeout',
        mx_records: [],
        fallback_records: [],
        error_detail: `DNS MX query timed out after ${timeoutMs}ms`,
      };
    }

    if (code === 'SERVFAIL' || message.includes('servfail') || code === 'EAI_AGAIN') {
      return {
        domain,
        has_usable_route: false,
        status: 'temporary_failure',
        mx_records: [],
        fallback_records: [],
        error_detail: `Temporary DNS failure / SERVFAIL querying ${domain}`,
      };
    }

    if (code === 'ENOTFOUND') {
      // Domain does not exist (NXDOMAIN)
      return {
        domain,
        has_usable_route: false,
        status: 'no_route',
        mx_records: [],
        fallback_records: [],
        error_detail: 'Domain does not exist (NXDOMAIN)',
      };
    }

    // If ENODATA or no MX answer, fall through to check RFC 5321 fallback A/AAAA records
  }

  // 2. Fallback routing via A/AAAA records (RFC 5321 §5.1 implicit MX)
  const fallbackIps: string[] = [];
  try {
    const aRecords = await withTimeout(
      dns.promises.resolve4(domain).catch(() => []),
      timeoutMs,
      `A:${domain}`
    );
    fallbackIps.push(...aRecords);
  } catch (err: any) {
    if (err.code === 'ETIMEOUT') {
      return {
        domain,
        has_usable_route: false,
        status: 'timeout',
        mx_records: [],
        fallback_records: [],
        error_detail: `DNS fallback A record query timed out`,
      };
    }
  }

  if (fallbackIps.length === 0) {
    try {
      const aaaaRecords = await withTimeout(
        dns.promises.resolve6(domain).catch(() => []),
        timeoutMs,
        `AAAA:${domain}`
      );
      fallbackIps.push(...aaaaRecords);
    } catch {
      // Ignore ipv6 fallback errors
    }
  }

  if (fallbackIps.length > 0) {
    return {
      domain,
      has_usable_route: true,
      status: 'ok',
      mx_records: [],
      fallback_records: fallbackIps,
      error_detail: 'No MX record found; utilizing RFC 5321 fallback host A/AAAA routing',
    };
  }

  return {
    domain,
    has_usable_route: false,
    status: 'no_route',
    mx_records: [],
    fallback_records: [],
    error_detail: 'Domain has neither MX records nor fallback A/AAAA records',
  };
}
