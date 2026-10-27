import React from 'react';
import { X, CheckCircle, AlertTriangle, HelpCircle, Shield, Server, FileText } from 'lucide-react';
import { CapabilitiesResponse } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  capabilities: CapabilitiesResponse | null;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  isOpen,
  onClose,
  capabilities,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">How MailCheck Works</h2>
              <p className="text-xs text-slate-500">Layered verification logic & technical honesty</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-600 max-h-[75vh] overflow-y-auto">
          {/* Layered Pipeline */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              The 4-Stage Verification Pipeline
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono">1</span>
                  <span>Stage A & B: Input Parsing & RFC Syntax Validation</span>
                </div>
                <p className="text-slate-600 pl-7">
                  Parses batch entries, deduplicates inputs while preserving order, and validates local-part and domain labels against RFC 5321/5322 and RFC 6531/6532 internationalized domain standards.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono">2</span>
                  <span>Stage C: DNS MX & Fallback A/AAAA Mail Routing</span>
                </div>
                <p className="text-slate-600 pl-7">
                  Resolves active MX records for the domain. If no MX records exist, checks RFC 5321 §5.1 fallback host routing (implicit MX). Differentiates NXDOMAIN permanent failures from temporary DNS timeouts and SERVFAIL errors.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono">3</span>
                  <span>Stage D: Safe SMTP Probing (Configurable)</span>
                </div>
                <p className="text-slate-600 pl-7">
                  When enabled, connects to port 25 with strict 3-second timeouts. Issues safe EHLO, MAIL FROM, and RCPT TO commands without ever sending an email body (never issues DATA). Detects catch-all domains and greylisting.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-mono">4</span>
                  <span>Stage E: Centralized 3-Way Classification</span>
                </div>
                <p className="text-slate-600 pl-7">
                  Maps evidence strictly to: <strong>Likely Delivered</strong> (valid syntax + active route), <strong>Likely to Bounce</strong> (invalid syntax or no usable mail route), or <strong>Unknown</strong> (unconfirmed mailbox, DNS timeout, or port 25 block).
                </p>
              </div>
            </div>
          </div>

          {/* Hosting & Port 25 Deployment Reality */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-slate-600" />
              <span>Real-World Deployment Constraints</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Most modern cloud and serverless hosting providers (including Render, Cloud Run, AWS EC2, and Heroku) strictly block outbound connections on TCP port 25 to prevent spam abuse. Consequently, SMTP probing is disabled by default on hosted deployments.
            </p>
            <p className="text-slate-600 leading-relaxed mt-2">
              In this mode, MailCheck performs authentic RFC syntax validation and real-time DNS mail-routing checks. Mailboxes on valid mail servers are marked as <strong>Likely Delivered</strong> or <strong>Unknown</strong> as appropriate, never falsely claiming individual recipient mailbox verification when port 25 is restricted.
            </p>
          </div>

          {/* System Capabilities */}
          {capabilities && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <h4 className="font-semibold text-slate-900 mb-2">Current System Capabilities</h4>
              <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div>
                  <dt className="text-slate-400">DNS Checks:</dt>
                  <dd className="text-emerald-700 font-semibold">Active (Real MX / A)</dd>
                </div>
                <div>
                  <dt className="text-slate-400">SMTP Probes:</dt>
                  <dd className={capabilities.smtp_check_enabled ? 'text-emerald-700' : 'text-slate-600'}>
                    {capabilities.smtp_check_enabled ? 'Active (Port 25)' : 'Disabled (Safe Mode)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Max Batch Size:</dt>
                  <dd className="text-slate-800">{capabilities.max_batch_size} addresses</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Rate Limiter:</dt>
                  <dd className="text-slate-800">{capabilities.rate_limit_per_minute} req/min</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Mandatory Disclaimer */}
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <strong className="block mb-1 text-amber-950 font-semibold">Deliverability Disclaimer</strong>
            These results estimate deliverability. They do not guarantee that an email will reach an inbox. Mail servers may hide mailbox information, and recipient servers can reject messages for reasons that cannot be predicted by these checks.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
