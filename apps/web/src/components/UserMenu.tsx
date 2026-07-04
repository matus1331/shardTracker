import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

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
            className="block w-full border-none bg-transparent px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
          >
            Odhlásiť sa
          </button>
        </div>
      )}
    </div>
  );
}
