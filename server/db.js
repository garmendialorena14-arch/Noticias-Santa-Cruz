import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { CATEGORY_NAMES, DEFAULT_SETTINGS, DEFAULT_SOURCES } from './config.js';
import { classifyCategory, classifyLocality, cleanSourceCategories } from './classify.js';
import { addDays, localDate, todayLocal } from './lib/dates.js';
import { areTitlesSimilar, dedupeTitleKey, extractArticleId } from './lib/text.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'news.db');

let db;

function nowIso() {
  return new Date().toISOString();
}

export function getDbPath() {
  return DB_PATH;
}

export function initDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      locality TEXT NOT NULL DEFAULT 'Provincia',
      homepage TEXT,
      feed_url TEXT,
      list_url TEXT,
      article_pattern TEXT,
      type TEXT NOT NULL DEFAULT 'auto',
      enrich INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      wp_api TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_fetch_at TEXT,
      last_status TEXT,
      last_error TEXT,
      last_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      summary TEXT,
      image_url TEXT,
      author TEXT,
      published_at TEXT,
      date_local TEXT NOT NULL,
      category TEXT NOT NULL,
      locality TEXT NOT NULL,
      source_category TEXT,
      fetched_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      dedupe_key TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date_local);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_articles_locality ON articles(locality);
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      trigger TEXT,
      found INTEGER NOT NULL DEFAULT 0,
      added INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      errors INTEGER NOT NULL DEFAULT 0,
      details TEXT
    );
  `);

  seedSources();
  seedSettings();
  const removed = migrateArticles();
  if (removed) console.log(`[db] Se eliminaron ${removed} noticias duplicadas.`);
  return db;
}

/**
 * Agrega la clave de deduplicación a bases existentes, limpia duplicados
 * del mismo medio y recién después crea el índice único.
 */
function migrateArticles() {
  const columns = db.prepare('PRAGMA table_info(articles)').all();
  if (!columns.some((column) => column.name === 'dedupe_key')) {
    db.exec('ALTER TABLE articles ADD COLUMN dedupe_key TEXT');
  }

  db.exec('DROP INDEX IF EXISTS idx_articles_source_dedupe');
  const removed = dedupeExistingArticles();
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_source_dedupe
    ON articles(source_id, dedupe_key)
  `);
  return removed;
}

/**
 * Deja una sola fila por medio y noticia (por clave de título, ID de nota o similitud).
 * Conserva la nota más antigua (la publicación original) y completa copete/imagen si faltaban.
 */
function dedupeExistingArticles() {
  const rows = db
    .prepare(`
      SELECT id, source_id, title, summary, image_url, url, date_local
      FROM articles
      ORDER BY date_local ASC, COALESCE(published_at, fetched_at) ASC, id ASC
    `)
    .all();

  const keepersBySource = new Map();
  const toDelete = [];
  const setKey = db.prepare('UPDATE articles SET dedupe_key = ? WHERE id = ?');
  const merge = db.prepare(`
    UPDATE articles SET
      summary = CASE
        WHEN length(COALESCE(summary, '')) >= length(COALESCE(?, '')) THEN summary
        ELSE ? END,
      image_url = COALESCE(image_url, ?)
    WHERE id = ?
  `);
  const remove = db.prepare('DELETE FROM articles WHERE id = ?');

  let removed = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const sId = row.source_id ?? 'null';
      const key = dedupeTitleKey(row.title);
      const artId = extractArticleId(row.url);
      if (!keepersBySource.has(sId)) {
        keepersBySource.set(sId, []);
      }

      const keepers = keepersBySource.get(sId);
      let match = null;

      for (const k of keepers) {
        if (artId && k.artId && artId === k.artId) {
          match = k;
          break;
        }
        if (key && k.key && key === k.key) {
          match = k;
          break;
        }
        const daysDiff = Math.abs(new Date(row.date_local).getTime() - new Date(k.date_local).getTime()) / 86400000;
        if (daysDiff <= 3 && areTitlesSimilar(k.title, row.title)) {
          match = k;
          break;
        }
      }

      if (match) {
        merge.run(row.summary, row.summary, row.image_url, match.id);
        remove.run(row.id);
        removed++;
      } else {
        if (key) setKey.run(key, row.id);
        keepers.push({ id: row.id, key, artId, title: row.title, date_local: row.date_local });
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return removed;
}

function seedSources() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM sources').get().count;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO sources (
      slug, name, locality, homepage, feed_url, list_url, article_pattern,
      type, enrich, enabled, notes, wp_api, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = nowIso();
  for (const source of DEFAULT_SOURCES) {
    insert.run(
      source.slug,
      source.name,
      source.locality,
      source.homepage || null,
      source.feed_url || null,
      source.list_url || source.homepage || null,
      source.article_pattern || null,
      source.type || 'auto',
      source.enrich ? 1 : 0,
      source.enabled === false ? 0 : 1,
      source.notes || null,
      source.wp_api || null,
      timestamp,
      timestamp
    );
  }
}

function seedSettings() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, JSON.stringify(value));
  }
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export function updateSettings(patch) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const statement = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.includes(key)) continue;
    let parsed = value;
    if (key === 'refresh_minutes') parsed = Math.min(1440, Math.max(5, Number(value) || 30));
    if (key === 'max_per_source') parsed = Math.min(150, Math.max(5, Number(value) || 40));
    if (key === 'enrich_limit') parsed = Math.min(60, Math.max(0, Number(value) || 0));
    if (key === 'retention_days') parsed = Math.min(3650, Math.max(0, Number(value) || 0));
    if (key === 'daily_backfill_days') parsed = Math.min(30, Math.max(0, Number(value) || 0));
    if (key === 'default_categories') {
      const list = Array.isArray(value) ? value : [];
      parsed = [...new Set(list.map(String).filter((name) => CATEGORY_NAMES.includes(name)))];
    }
    if (key === 'default_sources') {
      const list = Array.isArray(value) ? value : [];
      parsed = [...new Set(list.map((name) => String(name).trim()).filter(Boolean))].slice(0, 50);
    }
    statement.run(key, JSON.stringify(parsed));
  }
  return getSettings();
}

export function getSources({ enabledOnly = false } = {}) {
  const sql = `SELECT * FROM sources ${enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY name COLLATE NOCASE`;
  return db.prepare(sql).all().map(mapSource);
}

export function getSourcesWithStats(date) {
  const rows = db
    .prepare(`
      SELECT s.*, COUNT(a.id) AS article_count
      FROM sources s
      LEFT JOIN articles a ON a.source_id = s.id AND a.date_local = ?
      GROUP BY s.id
      ORDER BY s.name COLLATE NOCASE
    `)
    .all(date);
  return rows.map((row) => ({ ...mapSource(row), article_count: row.article_count }));
}

function mapSource(row) {
  return {
    ...row,
    enrich: Boolean(row.enrich),
    enabled: Boolean(row.enabled)
  };
}

export function getSourceById(id) {
  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
  return row ? mapSource(row) : null;
}

export function getSourceBySlug(slug) {
  const row = db.prepare('SELECT * FROM sources WHERE slug = ?').get(slug);
  return row ? mapSource(row) : null;
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `medio-${Date.now()}`;
}

export function createSource(data) {
  const timestamp = nowIso();
  let slug = data.slug ? slugify(data.slug) : slugify(data.name);
  const existing = getSourceBySlug(slug);
  if (existing) slug = `${slug}-${Date.now().toString().slice(-5)}`;

  const result = db
    .prepare(`
      INSERT INTO sources (
        slug, name, locality, homepage, feed_url, list_url, article_pattern,
        type, enrich, enabled, notes, wp_api, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      slug,
      String(data.name || '').trim(),
      String(data.locality || 'Provincia').trim(),
      data.homepage || null,
      data.feed_url || null,
      data.list_url || data.homepage || null,
      data.article_pattern || null,
      ['auto', 'rss', 'html'].includes(data.type) ? data.type : 'auto',
      data.enrich ? 1 : 0,
      data.enabled === false ? 0 : 1,
      data.notes || null,
      data.wp_api || null,
      timestamp,
      timestamp
    );

  return getSourceById(Number(result.lastInsertRowid));
}

export function updateSource(id, data) {
  const current = getSourceById(id);
  if (!current) return null;

  // A diferencia de ??, esto permite vaciar un campo enviando null desde el formulario.
  const pick = (value, fallback) => (value !== undefined ? value : fallback);

  const timestamp = nowIso();
  db.prepare(`
    UPDATE sources SET
      name = ?, locality = ?, homepage = ?, feed_url = ?, list_url = ?,
      article_pattern = ?, type = ?, enrich = ?, enabled = ?, notes = ?, wp_api = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    String(data.name ?? current.name).trim(),
    String(data.locality ?? current.locality).trim(),
    pick(data.homepage, current.homepage),
    pick(data.feed_url, current.feed_url),
    pick(data.list_url, current.list_url),
    pick(data.article_pattern, current.article_pattern),
    ['auto', 'rss', 'html'].includes(data.type) ? data.type : current.type,
    data.enrich == null ? (current.enrich ? 1 : 0) : data.enrich ? 1 : 0,
    data.enabled == null ? (current.enabled ? 1 : 0) : data.enabled ? 1 : 0,
    pick(data.notes, current.notes),
    pick(data.wp_api, current.wp_api),
    timestamp,
    id
  );

  return getSourceById(id);
}

export function deleteSource(id) {
  return db.prepare('DELETE FROM sources WHERE id = ?').run(id).changes > 0;
}

export function markSourceFetch(id, { status, error = null, count = 0 }) {
  db.prepare(`
    UPDATE sources SET last_fetch_at = ?, last_status = ?, last_error = ?, last_count = ?
    WHERE id = ?
  `).run(nowIso(), status, error, count, id);
}

export function getExistingUrls(urls) {
  if (!urls.length) return new Set();
  const unique = [...new Set(urls)];
  const found = new Set();
  const chunkSize = 400;
  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.prepare(`SELECT url FROM articles WHERE url IN (${placeholders})`).all(...chunk);
    for (const row of rows) found.add(row.url);
  }
  return found;
}

export function upsertArticle(article) {
  const dedupeKey = dedupeTitleKey(article.title);
  const articleId = extractArticleId(article.url);

  const existingByUrl = db.prepare('SELECT id FROM articles WHERE url = ?').get(article.url);
  if (existingByUrl) {
    db.prepare(`
      UPDATE articles SET
        source_id = ?,
        source_name = ?,
        title = ?,
        summary = CASE
          WHEN length(COALESCE(?, '')) > length(COALESCE(summary, ''))
          THEN ? ELSE summary END,
        image_url = COALESCE(?, image_url),
        author = COALESCE(?, author),
        published_at = COALESCE(published_at, ?),
        date_local = CASE
          WHEN published_at IS NULL AND ? IS NOT NULL THEN ?
          ELSE date_local END,
        category = ?,
        locality = ?,
        source_category = COALESCE(?, source_category),
        dedupe_key = ?,
        last_seen_at = ?
      WHERE id = ?
    `).run(
      article.source_id,
      article.source_name,
      article.title,
      article.summary || null,
      article.summary || null,
      article.image_url || null,
      article.author || null,
      article.published_at || null,
      article.published_at || null,
      article.date_local,
      article.category,
      article.locality,
      article.source_category || null,
      dedupeKey || null,
      article.last_seen_at,
      existingByUrl.id
    );
    return { id: existingByUrl.id, inserted: false };
  }

  let existing = null;

  // 1. Coincidencia por ID de nota en la URL para el mismo medio
  if (articleId && article.source_id) {
    const candidates = db
      .prepare('SELECT id, title, url, date_local FROM articles WHERE source_id = ? ORDER BY id DESC LIMIT 200')
      .all(article.source_id);
    for (const cand of candidates) {
      if (extractArticleId(cand.url) === articleId) {
        existing = cand;
        break;
      }
    }
  }

  // 2. Coincidencia por clave de deduplicación de título
  if (!existing && dedupeKey && article.source_id) {
    existing = db
      .prepare('SELECT id, title, url, date_local FROM articles WHERE source_id = ? AND dedupe_key = ?')
      .get(article.source_id, dedupeKey);
  }

  // 3. Coincidencia por títulos similares del mismo medio (notas dentro de los 3 días)
  if (!existing && article.source_id && article.title) {
    const recents = db
      .prepare('SELECT id, title, url, date_local FROM articles WHERE source_id = ? ORDER BY id DESC LIMIT 150')
      .all(article.source_id);
    for (const cand of recents) {
      const daysDiff = Math.abs(new Date(article.date_local).getTime() - new Date(cand.date_local).getTime()) / 86400000;
      if (daysDiff <= 3 && areTitlesSimilar(cand.title, article.title)) {
        existing = cand;
        break;
      }
    }
  }

  if (existing) {
    // Es la misma nota republicada con otra URL o título ajustado: conservamos la original.
    db.prepare(`
      UPDATE articles SET
        source_name = ?,
        summary = CASE
          WHEN length(COALESCE(?, '')) > length(COALESCE(summary, ''))
          THEN ? ELSE summary END,
        image_url = COALESCE(image_url, ?),
        author = COALESCE(author, ?),
        published_at = COALESCE(published_at, ?),
        category = ?,
        locality = ?,
        source_category = COALESCE(source_category, ?),
        last_seen_at = ?
      WHERE id = ?
    `).run(
      article.source_name,
      article.summary || null,
      article.summary || null,
      article.image_url || null,
      article.author || null,
      article.published_at || null,
      article.category,
      article.locality,
      article.source_category || null,
      article.last_seen_at,
      existing.id
    );
    return { id: existing.id, inserted: false };
  }

  const result = db.prepare(`
    INSERT INTO articles (
      source_id, source_name, title, url, summary, image_url, author,
      published_at, date_local, category, locality, source_category,
      fetched_at, last_seen_at, dedupe_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    article.source_id,
    article.source_name,
    article.title,
    article.url,
    article.summary || null,
    article.image_url || null,
    article.author || null,
    article.published_at || null,
    article.date_local,
    article.category,
    article.locality,
    article.source_category || null,
    article.fetched_at,
    article.last_seen_at,
    dedupeKey || null
  );

  return { id: Number(result.lastInsertRowid), inserted: true };
}

export function buildArticle(source, item) {
  const fetchedAt = nowIso();
  // Si el medio no informa fecha, no inventamos una: la nota queda sin hora y
  // se archiva en el día en que se la detectó por primera vez.
  const publishedAt = item.published_at || null;
  const dateLocal = (publishedAt && localDate(publishedAt)) || todayLocal();
  const sourceCategories = cleanSourceCategories(item.source_categories || []);
  const category = classifyCategory({
    title: item.title,
    summary: item.summary,
    sourceCategories,
    url: item.url
  });
  const locality = classifyLocality({
    title: item.title,
    summary: item.summary,
    url: item.url,
    sourceLocality: source.locality,
    category
  });

  return {
    source_id: source.id,
    source_name: source.name,
    title: item.title,
    url: item.url,
    summary: item.summary || null,
    image_url: item.image_url || null,
    author: item.author || null,
    published_at: publishedAt,
    date_local: dateLocal,
    category,
    locality,
    source_category: sourceCategories.join(' · ') || null,
    fetched_at: fetchedAt,
    last_seen_at: fetchedAt
  };
}

export function getArticlesByDate(date) {
  const rows = db
    .prepare(`
      SELECT
        a.*,
        s.name AS live_source_name,
        s.slug AS source_slug,
        s.homepage AS source_homepage
      FROM articles a
      LEFT JOIN sources s ON s.id = a.source_id
      WHERE a.date_local = ?
      ORDER BY
        CASE WHEN a.published_at IS NULL THEN 1 ELSE 0 END,
        a.published_at DESC,
        a.id DESC
      LIMIT 1200
    `)
    .all(date)
    .map((row) => ({
      ...row,
      source_name: row.live_source_name || row.source_name,
      source_slug: row.source_slug || null
    }));

  // Asegurar que la misma noticia no se muestre más de una vez por el mismo medio
  const uniqueArticles = [];
  const seenBySource = new Map();

  for (const article of rows) {
    const sId = article.source_id || article.source_name;
    const artId = extractArticleId(article.url);
    const dKey = article.dedupe_key || dedupeTitleKey(article.title);

    let isDupe = false;
    if (!seenBySource.has(sId)) {
      seenBySource.set(sId, []);
    } else {
      for (const prev of seenBySource.get(sId)) {
        if (artId && prev.artId && artId === prev.artId) {
          isDupe = true;
          break;
        }
        if (dKey && prev.dKey && dKey === prev.dKey) {
          isDupe = true;
          break;
        }
        if (areTitlesSimilar(prev.title, article.title)) {
          isDupe = true;
          break;
        }
      }
    }

    if (!isDupe) {
      seenBySource.get(sId).push({ artId, dKey, title: article.title });
      uniqueArticles.push(article);
    }
  }

  return uniqueArticles;
}

export function getDayCounts(limit = 60, endDate = todayLocal()) {
  const rows = db
    .prepare(`
      SELECT date_local AS date, COUNT(*) AS count
      FROM articles
      WHERE date_local <= ?
      GROUP BY date_local
      ORDER BY date_local DESC
      LIMIT ?
    `)
    .all(endDate, limit);
  return rows;
}

export function getGlobalStats() {
  const total = db.prepare('SELECT COUNT(*) AS count FROM articles').get().count;
  const sources = db.prepare('SELECT COUNT(*) AS count FROM sources WHERE enabled = 1').get().count;
  const firstDate = db.prepare('SELECT MIN(date_local) AS date FROM articles').get().date;
  const lastUpdate = db.prepare('SELECT MAX(last_seen_at) AS value FROM articles').get().value;
  return { total, sources, firstDate, lastUpdate };
}

export function getDayStats(date) {
  const row = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT source_id) AS sources,
        COUNT(DISTINCT locality) AS localities,
        MAX(last_seen_at) AS last_update
      FROM articles
      WHERE date_local = ?
    `)
    .get(date);
  return row;
}

export function getFacets(date) {
  const categories = db
    .prepare(`SELECT category AS name, COUNT(*) AS count FROM articles WHERE date_local = ? GROUP BY category ORDER BY count DESC, name`)
    .all(date);
  const localities = db
    .prepare(`SELECT locality AS name, COUNT(*) AS count FROM articles WHERE date_local = ? GROUP BY locality ORDER BY count DESC, name`)
    .all(date);
  const sources = db
    .prepare(`
      SELECT COALESCE(s.name, a.source_name) AS name, COUNT(*) AS count
      FROM articles a
      LEFT JOIN sources s ON s.id = a.source_id
      WHERE a.date_local = ?
      GROUP BY COALESCE(s.name, a.source_name)
      ORDER BY count DESC, name
    `)
    .all(date);
  return { categories, localities, sources };
}

export function getDashboard(date) {
  const articles = getArticlesByDate(date);
  const facets = getFacets(date);
  const stats = getDayStats(date);
  const days = getDayCounts(60, todayLocal());
  const global = getGlobalStats();
  const settings = getSettings();

  return {
    date,
    today: todayLocal(),
    articles,
    facets,
    stats: {
      total: stats.total || 0,
      sources: stats.sources || 0,
      localities: stats.localities || 0,
      lastUpdate: stats.last_update || global.lastUpdate || null,
      sourcesEnabled: global.sources,
      archiveTotal: global.total,
      firstDate: global.firstDate
    },
    days,
    settings
  };
}

export function startRun(trigger = 'manual') {
  const result = db
    .prepare('INSERT INTO runs (started_at, trigger) VALUES (?, ?)')
    .run(nowIso(), trigger);
  return Number(result.lastInsertRowid);
}

export function finishRun(id, { found = 0, added = 0, updated = 0, errors = 0, details = [] } = {}) {
  db.prepare(`
    UPDATE runs SET finished_at = ?, found = ?, added = ?, updated = ?, errors = ?, details = ?
    WHERE id = ?
  `).run(nowIso(), found, added, updated, errors, JSON.stringify(details), id);
}

export function getLastRun() {
  const row = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').get();
  if (!row) return null;
  let details = [];
  try {
    details = row.details ? JSON.parse(row.details) : [];
  } catch {
    details = [];
  }
  return { ...row, details };
}

export function getRuns(limit = 10) {
  const rows = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map((row) => {
    let details = [];
    try {
      details = row.details ? JSON.parse(row.details) : [];
    } catch {
      details = [];
    }
    return { ...row, details };
  });
}

export function getRunById(id) {
  const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
  if (!row) return null;
  let details = [];
  try {
    details = row.details ? JSON.parse(row.details) : [];
  } catch {
    details = [];
  }
  return { ...row, details };
}

export function reclassifyAll() {
  const rows = db
    .prepare(`
      SELECT a.id, a.title, a.summary, a.url, a.category, a.locality, a.source_category,
             COALESCE(s.locality, 'Provincia') AS source_locality
      FROM articles a
      LEFT JOIN sources s ON s.id = a.source_id
    `)
    .all();

  const update = db.prepare('UPDATE articles SET category = ?, locality = ? WHERE id = ?');
  let changed = 0;

  for (const row of rows) {
    const sourceCategories = row.source_category ? row.source_category.split(' · ') : [];
    const category = classifyCategory({
      title: row.title,
      summary: row.summary || '',
      sourceCategories,
      url: row.url
    });
    const locality = classifyLocality({
      title: row.title,
      summary: row.summary || '',
      url: row.url,
      sourceLocality: row.source_locality,
      category
    });
    if (category !== row.category || locality !== row.locality) {
      update.run(category, locality, row.id);
      changed++;
    }
  }

  return changed;
}

export function cleanupOldArticles(retentionDays) {
  if (!retentionDays || retentionDays <= 0) return 0;
  const cutoff = addDays(todayLocal(), -retentionDays);
  const result = db.prepare('DELETE FROM articles WHERE date_local < ?').run(cutoff);
  db.prepare(`DELETE FROM runs WHERE started_at < datetime('now', '-90 days')`).run();
  return result.changes;
}

export function getArticlesWithoutImage(limit = 100) {
  return db
    .prepare(`
      SELECT id, source_id, source_name, url, title, date_local
      FROM articles
      WHERE image_url IS NULL OR length(image_url) = 0
      ORDER BY date_local DESC, id DESC
      LIMIT ?
    `)
    .all(limit);
}

export function updateArticleImage(id, imageUrl, summary = null) {
  return db
    .prepare(`
      UPDATE articles SET
        image_url = ?,
        summary = CASE WHEN length(COALESCE(summary, '')) < 30 AND length(COALESCE(?, '')) >= 30 THEN ? ELSE summary END
      WHERE id = ?
    `)
    .run(imageUrl, summary, summary, id);
}

export function exportArticles(date) {
  return db
    .prepare(`
      SELECT
        a.date_local AS fecha,
        a.published_at AS publicado,
        a.title AS titulo,
        a.summary AS copete,
        a.category AS tematica,
        a.locality AS localidad,
        COALESCE(s.name, a.source_name) AS medio,
        a.url AS enlace,
        a.image_url AS imagen
      FROM articles a
      LEFT JOIN sources s ON s.id = a.source_id
      WHERE a.date_local = ?
      ORDER BY a.published_at DESC
    `)
    .all(date);
}
