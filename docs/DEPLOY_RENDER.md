# Deploying to Render (Quick Guide)

This project is ready to deploy to Render as a long-running Node service. This guide covers the minimal steps to deploy using the `feature/task-sync` branch.

Prerequisites
- A Render account
- Repository pushed to GitHub (branch `feature/task-sync`)

Steps (UI)
1. Sign into Render and choose "New+" → "Web Service".
2. Connect your GitHub account and select the repository `backend-interview-challenge` and branch `feature/task-sync`.
3. Configure the service:
   - Build Command: `npm run render-build`
   - Start Command: `npm run start`
   - Environment: Node >= 18
4. (Optional) Add Environment Variables under "Environment" if you plan to use a managed DB:
   - `DATABASE_URL` - (optional) connection string for a production DB
   - `SYNC_BATCH_SIZE` - default 50
   - `SYNC_MAX_RETRIES` - default 3
5. Create the service and deploy. Render will run `npm ci --include=dev && npm run build` and then start the app.

Verification
- After deploy, visit `https://<your-service>.onrender.com/api/health` to check the health endpoint.
- Create/list tasks using `/api/tasks` and trigger `/api/sync` as needed.

Notes
- This deployment keeps using SQLite for persistence. It's sufficient for demo purposes but not recommended for production. Consider migrating to a managed Postgres (Supabase) for production.
- If you prefer to install devDependencies via environment, set `NPM_CONFIG_PRODUCTION=false` in Render settings instead of using `render-build`.

*** End
