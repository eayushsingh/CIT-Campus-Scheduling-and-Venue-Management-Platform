import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const HealthBanner: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'offline'>('checking');
  const [retrying, setRetrying] = useState<boolean>(false);

  const checkHealth = useCallback(async () => {
    try {
      setRetrying(true);
      const res = await apiClient.get('/health', { timeout: 6000 });
      if (res.data?.status === 'healthy' || res.data?.status === 'ok') {
        setStatus('healthy');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    } finally {
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  if (status === 'healthy') {
    return null;
  }

  return (
    <div
      role="alert"
      className={`w-full px-4 py-2 text-xs font-medium flex items-center justify-between border-b transition-all ${
        status === 'checking'
          ? 'bg-blue-50 text-blue-800 border-blue-200'
          : 'bg-amber-50 text-amber-900 border-amber-300'
      }`}
    >
      <div className="flex items-center space-x-2">
        {status === 'checking' ? (
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        )}
        <span>
          {status === 'checking'
            ? 'Connecting to CIT backend server...'
            : 'Server is waking up, retry in a few seconds (free-tier hosting may take a moment to spin up).'}
        </span>
      </div>

      <button
        onClick={checkHealth}
        disabled={retrying}
        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 text-xs font-semibold shadow-sm transition disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
        <span>{retrying ? 'Checking...' : 'Retry'}</span>
      </button>
    </div>
  );
};
