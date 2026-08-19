import type { FastifyInstance } from 'fastify';
import { MERCY_CONFIGS, PRIMAL_LEGENDARY_MERCY_CONFIG, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import { listChampionsForShardType, listDrops } from '../repository.js';

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
    return drops.map((drop) => {
      const config =
        drop.shardType === 'PRIMAL' && drop.rarity === 'LEGENDARY' ? PRIMAL_LEGENDARY_MERCY_CONFIG : MERCY_CONFIGS[drop.shardType];
      return { ...drop, mercyActive: drop.seriesNumber >= config.mercyThreshold };
    });
  });

  app.get<{ Params: { shardType: string }; Querystring: { rarity?: string } }>(
    '/api/champions/:shardType',
    async (request, reply) => {
      const { shardType } = request.params;
      if (!isShardType(shardType)) {
        return reply.code(400).send({ error: 'Invalid shardType' });
      }
      const { rarity } = request.query;
      const trimmedRarity = rarity === 'LEGENDARY' || rarity === 'MYTHICAL' ? rarity : undefined;
      return listChampionsForShardType(shardType, trimmedRarity);
    },
  );
}
