import { enrichArticle, extractList, parseFeed } from './feed.js';
import { fetchPage } from './lib/fetch.js';
import { localDate } from './lib/dates.js';
import { areTitlesSimilar, canonicalizeUrl, dedupeTitleKey, extractArticleId, mapLimit } from './lib/text.js';
import { fetchWpPosts } from './wp.js';
import {
  buildArticle,
  cleanupOldArticles,
  finishRun,
  getArticlesWithoutImage,
  getExistingUrls,
  getSettings,
  getSourceById,
  getSources,
  markSourceFetch,
  startRun,
  updateArticleImage,
  upsertArticle
} from './db.js';

let state = {
  running: false,
  startedAt: null,
  trigger: null,
  lastRun: null,
  lastError: null
};

export function getRefreshState() {
  return { ...state };
}

function dedupeItems(items) {
  const seenUrls = new Set();
  const seenKeys = [];
  const result = [];
  for (const item of items) {
    const url = canonicalizeUrl(item.url, item.source_url || undefined);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);

    const artId = extractArticleId(url);
    const dKey = dedupeTitleKey(item.title);

    let isDupe = false;
    for (const prev of seenKeys) {
      if (artId && prev.artId && artId === prev.artId) {
        isDupe = true;
        break;
      }
      if (dKey && prev.dKey && dKey === prev.dKey) {
        isDupe = true;
        break;
      }
      if (areTitlesSimilar(prev.title, item.title)) {
        isDupe = true;
        break;
      }
    }

    if (!isDupe) {
      seenKeys.push({ artId, dKey, title: item.title });
      result.push({ ...item, url });
    }
  }
  return result;
}

async function enrichItem(item, source) {
  try {
    const enriched = await enrichArticle(item.url, fetchPage);
    if (!enriched) return item;

    return {
      ...item,
      title: enriched.title || item.title,
      summary: enriched.summary && enriched.summary.length > (item.summary?.length || 0)
        ? enriched.summary
        : item.summary,
      image_url: item.image_url || enriched.image_url || null,
      published_at: item.published_at || enriched.published_at || null,
      author: item.author || enriched.author || null,
      source_categories: item.source_categories?.length
        ? item.source_categories
        : enriched.section
          ? [enriched.section]
          : item.source_categories
    };
  } catch {
    return item;
  }
}

export async function ingestItems(source, rawItems, settings = getSettings(), options = {}) {
  const { enrich = true, limit } = options;
  const maxItems = Number.isFinite(Number(limit))
    ? Math.max(1, Number(limit))
    : settings.max_per_source || 40;
  let items = dedupeItems(rawItems)
    .sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, maxItems);

  if (!items.length) {
    return { found: 0, added: 0, updated: 0 };
  }

  const existing = getExistingUrls(items.map((item) => item.url));
  const newItems = items.filter((item) => !existing.has(item.url));

  if (enrich && source.enrich && newItems.length) {
    const limit = Math.max(25, Number(settings.enrich_limit) || 40);
    const candidates = newItems
      .filter((item) => !item.image_url || !item.summary || !item.published_at)
      .sort((a, b) => {
        // Priorizar notas que no tienen imagen
        if (!a.image_url && b.image_url) return -1;
        if (a.image_url && !b.image_url) return 1;
        return 0;
      })
      .slice(0, limit);

    const enriched = await mapLimit(candidates, 4, (item) => enrichItem(item, source));
    const enrichedByUrl = new Map();
    for (let index = 0; index < candidates.length; index++) {
      const result = enriched[index];
      if (result && !result.error) enrichedByUrl.set(candidates[index].url, result);
    }
    items = items.map((item) => enrichedByUrl.get(item.url) || item);
  }

  let added = 0;
  let updated = 0;
  for (const item of items) {
    const article = buildArticle(source, item);
    const result = upsertArticle(article);
    if (result.inserted) added++;
    else updated++;
  }

  return { found: items.length, added, updated };
}

async function fetchSourceItems(source, settings) {
  let items = [];
  let mode = 'html';
  let rssError = null;

  if (source.feed_url && source.type !== 'html') {
    try {
      const page = await fetchPage(source.feed_url, { timeout: 25_000 });
      items = parseFeed(page.text, source);
      mode = 'rss';
    } catch (error) {
      rssError = error;
      if (source.type === 'rss') throw error;
    }
  }

  if (!items.length && source.list_url) {
    const page = await fetchPage(source.list_url, { timeout: 25_000 });
    items = extractList(page.text, page.url, source);
    mode = 'html';
  }

  if (!items.length) {
    if (rssError) throw new Error(`RSS sin resultados (${rssError.message}) y HTML sin notas detectadas`);
    throw new Error('No se detectaron notas en la fuente');
  }

  return { items, mode };
}

async function refreshSource(source, settings) {
  const startedAt = Date.now();
  try {
    const { items, mode } = await fetchSourceItems(source, settings);
    const result = await ingestItems(source, items, settings, { enrich: true });
    markSourceFetch(source.id, {
      status: 'ok',
      error: null,
      count: result.found
    });
    return {
      source_id: source.id,
      source: source.name,
      locality: source.locality,
      mode,
      ok: true,
      ...result,
      duration_ms: Date.now() - startedAt
    };
  } catch (error) {
    markSourceFetch(source.id, {
      status: 'error',
      error: error.message,
      count: 0
    });
    return {
      source_id: source.id,
      source: source.name,
      locality: source.locality,
      ok: false,
      found: 0,
      added: 0,
      updated: 0,
      error: error.message,
      duration_ms: Date.now() - startedAt
    };
  }
}

/**
 * Releva todos los medios habilitados (o uno puntual) y guarda las noticias.
 * Solo puede haber una ejecución a la vez.
 */
export async function runRefresh(trigger = 'manual', options = {}) {
  if (state.running) {
    return { alreadyRunning: true, ...state };
  }

  const settings = getSettings();
  const sources = options.sourceId
    ? [getSourceById(Number(options.sourceId))].filter(Boolean)
    : getSources({ enabledOnly: true });

  if (!sources.length) {
    return { error: 'No hay medios habilitados' };
  }

  const runId = startRun(trigger);
  state = {
    running: true,
    startedAt: new Date().toISOString(),
    trigger,
    lastRun: state.lastRun,
    lastError: null
  };

  const details = [];
  try {
    await mapLimit(sources, 3, async (source) => {
      const detail = await refreshSource(source, settings);
      details.push(detail);
      const status = detail.ok ? 'ok' : 'error';
      console.log(
        `[refresh] ${source.name}: ${status} · ${detail.found} encontradas, ${detail.added} nuevas` +
          (detail.error ? ` · ${detail.error}` : '')
      );
      return detail;
    });

    const totals = details.reduce(
      (accumulator, detail) => {
        accumulator.found += detail.found || 0;
        accumulator.added += detail.added || 0;
        accumulator.updated += detail.updated || 0;
        if (!detail.ok) accumulator.errors += 1;
        return accumulator;
      },
      { found: 0, added: 0, updated: 0, errors: 0 }
    );

    finishRun(runId, { ...totals, details });
    cleanupOldArticles(settings.retention_days);

    const result = {
      runId,
      ...totals,
      sources: sources.length,
      details,
      finishedAt: new Date().toISOString()
    };
    state = {
      running: false,
      startedAt: null,
      trigger: null,
      lastRun: result,
      lastError: totals.errors ? `${totals.errors} medio(s) con error` : null
    };
    return result;
  } catch (error) {
    finishRun(runId, { errors: 1, details });
    state = {
      running: false,
      startedAt: null,
      trigger: null,
      lastRun: state.lastRun,
      lastError: error.message
    };
    throw error;
  }
}

/**
 * Completa el archivo de los últimos N días usando las fuentes con API de WordPress.
 */
export async function runDailyBackfill(days = 3) {
  const settings = getSettings();
  const sources = getSources({ enabledOnly: true }).filter((s) => s.wp_api);
  let totalFound = 0;
  let totalAdded = 0;

  for (const source of sources) {
    try {
      const items = await fetchWpPosts(source, { days, perPage: 50, maxPages: 4 });
      if (items.length) {
        const result = await ingestItems(source, items, settings, { enrich: false, limit: 300 });
        totalFound += result.found;
        totalAdded += result.added;
      }
    } catch (err) {
      console.warn(`[daily-backfill] ${source.name}:`, err.message);
    }
  }
  return { found: totalFound, added: totalAdded };
}

export { fetchSourceItems };

/**
 * Busca y trae noticias de una fecha anterior puntual consultando los medios
 * con API de WordPress y feeds con historial.
 */
export async function fetchNewsForDate(targetDate) {
  const settings = getSettings();
  const sources = getSources({ enabledOnly: true });
  let totalFound = 0;
  let totalAdded = 0;
  let totalUpdated = 0;

  for (const source of sources) {
    try {
      let items = [];
      if (source.wp_api) {
        items = await fetchWpPosts(source, { date: targetDate, perPage: 50, maxPages: 4 });
      } else if (source.feed_url && source.type !== 'html') {
        try {
          const page = await fetchPage(source.feed_url, { timeout: 20_000 });
          const allItems = parseFeed(page.text, source);
          items = allItems.filter((item) => item.published_at && localDate(item.published_at) === targetDate);
        } catch {
          // Si el feed no responde, continuar
        }
      }

      if (items.length) {
        const result = await ingestItems(source, items, settings, { enrich: false, limit: 100 });
        totalFound += result.found;
        totalAdded += result.added;
        totalUpdated += result.updated;
      }
    } catch (err) {
      console.warn(`[fetch-date] Error en ${source.name} para ${targetDate}:`, err.message);
    }
  }

  return { date: targetDate, found: totalFound, added: totalAdded, updated: totalUpdated };
}

/**
 * Recorre notas ya guardadas en la base que no tengan foto e intenta
 * completar la imagen visitando la nota original.
 */
export async function enrichMissingImages({ limit = 100 } = {}) {
  const sources = new Map(getSources().map((s) => [s.id, s]));
  const rows = getArticlesWithoutImage(limit);

  if (!rows.length) return { total: 0, enriched: 0 };

  let enrichedCount = 0;
  await mapLimit(rows, 3, async (row) => {
    const source = sources.get(row.source_id);
    if (source && source.enrich === false) return;
    try {
      const enriched = await enrichArticle(row.url, fetchPage);
      if (enriched?.image_url) {
        updateArticleImage(row.id, enriched.image_url, enriched.summary);
        enrichedCount++;
      }
    } catch {
      // Ignorar errores individuales para continuar con las demás notas
    }
  });

  return { total: rows.length, enriched: enrichedCount };
}
