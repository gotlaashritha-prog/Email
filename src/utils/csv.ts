/**
 * Safe CSV Export Utility
 * Implements RFC 4180 compliance and OWASP formula injection protection.
 */

import { DeliverabilityResultItem } from '../types';

/**
 * Escapes a cell value for CSV output.
 * If the cell starts with formula characters (=, +, -, @),
 * prepends a single quote (') to mitigate spreadsheet formula injection.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // OWASP CSV Injection defense:
  // Disarm spreadsheet formulas that could execute commands in Excel, Calc, or Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Double quotes must be escaped by another double quote
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateDeliverabilityCsv(results: DeliverabilityResultItem[]): string {
  const headers = [
    'Row #',
    'Email Address',
    'Classification Status',
    'Reason Code',
    'Explanation',
    'Syntax Valid',
    'DNS Status',
    'MX Records',
    'Fallback Routing (A/AAAA)',
    'SMTP Status',
    'Is Duplicate',
    'Duplicate Count',
    'Checks Performed',
    'Warning',
  ];

  const headerLine = headers.map(escapeCsvCell).join(',');

  const rowLines = results.map((item) => {
    const mxSummary = item.mx_records.length > 0
      ? item.mx_records.map((r) => `${r.exchange} (prio:${r.priority})`).join('; ')
      : 'None';

    const fallbackSummary = item.fallback_records.length > 0
      ? item.fallback_records.join('; ')
      : 'None';

    const checksSummary = item.checks_performed.join('; ');

    const cells = [
      item.row_number,
      item.original_input,
      item.status,
      item.reason_code,
      item.explanation,
      item.syntax_valid ? 'Yes' : 'No',
      item.dns_status,
      mxSummary,
      fallbackSummary,
      item.smtp_status,
      item.is_duplicate ? 'Yes' : 'No',
      item.duplicate_count,
      checksSummary,
      item.warning || '',
    ];

    return cells.map(escapeCsvCell).join(',');
  });

  return [headerLine, ...rowLines].join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  // UTF-8 BOM helps Excel recognize encoding immediately
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
