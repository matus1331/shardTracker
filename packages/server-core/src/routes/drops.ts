import type { FastifyInstance } from 'fastify';
import { MERCY_CONFIGS, PRIMAL_LEGENDARY_MERCY_CONFIG, SHARD_TYPES, type ShardType } from '@rsl/mercy-calc';
import {
  getDropShardInfo,
  isChampionInShardPool,
  isChampionOfRarity,
  listChampionsForShardType,
  listDrops,
  updateDropChampionName,
} from '../repository.js';

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

  app.patch<{ Params: { id: string }; Body: { championName?: string | null } }>(
    '/api/drops/:id',
    async (request, reply) => {
      const batchId = Number(request.params.id);
      if (!Number.isInteger(batchId) || batchId < 1) {
        return reply.code(400).send({ error: 'Neplatné ID dropu' });
      }

      const info = await getDropShardInfo(request.profileId!, batchId);
      if (!info) {
        return reply.code(404).send({ error: 'Drop nenalezen' });
      }

      const championName = request.body?.championName?.trim().slice(0, 80) || null;
      if (championName) {
        const isValid =
          info.shardType === 'PRIMAL' && info.rarity
            ? await isChampionOfRarity(championName, info.rarity)
            : await isChampionInShardPool(info.shardType, championName);
        if (!isValid) {
          return reply.code(400).send({ error: 'Neplatné jméno šampiona pro tento typ shardu' });
        }
      }

      return updateDropChampionName(request.profileId!, batchId, info.shardType, championName);
    },
  );

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
