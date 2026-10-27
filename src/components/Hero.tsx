import React from 'react';
import { Shield, EyeOff, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="pt-10 pb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
          Know which emails are worth checking.
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
          Validate email syntax, inspect mail-routing records, and understand which results are reliable — without sending emails.
        </p>

        {/* Compact Privacy Note */}
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700">
          <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            <strong>Privacy note:</strong> No emails are sent. Results are based on available validation and mail-routing signals.
          </span>
        </div>

        {/* Three Outcome Category Highlights */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-950 block">Likely Delivered</span>
              <span className="text-emerald-800 text-[11px] leading-tight block mt-0.5">
                Passes RFC syntax and active MX or fallback host mail routes discovered.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50/60 border border-rose-100 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-rose-950 block">Likely to Bounce</span>
              <span className="text-rose-800 text-[11px] leading-tight block mt-0.5">
                Invalid syntax, missing domain, or confirmed absent mail route.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/60 border border-amber-100 text-xs">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-950 block">Unknown</span>
              <span className="text-amber-800 text-[11px] leading-tight block mt-0.5">
                Catch-all servers, privacy protections, DNS timeouts, or unprobed mailboxes.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
