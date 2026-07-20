import type { FastifyInstance } from 'fastify';
import { type ShardType } from '@rsl/mercy-calc';
import { isAdminUsername } from '../admin.js';
import { createMercyEvent, deleteMercyEventGroup, getProfileById, listMercyEvents } from '../repository.js';

const SUPPORTED_EVENT_SHARD_TYPES: ShardType[] = ['ANCIENT', 'VOID', 'PRIMAL', 'SACRED'];

function isSupportedEventShardType(value: unknown): value is ShardType {
  return typeof value === 'string' && (SUPPORTED_EVENT_SHARD_TYPES as string[]).includes(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
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

  app.post<{ Body: { shardTypes?: unknown[]; startDate?: string; endDate?: string; label?: string } }>(
    '/api/events',
    async (request, reply) => {
      const { shardTypes, startDate, endDate, label } = request.body ?? {};

      if (!Array.isArray(shardTypes) || shardTypes.length === 0) {
        return reply.code(400).send({ error: 'Vyber alespoň jeden shard' });
      }
      for (const shardType of shardTypes) {
        if (!isSupportedEventShardType(shardType)) {
          return reply.code(400).send({ error: 'Neplatný typ shardu pro 2x event' });
        }
      }
      if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
        return reply.code(400).send({ error: 'Datum od musí předcházet datu do (formát YYYY-MM-DD)' });
      }

      const groupId = await createMercyEvent(shardTypes as ShardType[], startDate, endDate, label?.trim() || null);
      return { groupId };
    },
  );

  app.delete<{ Params: { groupId: string } }>('/api/events/:groupId', async (request) => {
    await deleteMercyEventGroup(request.params.groupId);
    return { ok: true };
  });
}
