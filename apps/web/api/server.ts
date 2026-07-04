import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '@rsl/server-core';

const appPromise = buildApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  await app.ready();
  app.server.emit('request', req, res);
}
