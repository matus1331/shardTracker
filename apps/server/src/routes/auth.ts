import type { FastifyInstance } from 'fastify';
import { createSessionToken, hashPassword, verifyPassword } from '../auth.js';
import {
  createProfile,
  createSession,
  deleteSession,
  getProfileById,
  getProfileByUsername,
} from '../repository.js';

const SESSION_COOKIE = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

function isValidCredentials(username: unknown, password: unknown): username is string {
  return (
    typeof username === 'string' &&
    username.trim().length >= 3 &&
    typeof password === 'string' &&
    password.length >= 4
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { username?: string; password?: string } }>('/api/auth/register', async (request, reply) => {
    const { username, password } = request.body ?? {};

    if (!isValidCredentials(username, password)) {
      return reply.code(400).send({ error: 'Používateľské meno (min. 3 znaky) a heslo (min. 4 znaky) sú povinné' });
    }

    const trimmedUsername = username.trim();
    if (getProfileByUsername(trimmedUsername)) {
      return reply.code(409).send({ error: 'Toto používateľské meno je už obsadené' });
    }

    const profile = createProfile(trimmedUsername, hashPassword(password as string));
    const token = createSessionToken();
    createSession(token, profile.id);
    reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTIONS);

    return { username: profile.username };
  });

  app.post<{ Body: { username?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};

    if (typeof username !== 'string' || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Používateľské meno a heslo sú povinné' });
    }

    const profile = getProfileByUsername(username.trim());
    if (!profile || !verifyPassword(password, profile.passwordHash)) {
      return reply.code(401).send({ error: 'Nesprávne používateľské meno alebo heslo' });
    }

    const token = createSessionToken();
    createSession(token, profile.id);
    reply.setCookie(SESSION_COOKIE, token, COOKIE_OPTIONS);

    return { username: profile.username };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      deleteSession(token);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.profileId) {
      return reply.code(401).send({ error: 'Neprihlásený' });
    }
    const profile = getProfileById(request.profileId);
    if (!profile) {
      return reply.code(401).send({ error: 'Neprihlásený' });
    }
    return { username: profile.username };
  });
}

export { SESSION_COOKIE };
