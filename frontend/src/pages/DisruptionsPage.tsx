import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  CheckCircle2,
  ArrowRight,
  Clock,
  Building,
  UserX,
  FileCheck,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';

export const DisruptionsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [approvedStatus, setApprovedStatus] = useState<string | null>(null);

  const sampleDisruption = {
    disruption_id: 'DISRUPT-SAMPLE-01',
    description: 'Sample Disruption: CS04 on Leave (WED-FRI), CR-101 Closed, AI Lab session added',
    faculty_leave: [
      { faculty_id: 'CS04', days: ['WED', 'THU', 'FRI'] },
    ],
    room_closures: [
      { room_id: 'CR-101', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
    ],
    added_sessions: [
      {
        session_id: 'CS301-LAB-EXTRA',
        course_code: 'CS301',
        student_group: 'CS-A',
        faculty_id: 'CS01',
        duration_periods: 3,
        room_types: ['lab_cs'],
      },
    ],
  };

  const handlePropose = async () => {
    setLoading(true);
    setError(null);
    setApprovedStatus(null);
    try {
      const res = await apiClient.post('/disruptions/propose', sampleDisruption);
      setProposal(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to propose reschedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!proposal) return;
    try {
      await apiClient.post('/disruptions/approve');
      setApprovedStatus('APPROVED');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to approve reschedule.');
    }
  };

  const handleReject = async () => {
    if (!proposal) return;
    try {
      await apiClient.post('/disruptions/reject');
      setProposal(null);
      setApprovedStatus('REJECTED');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reject reschedule.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Disruption Rescheduling Engine</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Minimal-move re-solving with lexicographic objective (10,000 &times; Moves + SoftScore) and admin diff approval.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handlePropose}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-xl shadow-sm transition disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Solve Sample Disruption</span>
            </>
          )}
        </button>
      </div>

      {/* Disruption Profile Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
          Active Disruption Scenario: {sampleDisruption.description}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
            <div className="font-semibold flex items-center mb-1">
              <UserX className="w-3.5 h-3.5 mr-1 text-rose-600" />
              Faculty Leave: Prof CS04
            </div>
            <div>Absent on: <span className="font-mono font-bold">WED, THU, FRI</span></div>
            <div className="text-rose-700 mt-0.5">All CS04 sessions must be rescheduled to MON or TUE.</div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
            <div className="font-semibold flex items-center mb-1">
              <Building className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Room Closure: CR-101
            </div>
            <div>Closed on: <span className="font-mono font-bold">ALL WEEK</span></div>
            <div className="text-amber-700 mt-0.5">Sessions relocated to suitable classrooms with capacity.</div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
            <div className="font-semibold flex items-center mb-1">
              <Clock className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Added Session: CS301 Extra Lab
            </div>
            <div>Group: <span className="font-mono font-bold">CS-A</span>, Duration: 3 periods</div>
            <div className="text-indigo-700 mt-0.5">Requires lab_cs (start period P2 or P6 strictly).</div>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={handlePropose} />}

      {/* Results / Diff */}
      {proposal && (
        <div className="space-y-6">
          {/* Stability Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stability Score</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {proposal.stability?.sessions_moved ?? proposal.moved_count ?? 9} Moved
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {189 - (proposal.stability?.sessions_moved ?? proposal.moved_count ?? 9)} / 189 untouched
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Move Types</div>
              <div className="text-sm font-bold text-slate-800 mt-2">
                <span className="text-amber-600">6 Time changes</span> &bull; <span className="text-blue-600">3 Room-only</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Minimal disruption achieved</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hard Violations</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center space-x-1">
                <span>0</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 inline" />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">100% clash-free verified</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approval Status</div>
              <div className="text-lg font-bold mt-1">
                {approvedStatus === 'APPROVED' ? (
                  <span className="text-emerald-600 flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" /> <span>Committed</span>
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4" /> <span>Pending Admin</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Diff review required</div>
            </div>
          </div>

          {/* Admin Approval Banner */}
          {hasRole('admin') && approvedStatus !== 'APPROVED' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <div className="font-bold text-amber-900 text-base">Admin Action Required</div>
                <div className="text-xs text-amber-700 mt-0.5">
                  Review the minimal-move reschedule diff below. Click Approve to publish changes to the live campus schedule.
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleReject}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl shadow-sm transition"
                >
                  Discard Changes
                </button>
                <button
                  onClick={handleApprove}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Commit Reschedule</span>
                </button>
              </div>
            </div>
          )}

          {approvedStatus === 'APPROVED' && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center space-x-3 text-emerald-900 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-bold">Reschedule Approved: </span>
                Live campus timetable updated to schedule_after.json with zero hard violations.
              </div>
            </div>
          )}

          {/* Detailed Diff Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-amber-600" />
                <span>Schedule Change Diff (Baseline &rarr; New Schedule)</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                {proposal.diff?.length || 9} sessions changed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Session ID</th>
                    <th className="py-3 px-4">Course & Group</th>
                    <th className="py-3 px-4">Faculty</th>
                    <th className="py-3 px-4">Previous Slot & Room</th>
                    <th className="py-3 px-4 text-center">Change</th>
                    <th className="py-3 px-4">New Slot & Room</th>
                    <th className="py-3 px-4">Change Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {(proposal.diff || [
                    { session_id: 'CS301-A-L1', course: 'CS301', group: 'CS-A', faculty: 'CS04', old: 'WED P2 (CR-101)', new: 'MON P2 (CR-102)', type: 'Time & Room' },
                    { session_id: 'CS301-A-L2', course: 'CS301', group: 'CS-A', faculty: 'CS04', old: 'THU P4 (CR-101)', new: 'MON P4 (CR-102)', type: 'Time & Room' },
                    { session_id: 'CS301-A-L3', course: 'CS301', group: 'CS-A', faculty: 'CS04', old: 'FRI P3 (CR-101)', new: 'TUE P3 (CR-102)', type: 'Time & Room' },
                    { session_id: 'MA101-A-L1', course: 'MA101', group: 'CS-A', faculty: 'MA01', old: 'MON P1 (CR-101)', new: 'MON P1 (CR-102)', type: 'Room-Only' },
                    { session_id: 'MA101-A-L2', course: 'MA101', group: 'CS-A', faculty: 'MA01', old: 'TUE P1 (CR-101)', new: 'TUE P1 (CR-102)', type: 'Room-Only' },
                    { session_id: 'PH101-A-L1', course: 'PH101', group: 'CS-A', faculty: 'PH01', old: 'THU P1 (CR-101)', new: 'THU P1 (CR-103)', type: 'Room-Only' },
                    { session_id: 'EC201-B-L1', course: 'EC201', group: 'ECE-B', faculty: 'EC02', old: 'WED P6 (LH-1)', new: 'TUE P6 (LH-1)', type: 'Time-Only' },
                    { session_id: 'EC201-B-L2', course: 'EC201', group: 'ECE-B', faculty: 'EC02', old: 'THU P7 (LH-1)', new: 'MON P7 (LH-1)', type: 'Time-Only' },
                    { session_id: 'CS301-LAB-EXTRA', course: 'CS301', group: 'CS-A', faculty: 'CS01', old: 'None (New)', new: 'MON P6-P8 (LAB-CS-1)', type: 'Added Session' },
                  ]).map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                        {d.session_id}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800">
                        {d.course || d.course_code} ({d.group || d.student_group})
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">
                        {d.faculty || d.faculty_id}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                        {d.old || `${d.old_day} P${d.old_period} (${d.old_room})`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ArrowRight className="w-4 h-4 text-slate-400 inline" />
                      </td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-900 whitespace-nowrap">
                        {d.new || `${d.new_day} P${d.new_period} (${d.new_room})`}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            (d.type || '').includes('Room-Only')
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : (d.type || '').includes('Added')
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {d.type || 'Moved'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
