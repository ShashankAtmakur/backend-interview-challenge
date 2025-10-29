import { Router, Request, Response } from 'express';
import { SyncService } from '../services/syncService';
import { Database } from '../db/database';

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const syncService = new SyncService(db);

  // Trigger manual sync
  router.post('/sync', async (_req: Request, res: Response) => {
    try {
      const online = await syncService.checkConnectivity();
      if (!online) return res.status(503).json({ error: 'Server unreachable' });
      const result = await syncService.sync();
      return res.json(result);
    } catch (_error) {
      return res.status(500).json({ error: 'Sync failed' });
    }
  });

  // Check sync status
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const pending = await db.get('SELECT COUNT(*) as cnt FROM sync_queue');
      const last = await db.get('SELECT MAX(last_synced_at) as last FROM tasks');
      const online = await syncService.checkConnectivity();
      return res.json({ pending: pending?.cnt || 0, last_synced_at: last?.last || null, online });
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // Batch sync endpoint (for server-side)
  router.post('/batch', async (req: Request, res: Response) => {
    // Minimal batch handler for testing / demo purposes
    try {
      const { items } = req.body as { items: any[] };
      const processed = (items || []).map((it: any) => ({
        client_id: it.task_id || (it.data && it.data.id) || null,
        server_id: `srv_${Math.random().toString(36).slice(2, 8)}`,
        status: 'success',
      }));
      return res.json({ processed_items: processed });
    } catch (_error) {
      return res.status(500).json({ error: 'Batch processing failed' });
    }
  });

  // Health check endpoint
  router.get('/health', async (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  return router;
}