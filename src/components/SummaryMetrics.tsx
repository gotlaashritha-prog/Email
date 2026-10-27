import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, Layers } from 'lucide-react';
import { SummaryCounts } from '../types';

interface SummaryMetricsProps {
  totalSubmitted: number;
  uniqueCount: number;
  duplicateCount: number;
  validSyntaxCount: number;
  invalidSyntaxCount: number;
  summary: SummaryCounts;
  executionTimeMs: number;
  activeFilter: string;
  onSelectFilter: (filter: 'all' | 'Likely Delivered' | 'Likely to Bounce' | 'Unknown') => void;
}

export const SummaryMetrics: React.FC<SummaryMetricsProps> = ({
  totalSubmitted,
  uniqueCount,
  duplicateCount,
  summary,
  executionTimeMs,
  activeFilter,
  onSelectFilter,
}) => {
  const getPercent = (count: number) => {
    if (totalSubmitted === 0) return '0%';
    return `${Math.round((count / totalSubmitted) * 100)}%`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Total Entries */}
      <button
        type="button"
        onClick={() => onSelectFilter('all')}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          activeFilter === 'all'
            ? 'bg-white border-slate-900 shadow-sm ring-1 ring-slate-900'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Total Entries</span>
          <Layers className="w-4 h-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {totalSubmitted}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            in {executionTimeMs}ms
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          <span>{uniqueCount} unique</span>
          {duplicateCount > 0 && (
            <span className="text-amber-600 font-medium ml-1">
              · {duplicateCount} duplicates
            </span>
          )}
        </div>
      </button>

      {/* 2. Likely Delivered */}
      <button
        type="button"
        onClick={() => onSelectFilter('Likely Delivered')}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          activeFilter === 'Likely Delivered'
            ? 'bg-emerald-50/80 border-emerald-600 shadow-sm ring-1 ring-emerald-600'
            : 'bg-white border-slate-200 hover:border-emerald-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-800">Likely Delivered</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950 font-mono tabular-nums">
            {summary.likely_delivered}
          </span>
          <span className="text-xs font-semibold text-emerald-700 font-mono">
            {getPercent(summary.likely_delivered)}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Valid route discovered
        </div>
      </button>

      {/* 3. Likely to Bounce */}
      <button
        type="button"
        onClick={() => onSelectFilter('Likely to Bounce')}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          activeFilter === 'Likely to Bounce'
            ? 'bg-rose-50/80 border-rose-600 shadow-sm ring-1 ring-rose-600'
            : 'bg-white border-slate-200 hover:border-rose-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-rose-800">Likely to Bounce</span>
          <AlertTriangle className="w-4 h-4 text-rose-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-950 font-mono tabular-nums">
            {summary.likely_to_bounce}
          </span>
          <span className="text-xs font-semibold text-rose-700 font-mono">
            {getPercent(summary.likely_to_bounce)}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Syntax or routing failure
        </div>
      </button>

      {/* 4. Unknown */}
      <button
        type="button"
        onClick={() => onSelectFilter('Unknown')}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          activeFilter === 'Unknown'
            ? 'bg-amber-50/80 border-amber-600 shadow-sm ring-1 ring-amber-600'
            : 'bg-white border-slate-200 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-800">Unknown</span>
          <HelpCircle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-950 font-mono tabular-nums">
            {summary.unknown}
          </span>
          <span className="text-xs font-semibold text-amber-700 font-mono">
            {getPercent(summary.unknown)}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Inconclusive or unprobed
        </div>
      </button>
    </div>
  );
};
