import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 text-slate-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 py-1.5 pr-3 pl-1.5 hover:bg-slate-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-300">
          {initials}
        </span>
        <span className="text-sm text-slate-200">{user.username}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-slate-800 bg-slate-900 py-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-red-300"
          >
            <LogoutIcon />
            Odhlásiť sa
          </button>
        </div>
      )}
    </div>
  );
}
