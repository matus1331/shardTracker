export interface AuthUser {
  username: string;
}

async function handleAuthResponse(res: Response): Promise<AuthUser> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Požadavek se nezdařil');
  }
  return res.json();
}

export function register(username: string, password: string): Promise<AuthUser> {
  return fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  }).then(handleAuthResponse);
}

export function login(username: string, password: string): Promise<AuthUser> {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  }).then(handleAuthResponse);
}

export function logout(): Promise<void> {
  return fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => undefined);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}
