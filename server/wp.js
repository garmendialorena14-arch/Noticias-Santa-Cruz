import { fetchJson } from './lib/fetch.js';
import { firstImageFromHtml, cleanSummary, cleanTitle, stripHtml } from './lib/text.js';
import { parseDate } from './lib/dates.js';

function embeddedTerms(post) {
  const groups = post?._embedded?.['wp:term'];
  if (!Array.isArray(groups)) return [];
  const names = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const term of group) {
      if (term?.name && (!term.taxonomy || term.taxonomy === 'category' || term.taxonomy === 'post_tag')) {
        names.push(term.name);
      }
    }
  }
  return [...new Set(names)];
}

function embeddedImage(post) {
  const media = post?._embedded?.['wp:featuredmedia'];
  if (Array.isArray(media) && media[0]?.source_url) return media[0].source_url;
  if (post?.jetpack_featured_media_url) return post.jetpack_featured_media_url;
  return firstImageFromHtml(post?.content?.rendered || '', post?.link);
}

function embeddedAuthor(post) {
  const authors = post?._embedded?.author;
  if (Array.isArray(authors) && authors[0]?.name) return authors[0].name;
  return '';
}

/**
 * Descarga notas históricas desde la API REST de WordPress.
 * Se usa para completar el archivo de los medios que la exponen o buscar notas de una fecha puntual.
 */
export async function fetchWpPosts(source, { days = 7, date = null, perPage = 50, maxPages = 4 } = {}) {
  if (!source.wp_api) return [];

  let after;
  let before = null;

  if (date) {
    // Rango completo del día en zona horaria local (-03:00)
    after = new Date(`${date}T00:00:00-03:00`).toISOString();
    before = new Date(`${date}T23:59:59-03:00`).toISOString();
  } else {
    after = new Date(Date.now() - Math.max(1, days) * 86_400_000).toISOString();
  }

  const items = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(source.wp_api);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    url.searchParams.set('after', after);
    if (before) url.searchParams.set('before', before);
    url.searchParams.set('orderby', 'date');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('_embed', '1');

    let posts;
    try {
      posts = await fetchJson(url.href, { timeout: 30_000 });
    } catch (error) {
      if (page === 1) throw error;
      break;
    }

    if (!Array.isArray(posts) || posts.length === 0) break;

    for (const post of posts) {
      const title = cleanTitle(post?.title?.rendered || '', source.name);
      if (!title || !post?.link) continue;
      const content = post?.content?.rendered || '';
      const excerpt = post?.excerpt?.rendered || content;
      items.push({
        title,
        url: post.link,
        summary: cleanSummary(excerpt, title),
        image_url: embeddedImage(post),
        author: embeddedAuthor(post),
        published_at: parseDate(post.date) || parseDate(post.date_gmt),
        source_categories: embeddedTerms(post),
        source_url: post.link
      });
    }

    if (posts.length < perPage) break;
  }

  return items;
}

export { stripHtml };
