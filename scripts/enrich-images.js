/**
 * Recorre todas las notas guardadas en la base de datos que no tengan imagen
 * y visita sus páginas originales para extraer su foto oficial (og:image, twitter:image, ld+json).
 *
 * Uso:
 *   node scripts/enrich-images.js
 *   node scripts/enrich-images.js --limit 200
 */

import { initDb, getArticlesWithoutImage } from '../server/db.js';
import { enrichMissingImages } from '../server/refresh.js';

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

async function main() {
  initDb();
  const limit = Math.max(1, Math.min(500, Number(readArg('limit', 200)) || 200));

  const pending = getArticlesWithoutImage(limit);
  console.log('');
  console.log(`Buscando fotos para notas sin imagen (${pending.length} pendientes encontradas)...`);
  console.log('');

  if (!pending.length) {
    console.log('¡Todas las notas ya tienen imagen!');
    return;
  }

  const startedAt = Date.now();
  const result = await enrichMissingImages({ limit });

  console.log(`Listo: ${result.enriched} fotos añadidas de ${result.total} notas procesadas en ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
  console.log('');
}

main().catch((error) => {
  console.error('Error al enriquecer imágenes:', error);
  process.exitCode = 1;
});
