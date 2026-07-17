import { useId, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const PASSWORD_MAX_LENGTH = 25;

type Mode = 'login' | 'register';

function ShardMark() {
  return (
    <svg viewBox="0 0 100 100" className="shard-mark h-16 w-16" aria-hidden="true">
      <g stroke="#020617" strokeWidth="1.5" strokeLinejoin="round">
        <polygon points="50,4 90,38 50,50" fill="#3b82f6" />
        <polygon points="90,38 50,96 50,50" fill="#8b5cf6" />
        <polygon points="50,96 10,38 50,50" fill="#A30000" />
        <polygon points="10,38 50,4 50,50" fill="#fbbf24" />
      </g>
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.3 6.5C3.9 8 2 12 2 12s3.6 6.5 10 6.5c2 0 3.7-.6 5.1-1.4M17.9 17.6C20.4 15.9 22 12 22 12s-1.2-2.2-3.4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameId = useId();
  const passwordId = useId();

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
  };

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
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <ShardMark />
        <h1 className="text-2xl font-bold uppercase tracking-[0.2em] text-slate-100">Shard Tracker</h1>
        <p className="text-sm text-slate-500">Mercy tracker pre Raid: Shadow Legends</p>
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40">
        <div className="grid grid-cols-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => switchMode('login')}
            aria-current={mode === 'login'}
            className={`py-4 text-center transition-colors ${
              mode === 'login'
                ? 'border-b-2 border-blue-500 bg-slate-900 text-lg font-semibold text-slate-100'
                : 'border-b-2 border-transparent bg-slate-950/40 text-sm font-medium text-slate-500 hover:text-slate-300'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            aria-current={mode === 'register'}
            className={`py-4 text-center transition-colors ${
              mode === 'register'
                ? 'border-b-2 border-blue-500 bg-slate-900 text-lg font-semibold text-slate-100'
                : 'border-b-2 border-transparent bg-slate-950/40 text-sm font-medium text-slate-500 hover:text-slate-300'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div>
            <label className="mb-1 block text-xs text-slate-400" htmlFor={usernameId}>
              Používateľské meno
            </label>
            <input
              id={usernameId}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400" htmlFor={passwordId}>
              Heslo
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={PASSWORD_MAX_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 pr-10 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={submitting}
                aria-label={showPassword ? 'Skryť heslo' : 'Zobraziť heslo'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-300 focus:outline-none focus-visible:text-blue-400"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            className="mt-2 h-10 rounded-lg border border-blue-500/40 bg-blue-500/10 font-medium text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? mode === 'login'
                ? 'Logging in…'
                : 'Creating account…'
              : mode === 'login'
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
