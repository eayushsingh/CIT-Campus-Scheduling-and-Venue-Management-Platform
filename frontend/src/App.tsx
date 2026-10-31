import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './state/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TimetablePage } from './pages/TimetablePage';
import { ExamsPage } from './pages/ExamsPage';
import { BookingsPage } from './pages/BookingsPage';
import { DisruptionsPage } from './pages/DisruptionsPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AssistantPage } from './pages/AssistantPage';
import { AdminPage } from './pages/AdminPage';
import { RoomFinderPage } from './pages/RoomFinderPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import { HealthBanner } from './components/HealthBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" label="Authenticating session..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <HealthBanner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="timetable" element={<TimetablePage />} />
                  <Route path="rooms" element={<RoomFinderPage />} />
                  <Route path="exams" element={<ExamsPage />} />
                  <Route path="bookings" element={<BookingsPage />} />
                  <Route path="disruptions" element={<DisruptionsPage />} />
                  <Route
                    path="approvals"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'coordinator']}>
                        <ApprovalsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="assistant" element={<AssistantPage />} />
                  <Route
                    path="admin"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
