import { buildApp } from '@rsl/server-core';

const app = await buildApp();

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '127.0.0.1' });
