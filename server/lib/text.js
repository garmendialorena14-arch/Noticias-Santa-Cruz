import * as cheerio from 'cheerio';

/** Minúsculas, sin acentos y con espacios normalizados. */
export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clave estable para detectar la misma nota repetida por un medio.
 * Ignora acentos, mayúsculas, puntuación, prefijos de hablante o etiquetas y espacios.
 */
export function dedupeTitleKey(value) {
  let text = normalize(value);
  // Remover prefijos de hablante o sección (ej. "grasso: ", "vidal: ")
  text = text.replace(/^[a-z0-9\s]{2,22}:\s+/, '');
  text = text.replace(/^(?:video|fotos?|galeria|urgente|alerta|atencion|en vivo|exclusivo|lo ultimo)\s*[:·|\-–—]?\s*/i, '');
  return text
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

/**
 * Compara dos títulos del mismo medio para verificar si son la misma noticia
 * con pequeñas variaciones de redacción, comillas o extensión.
 */
export function areTitlesSimilar(titleA, titleB) {
  const keyA = dedupeTitleKey(titleA);
  const keyB = dedupeTitleKey(titleB);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  // Si ambos tienen números distintos (ej. día 30 vs día 31), no son la misma nota
  const numsA = keyA.match(/\d+/g) || [];
  const numsB = keyB.match(/\d+/g) || [];
  if (numsA.length > 0 && numsB.length > 0) {
    if (numsA.join(' ') !== numsB.join(' ')) return false;
  }

  if (keyA.length >= 25 && keyB.length >= 25) {
    if (keyA.includes(keyB) || keyB.includes(keyA)) return true;
  }

  const wordsA = new Set(keyA.split(' ').filter((w) => w.length >= 4));
  const wordsB = new Set(keyB.split(' ').filter((w) => w.length >= 4));
  if (wordsA.size >= 4 && wordsB.size >= 4) {
    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    const sim = intersection.size / union.size;
    if (sim >= 0.68) return true;
  }

  return false;
}

/**
 * Extrae un identificador numérico o clave única de la URL de una nota según el medio.
 * Permite detectar si la misma nota fue actualizada o si cambió su slug.
 */
export function extractArticleId(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // El Extremo Sur: /nota/60065-slug
    const mExtremo = path.match(/\/nota\/(\d+)/i);
    if (mExtremo) return `extremo:${mExtremo[1]}`;

    // La Opinión Austral: -726162.html
    const mOpinion = path.match(/-(\d{5,})\.html$/i);
    if (mOpinion) return `opinion:${mOpinion[1]}`;

    // Libertad Noticias: articulo.php?articulo=924937
    const mLibertad = parsed.searchParams.get('articulo');
    if (mLibertad && /^\d+$/.test(mLibertad)) return `libertad:${mLibertad}`;

    // WordPress posts por ID: ?p=123
    const mP = parsed.searchParams.get('p');
    if (mP && /^\d+$/.test(mP)) return `wp:${mP}`;

    // Portales con ID numérico largo al final del slug: -123204
    const mSlugId = path.match(/-(\d{4,})\/?$/);
    if (mSlugId && mSlugId[1] !== '2026' && mSlugId[1] !== '2025' && mSlugId[1] !== '2024') {
      return `id:${mSlugId[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

export function cleanWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Convierte HTML (fragmentos o documentos) en texto plano. */
export function stripHtml(html) {
  if (!html) return '';
  const input = String(html);
  if (!/[<&]/.test(input)) return cleanWhitespace(input);
  try {
    const $ = cheerio.load(`<div id="__root">${input}</div>`, null, false);
    $('script, style, noscript, iframe, svg').remove();
    return cleanWhitespace($('#__root').text());
  } catch {
    return cleanWhitespace(input.replace(/<[^>]+>/g, ' '));
  }
}

export function decodeEntities(value) {
  if (!value) return '';
  const input = String(value);
  if (!input.includes('&')) return input;
  try {
    const $ = cheerio.load(`<div id="__root">${input}</div>`, null, false);
    return $('#__root').text();
  } catch {
    return input;
  }
}

export function truncate(value, max = 320) {
  const text = cleanWhitespace(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trim()}…`;
}

export function cleanTitle(value, sourceName = '') {
  let title = cleanWhitespace(decodeEntities(value))
    .replace(/\s*[-|–—]\s*(?:La Opinión Austral|Tiempo Sur|El Diario Nuevo Día|El Extremo Sur|El Caletense|La Vanguardia Noticias|Voces y Apuntes|La Prensa de Santa Cruz|Periódico Las Heras|Deseado Noticias|Libertad Noticias)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (sourceName) {
    const escaped = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`\\s*[-|–—]\\s*${escaped}\\s*$`, 'i'), '').trim();
  }

  // Algunos listados agregan etiquetas al principio y la antigüedad al final.
  title = title
    .replace(/^(?:lo\s+[uú]ltimo|[uú]ltimo\s+momento|[uú]ltimas?\s+noticias?|urgente|en\s+vivo|exclusivo|alerta|video|fotos?|galer[ií]a)\s*[:·|\-–—]?\s*/i, '')
    .replace(/\s+hace\s+\d+\s*(?:min(?:utos?)?|h|hs|horas?|d|d[ií]as?|semanas?)\s*$/i, '')
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/^["'“”«»]+|["'“”«»]+$/g, '')
    .trim();

  return truncate(title, 240);
}

export function cleanSummary(value, title = '') {
  let summary = stripHtml(value)
    .replace(/^(leer más|leer mas|compartir|escuchar|ver más|ver mas)[:\s-]*/i, '')
    .replace(/\s*\[…\]\s*$/g, '')
    .replace(/\s*\.\.\.\s*$/g, '')
    .trim();

  if (!summary) return '';
  if (normalize(summary) === normalize(title)) return '';
  if (summary.length < 25) return '';

  return truncate(summary, 300);
}

/** Escapa texto para insertarlo en HTML desde el frontend. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normaliza una URL para deduplicar: sin tracking, sin hash y sin barra final. */
export function canonicalizeUrl(value, base) {
  try {
    const url = new URL(String(value), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    url.hash = '';
    const remove = [];
    for (const key of url.searchParams.keys()) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|source$)/i.test(key)) remove.push(key);
    }
    for (const key of remove) url.searchParams.delete(key);

    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    url.hostname = url.hostname.toLowerCase();
    return url.href;
  } catch {
    return null;
  }
}

/** Resuelve URLs relativas y valida que sean http(s). */
export function absoluteUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim(), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function firstImageFromHtml(html, base) {
  if (!html) return null;
  try {
    const $ = cheerio.load(`<div id="__root">${html}</div>`, null, false);
    let found = null;
    $('#__root img').each((_, el) => {
      if (found) return;
      const candidate = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      const url = absoluteUrl(candidate, base);
      if (url && isUsableImage(url)) found = url;
    });
    return found;
  } catch {
    return null;
  }
}

export function isUsableImage(value) {
  if (!value) return false;
  const url = String(value);
  if (!/^https?:\/\//i.test(url)) return false;
  if (/^(data|blob):/i.test(url)) return false;
  if (/logo|favicon|sprite|avatar|placeholder|publicidad|banner|pixel|spacer|1x1|(?<![a-z0-9])default[-_.]/i.test(url)) return false;
  return true;
}

/** Elige la mejor imagen entre varias opciones. */
export function pickImage(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const list = Array.isArray(candidate) ? candidate : [candidate];
    for (const item of list) {
      if (typeof item === 'string' && isUsableImage(item)) return item;
    }
  }
  return null;
}

export function mapLimit(items, limit, worker) {
  const list = Array.from(items);
  const results = new Array(list.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const index = next++;
      try {
        results[index] = await worker(list[index], index);
      } catch (error) {
        results[index] = { error };
      }
    }
  });
  return Promise.all(runners).then(() => results);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
