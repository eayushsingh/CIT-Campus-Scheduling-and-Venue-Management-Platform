import React from 'react';
import { Role } from '../state/AuthContext';

export const RoleBadge: React.FC<{ role: Role; className?: string }> = ({ role, className = '' }) => {
  const styles: Record<Role, { bg: string; text: string; label: string }> = {
    admin: {
      bg: 'bg-purple-100 border-purple-200',
      text: 'text-purple-800',
      label: 'Admin',
    },
    coordinator: {
      bg: 'bg-blue-100 border-blue-200',
      text: 'text-blue-800',
      label: 'Dept Coordinator',
    },
    faculty: {
      bg: 'bg-emerald-100 border-emerald-200',
      text: 'text-emerald-800',
      label: 'Faculty',
    },
    club_rep: {
      bg: 'bg-amber-100 border-amber-200',
      text: 'text-amber-800',
      label: 'Club Representative',
    },
  };

  const current = styles[role] || {
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-800',
    label: role,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${current.bg} ${current.text} ${className}`}
    >
      {current.label}
    </span>
  );
};
