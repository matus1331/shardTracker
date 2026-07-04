import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Niečo sa pokazilo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="mb-1 text-xl font-semibold">Shard tracker</p>
        <p className="mb-6 text-sm text-slate-400">
          {mode === 'login' ? 'Prihlás sa do svojho účtu' : 'Vytvor si nový účet'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400" htmlFor="username">
              Používateľské meno
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400" htmlFor="password">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            className="mt-2 h-10 rounded-lg border border-blue-500/40 bg-blue-500/10 font-medium text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Chvíľu…' : mode === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          className="mt-4 w-full border-none bg-transparent p-0 text-center text-xs text-slate-400 underline"
        >
          {mode === 'login' ? 'Nemáš účet? Zaregistruj sa' : 'Už máš účet? Prihlás sa'}
        </button>
      </div>
    </div>
  );
}
