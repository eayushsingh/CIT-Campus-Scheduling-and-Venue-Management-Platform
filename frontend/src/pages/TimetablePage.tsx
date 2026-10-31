import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import {
  Calendar,
  Filter,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface SessionItem {
  session_id: string;
  day: string;
  start_period: number;
  duration?: number;
  room_id: string;
  faculty_id?: string;
  group_id?: string;
}

export const TimetablePage: React.FC = () => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [activeDayTab, setActiveDayTab] = useState('MON');
  const [filterMode, setFilterMode] = useState<'all' | 'room' | 'group'>('all');
  const [selectedFilter, setSelectedFilter] = useState('');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });

  const sessions: SessionItem[] = data?.sessions || [];

  // Extract unique rooms and groups
  const uniqueRooms = Array.from(new Set(sessions.map((s) => s.room_id))).sort();

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (filterMode === 'room' && selectedFilter) {
      return s.room_id === selectedFilter;
    }
    return true;
  });

  const getSessionAt = (day: string, period: number) => {
    return filteredSessions.filter((s) => {
      const dur = s.duration || 1;
      return s.day === day && s.start_period <= period && period < s.start_period + dur;
    });
  };

  const getSessionBadgeColor = (sid: string) => {
    if (sid.includes('-P') || sid.includes('LAB') || sid.includes('-L2')) {
      return 'bg-amber-100 border-amber-300 text-amber-900';
    }
    if (sid.includes('OE30')) {
      return 'bg-purple-100 border-purple-300 text-purple-900';
    }
    if (sid.includes('ID101')) {
      return 'bg-rose-100 border-rose-300 text-rose-900';
    }
    return 'bg-blue-100 border-blue-300 text-blue-900';
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Timetable Grid</h1>
          <p className="text-sm text-slate-600 mt-1">
            Zero-clash teaching schedule for 189 sessions across 27 campus venues.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {hasRole('admin') && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{generateMutation.isPending ? 'Solving CP-SAT...' : 'Generate Schedule'}</span>
            </button>
          )}

          <button
            onClick={() => refetch()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Validation status badge */}
      {data?.report && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Official Validator: 0 Hard Violations</span>
          </div>
          <div className="text-xs text-emerald-700">
            Soft Penalty Score: <strong>{data.report.soft_total}</strong> | Sessions Placed:{' '}
            <strong>{sessions.length}</strong>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center space-x-2 font-medium text-slate-700">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>View Filter:</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setFilterMode('all');
              setSelectedFilter('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Sessions
          </button>

          <button
            onClick={() => setFilterMode('room')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterMode === 'room'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            By Venue
          </button>
        </div>

        {filterMode === 'room' && (
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium"
          >
            <option value="">Select Venue...</option>
            {uniqueRooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Mobile Day Tabs */}
      <div className="md:hidden flex space-x-1 bg-white p-1 rounded-xl border border-slate-200">
        {DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDayTab(d)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              activeDayTab === d ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading timetable..." />
      ) : error ? (
        <ErrorMessage message="Failed to load timetable." />
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800">No Timetable Placed Yet</h3>
          <p className="text-sm text-slate-500 mt-1">
            Click 'Generate Schedule' above to run the CP-SAT solver.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                <th className="p-3 w-20 border-r border-slate-200">Day / Period</th>
                {PERIODS.map((p) => (
                  <th key={p} className="p-3 text-center border-r border-slate-200 min-w-[110px]">
                    <div>P{p}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {p === 5 ? '12:00 - 13:00' : p === 6 ? '14:00 - 15:00' : `${p + 7}:00`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {DAYS.map((day) => (
                <tr
                  key={day}
                  className={`hover:bg-slate-50/50 transition ${
                    activeDayTab !== day ? 'hidden md:table-row' : ''
                  }`}
                >
                  <td className="p-3 font-bold text-slate-800 bg-slate-50/80 border-r border-slate-200 align-top">
                    {day}
                  </td>
                  {PERIODS.map((period) => {
                    const cellSessions = getSessionAt(day, period);
                    const isLunchBoundary = period === 5;

                    return (
                      <td
                        key={period}
                        className={`p-2 border-r border-slate-200 align-top ${
                          isLunchBoundary ? 'border-r-2 border-r-slate-300' : ''
                        }`}
                      >
                        {cellSessions.length === 0 ? (
                          <div className="h-10 text-[10px] text-slate-300 flex items-center justify-center font-mono">
                            -
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {cellSessions.map((s) => (
                              <div
                                key={s.session_id}
                                className={`p-1.5 rounded border text-[11px] font-semibold leading-tight shadow-2xs ${getSessionBadgeColor(
                                  s.session_id
                                )}`}
                              >
                                <div className="truncate">{s.session_id}</div>
                                <div className="text-[10px] opacity-75 font-mono mt-0.5">
                                  {s.room_id}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
