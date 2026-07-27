import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { HistoryStatsPage } from './components/HistoryStatsPage';

function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<'dashboard' | 'history'>('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Načítání…</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return page === 'history' ? (
    <HistoryStatsPage onBack={() => setPage('dashboard')} />
  ) : (
    <Dashboard onOpenHistory={() => setPage('history')} />
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
