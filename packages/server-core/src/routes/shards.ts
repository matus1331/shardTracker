import type { FastifyInstance } from 'fastify';
import { calculateDropChance, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import {
  addShards,
  correctSinceLastDrop,
  getActiveMercyEvents,
  getAllCounters,
  type MercyEventRow,
  type ShardCounterRow,
} from '../repository.js';

function isShardType(value: string): value is ShardType {
  return (SHARD_TYPES as string[]).includes(value);
}

function withChance(row: ShardCounterRow, activeEvents: Map<ShardType, MercyEventRow>) {
  const activeEvent = activeEvents.get(row.shardType);
  return {
    ...row,
    currentChance: calculateDropChance(row.shardType, row.sinceLastDrop, { multiplier: activeEvent?.multiplier ?? 1 }),
    activeEvent: activeEvent
      ? { multiplier: activeEvent.multiplier, endAt: activeEvent.endAt, label: activeEvent.label }
      : null,
  };
}

export async function shardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.profileId) {
      return reply.code(401).send({ error: 'Nepřihlášený' });
    }
  });

  app.get('/api/shards', async (request) => {
    const counters = await getAllCounters(request.profileId!);
    const activeEvents = await getActiveMercyEvents(SHARD_TYPES);
    return counters.map((row) => withChance(row, activeEvents));
  });

  app.post<{ Params: { shardType: string }; Body: { amount?: number; gotDrop?: boolean } }>(
    '/api/shards/:shardType/add',
    async (request, reply) => {
      const { shardType } = request.params;
      const { amount, gotDrop = false } = request.body ?? {};

      if (!isShardType(shardType)) {
        return reply.code(400).send({ error: 'Invalid shardType' });
      }
      if (!Number.isInteger(amount) || (amount as number) < 1) {
        return reply.code(400).send({ error: 'amount must be an integer >= 1' });
      }

      const updated = await addShards(request.profileId!, shardType, amount as number, gotDrop);
      const activeEvents = await getActiveMercyEvents([shardType]);
      return withChance(updated, activeEvents);
    },
  );

  app.put<{ Params: { shardType: string }; Body: { value?: number; gotDrop?: boolean; championName?: string } }>(
    '/api/shards/:shardType/since-last-drop',
    async (request, reply) => {
      const { shardType } = request.params;
      const { value, gotDrop = false, championName } = request.body ?? {};

      if (!isShardType(shardType)) {
        return reply.code(400).send({ error: 'Invalid shardType' });
      }
      if (!Number.isInteger(value) || (value as number) < 0) {
        return reply.code(400).send({ error: 'value must be an integer >= 0' });
      }

      const trimmedChampionName = championName?.trim().slice(0, 80) || null;
      const updated = await correctSinceLastDrop(
        request.profileId!,
        shardType,
        value as number,
        gotDrop,
        trimmedChampionName,
      );
      const activeEvents = await getActiveMercyEvents([shardType]);
      return withChance(updated, activeEvents);
    },
  );
}
