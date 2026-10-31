import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DemoAccount } from '../state/AuthContext';
import { apiClient } from '../api/client';
import { Shield, UserCheck, Users, School, ArrowRight, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemo, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<(() => Promise<void>) | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoLoading, setDemoLoading] = useState(true);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch demo accounts
  useEffect(() => {
    const fetchDemoAccounts = async () => {
      try {
        const res = await apiClient.get<DemoAccount[]>('/auth/demo-accounts', { timeout: 8000 });
        setDemoAccounts(res.data);
      } catch (err) {
        // Fallback default demo accounts
        setDemoAccounts([
          {
            username: 'admin',
            password: 'admin123',
            role: 'admin',
            display_name: 'Dr. Rajesh Kumar (Admin)',
          },
          {
            username: 'coordinator',
            password: 'coord123',
            role: 'coordinator',
            display_name: 'Prof. Anita Sharma (Dept Coordinator)',
          },
          {
            username: 'faculty',
            password: 'faculty123',
            role: 'faculty',
            display_name: 'Dr. Suresh Patel (Faculty)',
          },
          {
            username: 'clubrep',
            password: 'clubrep123',
            role: 'club_rep',
            display_name: 'Priya Nair (Club Representative)',
          },
        ]);
      } finally {
        setDemoLoading(false);
      }
    };
    fetchDemoAccounts();
  }, []);

  const handleManualLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    setLastAction(() => () => handleManualLogin());
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(
        err.userMessage ||
        err.response?.data?.message ||
        err.response?.data?.detail?.message ||
        'Server is waking up, retry in a few seconds.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async (account: DemoAccount) => {
    setError(null);
    setLoading(true);
    setLastAction(() => () => handleDemoClick(account));
    try {
      await loginAsDemo(account);
      navigate('/');
    } catch (err: any) {
      setError(
        err.userMessage ||
        err.response?.data?.message ||
        err.response?.data?.detail?.message ||
        'Server is waking up, retry in a few seconds.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-5 h-5 text-purple-600" />;
      case 'coordinator':
        return <School className="w-5 h-5 text-blue-600" />;
      case 'faculty':
        return <UserCheck className="w-5 h-5 text-emerald-600" />;
      case 'club_rep':
        return <Users className="w-5 h-5 text-amber-600" />;
      default:
        return <UserCheck className="w-5 h-5 text-slate-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'coordinator':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'faculty':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'club_rep':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Left Side: 1-Click Demo Accounts */}
        <div className="p-8 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-4">
              <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Hackathon Judge Quick-Access</span>
            </div>

            <h2 className="text-xl font-bold text-slate-800">1-Click Demo Logins</h2>
            <p className="text-sm text-slate-600 mt-1 mb-6">
              Instant login with seeded credentials for all 4 institution roles.
            </p>

            {demoLoading ? (
              <LoadingSpinner label="Loading demo accounts..." />
            ) : (
              <div className="space-y-3">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.username}
                    onClick={() => handleDemoClick(acc)}
                    disabled={loading}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition group flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-blue-50 transition">
                        {getRoleIcon(acc.role)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-sm truncate">
                          {acc.display_name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {acc.username} / {acc.password}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md border font-medium ${getRoleBadgeColor(
                          acc.role
                        )}`}
                      >
                        {acc.role}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500">
            Role permissions are enforced server-side via JWT and checked on every API call.
          </div>
        </div>

        {/* Right Side: Manual Login */}
        <div className="p-8 flex flex-col justify-center">
          <div className="mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl mb-4 shadow-sm shadow-blue-300">
              CIT
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
            <p className="text-sm text-slate-600 mt-1">
              Chilika Institute of Technology Timetable & Venue Platform
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="leading-snug">{error}</span>
              </div>
              {lastAction && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => lastAction()}
                    disabled={loading}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    <span>Retry</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Sign In with Credentials</span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-400">
            Production-grade constraint solver with zero LLM validity reliance
          </div>
        </div>
      </div>
    </div>
  );
};
