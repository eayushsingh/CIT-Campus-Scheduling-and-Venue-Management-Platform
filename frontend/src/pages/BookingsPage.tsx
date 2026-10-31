import React, { useState, useEffect } from 'react';
import {
  Building2,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';

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
    status: 'approved' | 'alternative_offered' | 'rejected' | 'pending';
    allocated_room?: string;
    day?: string;
    start_period?: number;
    duration_periods?: number;
    reason?: string;
  };
}

interface RoomItem {
  id: string;
  name: string;
  type: string;
  capacity: number;
  floor: number;
  features?: string[];
}

export const BookingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'finder' | 'ai_form' | 'spectra'>('finder');

  // Spectra Bookings
  const [bookings, setBookings] = useState<BookingRequestItem[]>([]);
  const [bookingScore, setBookingScore] = useState<number>(0);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [errorBookings, setErrorBookings] = useState<string | null>(null);

  // Room Finder state
  const [finderDay, setFinderDay] = useState<string>('MON');
  const [finderPeriod, setFinderPeriod] = useState<number>(3);
  const [finderCapacity, setFinderCapacity] = useState<number>(40);
  const [finderType, setFinderType] = useState<string>('all');
  const [finderAccessible, setFinderAccessible] = useState<boolean>(false);
  const [availableRooms, setAvailableRooms] = useState<RoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);

  // AI Booking Form state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);
  const [parsedBooking, setParsedBooking] = useState<any>(null);
  const [aiEngine, setAiEngine] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const fetchBookings = async () => {
    setLoadingBookings(true);
    setErrorBookings(null);
    try {
      const res = await apiClient.get('/bookings/');
      if (res.data?.booking_requests) {
        setBookings(res.data.booking_requests);
        setBookingScore(res.data.booking_score || 0);
      }
    } catch (err: any) {
      setErrorBookings(err.response?.data?.detail || 'Failed to load bookings.');
    } finally {
      setLoadingBookings(false);
    }
  };

  const searchAvailableRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await apiClient.get('/bookings/available-rooms', {
        params: {
          day: finderDay,
          period: finderPeriod,
          capacity: finderCapacity,
          room_type: finderType,
          accessible_only: finderAccessible,
        },
      });
      setAvailableRooms(res.data?.available_rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    searchAvailableRooms();
  }, []);

  const handleParseAi = async () => {
    if (!aiPrompt.trim()) return;
    setParsing(true);
    setSubmissionResult(null);
    try {
      const res = await apiClient.post('/assistant/parse-booking', {
        prompt: aiPrompt,
      });
      setParsedBooking(res.data?.draft);
      setAiEngine(res.data?.engine || 'fallback');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to parse prompt.');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmitBooking = async () => {
    if (!parsedBooking) return;
    setSubmitting(true);
    setSubmissionResult(null);
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
        requested_room: parsedBooking.requested_room,
      });
      setSubmissionResult({
        success: true,
        data: res.data,
      });
      fetchBookings();
    } catch (err: any) {
      setSubmissionResult({
        success: false,
        error: err.response?.data?.detail || 'Failed to submit booking.',
      });
    } finally {
      setSubmitting(false);
    }
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
              <h1 className="text-2xl font-bold text-slate-800">Venue Bookings & Room Finder</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Deterministic priority hierarchy (Institute 5 &gt; Guest 4 &gt; Dept 3 &gt; Club 2) with instant clash checking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl border border-emerald-200 font-medium text-sm">
          <span>Booking Score:</span>
          <span className="font-bold text-emerald-900 text-base">{bookingScore} / 70.0</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('finder')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition ${
            activeTab === 'finder'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Instant Room Finder
        </button>
        <button
          onClick={() => setActiveTab('ai_form')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition flex items-center space-x-1.5 ${
            activeTab === 'ai_form'
              ? 'border-purple-600 text-purple-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>Natural Language / Hinglish Booking</span>
        </button>
        <button
          onClick={() => setActiveTab('spectra')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition ${
            activeTab === 'spectra'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Spectra Fest Bookings ({bookings.length})
        </button>
      </div>

      {/* Tab 1: Instant Room Finder */}
      {activeTab === 'finder' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Day</label>
              <select
                value={finderDay}
                onChange={(e) => setFinderDay(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-200 p-2"
              >
                {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Period</label>
              <select
                value={finderPeriod}
                onChange={(e) => setFinderPeriod(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-200 p-2"
              >
                {Array.from({ length: 13 }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>P{p} ({p <= 5 ? `${7 + p}:00` : p <= 9 ? `${8 + p}:00` : `${9 + p}:00`})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Min Capacity</label>
              <input
                type="number"
                value={finderCapacity}
                onChange={(e) => setFinderCapacity(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-200 p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Room Type</label>
              <select
                value={finderType}
                onChange={(e) => setFinderType(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-200 p-2"
              >
                <option value="all">All Room Types</option>
                <option value="classroom">Classroom</option>
                <option value="lecture_hall">Lecture Hall</option>
                <option value="auditorium">Auditorium</option>
                <option value="seminar_hall">Seminar Hall</option>
                <option value="lab_cs">CS Lab</option>
                <option value="lab_elec">Elec Lab</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="acc"
                checked={finderAccessible}
                onChange={(e) => setFinderAccessible(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <label htmlFor="acc" className="text-xs font-medium text-slate-700 cursor-pointer">
                Ground Floor / Accessible Only
              </label>
            </div>

            <div>
              <button
                onClick={searchAvailableRooms}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm transition"
              >
                Find Rooms
              </button>
            </div>
          </div>

          {loadingRooms ? (
            <LoadingSpinner message="Searching available rooms..." />
          ) : availableRooms.length === 0 ? (
            <EmptyState
              title="No rooms available"
              description="All matching rooms are booked or occupied at this time. Try a different period or day."
              icon={<Building2 className="w-8 h-8 text-slate-400" />}
            />
          ) : (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">
                {availableRooms.length} Available Rooms (Best Fit Sorted)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {availableRooms.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-slate-900 text-base">{r.id}</span>
                        <div className="text-xs text-slate-500">{r.name}</div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Floor {r.floor}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 my-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Type:</span>
                        <span className="font-medium capitalize">{r.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Capacity:</span>
                        <span className="font-medium text-slate-900">{r.capacity} seats</span>
                      </div>
                      {r.features && r.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
                          {r.features.map((f) => (
                            <span key={f} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setParsedBooking({
                          title: `Booking in ${r.id}`,
                          category: 'club_event',
                          attendance: Math.min(finderCapacity || 30, r.capacity),
                          duration_periods: 1,
                          day: finderDay,
                          from_period: finderPeriod,
                          to_period: finderPeriod,
                          room_types: [r.type],
                          requested_room: r.id,
                        });
                        setActiveTab('ai_form');
                      }}
                      className="w-full mt-2 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                    >
                      Use this Room &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: AI / Natural Language Booking Form */}
      {activeTab === 'ai_form' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-purple-700 font-bold text-base">
              <Sparkles className="w-5 h-5" />
              <span>Prompt Assistant (Supports English & Hinglish)</span>
            </div>
            <p className="text-xs text-slate-600">
              Type your booking in natural language. Our system parses constraints deterministically, validates role limits, and verifies wheelchair accessibility before submitting.
            </p>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="font-semibold text-slate-500 pt-1">Sample prompts:</span>
              <button
                onClick={() => setAiPrompt("Kal shaam 6 baje robotics club ke liye 50 log ka room chahiye projector ke saath")}
                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg transition border border-purple-200"
              >
                Hinglish: "Kal shaam 6 baje robotics club 50 log..."
              </button>
              <button
                onClick={() => setAiPrompt("Need auditorium on Friday P8 for 250 students guest lecture")}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg transition border border-blue-200"
              >
                English: "Need auditorium Friday P8 250 students..."
              </button>
              <button
                onClick={() => setAiPrompt("CR-201 chahiye for wheelchair user student meeting")}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg transition border border-rose-200"
              >
                Accessibility Check: "CR-201 wheelchair user..."
              </button>
            </div>

            <div className="flex gap-2">
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Type in English or Hinglish: e.g., 'Kal shaam 6 baje robotics club ke liye 50 log ka room chahiye projector ke saath'..."
                className="w-full text-sm rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-400">
                Logged in as: <span className="font-semibold text-slate-700">{user?.username} ({user?.role})</span>
              </div>
              <button
                onClick={handleParseAi}
                disabled={parsing || !aiPrompt.trim()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-xl shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50"
              >
                {parsing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Parse Constraints</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Parsed Draft Display */}
          {parsedBooking && (
            <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-base">Parsed Booking Draft</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  Engine: {aiEngine.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Title</span>
                  <input
                    type="text"
                    value={parsedBooking.title || ''}
                    onChange={(e) => setParsedBooking({ ...parsedBooking, title: e.target.value })}
                    className="w-full font-semibold text-slate-800 border rounded p-1.5"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Category (Role Cap)</span>
                  <input
                    type="text"
                    value={parsedBooking.category || 'club_event'}
                    onChange={(e) => setParsedBooking({ ...parsedBooking, category: e.target.value })}
                    className="w-full font-semibold text-slate-800 border rounded p-1.5"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Day & Slot</span>
                  <div className="flex space-x-1">
                    <input
                      type="text"
                      value={parsedBooking.day || 'MON'}
                      onChange={(e) => setParsedBooking({ ...parsedBooking, day: e.target.value })}
                      className="w-1/2 font-semibold text-slate-800 border rounded p-1.5"
                    />
                    <input
                      type="number"
                      value={parsedBooking.from_period || 1}
                      onChange={(e) => setParsedBooking({ ...parsedBooking, from_period: Number(e.target.value), to_period: Number(e.target.value) })}
                      className="w-1/2 font-semibold text-slate-800 border rounded p-1.5"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Attendance</span>
                  <input
                    type="number"
                    value={parsedBooking.attendance || 30}
                    onChange={(e) => setParsedBooking({ ...parsedBooking, attendance: Number(e.target.value) })}
                    className="w-full font-semibold text-slate-800 border rounded p-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={handleSubmitBooking}
                  disabled={submitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Booking</span>
                    </>
                  )}
                </button>
              </div>

              {submissionResult && (
                <div
                  className={`p-4 rounded-xl border mt-3 text-sm ${
                    submissionResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="font-semibold mb-1">
                    {submissionResult.success ? 'Booking Submission Processed' : 'Booking Error'}
                  </div>
                  <div>{submissionResult.success ? submissionResult.data?.message : submissionResult.error}</div>
                  {submissionResult.success && submissionResult.data?.effective_category && (
                    <div className="text-xs text-emerald-700 mt-2">
                      Effective Category: <span className="font-bold">{submissionResult.data.effective_category}</span> (Role Cap: {submissionResult.data.role_category_cap})
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Spectra 25 Bookings */}
      {activeTab === 'spectra' && (
        <div className="space-y-4">
          {loadingBookings ? (
            <LoadingSpinner message="Loading Spectra fest bookings..." />
          ) : errorBookings ? (
            <ErrorMessage message={errorBookings} onRetry={fetchBookings} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Request ID</th>
                      <th className="py-3 px-4">Event Title</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Requested Slot</th>
                      <th className="py-3 px-4">Attendance</th>
                      <th className="py-3 px-4">Status & Decision</th>
                      <th className="py-3 px-4">Allocated Room / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {bookings.map((b) => {
                      const dec = b.decision;
                      const status = dec?.status || 'pending';
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-900">
                            {b.id}
                          </td>

                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {b.title}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {b.category.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{b.day}</span> P{b.from_period}-P{b.to_period}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                            <div className="flex items-center">
                              <Users className="w-3.5 h-3.5 text-slate-400 mr-1" />
                              {b.attendance}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {status === 'approved' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Approved</span>
                              </span>
                            )}
                            {status === 'alternative_offered' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Alternative Offered</span>
                              </span>
                            )}
                            {status === 'rejected' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Rejected</span>
                              </span>
                            )}
                            {status === 'pending' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs">
                            {dec?.allocated_room ? (
                              <div className="font-semibold text-emerald-800">
                                {dec.allocated_room} ({dec.day} P{dec.start_period}-P{(dec.start_period || 0) + (dec.duration_periods || 1) - 1})
                              </div>
                            ) : (
                              <div className="text-slate-500 italic max-w-xs truncate" title={dec?.reason}>
                                {dec?.reason || 'No allocation'}
                              </div>
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
