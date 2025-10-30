import { createApp } from './app';

const PORT = process.env.PORT || 3000;
const { app, database } = createApp();

async function start() {
  try {
    await database.initialize();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();