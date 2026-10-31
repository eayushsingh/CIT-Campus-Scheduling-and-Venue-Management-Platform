import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const AssistantPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">CIT AI Assistant</h1>
        <p className="text-sm text-slate-600 mt-1">
          Natural language & Hinglish conversational interface for room bookings and timetable queries.
        </p>
      </div>

      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-sm flex items-start space-x-3">
        <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold">Guardrail Protected: </span>
          The LLM extracts user intent and parses text into structured JSON drafts. Deterministic code strictly decides feasibility and validity.
        </div>
      </div>

      <EmptyState
        title="AI Assistant Ready for Activation"
        description="Supports English, Hinglish, vague timings, and fallback parsing when offline."
        icon={<Bot className="w-8 h-8 text-purple-500" />}
      />
    </div>
  );
};
