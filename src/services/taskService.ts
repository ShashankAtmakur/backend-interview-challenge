import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';
import { Database } from '../db/database';

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    completed: row.completed === 1,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    is_deleted: row.is_deleted === 1,
    sync_status: row.sync_status,
    server_id: row.server_id ?? undefined,
    last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
  } as Task;
}

export class TaskService {
  constructor(private db: Database) {}

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const id = uuidv4();
    const title = taskData.title || 'Untitled Task';
    const description = taskData.description || null;
    const completed = taskData.completed ? 1 : 0;
    const is_deleted = 0;
    const sync_status = 'pending';

    const sql = `INSERT INTO tasks (id, title, description, completed, is_deleted, sync_status) VALUES (?, ?, ?, ?, ?, ?)`;
    await this.db.run(sql, [id, title, description, completed, is_deleted, sync_status]);

    // Add to sync queue
    const queueId = uuidv4();
    const insertQueue = `INSERT INTO sync_queue (id, task_id, operation, data) VALUES (?, ?, ?, ?)`;
    const data = JSON.stringify({ id, title, description, completed: !!completed });
    await this.db.run(insertQueue, [queueId, id, 'create', data]);

    const row = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    return rowToTask(row);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) return null;

    const title = updates.title ?? existing.title;
    const description = updates.description ?? existing.description;
    const completed = typeof updates.completed === 'boolean' ? (updates.completed ? 1 : 0) : existing.completed;

    const sql = `UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = CURRENT_TIMESTAMP, sync_status = ? WHERE id = ?`;
    await this.db.run(sql, [title, description, completed, 'pending', id]);

    // Add to sync queue
    const queueId = uuidv4();
    const insertQueue = `INSERT INTO sync_queue (id, task_id, operation, data) VALUES (?, ?, ?, ?)`;
    const data = JSON.stringify({ id, title, description, completed: !!completed });
    await this.db.run(insertQueue, [queueId, id, 'update', data]);

    const row = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    return rowToTask(row);
  }

  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) return false;

    const sql = `UPDATE tasks SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP, sync_status = ? WHERE id = ?`;
    await this.db.run(sql, ['pending', id]);

    // Add to sync queue
    const queueId = uuidv4();
    const insertQueue = `INSERT INTO sync_queue (id, task_id, operation, data) VALUES (?, ?, ?, ?)`;
    const data = JSON.stringify({ id });
    await this.db.run(insertQueue, [queueId, id, 'delete', data]);

    return true;
  }

  async getTask(id: string): Promise<Task | null> {
    const row = await this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!row) return null;
    if (row.is_deleted === 1) return null;
    return rowToTask(row);
  }

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.db.all('SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY created_at');
    return rows.map(rowToTask);
  }

  async getTasksNeedingSync(): Promise<Task[]> {
    const rows = await this.db.all(`SELECT * FROM tasks WHERE sync_status IN ('pending','error')`);
    return rows.map(rowToTask);
  }
}