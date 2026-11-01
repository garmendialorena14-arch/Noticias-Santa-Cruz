import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { api } from './api.js';
import { getDbPath, getSettings, initDb, reclassifyAll, cleanupOldArticles } from './db.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { getRefreshState } from './refresh.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

initDb();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/api', api);
app.use(
  express.static(PUBLIC_DIR, {
    etag: true,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  })
);

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('[server] Error no controlado:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Santa Cruz Noticias');
  console.log(`  Dashboard: http://${HOST}:${PORT}`);
  console.log(`  Base de datos: ${getDbPath()}`);
  console.log('');

  const settings = getSettings();
  if (settings.retention_days) {
    const removed = cleanupOldArticles(settings.retention_days);
    if (removed) console.log(`[db] Se eliminaron ${removed} noticias fuera de retención.`);
  }

  const changed = reclassifyAll();
  if (changed) console.log(`[db] Se reclasificaron ${changed} noticias.`);

  startScheduler();
});

function shutdown(signal) {
  console.log(`\n[server] ${signal} recibido. Cerrando...`);
  stopScheduler();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (error) => {
  console.error('[server] Promesa rechazada sin manejar:', error);
});
