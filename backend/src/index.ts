import { app } from './app.ts';

const port = Number(process.env.PORT) || 8000;

console.log(`NEPSE EMA Scanner API running on http://localhost:${port}`);

Bun.serve({ fetch: app.fetch, port });