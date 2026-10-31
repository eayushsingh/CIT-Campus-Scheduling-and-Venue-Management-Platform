import React from 'react';
import { CheckSquare } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const ApprovalsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pending Approvals</h1>
        <p className="text-sm text-slate-600 mt-1">
          Review schedule changes, bumped classes, and department venue requests.
        </p>
      </div>

      <EmptyState
        title="No Pending Approvals"
        description="All booking and rescheduling diffs requiring coordinator or admin sign-off appear here."
        icon={<CheckSquare className="w-8 h-8 text-blue-500" />}
      />
    </div>
  );
};
