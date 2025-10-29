# Solution Summary

This file documents the approach, assumptions, and tools used to complete the Task Sync API challenge.

## Approach

- Implement core task CRUD in `src/services/taskService.ts`. Each mutating operation (create/update/delete) writes a sync queue entry in `sync_queue` so offline changes can be synchronized later.
- Implement `SyncService` in `src/services/syncService.ts` to:
  - Read queued operations from the `sync_queue` table.
  - Batch them (configurable with `SYNC_BATCH_SIZE`, default 50).
  - POST the batch to `/api/batch` (configurable `API_BASE_URL`), handle network errors, and update local `tasks` rows when successful.
  - Apply a last-write-wins conflict resolution strategy (based on `updated_at`).
  - Track retries per queue item and mark tasks with `sync_status = 'error'` after `SYNC_MAX_RETRIES` (default 3).
- Routes in `src/routes/tasks.ts` and `src/routes/sync.ts` wire HTTP endpoints to services. A simple `/api/batch` endpoint is provided for local testing.

## Assumptions

- This repository is a local/standalone candidate submission. The included `/api/batch` route is a minimal handler useful for local tests; in a real deployment, that endpoint would be hosted by a central server responsible for authoritative merges.
- Timestamps (`created_at`, `updated_at`, `last_synced_at`) are stored as DATETIME strings via SQLite `CURRENT_TIMESTAMP`. Conflict resolution uses `updated_at` parsed as Date.
- Sync data stored in `sync_queue.data` is JSON-serialized at enqueue time; we accept possible duplication (multiple queue entries for repeated updates). A future optimization could squash or coalesce queued changes per task.
- Lint rules expect unused function parameters to be prefixed with `_` (the code follows this convention where needed).

## Tools & Libraries Used

- Node.js + Express (API)
- SQLite via `sqlite3` package for local persistence
- Axios for HTTP requests in `SyncService`
- TypeScript for types and safety
- Vitest for tests
- ESLint + @typescript-eslint (added minimal config to run lint in this environment)

## How to run

From the repository root:

```powershell
Set-Location -Path 'd:\source\backend-interview-challenge'
npm install
npm test          # run unit/integration tests
npm run typecheck # TypeScript check
npm run lint      # ESLint checks
npm run dev       # start dev server (nodemon + tsx)
```

## What I changed

- Implemented task service CRUD and sync service logic required by the challenge.
- Implemented routes for tasks and sync endpoints, including a local `/api/batch` handler used during tests.
- Added `eslint.config.cjs` so `npm run lint` runs under ESLint v9 several projects expect.
- Added this `docs/SOLUTION.md` describing the solution and assumptions.

## Possible Improvements (future work)

- Implement queue squashing to avoid redundant update entries for the same task.
- Add exponential backoff and jitter for retries.
- Harden conflict resolution and logging (store conflict logs to a dedicated table).
- Add authentication and per-user scoping of tasks (currently all tasks are global in the DB for simplicity).
