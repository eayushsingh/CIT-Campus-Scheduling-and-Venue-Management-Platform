import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  User,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  structuredDraft?: any;
  engine?: string;
  timestamp: string;
}

export const AssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am the CIT AI Assistant. I can parse English or Hinglish booking requests, process faculty leave/swap queries, and explain scheduling decisions. Remember, I extract your intent into structured data, while our deterministic CP-SAT engine strictly enforces all campus rules.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const quickPrompts = [
    {
      label: 'Hinglish Booking',
      text: 'Kal shaam 6 baje robotics club ke liye 50 log ka room chahiye projector ke saath',
    },
    {
      label: 'Why BR-09 Rejected?',
      text: 'Explain why booking request BR-09 was rejected in Spectra fest.',
    },
    {
      label: 'Accessibility Conflict',
      text: 'I want seminar hall SH-2 for an event with a student in a wheelchair.',
    },
    {
      label: 'Faculty Swap Request',
      text: 'Swap my Friday P2 lecture with Prof CS02 because of department meeting.',
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      if (prompt.toLowerCase().includes('why') || prompt.toLowerCase().includes('explain')) {
        // Explainer endpoint
        const res = await apiClient.post('/assistant/explain', {
          topic: 'booking',
          target_id: prompt.includes('BR-09') ? 'BR-09' : undefined,
          context: { question: prompt },
        });
        const reply = res.data?.explanation || 'Explanation provided by CIT Deterministic Explainer.';
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else if (prompt.toLowerCase().includes('swap') || prompt.toLowerCase().includes('leave')) {
        // Faculty request endpoint
        const res = await apiClient.post('/assistant/faculty-request', { prompt });
        const analysis = res.data?.analysis;
        const text = `Request Parsed: Type=${analysis?.request_type || 'General'}. Actionable=${res.data?.actionable}. Feasibility: ${analysis?.reasoning || 'Evaluated against timetable constraints.'}`;
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        // Booking parser endpoint
        const res = await apiClient.post('/assistant/parse-booking', { prompt });
        const draft = res.data?.draft;
        const engine = res.data?.engine || 'fallback';
        const text = `I parsed your booking request:\n• Title: "${draft?.title || 'Event'}"\n• Category: ${draft?.category} (Capped by role ${user?.role})\n• Requested: ${draft?.day} Periods P${draft?.from_period}-P${draft?.to_period}\n• Expected Attendance: ${draft?.attendance} seats\n• Needs: ${draft?.needs?.join(', ') || 'None'}`;
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: text,
            structuredDraft: draft,
            engine: engine,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-err-${Date.now()}`,
          sender: 'assistant',
          text: `Error processing request: ${err.response?.data?.detail || err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">CIT AI Copilot</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Multi-lingual natural language interface with 100% deterministic rule guardrails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Rule-Guarded Sandbox</span>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 space-y-2">
        <div className="text-xs font-semibold text-purple-900 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Click to test adversarial & Hinglish prompts:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.text)}
              className="text-xs font-medium px-3 py-1.5 bg-white hover:bg-purple-100 text-purple-900 rounded-xl border border-purple-200 shadow-sm transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden">
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start space-x-3 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`p-2 rounded-xl flex-shrink-0 ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`space-y-1.5 max-w-[80%]`}>
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  {m.text}
                </div>

                {m.structuredDraft && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1 text-purple-950">
                    <div className="font-bold flex items-center justify-between">
                      <span>Deterministic Validation Result:</span>
                      <span className="font-mono text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">
                        {m.engine?.toUpperCase()}
                      </span>
                    </div>
                    <div>Safe Draft verified against role caps and campus venue limitations.</div>
                  </div>
                )}

                <div className={`text-[10px] text-slate-400 ${m.sender === 'user' ? 'text-right' : ''}`}>
                  {m.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center space-x-3 text-slate-500 text-xs italic">
              <Bot className="w-4 h-4 animate-bounce text-purple-600" />
              <span>Parsing and evaluating deterministic constraints...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center space-x-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type booking, explanation query, or Hinglish request..."
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={loading || !inputPrompt.trim()}
            className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
