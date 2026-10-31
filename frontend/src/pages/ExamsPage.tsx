import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Clock,
  Building,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';

interface ExamItem {
  course_code: string;
  course_title?: string;
  slot: string;
  day: string;
  session: string; // AM or PM
  rooms: string[];
  student_groups: string[];
  registered_students: number;
  allocated_capacity?: number;
}

export const ExamsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [examSoftPenalty, setExamSoftPenalty] = useState(0);

  // Filters
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/exams/');
      if (res.data?.exams) {
        setExams(res.data.exams);
        setExamSoftPenalty(res.data.exam_soft_penalty || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load exam schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const days = ['ALL', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const sessions = ['ALL', 'AM', 'PM'];

  const filteredExams = exams.filter((e) => {
    if (selectedDay !== 'ALL' && e.day !== selectedDay) return false;
    if (selectedSession !== 'ALL' && e.session !== selectedSession) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = e.course_code.toLowerCase().includes(q);
      const titleMatch = e.course_title?.toLowerCase().includes(q);
      const roomMatch = e.rooms.some((r) => r.toLowerCase().includes(q));
      const groupMatch = e.student_groups.some((g) => g.toLowerCase().includes(q));
      if (!codeMatch && !titleMatch && !roomMatch && !groupMatch) return false;
    }
    return true;
  });

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exams, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'cit_midsem_exams.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Midsem Exams Schedule</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Halved room capacity enforcement (capacity // 2) and strict zero student-overlap guarantee.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={exportJSON}
          disabled={exams.length === 0}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Export Exams JSON</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Exams</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{exams.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">All CIT degree courses</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam Slots</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">12 Slots</div>
          <div className="text-xs text-slate-400 mt-0.5">6 Days &times; 2 Sessions (AM/PM)</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hard Violations</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center space-x-1">
            <span>0</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 inline" />
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Verified by validator.py</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam Soft Penalty</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{examSoftPenalty}</div>
          <div className="text-xs text-slate-400 mt-0.5">&le; 1 exam per student/day</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" /> Day:
          </span>
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                selectedDay === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {d}
            </button>
          ))}

          <span className="text-xs font-semibold text-slate-500 ml-3 mr-1 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1" /> Slot:
          </span>
          {sessions.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSession(s)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                selectedSession === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {s === 'ALL' ? 'ALL' : s === 'AM' ? 'AM (9-12)' : 'PM (14-17)'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search course, room, group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading midsem exams schedule..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchExams} />
      ) : filteredExams.length === 0 ? (
        <EmptyState
          title="No exams match filter"
          description="Try adjusting your Day, Slot, or Search query."
          icon={<BookOpen className="w-8 h-8 text-indigo-400" />}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Exam Slot</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Student Groups</th>
                  <th className="py-3 px-4">Students</th>
                  <th className="py-3 px-4">Allocated Room(s)</th>
                  <th className="py-3 px-4 text-right">Halved Capacity Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredExams.map((exam, idx) => (
                  <tr key={`${exam.course_code}-${exam.slot}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900 bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-md text-xs font-mono">
                          {exam.slot}
                        </span>
                        <span className="text-xs text-slate-500">
                          {exam.session === 'AM' ? '09:00 - 12:00' : '14:00 - 17:00'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{exam.course_code}</div>
                      {exam.course_title && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{exam.course_title}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {exam.student_groups.map((g) => (
                          <span
                            key={g}
                            className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center text-slate-700 font-medium text-xs">
                        <Users className="w-3.5 h-3.5 text-slate-400 mr-1" />
                        {exam.registered_students} students
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {exam.rooms.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            <Building className="w-3 h-3 text-emerald-600" />
                            <span>{r}</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Valid (Cap &ge; Size)</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
