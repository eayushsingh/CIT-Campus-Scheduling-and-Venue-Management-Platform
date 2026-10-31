import React from 'react';

export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}> = ({ size = 'md', label = 'Loading...', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 space-y-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-blue-600 border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {label && <p className="text-sm font-medium text-slate-500">{label}</p>}
    </div>
  );
};

export const LoadingSkeleton: React.FC<{
  rows?: number;
  className?: string;
}> = ({ rows = 4, className = '' }) => {
  return (
    <div className={`w-full space-y-3 animate-pulse ${className}`}>
      <div className="h-6 bg-slate-200 rounded w-1/3"></div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-4 bg-slate-200 rounded w-full"></div>
        ))}
      </div>
    </div>
  );
};
