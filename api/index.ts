import serverless from 'serverless-http';
import { createApp } from '../src/app';
import { Database } from '../src/db/database';

const db = new Database(process.env.DATABASE_URL || ':memory:');
let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await db.initialize();
    initialized = true;
  }
}

const { app } = createApp(db);
const proxy = serverless(app as any);

export default async function handler(req: any, res: any) {
  await ensureInit();
  return proxy(req, res);
}
