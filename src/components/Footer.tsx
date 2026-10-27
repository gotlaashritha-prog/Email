import React from 'react';
import { Shield, EyeOff, ExternalLink } from 'lucide-react';

interface FooterProps {
  onOpenHowItWorks: () => void;
  onOpenCapabilities: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenHowItWorks,
  onOpenCapabilities,
}) => {
  return (
    <footer className="mt-16 bg-white border-t border-slate-200 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <span className="font-bold text-slate-900 text-sm">MailCheck</span>
              <span className="text-slate-400">·</span>
              <span>Email Deliverability Checker</span>
            </div>
            <p className="text-slate-600 leading-relaxed max-w-md">
              A technically honest full-stack deliverability verification tool built for academic assignment evaluation. Performs layered RFC 5322 syntax validation, async DNS MX/fallback resolution, and optional safe SMTP RCPT checks.
            </p>
            <div className="flex items-center gap-2 text-slate-500">
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Strict in-memory processing: zero database retention, no telemetry, no emails sent.</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Application
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={onOpenHowItWorks}
                  className="hover:text-slate-900 transition-colors cursor-pointer"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenCapabilities}
                  className="hover:text-slate-900 transition-colors cursor-pointer"
                >
                  System Capabilities & Limits
                </button>
              </li>
              <li>
                <a
                  href="#technical-disclaimer"
                  className="hover:text-slate-900 transition-colors"
                >
                  Deliverability Disclaimer
                </a>
              </li>
            </ul>
          </div>

          {/* Assignment Architecture */}
          <div>
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Tech Stack
            </h4>
            <ul className="space-y-1.5 text-slate-600 font-mono text-[11px]">
              <li>Frontend: React 19 + TypeScript + Vite</li>
              <li>Styling: Tailwind CSS v4</li>
              <li>Backend API: Node.js Express + Python FastAPI</li>
              <li>DNS: dnspython / Node DNS Promises</li>
              <li>Tests: pytest & Python unittest (23 tests)</li>
            </ul>
          </div>
        </div>

        {/* Technical Disclaimer Section */}
        <div id="technical-disclaimer" className="pt-6 border-t border-slate-100 space-y-2 text-slate-500">
          <p className="font-semibold text-slate-700">Deliverability Disclaimer & Technical Honesty:</p>
          <p className="leading-relaxed">
            These verification results represent estimated deliverability based on visible mail routing and RFC validation signals. They do not constitute a guarantee that an email will reach an inbox. Mail servers may deploy privacy protections, catch-all configurations, greylisting, or spam filters that reject incoming mail without disclosing recipient mailbox existence.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <span>MailCheck — College Assignment Full-Stack Web Application. All rights reserved.</span>
          <span>Deployable to Render · Built with Google AI Studio</span>
        </div>
      </div>
    </footer>
  );
};
