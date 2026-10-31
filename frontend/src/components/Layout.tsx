import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { RoleBadge } from './RoleBadge';
import { apiClient } from '../api/client';
import { useToast } from './Toast';
import {
  Calendar,
  Clock,
  BookOpen,
  AlertTriangle,
  Bot,
  Shield,
  LogOut,
  Menu,
  X,
  Building2,
  CheckSquare,
  Search,
  RotateCcw,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAdminReset = async () => {
    if (!window.confirm('Reset all demo dataset state back to clean initial values?')) {
      return;
    }
    setResetting(true);
    try {
      const res = await apiClient.post('/admin/reset');
      showToast(res.data?.message || 'Demo data successfully reset to clean state!');
    } catch {
      showToast('Failed to reset demo data.', 'error');
    } finally {
      setResetting(false);
    }
  };

  const navItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: <Clock className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Timetable',
      path: '/timetable',
      icon: <Calendar className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Room Finder',
      path: '/rooms',
      icon: <Search className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Exams',
      path: '/exams',
      icon: <BookOpen className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Venue Bookings',
      path: '/bookings',
      icon: <Building2 className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Disruptions',
      path: '/disruptions',
      icon: <AlertTriangle className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Approvals',
      path: '/approvals',
      icon: <CheckSquare className="w-5 h-5" />,
      visible: hasRole('admin', 'coordinator'),
    },
    {
      label: 'AI Assistant',
      path: '/assistant',
      icon: <Bot className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Admin Center',
      path: '/admin',
      icon: <Shield className="w-5 h-5" />,
      visible: hasRole('admin'),
    },
  ];

  const mobileBottomItems = [
    { label: 'Home', path: '/', icon: <Clock className="w-5 h-5" /> },
    { label: 'Timetable', path: '/timetable', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Rooms', path: '/rooms', icon: <Search className="w-5 h-5" /> },
    { label: 'Bookings', path: '/bookings', icon: <Building2 className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            CIT
          </div>
          <span className="font-bold text-slate-800 text-sm">Campus Platform</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Toggle navigation drawer"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar & Mobile Drawer */}
      <aside
        className={`
          ${mobileMenuOpen ? 'fixed inset-0 top-[57px] bg-white z-40 p-4 block overflow-y-auto' : 'hidden'}
          md:block md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col justify-between z-40
          md:sticky md:top-0 md:h-screen md:overflow-y-auto
        `}
      >
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-slate-100 hidden md:flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-blue-200">
              CIT
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm leading-tight">Chilika Institute</h2>
              <p className="text-xs text-slate-500">Scheduling & Venue Core</p>
            </div>
          </div>

          {/* User Profile Card */}
          {user && (
            <div className="p-4 mx-3 my-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Active Session
              </div>
              <div className="font-semibold text-slate-800 text-sm truncate">{user.display_name}</div>
              <div className="mt-2 flex items-center justify-between">
                <RoleBadge role={user.role} />
                {user.department && (
                  <span className="text-xs text-slate-500 truncate max-w-[100px]">
                    {user.department}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Bottom logout section */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition min-h-[44px]"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col justify-between">
        <div className="max-w-7xl mx-auto p-4 md:p-8 w-full">
          <Outlet />

          {/* Admin Demo Reset Footer on every screen */}
          {hasRole('admin') && (
            <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span>Superadmin Mode · Live Evaluation Environment</span>
              </div>
              <button
                onClick={handleAdminReset}
                disabled={resetting}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold transition disabled:opacity-50 min-h-[36px]"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>Reset Demo State</span>
              </button>
            </footer>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex justify-around items-center py-1 shadow-lg">
        {mobileBottomItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium min-h-[44px] min-w-[56px] transition ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                {item.icon}
              </div>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
