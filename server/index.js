import config from './src/config/index.js';
import { connectDb, closeDb } from './src/config/database.js';
import { migrate } from './src/database/migrate.js';
import app from './src/app.js';

try {
  connectDb();
  migrate();
  // Catalog/users come from cloud bootstrap only. Manual seed: npm run seed (CLI).
} catch (error) {
  console.error('Failed to start server:', error.message);
  closeDb();
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log(`FluxOne server running on port ${config.port} (${config.env})`);
  if (process.env.CLIENT_DIST_PATH) {
    console.log(`Serving UI from ${process.env.CLIENT_DIST_PATH}`);
  }
});

const shutdown = () => {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
