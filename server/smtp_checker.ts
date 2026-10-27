/**
 * Safe SMTP probe module (Node.js)
 * Only probes mail servers if ENABLE_SMTP_CHECK is explicitly 'true'.
 * Adheres to safety constraints:
 * - Never delivers emails or sends message bodies (no DATA command)
 * - Strict 3.0s timeout
 * - Detects catch-all configurations
 * - Interprets timeouts, firewalls, and 4xx greylisting as Unknown
 */

import net from 'net';
import crypto from 'crypto';

export interface SMTPProbeResult {
  performed: boolean;
  status: 'not_performed' | 'mailbox_verified' | 'mailbox_rejected' | 'catch_all' | 'inconclusive' | 'blocked_or_timeout' | 'error';
  response_code: number | null;
  response_message: string | null;
  is_catch_all: boolean;
  detail: string;
}

export async function probeSmtp(
  email: string,
  mxHost: string,
  timeoutMs = 3000
): Promise<SMTPProbeResult> {
  const isEnabled = process.env.ENABLE_SMTP_CHECK === 'true' || process.env.ENABLE_SMTP_CHECK === '1';

  if (!isEnabled) {
    return {
      performed: false,
      status: 'not_performed',
      response_code: null,
      response_message: null,
      is_catch_all: false,
      detail: 'SMTP verification is disabled by host configuration (ENABLE_SMTP_CHECK=false).',
    };
  }

  return new Promise<SMTPProbeResult>((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;
    let buffer = '';
    let step = 0; // 0: banner, 1: ehlo, 2: mail from, 3: rcpt to, 4: quit
    let isCatchAll = false;

    const domain = email.split('@')[1] || '';
    const randomLocal = `mailcheck-probe-${crypto.randomBytes(6).toString('hex')}`;
    const testCatchAll = `${randomLocal}@${domain}`;

    const finish = (result: SMTPProbeResult) => {
      if (!isResolved) {
        isResolved = true;
        try {
          socket.write('QUIT\r\n');
        } catch {}
        socket.destroy();
        resolve(result);
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      finish({
        performed: true,
        status: 'blocked_or_timeout',
        response_code: null,
        response_message: null,
        is_catch_all: false,
        detail: `SMTP connection to ${mxHost}:25 timed out. Outbound port 25 may be blocked by network or cloud provider.`,
      });
    });

    socket.on('error', (err: any) => {
      finish({
        performed: true,
        status: 'blocked_or_timeout',
        response_code: null,
        response_message: null,
        is_catch_all: false,
        detail: `SMTP connection to ${mxHost}:25 failed: ${err.message || 'Connection refused or unreachable'}`,
      });
    });

    socket.connect(25, mxHost, () => {
      // Connected, wait for server banner
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\r\n');
      // If last item is not empty, keep incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const code = parseInt(line.substring(0, 3), 10);
        const isLastReplyLine = line.charAt(3) === ' ' || line.length === 3;

        if (!isLastReplyLine) continue;

        if (step === 0 && code === 220) {
          step = 1;
          socket.write('EHLO mailcheck.local\r\n');
        } else if (step === 1 && (code === 250 || code === 220)) {
          // Probe catch-all first
          step = 2;
          socket.write(`MAIL FROM:<probe@mailcheck.local>\r\n`);
        } else if (step === 2 && code === 250) {
          step = 3;
          socket.write(`RCPT TO:<${testCatchAll}>\r\n`);
        } else if (step === 3) {
          if (code === 250) {
            // Random test address was accepted! Domain has catch-all behavior
            isCatchAll = true;
            finish({
              performed: true,
              status: 'catch_all',
              response_code: code,
              response_message: line,
              is_catch_all: true,
              detail: 'Domain operates catch-all routing (accepts arbitrary recipients). Mailbox existence cannot be confirmed.',
            });
            return;
          }
          // Server rejected random address (good, not catch-all). Reset and probe real target
          step = 4;
          socket.write('RSET\r\n');
        } else if (step === 4 && (code === 250 || code === 200)) {
          step = 5;
          socket.write(`MAIL FROM:<probe@mailcheck.local>\r\n`);
        } else if (step === 5 && code === 250) {
          step = 6;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 6) {
          // Response to real recipient probe!
          if (code === 250) {
            finish({
              performed: true,
              status: 'mailbox_verified',
              response_code: code,
              response_message: line,
              is_catch_all: false,
              detail: 'Mail server accepted recipient address in RCPT probe (evidence of deliverability; not a guarantee of delivery).',
            });
          } else if (code >= 550 && code <= 554) {
            finish({
              performed: true,
              status: 'mailbox_rejected',
              response_code: code,
              response_message: line,
              is_catch_all: false,
              detail: `Mail server permanently rejected recipient mailbox (SMTP ${code}): ${line}`,
            });
          } else if (code >= 400 && code < 500) {
            finish({
              performed: true,
              status: 'inconclusive',
              response_code: code,
              response_message: line,
              is_catch_all: false,
              detail: `Mail server returned temporary greylisting or deferral (SMTP ${code}): ${line}`,
            });
          } else {
            finish({
              performed: true,
              status: 'inconclusive',
              response_code: code,
              response_message: line,
              is_catch_all: false,
              detail: `Mail server returned unexpected code (SMTP ${code}): ${line}`,
            });
          }
          return;
        } else if (code >= 500) {
          finish({
            performed: true,
            status: 'inconclusive',
            response_code: code,
            response_message: line,
            is_catch_all: false,
            detail: `SMTP transaction error (code ${code}): ${line}`,
          });
          return;
        }
      }
    });
  });
}
