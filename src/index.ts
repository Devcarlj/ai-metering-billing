import { Pool } from 'pg';
import { createApp } from './app.js';
import { initDb } from './db/initDb.js';
import { seedTestData } from './db/seed.js';

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:dev@db:5432/billing_db',
});

async function start() {
  try {
    // 1. Ensure DB schema exists
    await initDb(db);
    
    // 2. Seed initial test data
    await seedTestData(db);

    // 3. Start Express app
    const app = createApp(db);
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Billing Engine running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Server failed to start due to DB initialization error:', err);
    process.exit(1);
  }
}

start();