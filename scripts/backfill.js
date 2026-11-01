/**
 * Completa el archivo histórico usando la API REST de WordPress de los medios
 * que la exponen. No visita cada nota: usa los datos que ya trae la API.
 *
 * Uso:
 *   npm run backfill                 # últimos 7 días
 *   npm run backfill -- --days 30    # últimos 30 días
 *   npm run backfill -- --days 14 --source la-prensa-de-santa-cruz
 */

import { getSettings, getSources, initDb } from '../server/db.js';
import { fetchWpPosts } from '../server/wp.js';
import { ingestItems } from '../server/refresh.js';

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

async function main() {
  const days = Math.max(1, Math.min(90, Number(readArg('days', 7)) || 7));
  const slug = readArg('source', null);

  initDb();

  const settings = getSettings();
  const allSources = getSources({ enabledOnly: true });
  const sources = slug
    ? allSources.filter((source) => source.slug === slug)
    : allSources.filter((source) => source.wp_api);

  if (!sources.length) {
    console.log(
      slug
        ? `No se encontró el medio "${slug}" o no tiene API de WordPress configurada.`
        : 'Ningún medio habilitado tiene API de WordPress configurada.'
    );
    return;
  }

  console.log('');
  console.log(`Backfill de los últimos ${days} días en ${sources.length} medio(s):`);
  console.log('');

  const totals = { found: 0, added: 0, updated: 0, errors: 0 };
  const startedAt = Date.now();

  for (const source of sources) {
    const sourceStartedAt = Date.now();
    try {
      const items = await fetchWpPosts(source, { days, perPage: 50, maxPages: 4 });
      const result = await ingestItems(source, items, settings, { enrich: false, limit: 500 });
      totals.found += result.found;
      totals.added += result.added;
      totals.updated += result.updated;
      console.log(
        `  ${source.name.padEnd(26)} ${String(result.found).padStart(4)} notas · ` +
          `${String(result.added).padStart(4)} nuevas · ${formatDuration(Date.now() - sourceStartedAt)}`
      );
    } catch (error) {
      totals.errors += 1;
      console.error(`  ${source.name.padEnd(26)} error: ${error.message}`);
    }
  }

  console.log('');
  console.log(
    `Listo: ${totals.found} notas procesadas, ${totals.added} nuevas, ` +
      `${totals.updated} actualizadas, ${totals.errors} error(es). ` +
      `Tiempo total: ${formatDuration(Date.now() - startedAt)}.`
  );
  console.log('');
}

main().catch((error) => {
  console.error('Backfill interrumpido:', error);
  process.exitCode = 1;
});
