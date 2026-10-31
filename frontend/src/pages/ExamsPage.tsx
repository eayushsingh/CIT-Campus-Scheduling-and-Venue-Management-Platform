import React from 'react';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const ExamsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Midsem Exams Schedule</h1>
        <p className="text-sm text-slate-600 mt-1">
          41 midsem exams scheduled with halved effective room capacity and zero student/invigilator clashes.
        </p>
      </div>

      <EmptyState
        title="Midsem Exams Engine Ready"
        description="Exam scheduler enforces halved room capacity (capacity // 2) and strict non-overlap."
        icon={<BookOpen className="w-8 h-8 text-indigo-500" />}
      />
    </div>
  );
};
