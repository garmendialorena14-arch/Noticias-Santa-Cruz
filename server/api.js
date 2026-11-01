import express from 'express';
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  GROUP_LOCALITIES,
  LOCALITIES,
  PROVINCE,
  TIMEZONE
} from './config.js';
import {
  createSource,
  deleteSource,
  exportArticles,
  getDashboard,
  getDayCounts,
  getLastRun,
  getRuns,
  getSettings,
  getSourcesWithStats,
  getSourceById,
  updateSettings,
  updateSource
} from './db.js';
import { isValidDateString, todayLocal } from './lib/dates.js';
import { isHttpUrl } from './lib/text.js';
import { enrichMissingImages, fetchNewsForDate, fetchSourceItems, getRefreshState, runRefresh } from './refresh.js';
import { getSchedulerInfo, reschedule } from './scheduler.js';

export const api = express.Router();

function parseDateParam(value, fallback = todayLocal()) {
  if (!value) return fallback;
  return isValidDateString(value) ? value : null;
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

api.get('/health', (req, res) => {
  res.json({
    ok: true,
    province: PROVINCE,
    timezone: TIMEZONE,
    date: todayLocal(),
    uptime: process.uptime()
  });
});

api.get('/meta', (req, res) => {
  res.json({
    province: PROVINCE,
    timezone: TIMEZONE,
    categories: CATEGORIES.map(({ name, color, bg }) => ({ name, color, bg })),
    localities: LOCALITIES.map((locality) => locality.name),
    groups: GROUP_LOCALITIES,
    defaults: DEFAULT_SETTINGS
  });
});

api.get('/dashboard', (req, res) => {
  const date = parseDateParam(req.query.date);
  if (!date) return badRequest(res, 'Fecha inválida. Usá el formato YYYY-MM-DD.');
  try {
    res.json(getDashboard(date));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

api.get('/days', (req, res) => {
  const limit = Math.min(365, Math.max(1, Number(req.query.limit) || 60));
  res.json({ days: getDayCounts(limit) });
});

api.get('/status', (req, res) => {
  res.json({
    ...getRefreshState(),
    lastRun: getLastRun(),
    scheduler: getSchedulerInfo(),
    settings: getSettings()
  });
});

api.get('/runs', (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  res.json({ runs: getRuns(limit) });
});

api.post('/refresh', (req, res) => {
  if (getRefreshState().running) {
    return res.status(409).json({ error: 'Ya hay una actualización en curso.', ...getRefreshState() });
  }

  const sourceId = req.body?.sourceId ? Number(req.body.sourceId) : null;
  if (sourceId && !getSourceById(sourceId)) {
    return badRequest(res, 'El medio indicado no existe.');
  }

  runRefresh(sourceId ? 'manual-source' : 'manual', sourceId ? { sourceId } : {}).catch((error) => {
    console.error('[refresh] Error general:', error.message);
  });

  res.status(202).json({ started: true, sourceId, ...getRefreshState() });
});

api.post('/fetch-date', async (req, res) => {
  const date = parseDateParam(req.body?.date);
  if (!date) return badRequest(res, 'Fecha inválida. Usá el formato YYYY-MM-DD.');

  try {
    const result = await fetchNewsForDate(date);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[fetch-date] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

api.post('/enrich-images', async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.body?.limit) || 100));
  try {
    const result = await enrichMissingImages({ limit });
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[enrich-images] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

api.get('/sources', (req, res) => {
  const date = parseDateParam(req.query.date) || todayLocal();
  res.json({ sources: getSourcesWithStats(date) });
});

function normalizeSourcePayload(body, partial = false) {
  const payload = {};
  const fields = [
    'name', 'locality', 'homepage', 'feed_url', 'list_url', 'article_pattern',
    'type', 'enrich', 'enabled', 'notes', 'wp_api'
  ];

  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  if (!partial || payload.name !== undefined) {
    if (!String(payload.name || '').trim()) throw new Error('El nombre del medio es obligatorio.');
  }

  for (const field of ['homepage', 'feed_url', 'list_url', 'wp_api']) {
    if (payload[field]) {
      if (!isHttpUrl(payload[field])) throw new Error(`La URL de ${field} no es válida.`);
    }
  }

  if (payload.type && !['auto', 'rss', 'html'].includes(payload.type)) {
    throw new Error('El tipo debe ser auto, rss o html.');
  }

  if (payload.article_pattern) {
    try {
      new RegExp(payload.article_pattern);
    } catch {
      throw new Error('El patrón de enlaces no es una expresión regular válida.');
    }
  }

  if (!partial) {
    if (!payload.homepage && !payload.feed_url && !payload.list_url) {
      throw new Error('Indicá al menos una URL principal, de feed o de listado.');
    }
    payload.type = payload.type || 'auto';
    payload.enabled = payload.enabled !== false;
    payload.enrich = payload.enrich !== false;
    payload.locality = payload.locality || 'Provincia';
  }

  return payload;
}

api.post('/sources', (req, res) => {
  try {
    const payload = normalizeSourcePayload(req.body || {});
    const source = createSource(payload);
    res.status(201).json({ source });
  } catch (error) {
    badRequest(res, error.message);
  }
});

api.put('/sources/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!getSourceById(id)) return res.status(404).json({ error: 'Medio no encontrado.' });
    const payload = normalizeSourcePayload(req.body || {}, true);
    const source = updateSource(id, payload);
    res.json({ source });
  } catch (error) {
    badRequest(res, error.message);
  }
});

api.delete('/sources/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getSourceById(id)) return res.status(404).json({ error: 'Medio no encontrado.' });
  deleteSource(id);
  res.json({ ok: true });
});

api.post('/sources/test', async (req, res) => {
  const body = req.body || {};
  if (!body.feed_url && !body.list_url && !body.homepage) {
    return badRequest(res, 'Indicá una URL de feed o de listado para probar.');
  }

  const source = {
    name: body.name || 'Prueba',
    locality: body.locality || 'Provincia',
    homepage: body.homepage || null,
    feed_url: body.feed_url || null,
    list_url: body.list_url || body.homepage || null,
    article_pattern: body.article_pattern || null,
    type: ['auto', 'rss', 'html'].includes(body.type) ? body.type : 'auto',
    enrich: false
  };

  try {
    const { items, mode } = await fetchSourceItems(source, getSettings());
    res.json({
      ok: true,
      mode,
      count: items.length,
      sample: items.slice(0, 4).map((item) => ({
        title: item.title,
        url: item.url,
        published_at: item.published_at
      }))
    });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

api.get('/settings', (req, res) => {
  res.json({ settings: getSettings(), defaults: DEFAULT_SETTINGS });
});

api.put('/settings', (req, res) => {
  try {
    const settings = updateSettings(req.body || {});
    reschedule();
    res.json({ settings, scheduler: getSchedulerInfo() });
  } catch (error) {
    badRequest(res, error.message);
  }
});

api.get('/export', (req, res) => {
  const date = parseDateParam(req.query.date);
  if (!date) return badRequest(res, 'Fecha inválida.');
  const format = req.query.format === 'json' ? 'json' : 'csv';
  const rows = exportArticles(date);

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="santa-cruz-noticias-${date}.json"`);
    return res.json({ date, total: rows.length, articles: rows });
  }

  const headers = ['fecha', 'publicado', 'titulo', 'copete', 'tematica', 'localidad', 'medio', 'enlace', 'imagen'];
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="santa-cruz-noticias-${date}.csv"`);
  res.send(`\ufeff${lines.join('\r\n')}`);
});
