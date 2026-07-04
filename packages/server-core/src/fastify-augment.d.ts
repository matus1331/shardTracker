import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    profileId?: number | null;
  }
}
