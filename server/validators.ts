/**
 * Email syntax validation and batch parsing logic
 * Implements RFC 5321/5322 and RFC 6531/6532 parsing rules.
 */

const LOCAL_PART_REGEX = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export interface ParsedBatchEntry {
  row_number: number;
  original_input: string;
  normalized_email: string | null;
  local_part: string | null;
  domain: string | null;
  is_duplicate: boolean;
  duplicate_count: number;
  syntax_valid: boolean;
  syntax_error: string | null;
  warning: string | null;
}

export function parseInputString(rawText: string): string[] {
  if (!rawText) return [];
  // Split by newline, carriage return, comma, or semicolon
  const tokens = rawText.split(/[\r\n,;]+/);
  const cleaned: string[] = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed) {
      cleaned.push(trimmed);
    }
  }
  return cleaned;
}

export function validateSyntax(emailStr: string): {
  isValid: boolean;
  localPart: string | null;
  domain: string | null;
  error: string | null;
} {
  if (!emailStr) {
    return { isValid: false, localPart: null, domain: null, error: 'Email address is empty' };
  }

  if (emailStr.length > 254) {
    return {
      isValid: false,
      localPart: null,
      domain: null,
      error: `Total email length (${emailStr.length}) exceeds RFC 5321 maximum of 254 characters`,
    };
  }

  if (!emailStr.includes('@')) {
    return { isValid: false, localPart: null, domain: null, error: "Missing '@' symbol in email address" };
  }

  const parts = emailStr.split('@');
  if (parts.length !== 2) {
    return { isValid: false, localPart: null, domain: null, error: "Email contains multiple '@' characters" };
  }

  const [localPart, rawDomain] = parts;

  // Local part validation
  if (!localPart) {
    return { isValid: false, localPart: null, domain: null, error: "Local part (username before '@') is empty" };
  }

  if (localPart.length > 64) {
    return {
      isValid: false,
      localPart: null,
      domain: null,
      error: `Local part length (${localPart.length}) exceeds maximum of 64 characters`,
    };
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { isValid: false, localPart: null, domain: null, error: 'Local part cannot start or end with a period' };
  }

  if (localPart.includes('..')) {
    return { isValid: false, localPart: null, domain: null, error: 'Local part cannot contain consecutive periods' };
  }

  const isQuoted = localPart.startsWith('"') && localPart.endsWith('"') && localPart.length >= 2;
  if (!isQuoted && !LOCAL_PART_REGEX.test(localPart)) {
    return { isValid: false, localPart: null, domain: null, error: 'Local part contains invalid characters' };
  }

  // Domain validation
  if (!rawDomain) {
    return { isValid: false, localPart: null, domain: null, error: "Domain part (after '@') is empty" };
  }

  if (rawDomain.length > 253) {
    return {
      isValid: false,
      localPart: null,
      domain: null,
      error: `Domain length (${rawDomain.length}) exceeds maximum of 253 characters`,
    };
  }

  if (rawDomain.startsWith('.') || rawDomain.endsWith('.')) {
    return { isValid: false, localPart: null, domain: null, error: 'Domain cannot start or end with a period' };
  }

  if (rawDomain.includes('..')) {
    return { isValid: false, localPart: null, domain: null, error: 'Domain cannot contain consecutive periods' };
  }

  // Handle internationalized domains / ASCII conversion
  let asciiDomain = rawDomain.toLowerCase();
  try {
    // If URL/punycode conversion is needed
    if (/[^\x00-\x7F]/.test(asciiDomain)) {
      // Convert unicode domain using URL
      const dummy = new URL(`http://${asciiDomain}`);
      asciiDomain = dummy.hostname;
    }
  } catch (err) {
    return {
      isValid: false,
      localPart: null,
      domain: null,
      error: `Invalid internationalized domain name: ${(err as Error).message}`,
    };
  }

  const labels = asciiDomain.split('.');
  if (labels.length < 2) {
    return { isValid: false, localPart: null, domain: null, error: 'Domain must contain at least one dot separating labels' };
  }

  for (const label of labels) {
    if (!label) {
      return { isValid: false, localPart: null, domain: null, error: 'Domain label cannot be empty' };
    }
    if (label.length > 63) {
      return { isValid: false, localPart: null, domain: null, error: `Domain label '${label}' exceeds maximum 63 characters` };
    }
    if (!DOMAIN_LABEL_REGEX.test(label)) {
      return { isValid: false, localPart: null, domain: null, error: `Domain label '${label}' contains invalid characters or leading/trailing hyphens` };
    }
  }

  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) {
    return { isValid: false, localPart: null, domain: null, error: 'Top-level domain cannot be entirely numeric' };
  }

  if (tld.length < 2) {
    return { isValid: false, localPart: null, domain: null, error: `Top-level domain '${tld}' must be at least 2 characters long` };
  }

  return {
    isValid: true,
    localPart,
    domain: asciiDomain,
    error: null,
  };
}

export function processBatchEntries(rawEmails: string[]): ParsedBatchEntry[] {
  const seenCounts: Record<string, number> = {};
  const firstSeenIndex: Record<string, number> = {};

  for (let idx = 0; idx < rawEmails.length; idx++) {
    const key = rawEmails[idx].trim().toLowerCase();
    if (seenCounts[key]) {
      seenCounts[key]++;
    } else {
      seenCounts[key] = 1;
      firstSeenIndex[key] = idx;
    }
  }

  const processed: ParsedBatchEntry[] = [];
  const currentCounts: Record<string, number> = {};

  for (let idx = 0; idx < rawEmails.length; idx++) {
    const raw = rawEmails[idx];
    const key = raw.trim().toLowerCase();
    const isDup = seenCounts[key] > 1;
    currentCounts[key] = (currentCounts[key] || 0) + 1;
    const dupIndex = currentCounts[key];

    const { isValid, localPart, domain, error } = validateSyntax(raw.trim());

    let warning: string | null = null;
    if (isDup) {
      if (dupIndex === 1) {
        warning = `Duplicate entry: appears ${seenCounts[key]} times in this batch`;
      } else {
        warning = `Duplicate entry (#${dupIndex}): first appeared at row ${firstSeenIndex[key] + 1}`;
      }
    }

    const normalizedEmail = isValid && localPart && domain ? `${localPart}@${domain}` : null;

    processed.push({
      row_number: idx + 1,
      original_input: raw,
      normalized_email: normalizedEmail,
      local_part: localPart,
      domain,
      is_duplicate: isDup,
      duplicate_count: seenCounts[key],
      syntax_valid: isValid,
      syntax_error: error,
      warning,
    });
  }

  return processed;
}
