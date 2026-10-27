import React, { useMemo } from 'react';
import { Send, Trash2, FileText, AlertCircle, Sparkles } from 'lucide-react';

interface EmailInputCardProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
  onClear: () => void;
  maxBatchSize: number;
}

const SAMPLE_STANDARD_BATCH = `alice@example.com
team@github.com
billing@stripe.com
support@google.com
investors@microsoft.com`;

const SAMPLE_EDGE_CASES_BATCH = `valid.student@example.com
missing-at-symbol.com
alex@nonexistent-domain-4091.invalid
valid.student@example.com
user..double-dot@example.org
sales@cloudflare.com, info@cloudflare.com; support@cloudflare.com`;

export const EmailInputCard: React.FC<EmailInputCardProps> = ({
  inputValue,
  setInputValue,
  isLoading,
  onSubmit,
  onClear,
  maxBatchSize,
}) => {
  // Parse candidate count in real time
  const candidateCount = useMemo(() => {
    if (!inputValue.trim()) return 0;
    const tokens = inputValue.split(/[\r\n,;]+/);
    return tokens.filter((t) => t.trim().length > 0).length;
  }, [inputValue]);

  const charCount = inputValue.length;
  const isOverLimit = candidateCount > maxBatchSize;
  const isEmpty = candidateCount === 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <label
            htmlFor="email-batch-input"
            className="text-base font-semibold text-slate-900 block"
          >
            Email Addresses to Inspect
          </label>
          <span className="text-xs text-slate-500">
            Paste one address per line, or separate with commas or semicolons
          </span>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInputValue(SAMPLE_STANDARD_BATCH)}
            disabled={isLoading}
            className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Load Standard Sample
          </button>
          <button
            type="button"
            onClick={() => setInputValue(SAMPLE_EDGE_CASES_BATCH)}
            disabled={isLoading}
            className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Load Edge Cases
          </button>
        </div>
      </div>

      <div className="mt-4">
        <textarea
          id="email-batch-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          rows={7}
          placeholder={`alice@example.com\nbob@example.org\ncarol@mail.example.net`}
          className="w-full font-mono text-sm text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg p-3.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all placeholder:text-slate-400 resize-y"
        />
      </div>

      {/* Validation warning if limit exceeded */}
      {isOverLimit && (
        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            Batch contains <strong>{candidateCount}</strong> addresses, which exceeds the maximum limit of{' '}
            <strong>{maxBatchSize}</strong> addresses per request. Please remove{' '}
            {candidateCount - maxBatchSize} addresses before submitting.
          </span>
        </div>
      )}

      {/* Footer controls & counters */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono tabular-nums">
          <span>
            Addresses: <strong className="text-slate-800">{candidateCount}</strong> / {maxBatchSize}
          </span>
          <span>·</span>
          <span>
            Characters: <strong className="text-slate-800">{charCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={isLoading || (!inputValue && candidateCount === 0)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || isEmpty || isOverLimit}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Inspecting Mail Records...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Check Emails</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
