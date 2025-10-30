import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Database } from './db/database';
import { createTaskRouter } from './routes/tasks';
import { createSyncRouter } from './routes/sync';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

export function createApp(db?: Database) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const database = db ?? new Database(process.env.DATABASE_URL || './data/tasks.sqlite3');

  app.use('/api/tasks', createTaskRouter(database));
  app.use('/api', createSyncRouter(database));
  app.use(errorHandler);

  return { app, database };
}