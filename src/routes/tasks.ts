import { Router, Request, Response } from 'express';
import { TaskService } from '../services/taskService';
import { Database } from '../db/database';

export function createTaskRouter(db: Database): Router {
  const router = Router();
  const taskService = new TaskService(db);

  // Get all tasks
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const tasks = await taskService.getAllTasks();
      return res.json(tasks);
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get single task
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const task = await taskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.json(task);
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create task
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { title, description, completed } = req.body;
      if (!title) return res.status(400).json({ error: 'title is required' });
      const task = await taskService.createTask({ title, description, completed });
      return res.status(201).json(task);
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const updated = await taskService.updateTask(req.params.id, updates);
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      return res.json(updated);
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Delete task
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const ok = await taskService.deleteTask(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Task not found' });
      return res.json({ success: true });
    } catch (_error) {
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  return router;
}