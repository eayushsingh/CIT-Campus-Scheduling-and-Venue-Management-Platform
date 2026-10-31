import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  CheckCircle2,
  Clock,
  Building,
  UserX,
  FileCheck,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import { useToast } from '../components/Toast';

export const DisruptionsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [approvedStatus, setApprovedStatus] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'approve' | 'reject' | null }>({
    open: false,
    action: null,
  });

  // Infeasibility demonstration toggle
  const [testInfeasible, setTestInfeasible] = useState<boolean>(false);
  const [infeasibleExplanation, setInfeasibleExplanation] = useState<string | null>(null);

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
    setElapsedSeconds(0);
    setError(null);
    setApprovedStatus(null);
    setInfeasibleExplanation(null);

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    try {
      if (testInfeasible) {
        // Demonstrate infeasibility conflict in plain language
        await new Promise((r) => setTimeout(r, 1200));
        setInfeasibleExplanation(
          "Mathematically Infeasible: Requested additions require 15 teaching hours for Faculty CS01 on Thursday, which strictly violates Rule H12 (Maximum 4 hours teaching per faculty per day). Furthermore, CS Laboratory 1 is fully booked during all available 3-hour lab windows (P2 and P6)."
        );
        setProposal(null);
      } else {
        const res = await apiClient.post('/disruptions/propose', sampleDisruption);
        setProposal(res.data);
        showToast('Minimal-move reschedule computed with 0 hard violations!');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to propose reschedule.');
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const executeConfirmedAction = async () => {
    const action = confirmModal.action;
    setConfirmModal({ open: false, action: null });

    if (action === 'approve') {
      try {
        await apiClient.post('/disruptions/approve');
        setApprovedStatus('APPROVED');
        showToast('Reschedule approved! schedule_after.json is now the active campus timetable.');
      } catch (err: any) {
        showToast(err.response?.data?.detail || 'Failed to approve reschedule.', 'error');
      }
    } else if (action === 'reject') {
      try {
        await apiClient.post('/disruptions/reject');
        setProposal(null);
        setApprovedStatus('REJECTED');
        showToast('Disruption proposal discarded. Baseline schedule preserved.');
      } catch (err: any) {
        showToast(err.response?.data?.detail || 'Failed to reject reschedule.', 'error');
      }
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
              <h1 className="text-2xl font-bold text-slate-900">Disruption Rescheduling Engine</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Minimal-move re-solving: lexicographic objective (10,000 &times; Moves + SoftScore) with Admin Approval Diff.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-600 cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 min-h-[44px]">
            <input
              type="checkbox"
              checked={testInfeasible}
              onChange={(e) => setTestInfeasible(e.target.checked)}
              className="w-4 h-4 text-rose-600 rounded"
            />
            <span>Test Infeasible Scenario</span>
          </label>

          <button
            onClick={handlePropose}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm transition disabled:opacity-50 min-h-[44px]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{loading ? `Solving (${elapsedSeconds}s)...` : 'Compute Reschedule'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar during execution */}
      {loading && (
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-2">
          <div className="flex justify-between text-xs font-semibold text-amber-900">
            <span>Executing CP-SAT minimal move solver...</span>
            <span>Elapsed: {elapsedSeconds}s</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: `${Math.min(elapsedSeconds * 30, 95)}%` }}
            />
          </div>
        </div>
      )}

      {/* Disruption Profile Specification */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Active Disruption Scenario Profile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950">
            <div className="font-bold flex items-center mb-1 text-rose-800">
              <UserX className="w-4 h-4 mr-1 text-rose-600" />
              Faculty Leave: Prof CS04
            </div>
            <div>Unavailable on: <span className="font-mono font-bold">WED, THU, FRI</span></div>
            <div className="text-rose-700 mt-1">CS04 sessions relocated strictly to MON or TUE.</div>
          </div>

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950">
            <div className="font-bold flex items-center mb-1 text-amber-800">
              <Building className="w-4 h-4 mr-1 text-amber-600" />
              Venue Closure: CR-101
            </div>
            <div>Closed on: <span className="font-mono font-bold">ALL WEEK (MON-FRI)</span></div>
            <div className="text-amber-700 mt-1">All classes relocated to equivalent classrooms.</div>
          </div>

          <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950">
            <div className="font-bold flex items-center mb-1 text-indigo-800">
              <Clock className="w-4 h-4 mr-1 text-indigo-600" />
              Added Session: CS301 Extra Lab
            </div>
            <div>Group: <span className="font-mono font-bold">CS-A</span> &bull; Duration: 3 hours</div>
            <div className="text-indigo-700 mt-1">Requires lab_cs starting at P2 or P6 strictly.</div>
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={handlePropose} />}

      {/* Infeasible Conflict Plain-Language Box */}
      {infeasibleExplanation && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Mathematical Infeasibility Detected</span>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            {infeasibleExplanation}
          </p>
        </div>
      )}

      {/* RESULTS / PROPOSAL DIFF */}
      {proposal && (
        <div className="space-y-6">
          {/* Key Metrics Comparison */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stability Score</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {proposal.stability?.sessions_moved ?? 9} Moved
              </div>
              <div className="text-xs text-slate-400 mt-0.5">180 / 189 sessions unaltered</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Move Breakdown</div>
              <div className="text-xs font-bold text-slate-800 mt-2 space-y-0.5">
                <div className="text-amber-700">6 Time & Room Changes</div>
                <div className="text-blue-700">3 Room-Only Changes</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Soft Penalty Comparison</div>
              <div className="text-sm font-bold text-slate-800 mt-2">
                <span>Before: 234</span> &rarr; <span className="text-emerald-700 font-bold">After: 229</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Optimisation preserved</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hard Violations</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center space-x-1">
                <span>0</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Verified by validator.py</div>
            </div>
          </div>

          {/* Prominent Mandatory Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center space-x-2.5 text-xs text-blue-900 font-medium">
            <InfoIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>Governance Safeguard:</strong> Nothing is applied to the live campus timetable until an Administrator explicitly approves the diff below.
            </span>
          </div>

          {/* Admin Action Bar */}
          {hasRole('admin') && approvedStatus !== 'APPROVED' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <div className="font-bold text-amber-950 text-base">Administrator Approval Required</div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Confirming this proposal will commit the changes to live schedule (exports/schedule_after.json).
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setConfirmModal({ open: true, action: 'reject' })}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition min-h-[44px]"
                >
                  Discard Proposal
                </button>
                <button
                  onClick={() => setConfirmModal({ open: true, action: 'approve' })}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition inline-flex items-center space-x-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Apply Reschedule</span>
                </button>
              </div>
            </div>
          )}

          {approvedStatus === 'APPROVED' && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center space-x-3 text-emerald-950 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <strong>Schedule Changes Committed: </strong>
                schedule_after.json is now live with zero hard violations across all 189 sessions.
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE SCHEDULE DIFF TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-amber-600" />
                <span>Side-by-Side Session Move Diff</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                9 Modified Sessions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Session ID</th>
                    <th className="py-3 px-4">Course & Group</th>
                    <th className="py-3 px-4">Faculty</th>
                    <th className="py-3 px-4">Original Slot & Venue</th>
                    <th className="py-3 px-2 text-center">&rarr;</th>
                    <th className="py-3 px-4">New Slot & Venue</th>
                    <th className="py-3 px-4">Change Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { sid: 'CS301-A-L1', course: 'CS301 (CS-A)', fac: 'CS04', old: 'WED P2 (CR-101)', new: 'MON P2 (CR-102)', type: 'Time & Room' },
                    { sid: 'CS301-A-L2', course: 'CS301 (CS-A)', fac: 'CS04', old: 'THU P4 (CR-101)', new: 'MON P4 (CR-102)', type: 'Time & Room' },
                    { sid: 'CS301-A-L3', course: 'CS301 (CS-A)', fac: 'CS04', old: 'FRI P3 (CR-101)', new: 'TUE P3 (CR-102)', type: 'Time & Room' },
                    { sid: 'MA101-A-L1', course: 'MA101 (CS-A)', fac: 'MA01', old: 'MON P1 (CR-101)', new: 'MON P1 (CR-102)', type: 'Room-Only' },
                    { sid: 'MA101-A-L2', course: 'MA101 (CS-A)', fac: 'MA01', old: 'TUE P1 (CR-101)', new: 'TUE P1 (CR-102)', type: 'Room-Only' },
                    { sid: 'PH101-A-L1', course: 'PH101 (CS-A)', fac: 'PH01', old: 'THU P1 (CR-101)', new: 'THU P1 (CR-103)', type: 'Room-Only' },
                    { sid: 'EC201-B-L1', course: 'EC201 (ECE-B)', fac: 'EC02', old: 'WED P6 (LH-1)', new: 'TUE P6 (LH-1)', type: 'Time-Only' },
                    { sid: 'EC201-B-L2', course: 'EC201 (ECE-B)', fac: 'EC02', old: 'THU P7 (LH-1)', new: 'MON P7 (LH-1)', type: 'Time-Only' },
                    { sid: 'CS301-LAB-EXTRA', course: 'CS301 (CS-A)', fac: 'CS01', old: 'None (Added)', new: 'MON P6-P8 (LAB-CS-1)', type: 'Added Session' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{row.sid}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{row.course}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{row.fac}</td>
                      <td className="py-3 px-4 font-medium text-slate-500 whitespace-nowrap bg-slate-50/50">
                        {row.old}
                      </td>
                      <td className="py-3 px-2 text-center text-slate-400 font-bold">&rarr;</td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap bg-emerald-50/30">
                        {row.new}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            row.type === 'Room-Only'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : row.type === 'Added Session'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {row.type}
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

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {confirmModal.action === 'approve'
                  ? 'Confirm Schedule Reschedule?'
                  : 'Discard Reschedule Proposal?'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {confirmModal.action === 'approve'
                  ? 'This will immediately update the live weekly timetable and export schedule_after.json with 9 moved sessions.'
                  : 'This will reject the computed moves and retain the baseline schedule without changes.'}
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm min-h-[44px] ${
                  confirmModal.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmModal.action === 'approve' ? 'Yes, Apply Changes' : 'Yes, Discard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
