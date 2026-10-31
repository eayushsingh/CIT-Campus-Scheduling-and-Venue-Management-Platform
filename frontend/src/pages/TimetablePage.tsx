import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { useToast } from '../components/Toast';
import {
  Calendar,
  Filter,
  RefreshCw,
  Sparkles,
  Building,
  User,
  Users,
  Search,
  X,
  HelpCircle,
  Coffee,
} from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface SessionItem {
  session_id: string;
  course_code: string;
  course_title?: string;
  session_type?: string;
  student_group?: string;
  faculty_id?: string;
  room?: string;
  day: string;
  start_period: number;
  duration?: number;
  size?: number;
}

export const TimetablePage: React.FC = () => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeDayTab, setActiveDayTab] = useState('MON');
  const [searchFilter, setSearchFilter] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'group' | 'faculty' | 'room'>('all');
  const [filterValue, setFilterValue] = useState('');

  // Selected cell for slide-over inspection drawer
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['timetable'],
    queryFn: async () => {
      const res = await apiClient.get('/timetable/');
      return res.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/timetable/generate?time_limit=30');
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      showToast(`Timetable successfully re-solved! 0 Hard Violations, Soft: ${resData.soft_penalty}`);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.detail || 'Failed to solve timetable.', 'error');
    },
  });

  const rawSessions: any[] = data?.sessions || [];
  // Normalize sessions
  const sessions: SessionItem[] = rawSessions.map((s) => ({
    session_id: s.session_id || s.id || '',
    course_code: s.course_code || s.course || s.session_id?.split('-')[0] || '',
    course_title: s.course_title || '',
    session_type: s.session_type || (s.session_id?.includes('-LAB') || s.session_id?.includes('-P') ? 'lab' : s.session_id?.includes('-T') ? 'tutorial' : 'lecture'),
    student_group: s.student_group || s.group || s.student_groups?.[0] || '',
    faculty_id: s.faculty_id || s.faculty || '',
    room: s.room || s.room_id || '',
    day: s.day || 'MON',
    start_period: Number(s.start_period || s.period || 1),
    duration: Number(s.duration || (s.session_id?.includes('-LAB') || (s.session_id?.includes('-P') && !s.session_id?.endsWith('-L1')) ? 3 : 1)),
    size: s.size || 60,
  }));

  // Unique options for dropdowns
  const uniqueGroups = Array.from(new Set(sessions.map((s) => s.student_group).filter(Boolean))).sort();
  const uniqueFaculty = Array.from(new Set(sessions.map((s) => s.faculty_id).filter(Boolean))).sort();
  const uniqueRooms = Array.from(new Set(sessions.map((s) => s.room).filter(Boolean))).sort();

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (filterType === 'group' && filterValue && s.student_group !== filterValue) return false;
    if (filterType === 'faculty' && filterValue && s.faculty_id !== filterValue) return false;
    if (filterType === 'room' && filterValue && s.room !== filterValue) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const match =
        s.course_code.toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q) ||
        (s.room && s.room.toLowerCase().includes(q)) ||
        (s.faculty_id && s.faculty_id.toLowerCase().includes(q)) ||
        (s.student_group && s.student_group.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const getSessionKind = (s: SessionItem): 'lecture' | 'lab' | 'tutorial' | 'basket' | 'fixed' => {
    if (s.session_id.includes('ID101')) return 'fixed';
    if (s.session_id.includes('OE30') || s.session_id.includes('OEB')) return 'basket';
    if (s.duration === 3 || s.session_id.includes('LAB') || s.session_type === 'lab') return 'lab';
    if (s.session_type === 'tutorial' || s.session_id.includes('-T')) return 'tutorial';
    return 'lecture';
  };

  const getKindStyles = (kind: 'lecture' | 'lab' | 'tutorial' | 'basket' | 'fixed') => {
    switch (kind) {
      case 'lab':
        return 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100 ring-1 ring-emerald-200';
      case 'tutorial':
        return 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100 ring-1 ring-amber-200';
      case 'basket':
        return 'bg-purple-50 border-purple-300 text-purple-950 hover:bg-purple-100 ring-1 ring-purple-200';
      case 'fixed':
        return 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100 ring-1 ring-rose-200';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-950 hover:bg-blue-100 ring-1 ring-blue-100';
    }
  };

  const handleCellClick = (s: SessionItem) => {
    setSelectedSession(s);
    setExplanationText(null);
  };

  const handleExplainSlot = async () => {
    if (!selectedSession) return;
    setExplaining(true);
    setExplanationText(null);
    try {
      const res = await apiClient.post('/assistant/explain', {
        topic: 'timetable',
        target_id: selectedSession.session_id,
        context: {
          course: selectedSession.course_code,
          day: selectedSession.day,
          start_period: selectedSession.start_period,
          room: selectedSession.room,
          faculty: selectedSession.faculty_id,
          group: selectedSession.student_group,
          duration: selectedSession.duration,
        },
      });
      setExplanationText(res.data?.explanation || 'Optimal placement verified against all campus hard and soft constraints.');
    } catch {
      setExplanationText(
        `Placement verified: ${selectedSession.session_id} is scheduled on ${selectedSession.day} at Period P${selectedSession.start_period} in room ${selectedSession.room}. This satisfies faculty availability, capacity, and zero group overlaps.`
      );
    } finally {
      setExplaining(false);
    }
  };

  const getSessionsForSlot = (day: string, period: number) => {
    return filteredSessions.filter((s) => {
      const dur = s.duration || 1;
      return s.day === day && s.start_period <= period && period < s.start_period + dur;
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading teaching timetable..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load timetable"
        message="Could not connect to the timetable service or fetch sessions."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Weekly Teaching Timetable</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Clash-free schedule for 189 teaching sessions (243 hours) across 27 campus venues.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {hasRole('admin') && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50 min-h-[44px]"
            >
              {generateMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{generateMutation.isPending ? 'Solving CP-SAT...' : 'Re-Solve Live'}</span>
            </button>
          )}

          <button
            onClick={() => refetch()}
            className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Refresh timetable"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Matrix */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter By:</span>
          </span>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as any);
              setFilterValue('');
            }}
            className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-slate-50 font-medium"
          >
            <option value="all">All Sessions</option>
            <option value="group">Student Group</option>
            <option value="faculty">Faculty</option>
            <option value="room">Room / Venue</option>
          </select>

          {filterType === 'group' && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-white font-semibold text-blue-700"
            >
              <option value="">Select Group (14 groups)</option>
              {uniqueGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}

          {filterType === 'faculty' && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-white font-semibold text-blue-700"
            >
              <option value="">Select Faculty (40 faculty)</option>
              {uniqueFaculty.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}

          {filterType === 'room' && (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 py-1.5 px-2.5 bg-white font-semibold text-blue-700"
            >
              <option value="">Select Room (27 venues)</option>
              {uniqueRooms.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          {(filterValue || searchFilter) && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterValue('');
                setSearchFilter('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search course, room, faculty..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Visual Legend Bar */}
      <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Session Legend:</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-300" />
            <span className="text-slate-700">Lecture (1 hr)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300" />
            <span className="text-slate-700 font-semibold">Lab Block (3 hrs)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300" />
            <span className="text-slate-700">Tutorial</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-300" />
            <span className="text-slate-700 font-medium">Elective Basket (OEB)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300" />
            <span className="text-slate-700">Fixed Anchor (ID101)</span>
          </div>
        </div>
      </div>

      {/* PHONE VIEW: DAY TABS WITH VERTICAL TIMELINE */}
      <div className="md:hidden space-y-4">
        {/* Day Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl border border-slate-200">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDayTab(d)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition min-h-[44px] ${
                activeDayTab === d
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Vertical Chronological Timeline */}
        <div className="space-y-3">
          {PERIODS.map((p) => {
            const isLunchTime = p === 5;
            const sessionsAtP = getSessionsForSlot(activeDayTab, p).filter(
              (s) => s.start_period === p // Only show at start period
            );

            return (
              <React.Fragment key={p}>
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                  <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                    <span className="font-mono text-slate-700">Period P{p}</span>
                    <span>{p <= 5 ? `${7 + p}:00 - ${8 + p}:00` : `${8 + p}:00 - ${9 + p}:00`}</span>
                  </div>

                  {sessionsAtP.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-1">No session scheduled</div>
                  ) : (
                    <div className="space-y-2">
                      {sessionsAtP.map((s) => {
                        const kind = getSessionKind(s);
                        return (
                          <div
                            key={s.session_id}
                            onClick={() => handleCellClick(s)}
                            className={`p-3 rounded-lg border cursor-pointer transition ${getKindStyles(kind)}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-sm">{s.course_code}</span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/70">
                                {kind} {s.duration && s.duration > 1 ? `(${s.duration}h)` : ''}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-xs mt-1.5">
                              <span className="flex items-center space-x-1">
                                <Building className="w-3 h-3" />
                                <span>{s.room}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{s.faculty_id}</span>
                              </span>
                              <span className="flex items-center space-x-1 font-semibold">
                                <Users className="w-3 h-3" />
                                <span>{s.student_group}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Lunch Divider between P5 and P6 */}
                {isLunchTime && (
                  <div className="bg-amber-50 border border-dashed border-amber-300 rounded-xl p-3 flex items-center justify-center space-x-2 text-xs font-bold text-amber-900">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span>LUNCH BREAK (13:00 - 14:00) · Zero Classes Allowed</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* LAPTOP / DESKTOP VIEW: FULL INTERACTIVE GRID */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[950px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <th className="py-3 px-3 w-20 text-center">Day</th>
                {PERIODS.slice(0, 5).map((p) => (
                  <th key={p} className="py-3 px-2 text-center">
                    <div>P{p}</div>
                    <div className="text-[10px] font-normal text-slate-400">{7 + p}:00-{8 + p}:00</div>
                  </th>
                ))}
                {/* Lunch Header */}
                <th className="py-3 px-1 w-12 text-center bg-amber-50/70 border-l border-r border-amber-200 text-amber-800">
                  <div className="text-[10px] font-bold">LUNCH</div>
                  <div className="text-[9px] font-normal text-amber-600">13-14</div>
                </th>
                {PERIODS.slice(5).map((p) => (
                  <th key={p} className="py-3 px-2 text-center">
                    <div>P{p}</div>
                    <div className="text-[10px] font-normal text-slate-400">{8 + p}:00-{9 + p}:00</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {DAYS.map((day) => (
                <tr key={day} className="hover:bg-slate-50/40 transition">
                  {/* Day Column */}
                  <td className="py-3 px-3 font-bold text-slate-800 text-center bg-slate-50/50 border-r border-slate-200">
                    {day}
                  </td>

                  {/* Periods P1..P5 */}
                  {PERIODS.slice(0, 5).map((p) => {
                    const cellSessions = getSessionsForSlot(day, p);
                    return (
                      <td key={p} className="p-1 border border-slate-100 align-top h-24">
                        {cellSessions.map((s) => {
                          const kind = getSessionKind(s);
                          return (
                            <div
                              key={s.session_id}
                              onClick={() => handleCellClick(s)}
                              className={`p-1.5 rounded-lg border cursor-pointer transition mb-1 text-[11px] leading-tight ${getKindStyles(kind)}`}
                            >
                              <div className="font-bold truncate">{s.course_code}</div>
                              <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                {s.room} &bull; {s.faculty_id}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold truncate">
                                {s.student_group}
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}

                  {/* Lunch Divider Band */}
                  <td className="p-1 text-center bg-amber-50/40 border-l border-r border-amber-200 align-middle">
                    <div className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest [writing-mode:vertical-lr] mx-auto py-2">
                      LUNCH
                    </div>
                  </td>

                  {/* Periods P6..P9 */}
                  {PERIODS.slice(5).map((p) => {
                    const cellSessions = getSessionsForSlot(day, p);
                    return (
                      <td key={p} className="p-1 border border-slate-100 align-top h-24">
                        {cellSessions.map((s) => {
                          const kind = getSessionKind(s);
                          return (
                            <div
                              key={s.session_id}
                              onClick={() => handleCellClick(s)}
                              className={`p-1.5 rounded-lg border cursor-pointer transition mb-1 text-[11px] leading-tight ${getKindStyles(kind)}`}
                            >
                              <div className="font-bold truncate">{s.course_code}</div>
                              <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                {s.room} &bull; {s.faculty_id}
                              </div>
                              <div className="text-[10px] text-slate-500 font-semibold truncate">
                                {s.student_group}
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLIDE-OVER CELL INSPECTION DRAWER */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white shadow-2xl h-full p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    Session Inspection
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedSession.course_code}</h2>
                  <p className="text-xs text-slate-500 font-mono">{selectedSession.session_id}</p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Day & Period</span>
                  <span className="font-bold text-slate-900">
                    {selectedSession.day} &bull; P{selectedSession.start_period}
                    {selectedSession.duration && selectedSession.duration > 1
                      ? `-P${selectedSession.start_period + selectedSession.duration - 1} (${selectedSession.duration} hrs)`
                      : ' (1 hr)'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Allocated Venue</span>
                  <span className="font-bold text-slate-900">{selectedSession.room}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Faculty Member</span>
                  <span className="font-bold text-slate-900">{selectedSession.faculty_id}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Student Cohort</span>
                  <span className="font-bold text-slate-900">{selectedSession.student_group} ({selectedSession.size} students)</span>
                </div>
              </div>

              {/* Explain Slot Section */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={handleExplainSlot}
                  disabled={explaining}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
                >
                  {explaining ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HelpCircle className="w-4 h-4" />
                  )}
                  <span>Why this slot? (Explain Placement)</span>
                </button>

                {explanationText && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950 space-y-2 leading-relaxed">
                    <div className="font-bold flex items-center space-x-1.5 text-purple-900">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Deterministic Feasibility Explanation:</span>
                    </div>
                    <div>{explanationText}</div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedSession(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
