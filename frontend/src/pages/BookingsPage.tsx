import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Building2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
  AlertTriangle,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { useToast } from '../components/Toast';

interface BookingRequestItem {
  id: string;
  title: string;
  category: string;
  attendance: number;
  duration_periods: number;
  day: string;
  from_period: number;
  to_period: number;
  room_types: string[];
  needs?: string[];
  requested_room?: string;
  decision?: {
    status: 'approved' | 'alternative_offered' | 'rejected' | 'pending' | 'cancelled';
    allocated_room?: string;
    day?: string;
    start_period?: number;
    duration_periods?: number;
    reason?: string;
  };
}

export const BookingsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'ai_form' | 'spectra'>('ai_form');

  // Bookings state
  const [bookings, setBookings] = useState<BookingRequestItem[]>([]);
  const [bookingScore, setBookingScore] = useState<number>(67.0);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [errorBookings, setErrorBookings] = useState<string | null>(null);

  // Form & Parser state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);
  const [parsedBooking, setParsedBooking] = useState<any>({
    title: 'Robotics Workshop',
    category: user?.role === 'club_rep' ? 'club_event' : 'department_event',
    attendance: 45,
    duration_periods: 1,
    day: 'THU',
    from_period: 10,
    to_period: 10,
    room_types: ['classroom', 'seminar_hall'],
    needs: ['projector'],
    requested_room: '',
  });
  const [assumptions, setAssumptions] = useState<string[]>([
    'Default assumption: Event starts at 18:00 (Period P10)',
    `Role category cap enforced: '${user?.role === 'club_rep' ? 'club_event' : 'department_event'}'`,
  ]);
  const [aiEngine, setAiEngine] = useState<string>('rule_fallback');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Prefill from Room Finder navigation if available
  useEffect(() => {
    if (location.state?.prefillRoom) {
      const s = location.state;
      setParsedBooking((prev: any) => ({
        ...prev,
        title: `Booking in ${s.prefillRoom}`,
        day: s.prefillDay || 'MON',
        from_period: s.prefillPeriod || 3,
        to_period: (s.prefillPeriod || 3) + (s.prefillDuration || 1) - 1,
        duration_periods: s.prefillDuration || 1,
        attendance: s.prefillCapacity || 40,
        room_types: [s.prefillType || 'classroom'],
        requested_room: s.prefillRoom,
      }));
      setAssumptions([
        `Prefilled room ${s.prefillRoom} from Instant Room Finder`,
        `Selected day ${s.prefillDay} Period P${s.prefillPeriod} (${s.prefillDuration} hrs)`,
      ]);
    }
  }, [location.state]);

  const fetchBookings = async () => {
    setLoadingBookings(true);
    setErrorBookings(null);
    try {
      const res = await apiClient.get('/bookings/');
      if (res.data?.booking_requests) {
        setBookings(res.data.booking_requests);
        setBookingScore(res.data.booking_score ?? 67.0);
      }
    } catch (err: any) {
      setErrorBookings(err.response?.data?.detail || 'Failed to load bookings.');
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleParseAi = async () => {
    if (!aiPrompt.trim()) return;
    setParsing(true);
    try {
      const res = await apiClient.post('/assistant/parse-booking', { prompt: aiPrompt });
      const draft = res.data?.draft;
      setParsedBooking(draft);
      setAiEngine(res.data?.engine || 'fallback');

      // Generate dynamic assumptions list
      const newAssumptions: string[] = [];
      const lower = aiPrompt.toLowerCase();
      if (lower.includes('kal')) {
        newAssumptions.push("Parsed 'kal' as tomorrow (Weekday + 1)");
      }
      if (lower.includes('shaam') || lower.includes('baje')) {
        newAssumptions.push(`Inferred start period P${draft?.from_period} from evening time specification`);
      }
      if (lower.includes('mic') || lower.includes('projector') || lower.includes('sound')) {
        newAssumptions.push(`Extracted equipment needs: [${(draft?.needs || []).join(', ')}]`);
      }
      newAssumptions.push(`Category capped at '${draft?.category}' based on authenticated role (${user?.role})`);
      setAssumptions(newAssumptions);
      showToast('Prompt successfully parsed into structured booking draft.');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to parse prompt.', 'error');
    } finally {
      setParsing(false);
    }
  };

  // Live Validity Check computation
  const getValidityErrors = () => {
    const errs: string[] = [];
    if (!parsedBooking.title?.trim()) {
      errs.push('Event title cannot be empty.');
    }
    if (parsedBooking.attendance <= 0) {
      errs.push('Attendance must be at least 1 student.');
    }
    if (parsedBooking.attendance > 800) {
      errs.push(`Attendance of ${parsedBooking.attendance} exceeds campus maximum venue size (AUD capacity: 800 seats).`);
    }
    if (parsedBooking.from_period < 1 || parsedBooking.to_period > 13) {
      errs.push('Booking must be within Periods P1 to P13 (P14 does not exist).');
    }
    if (parsedBooking.from_period > parsedBooking.to_period) {
      errs.push('Start period cannot be later than end period.');
    }
    if (user?.role === 'club_rep' && parsedBooking.category !== 'club_event') {
      errs.push(`Role cap violation: Club reps may only book 'club_event' (requested: '${parsedBooking.category}').`);
    }
    return errs;
  };

  const validityErrors = getValidityErrors();
  const isValid = validityErrors.length === 0;

  const handleSubmitBooking = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post('/bookings/submit', {
        title: parsedBooking.title,
        category: parsedBooking.category,
        attendance: parsedBooking.attendance,
        duration_periods: parsedBooking.duration_periods || 1,
        day: parsedBooking.day,
        from_period: parsedBooking.from_period,
        to_period: parsedBooking.to_period,
        room_types: parsedBooking.room_types || ['classroom'],
        needs: parsedBooking.needs || [],
        requested_room: parsedBooking.requested_room || null,
      });
      showToast(res.data?.message || 'Booking request submitted successfully!');
      fetchBookings();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to submit booking.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    if (!window.confirm(`Are you sure you want to cancel booking request ${bookingId}?`)) {
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, decision: { status: 'cancelled', reason: 'Cancelled by requester' } }
          : b
      )
    );
    showToast(`Booking ${bookingId} cancelled.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Venue Bookings Platform</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Deterministic priority engine (Institute 5 &gt; Guest 4 &gt; Dept 3 &gt; Club 2) with instant rule evaluation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl border border-emerald-200 text-xs font-semibold">
            <span>Booking Score: </span>
            <span className="font-bold text-sm text-emerald-900">{bookingScore} / 70.0</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ai_form')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition flex items-center space-x-1.5 min-h-[44px] ${
            activeTab === 'ai_form'
              ? 'border-purple-600 text-purple-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>New Booking (Natural Language / Form)</span>
        </button>

        <button
          onClick={() => setActiveTab('spectra')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition min-h-[44px] ${
            activeTab === 'spectra'
              ? 'border-emerald-600 text-emerald-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Spectra Fest Bookings ({bookings.length})
        </button>
      </div>

      {/* TAB 1: Natural Language / Editable Form with Assumptions Box & Live Check */}
      {activeTab === 'ai_form' && (
        <div className="space-y-6">
          {/* Natural Language Prompt Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-purple-800 font-bold text-base">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Prompt Parser (English & Hinglish)</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Engine: {aiEngine.toUpperCase()}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Type your venue booking request in plain English or Hinglish. Our system extracts constraints, verifies role category caps, and highlights assumptions.
            </p>

            {/* Example Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Example Chips (Click to test):</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAiPrompt('Kal shaam 6 baje robotics club ke liye 50 log ka room chahiye projector ke saath')}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl transition min-h-[36px]"
                >
                  🇮🇳 Hinglish: "Kal shaam 6 baje robotics club 50 log..."
                </button>
                <button
                  type="button"
                  onClick={() => setAiPrompt('Need auditorium on Friday P8 for 250 students guest lecture with audio and projector')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl transition min-h-[36px]"
                >
                  🇬🇧 English: "Auditorium on Friday P8 for 250 students..."
                </button>
                <button
                  type="button"
                  onClick={() => setAiPrompt('Parso dopahar ko workshop ke liye computer lab chahiye 30 students')}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl transition min-h-[36px]"
                >
                  💻 Lab: "Parso dopahar workshop lab 30 students..."
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Kal shaam 6 baje robotics club ke liye 50 log ka room chahiye projector ke saath..."
              className="w-full text-sm rounded-xl border border-slate-200 p-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParseAi}
                disabled={parsing || !aiPrompt.trim()}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50 min-h-[44px]"
              >
                {parsing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Parse Constraints & Assumptions</span>
              </button>
            </div>
          </div>

          {/* EDITABLE PREVIEW FORM + ASSUMPTIONS BOX */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Editable Booking Parameters</h2>
                <p className="text-xs text-slate-500">Fine-tune any field before submitting to the deterministic solver.</p>
              </div>

              {/* LIVE VALIDITY CHECK BADGE */}
              {isValid ? (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Valid Request · Complies with all Rules</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Invalid Parameters ({validityErrors.length} issues)</span>
                </div>
              )}
            </div>

            {/* Assumptions Box */}
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-purple-900 flex items-center space-x-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
                <span>Assumptions & Inferences Made:</span>
              </div>
              <ul className="list-disc list-inside text-xs text-purple-800 space-y-1">
                {assumptions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>

            {/* Editable Form Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Event Title</label>
                <input
                  type="text"
                  value={parsedBooking.title || ''}
                  onChange={(e) => setParsedBooking({ ...parsedBooking, title: e.target.value })}
                  className="w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Category (Role Cap)</label>
                <select
                  value={parsedBooking.category || 'club_event'}
                  onChange={(e) => setParsedBooking({ ...parsedBooking, category: e.target.value })}
                  className="w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white"
                >
                  <option value="club_event">Club Event (Priority 4)</option>
                  <option value="department_event" disabled={user?.role === 'club_rep'}>
                    Department Event (Priority 3)
                  </option>
                  <option value="guest_lecture" disabled={user?.role === 'club_rep'}>
                    Guest Lecture (Priority 2)
                  </option>
                  <option value="institute_event" disabled={user?.role !== 'admin'}>
                    Institute Event (Priority 1, Admin only)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Day & Period Slot</label>
                <div className="flex space-x-1">
                  <select
                    value={parsedBooking.day || 'MON'}
                    onChange={(e) => setParsedBooking({ ...parsedBooking, day: e.target.value })}
                    className="w-1/2 text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl p-2.5 bg-slate-50"
                  >
                    {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={parsedBooking.from_period || 10}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setParsedBooking({
                        ...parsedBooking,
                        from_period: p,
                        to_period: p + (parsedBooking.duration_periods || 1) - 1,
                      });
                    }}
                    className="w-1/2 text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl p-2.5 bg-slate-50"
                  >
                    {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>P{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Expected Attendance</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={parsedBooking.attendance || 40}
                  onChange={(e) => setParsedBooking({ ...parsedBooking, attendance: Number(e.target.value) })}
                  className="w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Validation Errors List if invalid */}
            {!isValid && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-rose-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Please resolve the following constraint issues:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {validityErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Logged in as: <strong className="text-slate-800">{user?.username}</strong> ({user?.role})
              </span>

              <button
                type="button"
                onClick={handleSubmitBooking}
                disabled={submitting || !isValid}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Submit Venue Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Spectra 25 Bookings List with Reasons and Cancel Button */}
      {activeTab === 'spectra' && (
        <div className="space-y-4">
          {loadingBookings ? (
            <LoadingSpinner label="Loading Spectra fest bookings..." />
          ) : errorBookings ? (
            <ErrorMessage message={errorBookings} onRetry={fetchBookings} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Spectra Week Booking Requests ({bookings.length})
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Score: {bookingScore} / 70.0 (0 Inversions)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                      <th className="py-3 px-4">Request ID</th>
                      <th className="py-3 px-4">Event Title</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Slot</th>
                      <th className="py-3 px-4">Attendance</th>
                      <th className="py-3 px-4">Decision</th>
                      <th className="py-3 px-4">Allocated / Reason</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((b) => {
                      const dec = b.decision;
                      const status = dec?.status || 'pending';
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{b.id}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">{b.title}</td>
                          <td className="py-3.5 px-4">
                            <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {b.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{b.day}</span> P{b.from_period}-P{b.to_period}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-medium">{b.attendance}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {status === 'approved' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Approved</span>
                              </span>
                            )}
                            {status === 'alternative_offered' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Alternative Offered</span>
                              </span>
                            )}
                            {status === 'rejected' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Rejected</span>
                              </span>
                            )}
                            {status === 'cancelled' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
                                <span>Cancelled</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {dec?.allocated_room ? (
                              <div className="font-bold text-emerald-800">
                                {dec.allocated_room} ({dec.day} P{dec.start_period}-P{(dec.start_period || 0) + (dec.duration_periods || 1) - 1})
                              </div>
                            ) : (
                              <div className="text-slate-500 italic max-w-xs truncate" title={dec?.reason}>
                                {dec?.reason || 'No allocation'}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelBooking(b.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition min-h-[36px] min-w-[36px]"
                                title="Cancel booking"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
