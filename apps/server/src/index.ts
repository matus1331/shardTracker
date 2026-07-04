import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { shardRoutes } from './routes/shards.js';
import { authRoutes, SESSION_COOKIE } from './routes/auth.js';
import { getProfileIdBySessionToken } from './repository.js';
import './db.js';

const app = Fastify({ logger: true });

await app.register(cookie);

app.decorateRequest('profileId', null);

app.addHook('onRequest', async (request) => {
  const token = request.cookies[SESSION_COOKIE];
  request.profileId = token ? (getProfileIdBySessionToken(token) ?? null) : null;
});

await app.register(authRoutes);
await app.register(shardRoutes);

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '127.0.0.1' });
