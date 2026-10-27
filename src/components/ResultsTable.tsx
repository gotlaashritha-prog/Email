import React, { useState, useMemo } from 'react';
import {
  DeliverabilityResultItem,
  ClassificationStatus,
} from '../types';
import { ResultRowDetails } from './ResultRowDetails';
import { downloadCsv, generateDeliverabilityCsv } from '../utils/csv';
import {
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

interface ResultsTableProps {
  results: DeliverabilityResultItem[];
  activeFilter: 'all' | 'Likely Delivered' | 'Likely to Bounce' | 'Unknown';
  setActiveFilter: (filter: 'all' | 'Likely Delivered' | 'Likely to Bounce' | 'Unknown') => void;
  onClear: () => void;
  executionTimeMs: number;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  activeFilter,
  setActiveFilter,
  onClear,
  executionTimeMs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<'row_number' | 'email' | 'status'>('row_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Toggle expanded row state
  const toggleRow = (rowNumber: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRows(new Set(results.map((r) => r.row_number)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  // Filtered & Sorted results
  const filteredResults = useMemo(() => {
    return results
      .filter((item) => {
        // Status filter
        if (activeFilter !== 'all' && item.status !== activeFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchEmail = item.original_input.toLowerCase().includes(q);
          const matchReason = item.explanation.toLowerCase().includes(q);
          const matchDomain = (item.domain || '').toLowerCase().includes(q);
          return matchEmail || matchReason || matchDomain;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'row_number') {
          diff = a.row_number - b.row_number;
        } else if (sortField === 'email') {
          diff = a.original_input.localeCompare(b.original_input);
        } else if (sortField === 'status') {
          diff = a.status.localeCompare(b.status);
        }
        return sortDirection === 'asc' ? diff : -diff;
      });
  }, [results, activeFilter, searchQuery, sortField, sortDirection]);

  // Export CSV
  const handleExportCsv = () => {
    const csvContent = generateDeliverabilityCsv(results);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`email-deliverability-check-${dateStr}.csv`, csvContent);
  };

  // Copy concise summary
  const handleCopySummary = () => {
    const likelyDelivered = results.filter((r) => r.status === 'Likely Delivered').length;
    const likelyToBounce = results.filter((r) => r.status === 'Likely to Bounce').length;
    const unknown = results.filter((r) => r.status === 'Unknown').length;

    const summaryText = `MailCheck Deliverability Summary
Total Entries: ${results.length}
- Likely Delivered: ${likelyDelivered} (${Math.round((likelyDelivered / results.length) * 100)}%)
- Likely to Bounce: ${likelyToBounce} (${Math.round((likelyToBounce / results.length) * 100)}%)
- Unknown: ${unknown} (${Math.round((unknown / results.length) * 100)}%)
Inspected in ${executionTimeMs}ms.`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const getStatusBadge = (status: ClassificationStatus) => {
    switch (status) {
      case 'Likely Delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Likely Delivered</span>
          </span>
        );
      case 'Likely to Bounce':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Likely to Bounce</span>
          </span>
        );
      case 'Unknown':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Unknown</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Filter tabs & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Segmented Control */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setActiveFilter('Likely Delivered')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'Likely Delivered'
                  ? 'bg-white text-emerald-800 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Delivered ({results.filter((r) => r.status === 'Likely Delivered').length})
            </button>
            <button
              onClick={() => setActiveFilter('Likely to Bounce')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'Likely to Bounce'
                  ? 'bg-white text-rose-800 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bounce ({results.filter((r) => r.status === 'Likely to Bounce').length})
            </button>
            <button
              onClick={() => setActiveFilter('Unknown')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeFilter === 'Unknown'
                  ? 'bg-white text-amber-800 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unknown ({results.filter((r) => r.status === 'Unknown').length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address or domain..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            onClick={expandedRows.size === results.length ? collapseAll : expandAll}
            className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded border border-slate-200 bg-white transition-colors cursor-pointer"
          >
            {expandedRows.size === results.length ? 'Collapse All' : 'Expand All'}
          </button>

          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onClear}
            title="Clear all results"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 tracking-wider">
              <th
                onClick={() => {
                  setSortField('row_number');
                  setSortDirection(sortField === 'row_number' && sortDirection === 'asc' ? 'desc' : 'asc');
                }}
                className="py-3 px-4 w-16 cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span>#</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => {
                  setSortField('email');
                  setSortDirection(sortField === 'email' && sortDirection === 'asc' ? 'desc' : 'asc');
                }}
                className="py-3 px-4 cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span>Email Address</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th
                onClick={() => {
                  setSortField('status');
                  setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc');
                }}
                className="py-3 px-4 w-44 cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>

              <th className="py-3 px-4">Reason & Routing Signal</th>

              <th className="py-3 px-4 hidden md:table-cell w-56">Checks Performed</th>

              <th className="py-3 px-4 w-14 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  No email addresses match your current filter criteria.
                </td>
              </tr>
            ) : (
              filteredResults.map((item) => {
                const isExpanded = expandedRows.has(item.row_number);

                return (
                  <React.Fragment key={item.row_number}>
                    <tr
                      onClick={() => toggleRow(item.row_number)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-slate-50/60' : ''
                      }`}
                    >
                      {/* Row # */}
                      <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                        {item.row_number}
                      </td>

                      {/* Email address + duplicate badge */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-medium text-slate-900 break-all">
                            {item.original_input}
                          </span>
                          {item.is_duplicate && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 whitespace-nowrap">
                              Duplicate
                            </span>
                          )}
                          {!item.syntax_valid && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 whitespace-nowrap">
                              Malformed Syntax
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 text-slate-600 max-w-md">
                        <span className="line-clamp-2">{item.explanation}</span>
                      </td>

                      {/* Checks performed */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {item.checks_performed.map((chk, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]"
                            >
                              {chk}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Expand action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          aria-label="Expand technical details"
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Technical Detail */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <ResultRowDetails item={item} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
        <span>
          Showing <strong>{filteredResults.length}</strong> of <strong>{results.length}</strong> entries
        </span>
        <span className="font-mono">
          Completed in {executionTimeMs}ms · DNS resolver: Node.js Async Resolver
        </span>
      </div>
    </div>
  );
};
