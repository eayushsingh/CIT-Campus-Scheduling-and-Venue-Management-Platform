import React, { useState } from 'react';
import { Shield, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';

export const AdminPage: React.FC = () => {
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleResetData = async () => {
    if (!window.confirm('Reset all demo data back to clean initial state?')) {
      return;
    }
    setResetting(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.post('/admin/reset');
      setStatusMessage({
        type: 'success',
        text: res.data?.message || 'Demo data successfully reset!',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reset demo data.',
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin Control Center</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage system state, priority configuration, and demo resets for live judging.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Reset Demo Data Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <RotateCcw className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Reset Demo Data</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4 max-w-2xl">
          Instantly drops and reseeds the database with clean original data (4 demo accounts, original constraints, initial state). Crucial during live hackathon judging to return to a pristine state.
        </p>
        <button
          onClick={handleResetData}
          disabled={resetting}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-lg shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50"
        >
          {resetting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Clean Demo State</span>
            </>
          )}
        </button>
      </div>

      {/* Priority Rules Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Booking Priority Hierarchy</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Current deterministic resolution order for venue clash resolution:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <li>Priority 1: Midsem & Endsem Exams</li>
          <li>Priority 2: Regular Teaching Classes & Labs</li>
          <li>Priority 3: Institute Events & Convocations</li>
          <li>Priority 4: Guest Lectures & Academic Workshops</li>
          <li>Priority 5: Departmental Events</li>
          <li>Priority 6: Student Club Events & Gatherings</li>
        </ol>
      </div>
    </div>
  );
};
