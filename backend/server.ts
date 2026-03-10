import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express from 'express';
import { connect } from './services/database';
import { loadSchema } from './services/schema';
import queryRouter from './routes/query';
import { queryRateLimit } from './middleware/rateLimit';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(express.json());

// Rate limiting on all /api routes
app.use('/api', queryRateLimit);

// Routes
app.use('/api/query', queryRouter);

// Health check — useful for Azure App Service and local smoke tests
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start(): Promise<void> {
  try {
    await connect();
    await loadSchema();

    app.listen(PORT, () => {
      console.log(`[server] Backend running on http://localhost:${PORT}`);
      console.log(`[server] Health check: http://localhost:${PORT}/health`);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[server] Startup failed:', message);
    process.exit(1);
  }
}

start();
