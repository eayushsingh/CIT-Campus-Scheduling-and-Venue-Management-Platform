import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const DisruptionsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Disruption Rescheduling</h1>
        <p className="text-sm text-slate-600 mt-1">
          Minimal-move re-solving for faculty leave, room closures, and new session additions.
        </p>
      </div>

      <EmptyState
        title="Minimal-Move Rescheduler Ready"
        description="Lexicographic objective minimizes moved sessions and provides clear old-to-new diffs with admin approval."
        icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
      />
    </div>
  );
};
