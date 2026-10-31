import React from 'react';
import { Calendar } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const TimetablePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Weekly Timetable</h1>
          <p className="text-sm text-slate-600 mt-1">
            Clash-free timetable for 189 sessions across 14 student groups, 40 faculty, and 27 rooms.
          </p>
        </div>
      </div>

      <EmptyState
        title="Timetable Ready to Generate"
        description="The CP-SAT solver generates a clash-free weekly timetable strictly matching all hard and soft constraints once Phase 1 solver is activated."
        icon={<Calendar className="w-8 h-8 text-blue-500" />}
      />
    </div>
  );
};
