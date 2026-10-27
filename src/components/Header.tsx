import React from 'react';
import { ShieldCheck, HelpCircle, Server } from 'lucide-react';
import { CapabilitiesResponse } from '../types';

interface HeaderProps {
  capabilities: CapabilitiesResponse | null;
  onOpenHowItWorks: () => void;
  onOpenCapabilities: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  capabilities,
  onOpenHowItWorks,
  onOpenCapabilities,
}) => {
  const isSmtpEnabled = capabilities?.smtp_check_enabled ?? false;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand title and subtitle wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              MailCheck
            </span>
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Email Deliverability Checker
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={onOpenHowItWorks}
            className="hover:text-slate-900 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>How It Works</span>
          </button>
          <button
            onClick={onOpenCapabilities}
            className="hover:text-slate-900 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Server className="w-4 h-4 text-slate-400" />
            <span>System Capabilities</span>
          </button>
          <a
            href="#technical-disclaimer"
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Deliverability Disclaimer
          </a>
        </nav>

        {/* Zone 3: Primary Action / Status Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenCapabilities}
            title={
              isSmtpEnabled
                ? 'Safe SMTP probes active (port 25 enabled)'
                : 'SMTP checks disabled by host policy (Syntax & DNS routing active)'
            }
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSmtpEnabled ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span className="font-mono text-xs">
              {isSmtpEnabled ? 'SMTP: Enabled' : 'SMTP: Disabled (Safe Mode)'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
