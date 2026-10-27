/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { EmailInputCard } from './components/EmailInputCard';
import { SummaryMetrics } from './components/SummaryMetrics';
import { ResultsTable } from './components/ResultsTable';
import { HowItWorksModal } from './components/HowItWorksModal';
import { Footer } from './components/Footer';
import {
  CheckEmailsResponse,
  CapabilitiesResponse,
  ClassificationStatus,
} from './types';
import { AlertCircle, HelpCircle } from 'lucide-react';

const INITIAL_EMAIL_INPUT = `alice@example.com
team@github.com
invalid-user-format
support@google.com
alex@invalid-domain-4091.invalid
team@github.com`;

export default function App() {
  const [inputValue, setInputValue] = useState<string>(INITIAL_EMAIL_INPUT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<CheckEmailsResponse | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | ClassificationStatus>('all');
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);

  // Fetch capabilities on initial load
  useEffect(() => {
    async function fetchCapabilities() {
      try {
        const res = await fetch('/api/capabilities');
        if (res.ok) {
          const data: CapabilitiesResponse = await res.json();
          setCapabilities(data);
        }
      } catch (err) {
        console.warn('Could not fetch capabilities:', err);
      }
    }
    fetchCapabilities();
  }, []);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails: inputValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Server responded with HTTP ${res.status}`);
      }

      setResponse(data as CheckEmailsResponse);
      setActiveFilter('all');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to the verification service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setResponse(null);
    setErrorMessage(null);
    setActiveFilter('all');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Header */}
      <Header
        capabilities={capabilities}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenCapabilities={() => setIsHowItWorksOpen(true)}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <Hero />

        {/* Workspace Canvas Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Main Email Input Card */}
          <EmailInputCard
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onClear={handleClear}
            maxBatchSize={capabilities?.max_batch_size ?? 100}
          />

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Submission Error</span>
                <span className="text-rose-700 block mt-0.5">{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Results Section */}
          {response && (
            <div className="space-y-6 pt-2 animate-in fade-in duration-200">
              {/* Summary Metric Cards */}
              <SummaryMetrics
                totalSubmitted={response.total_submitted}
                uniqueCount={response.unique_count}
                duplicateCount={response.duplicate_count}
                validSyntaxCount={response.valid_syntax_count}
                invalidSyntaxCount={response.invalid_syntax_count}
                summary={response.summary}
                executionTimeMs={response.execution_time_ms}
                activeFilter={activeFilter}
                onSelectFilter={(f) => setActiveFilter(f)}
              />

              {/* Responsive Results Table */}
              <ResultsTable
                results={response.results}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                onClear={handleClear}
                executionTimeMs={response.execution_time_ms}
              />
            </div>
          )}

          {/* Informational Guidance Section if no results yet */}
          {!response && !isLoading && (
            <div className="p-6 rounded-xl border border-slate-200 bg-white/70">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm mb-3">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span>Verification Guidelines & Academic Requirements</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800 block">1. Layered Checking</span>
                  <p className="leading-relaxed">
                    Addresses are processed through RFC syntax checks, real DNS MX queries, and fallback host routing without sending emails.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800 block">2. Technical Honesty</span>
                  <p className="leading-relaxed">
                    Syntax validity alone is never proof of delivery. Mail servers often hide mailbox existence; Unknown is a normal, valid result.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-800 block">3. Full Export & Auditing</span>
                  <p className="leading-relaxed">
                    Export full inspection records as CSV with formula injection escaping, copy summary metrics, and inspect exact DNS responses.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* How It Works & Capabilities Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
        capabilities={capabilities}
      />

      {/* Page Footer */}
      <Footer
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        onOpenCapabilities={() => setIsHowItWorksOpen(true)}
      />
    </div>
  );
}
