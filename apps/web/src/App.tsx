import { AuthProvider, useAuth } from './auth/AuthContext';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import ClassicLoader from './components/ui/loader';

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ClassicLoader />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <Dashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
