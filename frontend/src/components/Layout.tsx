import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { RoleBadge } from './RoleBadge';
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
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
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
      label: 'Exams',
      path: '/exams',
      icon: <BookOpen className="w-5 h-5" />,
      visible: true,
    },
    {
      label: 'Bookings & Venues',
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
      label: 'Admin Control',
      path: '/admin',
      icon: <Shield className="w-5 h-5" />,
      visible: hasRole('admin'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            CIT
          </div>
          <span className="font-bold text-slate-800 text-sm">Campus Platform</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar for Desktop / Dropdown for Mobile */}
      <aside
        className={`
        ${mobileMenuOpen ? 'block' : 'hidden'} 
        md:block md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col justify-between z-40
        fixed md:sticky top-0 h-screen overflow-y-auto
      `}
      >
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-slate-100 hidden md:flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-blue-200">
              CIT
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm leading-tight">Chilika Institute</h1>
              <p className="text-xs text-slate-500">Scheduling & Venues</p>
            </div>
          </div>

          {/* User quick profile */}
          {user && (
            <div className="p-4 mx-3 my-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Signed in as
              </div>
              <div className="font-medium text-slate-800 text-sm truncate">{user.display_name}</div>
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
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
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

        {/* Bottom logout / status section */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
