import type { FastifyInstance } from 'fastify';
import { calculateDropChance, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import {
  addShards,
  correctSinceLastDrop,
  getActiveMercyEvents,
  getAllCounters,
  isChampionInShardPool,
  type MercyEventRow,
  type ShardCounterRow,
} from '../repository.js';

function isShardType(value: string): value is ShardType {
  return (SHARD_TYPES as string[]).includes(value);
}

function withChance(row: ShardCounterRow, activeEvents: Map<ShardType, MercyEventRow>) {
  const activeEvent = activeEvents.get(row.shardType);
  const multiplier = activeEvent?.kind === 'MULTIPLIER' ? activeEvent.multiplier : 1;
  return {
    ...row,
    currentChance: calculateDropChance(row.shardType, row.sinceLastDrop, { multiplier }),
    activeEvent: activeEvent
      ? { multiplier: activeEvent.multiplier, endAt: activeEvent.endAt, label: activeEvent.label, kind: activeEvent.kind }
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

  app.put<{
    Params: { shardType: string };
    Body: { value?: number; gotDrop?: boolean; championName?: string; extraChampionName?: string };
  }>('/api/shards/:shardType/since-last-drop', async (request, reply) => {
    const { shardType } = request.params;
    const { value, gotDrop = false, championName, extraChampionName } = request.body ?? {};

    if (!isShardType(shardType)) {
      return reply.code(400).send({ error: 'Invalid shardType' });
    }
    if (!Number.isInteger(value) || (value as number) < 0) {
      return reply.code(400).send({ error: 'value must be an integer >= 0' });
    }

    const trimmedChampionName = championName?.trim().slice(0, 80) || null;
    if (trimmedChampionName && !(await isChampionInShardPool(shardType, trimmedChampionName))) {
      return reply.code(400).send({ error: 'Invalid championName for this shard type' });
    }

    const activeEvents = await getActiveMercyEvents([shardType]);

    const trimmedExtraChampionName = extraChampionName?.trim().slice(0, 80) || null;
    if (trimmedExtraChampionName) {
      if (!gotDrop) {
        return reply.code(400).send({ error: 'extraChampionName requires gotDrop' });
      }
      if (activeEvents.get(shardType)?.kind !== 'EXTRA_LEGENDARY') {
        return reply.code(400).send({ error: 'No active Extra Legendary event for this shard type' });
      }
      if (!(await isChampionInShardPool(shardType, trimmedExtraChampionName))) {
        return reply.code(400).send({ error: 'Invalid extraChampionName for this shard type' });
      }
    }

    const updated = await correctSinceLastDrop(
      request.profileId!,
      shardType,
      value as number,
      gotDrop,
      trimmedChampionName,
      trimmedExtraChampionName,
    );
    return withChance(updated, activeEvents);
  });
}
