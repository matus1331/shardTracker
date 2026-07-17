import { AuthProvider, useAuth } from './auth/AuthContext';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Načítání…</p>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginScreen />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
