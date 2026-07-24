import type { FastifyInstance } from 'fastify';
import { type ShardType } from '@rsl/mercy-calc';
import { isAdminUsername } from '../admin.js';
import { createMercyEvent, deleteMercyEventGroup, getProfileById, listMercyEvents } from '../repository.js';

const SUPPORTED_EVENT_SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'PRIMAL', 'SACRED'];

function isSupportedEventShardType(value: unknown): value is ShardType {
  return typeof value === 'string' && (SUPPORTED_EVENT_SHARD_TYPES as string[]).includes(value);
}

/** UTC ISO 8601 datetime, e.g. '2026-07-24T08:00:00Z'. Also rejects calendar-invalid dates (e.g. month 13). */
function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

export async function eventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.profileId) {
      return reply.code(401).send({ error: 'Nepřihlášený' });
    }
    const profile = await getProfileById(request.profileId);
    if (!profile || !isAdminUsername(profile.username)) {
      return reply.code(403).send({ error: 'Nemáš oprávnění spravovat eventy' });
    }
  });

  app.get('/api/events', async () => {
    return listMercyEvents();
  });

  app.post<{ Body: { shardTypes?: unknown[]; startAt?: string; endAt?: string; label?: string } }>(
    '/api/events',
    async (request, reply) => {
      const { shardTypes, startAt, endAt, label } = request.body ?? {};

      if (!Array.isArray(shardTypes) || shardTypes.length === 0) {
        return reply.code(400).send({ error: 'Vyber alespoň jeden shard' });
      }
      for (const shardType of shardTypes) {
        if (!isSupportedEventShardType(shardType)) {
          return reply.code(400).send({ error: 'Neplatný typ shardu pro 2x event' });
        }
      }
      if (!isIsoDateTime(startAt) || !isIsoDateTime(endAt) || Date.parse(startAt) >= Date.parse(endAt)) {
        return reply
          .code(400)
          .send({ error: 'Začátek musí předcházet konci (formát ISO 8601 UTC, např. 2026-07-24T08:00:00Z)' });
      }

      const groupId = await createMercyEvent(shardTypes as ShardType[], startAt, endAt, label?.trim() || null);
      return { groupId };
    },
  );

  app.delete<{ Params: { groupId: string } }>('/api/events/:groupId', async (request) => {
    await deleteMercyEventGroup(request.params.groupId);
    return { ok: true };
  });
}
