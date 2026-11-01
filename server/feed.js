import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fetchPage } from './lib/fetch.js';
import { extractDateFromText, parseDate, parseRecentDate } from './lib/dates.js';
import {
  absoluteUrl,
  canonicalizeUrl,
  cleanSummary,
  cleanTitle,
  firstImageFromHtml,
  isUsableImage,
  pickImage,
  stripHtml,
  truncate
} from './lib/text.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: '#cdata',
  trimValues: true,
  parseTagValue: false
});

const BLACKLISTED_PATH =
  /\/(tag|tags|etiqueta|etiquetas|categoria|categorias|category|autor|autores|author|page|pagina|buscar|search|seccion|section|contacto|publicidad|avisos?|terminos|privacidad|newsletter|suscripcion|login|registro|radio|en-vivo|wp-json|wp-admin|feed|rss|sitemap)(\/|$)/i;

const SECTION_SLUGS = new Set([
  'locales', 'local', 'regionales', 'regional', 'nacionales', 'nacional', 'deportes', 'deporte',
  'policiales', 'policial', 'politica', 'sociedad', 'cultura', 'salud', 'turismo', 'ambiente',
  'economia', 'educacion', 'tecnologia', 'espectaculos', 'opinion', 'editorial', 'videos',
  'multimedia', 'actualidad', 'ultimas-noticias', 'informacion-general'
]);

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return textOf(value[0]);
  if (typeof value === 'object') {
    if (value['#cdata'] != null) return String(value['#cdata']);
    if (value['#text'] != null) return String(value['#text']);
    if (value.__text != null) return String(value.__text);
  }
  return '';
}

function attr(value, name) {
  if (!value || typeof value !== 'object') return null;
  return value[name] ?? value[`@_${name}`] ?? null;
}

function extractLink(item) {
  if (typeof item.link === 'string') return item.link;
  const links = asArray(item.link);
  if (!links.length) return null;
  const alternate = links.find((link) => {
    const rel = attr(link, 'rel');
    return !rel || rel === 'alternate';
  });
  return attr(alternate || links[0], 'href');
}

function extractFeedImage(item, contentHtml, baseUrl) {
  const mediaContent = asArray(item['media:content']);
  const mediaThumb = asArray(item['media:thumbnail']);
  const enclosures = asArray(item.enclosure);
  const candidates = [];

  for (const media of [...mediaContent, ...mediaThumb]) {
    const url = attr(media, 'url');
    if (url) candidates.push(url);
  }
  for (const enclosure of enclosures) {
    const type = attr(enclosure, 'type') || '';
    const url = attr(enclosure, 'url');
    if (url && (!type || /^image\//i.test(type))) candidates.push(url);
  }

  const direct = pickImage(candidates.map((url) => absoluteUrl(url, baseUrl)));
  if (direct) return direct;

  return firstImageFromHtml(contentHtml, baseUrl);
}

function extractFeedCategories(item) {
  const values = [
    ...asArray(item.category),
    ...asArray(item['dc:subject'])
  ];
  return values
    .map((value) => textOf(value))
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Convierte un feed RSS/Atom en una lista uniforme de noticias.
 */
export function parseFeed(xml, source = {}) {
  let document;
  try {
    document = xmlParser.parse(xml);
  } catch {
    return [];
  }

  const channel = document?.rss?.channel || document?.RDF?.channel || document?.feed;
  if (!channel) return [];

  const rawItems = channel.item || channel.entry || document?.RDF?.item || [];
  const items = asArray(rawItems);
  const baseUrl = source.homepage || source.list_url || 'https://localhost/';

  return items
    .map((item) => {
      const title = cleanTitle(textOf(item.title), source.name);
      let link = extractLink(item);
      if (!link && typeof item.guid === 'string') link = item.guid;
      link = absoluteUrl(link, baseUrl);
      if (!link || !title) return null;

      const contentHtml =
        textOf(item['content:encoded']) ||
        textOf(item.content) ||
        textOf(item.description) ||
        textOf(item.summary) ||
        '';
      const summaryHtml = textOf(item.description) || textOf(item.summary) || contentHtml;
      const publishedAt =
        parseDate(textOf(item.pubDate)) ||
        parseDate(textOf(item.published)) ||
        parseDate(textOf(item.updated)) ||
        parseDate(textOf(item['dc:date'])) ||
        parseDate(textOf(item.date));

      const categories = extractFeedCategories(item);

      return {
        title,
        url: canonicalizeUrl(link),
        summary: cleanSummary(summaryHtml, title),
        image_url: extractFeedImage(item, contentHtml, link),
        author: truncate(textOf(item['dc:creator']) || textOf(item.author), 120),
        published_at: publishedAt,
        source_categories: categories,
        source_url: link
      };
    })
    .filter((item) => item && item.url && item.title)
    .filter((item, index, list) => list.findIndex((other) => other.url === item.url) === index)
    .sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });
}

function sameSite(url, baseUrl) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./i, '').toLowerCase();
    return host === baseHost || host.endsWith(`.${baseHost}`);
  } catch {
    return false;
  }
}

function isArticleUrl(url, baseUrl, pattern) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!sameSite(url, baseUrl)) return false;
  if (BLACKLISTED_PATH.test(parsed.pathname)) return false;
  if (/^(javascript|mailto|tel|data):/i.test(url)) return false;
  if (/[?&](s|q|page|paged|p)=\b/i.test(parsed.search) && !/articulo=/i.test(parsed.search)) return false;

  if (pattern) {
    try {
      return new RegExp(pattern, 'i').test(`${parsed.pathname}${parsed.search}`);
    } catch {
      // Si el patrón está mal escrito, sigue con la heurística.
    }
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  const last = segments[segments.length - 1].toLowerCase();
  if (SECTION_SLUGS.has(last)) return false;
  if (last.length < 12) return false;

  return true;
}

function headingText($, element) {
  const clone = $(element).clone();
  clone
    .find('.volanta, [class*="volanta"], [class*="categoria"], [class*="category"], .kicker, .seccion')
    .remove();
  return clone.text();
}

function extractFromContainer($, element, baseUrl) {
  let container = $(element).closest(
    'article, li, .nota, .nota-item, .card, .post, .item, .news-item, .tarjeta, .bloque, .story, .row, .col'
  );
  if (!container.length) {
    container = $(element).parent();
    if (!container.length) container = $(element);
    if (container.parent().length) container = container.parent();
  }

  let image = null;
  container.find('img, source, [style*="background"]').each((_, img) => {
    if (image) return;
    const el = $(img);
    const src =
      el.attr('src') ||
      el.attr('data-src') ||
      el.attr('data-lazy-src') ||
      el.attr('data-original') ||
      el.attr('srcset');
    const fromSrcset = src && src.includes(',') ? src.split(',')[0].trim().split(/\s+/)[0] : src;
    const resolved = absoluteUrl(fromSrcset, baseUrl);
    if (resolved && isUsableImage(resolved)) {
      image = resolved;
      return;
    }
    const style = el.attr('style') || '';
    const mBg = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
    if (mBg) {
      const res = absoluteUrl(mBg[1], baseUrl);
      if (res && isUsableImage(res)) image = res;
    }
  });

  const time = container.find('time').first();
  const date =
    parseRecentDate(time.attr('datetime')) ||
    parseRecentDate(time.text()) ||
    parseRecentDate(extractDateFromText(container.text().slice(0, 800)), { maxAgeDays: 60 });

  let summary = '';
  container.find('p').each((_, paragraph) => {
    if (summary) return;
    const text = cleanSummary($(paragraph).text());
    if (text.length >= 40) summary = text;
  });

  return { image, date, summary };
}

/**
 * Extrae notas desde la portada o una página de sección.
 */
export function extractList(html, baseUrl, source = {}) {
  const $ = cheerio.load(html);
  const candidates = new Map();

  // Mapear previamente todas las imágenes en enlaces con su URL canónica
  const imagesByUrl = new Map();
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(href)) return;
    const url = absoluteUrl(href, baseUrl);
    if (!url) return;
    const canonical = canonicalizeUrl(url);
    if (!canonical || imagesByUrl.has(canonical)) return;

    let img = null;
    $(element).find('img, source').each((_, el) => {
      if (img) return;
      const src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-lazy-src') ||
        $(el).attr('data-original') ||
        $(el).attr('srcset');
      const candidate = src ? (src.includes(',') ? src.split(',')[0].trim().split(/\s+/)[0] : src) : null;
      const res = absoluteUrl(candidate, baseUrl);
      if (res && isUsableImage(res)) img = res;
    });

    if (!img) {
      const style = $(element).attr('style') || $(element).find('[style*="background"]').attr('style') || '';
      const mBg = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")]+)['"]?\)/i);
      if (mBg) {
        const res = absoluteUrl(mBg[1], baseUrl);
        if (res && isUsableImage(res)) img = res;
      }
    }

    if (img) imagesByUrl.set(canonical, img);
  });

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(href)) return;

    const url = absoluteUrl(href, baseUrl);
    if (!url) return;
    if (!isArticleUrl(url, baseUrl, source.article_pattern)) return;

    const canonical = canonicalizeUrl(url);
    if (!canonical) return;

    // Preferimos el título real antes que el texto completo del enlace, que
    // suele incluir la sección, la antigüedad o el copete.
    let title = cleanTitle($(element).attr('title') || '', source.name);
    if (title.length < 20) {
      const heading = $(element).find('h1, h2, h3, h4').first();
      if (heading.length) title = cleanTitle(headingText($, heading), source.name);
    }
    if (title.length < 20) {
      const spans = $(element)
        .find('span')
        .map((_, span) => ({
          text: cleanTitle($(span).text(), source.name),
          className: $(span).attr('class') || ''
        }))
        .get()
        .filter(
          (span) =>
            span.text.length >= 20 &&
            !/^hace\s/i.test(span.text) &&
            !/volanta|categoria|category|kicker|seccion|section|meta/i.test(span.className)
        )
        .map((span) => span.text);
      if (spans.length) title = spans[spans.length - 1];
    }
    if (title.length < 20) {
      const closest = $(element).closest('h1, h2, h3, h4').first();
      title = cleanTitle(
        closest.length ? headingText($, closest) : $(element).text(),
        source.name
      );
    }
    if (title.length < 20) return;

    const meta = extractFromContainer($, element, baseUrl);
    const image = meta.image || imagesByUrl.get(canonical) || null;
    const resolvedImage = image ? absoluteUrl(image, baseUrl) : null;

    const existing = candidates.get(canonical);
    if (!existing || title.length > existing.title.length) {
      candidates.set(canonical, {
        title,
        url: canonical,
        summary: meta.summary || existing?.summary || '',
        image_url: resolvedImage || existing?.image_url || null,
        published_at: meta.date || existing?.published_at || null,
        source_categories: [],
        source_url: url
      });
    } else if (resolvedImage && !existing.image_url) {
      existing.image_url = resolvedImage;
    }
  });

  return [...candidates.values()]
    .sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 80);
}

function findArticleJsonLd($) {
  const found = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const queue = [parsed];
      while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;
        if (Array.isArray(current)) {
          queue.push(...current);
          continue;
        }
        if (current['@graph']) queue.push(...asArray(current['@graph']));
        const type = current['@type'];
        if (
          type === 'NewsArticle' ||
          type === 'Article' ||
          type === 'BlogPosting' ||
          (Array.isArray(type) && type.some((item) => /Article|Posting/i.test(item)))
        ) {
          found.push(current);
        }
      }
    } catch {
      // Algunos sitios incluyen JSON-LD con errores; se ignora.
    }
  });
  return found[0] || null;
}

function ldImage(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return ldImage(value[0]);
  if (typeof value === 'object') return value.url || value.contentUrl || null;
  return null;
}

function ldAuthor(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(ldAuthor).filter(Boolean).join(', ');
  if (typeof value === 'object') return value.name || '';
  return '';
}

function firstParagraph($) {
  const selectors = [
    'article p',
    '.post-content p',
    '.entry-content p',
    '.article-body p',
    '.nota p',
    '.content p',
    'main p'
  ];
  let result = '';
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      if (result) return;
      const text = cleanSummary($(element).text());
      if (
        text.length >= 45 &&
        !/^(por|foto|imagen|publicado|actualizado|compartir|seguinos|suscribite)\b/i.test(text)
      ) {
        result = text;
      }
    });
    if (result) break;
  }
  return result;
}

/**
 * Entra a una nota para completar título, copete, imagen, fecha y autor.
 */
export async function enrichArticle(url, fetchPageFn = fetchPage) {
  const page = await fetchPageFn(url);
  const $ = cheerio.load(page.text);
  const finalUrl = page.url || url;

  const meta = {};
  $('meta').each((_, element) => {
    const key = $(element).attr('property') || $(element).attr('name');
    const content = $(element).attr('content');
    if (key && content) meta[key.toLowerCase()] = content;
  });

  const ld = findArticleJsonLd($);
  const title = cleanTitle(
    meta['og:title'] ||
      meta['twitter:title'] ||
      ld?.headline ||
      $('h1').first().text() ||
      $('title').text()
  );

  const summary = cleanSummary(
    meta['og:description'] ||
      meta['twitter:description'] ||
      meta.description ||
      ld?.description ||
      firstParagraph($),
    title
  );

  const ogImg = meta['og:image'] || meta['og:image:url'] || meta['og:image:secure_url'];
  const twImg = meta['twitter:image'] || meta['twitter:image:src'];
  const itemPropImg = meta['itemprop="image"'] || $('[itemprop="image"]').attr('src') || $('[itemprop="image"]').attr('content');
  const linkImg = $('link[rel="image_src"]').attr('href');
  const figureImgs = $(
    'figure img, .featured-image img, .post-thumbnail img, .entry-content img, .nota-image img, .nota img, article img, main img'
  )
    .map(
      (_, el) =>
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-lazy-src') ||
        $(el).attr('data-original') ||
        $(el).attr('srcset')
    )
    .get();

  const image = pickImage(
    absoluteUrl(ogImg, finalUrl),
    absoluteUrl(twImg, finalUrl),
    absoluteUrl(ldImage(ld?.image) || ld?.thumbnailUrl, finalUrl),
    absoluteUrl(itemPropImg, finalUrl),
    absoluteUrl(linkImg, finalUrl),
    figureImgs.map((src) => absoluteUrl(src ? (src.includes(',') ? src.split(',')[0].trim().split(/\s+/)[0] : src) : null, finalUrl)),
    firstImageFromHtml($('article').html() || $('.nota').html() || $('main').html() || $('body').html() || '', finalUrl)
  );

  const publishedAt =
    parseRecentDate(meta['article:published_time'], { maxAgeDays: 365 }) ||
    parseRecentDate(meta['datepublished'], { maxAgeDays: 365 }) ||
    parseRecentDate(ld?.datePublished, { maxAgeDays: 365 }) ||
    parseRecentDate(ld?.dateCreated, { maxAgeDays: 365 }) ||
    parseRecentDate($('time[datetime]').first().attr('datetime'), { maxAgeDays: 365 }) ||
    parseRecentDate($('time').first().text(), { maxAgeDays: 365 }) ||
    parseRecentDate(extractDateFromText($('body').text().slice(0, 30_000)), { maxAgeDays: 60 });

  const author = truncate(
    meta.author ||
      meta['article:author'] ||
      ldAuthor(ld?.author) ||
      $('[rel="author"]').first().text() ||
      $('.author').first().text(),
    120
  );

  return {
    title: title || null,
    summary: summary || null,
    image_url: image || null,
    published_at: publishedAt || null,
    author: author || null,
    section: meta['article:section'] || ld?.articleSection || null,
    source_url: finalUrl
  };
}

export function normalizeFeedItem(item, source) {
  const title = cleanTitle(item.title, source.name);
  const summary = cleanSummary(item.summary, title);
  return {
    ...item,
    title,
    summary,
    image_url: item.image_url || null,
    published_at: item.published_at || null
  };
}

export { stripHtml };
