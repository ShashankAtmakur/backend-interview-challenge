import axios from 'axios';
import { Task, SyncQueueItem, SyncResult, BatchSyncRequest, BatchSyncResponse } from '../types';
import { Database } from '../db/database';

export class SyncService {
  private apiUrl: string;
  
  constructor(
    private db: Database,
    apiUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api'
  ) {
    this.apiUrl = apiUrl;
  }

  async sync(): Promise<SyncResult> {
    const items = await this.db.all('SELECT * FROM sync_queue ORDER BY created_at');
    if (!items || items.length === 0) {
      return { success: true, synced_items: 0, failed_items: 0, errors: [] } as SyncResult;
    }

    // Parse items into SyncQueueItem shape
    const parsed: SyncQueueItem[] = items.map((r: any) => ({
      id: r.id,
      task_id: r.task_id,
      operation: r.operation,
      data: JSON.parse(r.data),
      created_at: r.created_at ? new Date(r.created_at) : new Date(),
      retry_count: r.retry_count || 0,
      error_message: r.error_message || undefined,
    }));

    const batchSize = parseInt(process.env.SYNC_BATCH_SIZE || '50', 10);
    let synced = 0;
    let failed = 0;
    const errors: any[] = [];

    // If offline, don't attempt network calls
    const online = await this.checkConnectivity();
    if (!online) {
      return { success: false, synced_items: 0, failed_items: parsed.length, errors: [{ error: 'offline', timestamp: new Date() }] } as SyncResult;
    }

    for (let i = 0; i < parsed.length; i += batchSize) {
      const batch = parsed.slice(i, i + batchSize);
      try {
        const res = await this.processBatch(batch);
        // res.processed_items
        for (const p of res.processed_items) {
          if (p.status === 'success') {
            // mark task as synced and remove queue entries for that task
            await this.db.run('UPDATE tasks SET sync_status = ?, server_id = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?', ['synced', p.server_id || null, p.client_id]);
            await this.db.run('DELETE FROM sync_queue WHERE task_id = ?', [p.client_id]);
            synced += 1;
          } else if (p.status === 'conflict') {
            // apply conflict resolution if server provided resolved_data
            if (p.resolved_data) {
              const local = await this.db.get('SELECT * FROM tasks WHERE id = ?', [p.client_id]);
              const serverTask = p.resolved_data as Task;
              const resolved = await this.resolveConflict(local ? ({ ...local, created_at: local.created_at, updated_at: local.updated_at } as Task) : serverTask, serverTask);
              // update local record
              await this.db.run('UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP, sync_status = ?, server_id = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?', [resolved.title, resolved.description || null, resolved.completed ? 1 : 0, 'synced', resolved.server_id || null, resolved.id]);
              await this.db.run('DELETE FROM sync_queue WHERE task_id = ?', [p.client_id]);
              synced += 1;
            } else {
              failed += 1;
              errors.push({ task_id: p.client_id, error: 'conflict_no_resolution' });
            }
          } else {
            // status === 'error'
            failed += 1;
            errors.push({ task_id: p.client_id, error: p.error || 'error' });
            // increment retry_count
            await this.db.run('UPDATE sync_queue SET retry_count = retry_count + 1, error_message = ? WHERE task_id = ?', [p.error || 'error', p.client_id]);
          }
        }
      } catch (err: any) {
        // network or server error for entire batch
        failed += batch.length;
        errors.push({ error: err.message || String(err) });
        // update retry counts
        for (const it of batch) {
          await this.handleSyncError(it, err);
        }
      }
    }

    return { success: failed === 0, synced_items: synced, failed_items: failed, errors } as SyncResult;
  }

  async addToSyncQueue(taskId: string, operation: 'create' | 'update' | 'delete', data: Partial<Task>): Promise<void> {
    const id = require('uuid').v4();
    const sql = `INSERT INTO sync_queue (id, task_id, operation, data) VALUES (?, ?, ?, ?)`;
    await this.db.run(sql, [id, taskId, operation, JSON.stringify(data)]);
  }

  private async processBatch(items: SyncQueueItem[]): Promise<BatchSyncResponse> {
    const payload = {
      items,
      client_timestamp: new Date(),
    } as BatchSyncRequest;

    const resp = await axios.post(`${this.apiUrl}/batch`, payload, { timeout: 15000 });
    return resp.data as BatchSyncResponse;
  }

  private async resolveConflict(localTask: Task, serverTask: Task): Promise<Task> {
    // last-write-wins: choose task with latest updated_at
    const localUpdated = localTask && localTask.updated_at ? new Date(localTask.updated_at) : new Date(0);
    const serverUpdated = serverTask && serverTask.updated_at ? new Date(serverTask.updated_at) : new Date(0);
    if (serverUpdated > localUpdated) {
      return serverTask;
    }
    return localTask;
  }

  

  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    const maxRetries = parseInt(process.env.SYNC_MAX_RETRIES || '3', 10);
    await this.db.run('UPDATE sync_queue SET retry_count = retry_count + 1, error_message = ? WHERE id = ?', [error.message, item.id]);
    const row = await this.db.get('SELECT retry_count FROM sync_queue WHERE id = ?', [item.id]);
    if (row && row.retry_count >= maxRetries) {
      // mark task as error
      await this.db.run('UPDATE tasks SET sync_status = ? WHERE id = ?', ['error', item.task_id]);
    }
  }

  async checkConnectivity(): Promise<boolean> {
    // TODO: Check if server is reachable
    // 1. Make a simple health check request
    // 2. Return true if successful, false otherwise
    try {
      await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}