import React from 'react';
import { Building2 } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const BookingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Venue Bookings & Finder</h1>
        <p className="text-sm text-slate-600 mt-1">
          Deterministic booking resolution with priority hierarchy: Exams &gt; Classes &gt; Events.
        </p>
      </div>

      <EmptyState
        title="Deterministic Booking Engine Ready"
        description="Processes booking requests deterministically, suggests valid alternatives, and produces machine-readable reasons."
        icon={<Building2 className="w-8 h-8 text-emerald-500" />}
      />
    </div>
  );
};
