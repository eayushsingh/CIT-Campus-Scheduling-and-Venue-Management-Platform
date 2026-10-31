import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../state/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/bookings/');
      const allReqs = res.data?.booking_requests || [];
      // Any booking that has status pending or alternative_offered
      const pending = allReqs.filter(
        (b: any) => !b.decision || b.decision.status === 'pending' || b.decision.status === 'alternative_offered'
      );
      setPendingBookings(pending);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    setActionMessage(`Booking ${id} marked as ${action.toUpperCase()} by ${user?.username}`);
    setPendingBookings((prev) => prev.filter((b) => b.id !== id));
    setTimeout(() => setActionMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Pending Approvals Queue</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Review and approve venue allocations, timetable adjustments, and alternative offers.
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
          Role: <span className="font-bold uppercase">{user?.role}</span>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading pending approvals queue..." />
      ) : pendingBookings.length === 0 ? (
        <EmptyState
          title="No pending approval items"
          description="All venue bookings and disruption changes are fully processed and up to date."
          icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {pendingBookings.length} Items Requiring Review
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-200 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {b.id}
                    </span>
                    <span className="font-bold text-slate-800 text-base">{b.title}</span>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                      {b.category?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{b.day}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Periods P{b.from_period}-P{b.to_period} ({b.duration_periods || 1} hrs)</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Requested Room: {b.requested_room || 'Any suitable'}</span>
                    </span>
                  </div>

                  {b.decision?.reason && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                      <span className="font-semibold">Engine note: </span>
                      {b.decision.reason}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2 w-full md:w-auto justify-end">
                  <button
                    onClick={() => handleAction(b.id, 'reject')}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl shadow-sm transition"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction(b.id, 'approve')}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Allocation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
