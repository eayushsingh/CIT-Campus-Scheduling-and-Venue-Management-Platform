import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  details?: string | null;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
}) => {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl my-3 text-red-800">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-red-900">{title}</h4>
          <p className="text-sm mt-0.5 text-red-700">{message}</p>
          {details && (
            <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-900 overflow-x-auto font-mono">
              {details}
            </pre>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded transition"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
