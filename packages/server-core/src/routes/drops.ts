import type { FastifyInstance } from 'fastify';
import { MERCY_CONFIGS, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import { listChampionNames, listDrops } from '../repository.js';

function isShardType(value: string): value is ShardType {
  return (SHARD_TYPES as string[]).includes(value);
}

export async function dropRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.profileId) {
      return reply.code(401).send({ error: 'Nepřihlášený' });
    }
  });

  app.get('/api/drops', async (request) => {
    const drops = await listDrops(request.profileId!);
    return drops.map((drop) => ({
      ...drop,
      mercyActive: drop.seriesNumber >= MERCY_CONFIGS[drop.shardType].mercyThreshold,
    }));
  });

  app.get<{ Params: { shardType: string } }>('/api/champions/:shardType', async (request, reply) => {
    const { shardType } = request.params;
    if (!isShardType(shardType)) {
      return reply.code(400).send({ error: 'Invalid shardType' });
    }
    return listChampionNames(request.profileId!, shardType);
  });
}
