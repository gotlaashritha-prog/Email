import React from 'react';
import { DeliverabilityResultItem } from '../types';
import { Server, Globe, Mail, Copy, Check } from 'lucide-react';

interface ResultRowDetailsProps {
  item: DeliverabilityResultItem;
}

export const ResultRowDetails: React.FC<ResultRowDetailsProps> = ({ item }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-50/80 p-4 border-t border-slate-200 text-xs text-slate-700 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">Technical Breakdown</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500">Row {item.row_number}</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-800">
            {item.reason_code}
          </span>
        </div>

        <button
          onClick={handleCopyJson}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-mono transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Copied JSON</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span>Copy Row JSON</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Syntax & Addresses */}
        <div className="bg-white p-3 rounded-lg border border-slate-200/80">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 mb-2">
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>Syntax & Identity</span>
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-400">Original input:</dt>
              <dd className="font-mono text-slate-800 break-all">{item.original_input}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Normalized address:</dt>
              <dd className="font-mono text-slate-800 break-all">{item.normalized_email || 'N/A'}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-slate-400">Local part:</dt>
                <dd className="font-mono text-slate-800 truncate">{item.local_part || 'None'}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Domain:</dt>
                <dd className="font-mono text-slate-800 truncate">{item.domain || 'None'}</dd>
              </div>
            </div>
            {item.syntax_error && (
              <div className="p-1.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                <span className="font-semibold">Syntax error:</span> {item.syntax_error}
              </div>
            )}
            {item.is_duplicate && (
              <div className="p-1.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                <span className="font-semibold">Duplicate:</span> Appears {item.duplicate_count} times in this batch
              </div>
            )}
          </dl>
        </div>

        {/* Column 2: DNS & Mail Routing */}
        <div className="bg-white p-3 rounded-lg border border-slate-200/80">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 mb-2">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>DNS Mail Routing</span>
          </div>
          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-400">DNS Status: </span>
              <span className="font-mono font-medium text-slate-800 capitalize">
                {item.dns_status.replace(/_/g, ' ')}
              </span>
            </div>

            {item.mx_records.length > 0 ? (
              <div>
                <span className="text-slate-400 block mb-1">
                  MX Records ({item.mx_records.length} found):
                </span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {item.mx_records.map((mx, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between font-mono bg-slate-50 p-1 rounded border border-slate-100 text-[10px]"
                    >
                      <span className="truncate max-w-[160px] text-slate-700">{mx.exchange}</span>
                      <span className="text-slate-500 shrink-0">prio {mx.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : item.fallback_records.length > 0 ? (
              <div>
                <span className="text-slate-400 block mb-1">RFC 5321 Fallback A/AAAA Hosts:</span>
                <div className="space-y-1">
                  {item.fallback_records.map((ip, idx) => (
                    <div
                      key={idx}
                      className="font-mono bg-slate-50 p-1 rounded border border-slate-100 text-[10px] text-slate-700"
                    >
                      {ip}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 italic">
                {item.syntax_valid
                  ? 'No usable mail exchange or fallback records discovered'
                  : 'DNS check skipped due to invalid email format'}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: SMTP & Deliverability Signals */}
        <div className="bg-white p-3 rounded-lg border border-slate-200/80">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 mb-2">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span>SMTP Verification Evidence</span>
          </div>
          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-400">Probe status: </span>
              <span className="font-mono font-medium text-slate-800">
                {item.smtp_status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="p-2 rounded bg-slate-50 border border-slate-100 text-slate-600 leading-normal">
              {item.smtp_checked ? (
                <span>SMTP RCPT probe was executed with strict timeout.</span>
              ) : (
                <span>
                  SMTP checks were not performed (host environment port 25 safety constraint).
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Checks performed:</span>
              <div className="flex flex-wrap gap-1">
                {item.checks_performed.map((chk, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                  >
                    {chk}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
