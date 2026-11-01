import {
  CATEGORIES,
  CATEGORY_ALIASES,
  LOCALITIES,
  SECTION_CATEGORY,
  SECTION_LOCALITY
} from './config.js';
import { normalize } from './lib/text.js';

const KEYWORD_RULES = CATEGORIES.filter((category) => category.keywords.length).map((category) => ({
  name: category.name,
  keywords: category.keywords.map((keyword) => normalize(keyword))
}));

const LOCALITY_RULES = LOCALITIES.map((locality) => ({
  name: locality.name,
  aliases: locality.aliases.map((alias) => normalize(alias))
}));

function countKeyword(text, keyword) {
  if (!text || !keyword) return 0;
  if (keyword.length <= 4 && !keyword.includes(' ')) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, 'g');
    return (text.match(pattern) || []).length;
  }
  let count = 0;
  let index = text.indexOf(keyword);
  while (index !== -1 && count < 4) {
    count++;
    index = text.indexOf(keyword, index + keyword.length);
  }
  return count;
}

function categoryFromSection(section) {
  if (!section) return null;
  const key = normalize(section).replace(/\s+/g, '-');
  return SECTION_CATEGORY[key] || null;
}

function localityFromSection(section) {
  if (!section) return null;
  const key = normalize(section).replace(/\s+/g, '-');
  return SECTION_LOCALITY[key] || null;
}

function categoryFromSourceCategories(categories) {
  if (!categories?.length) return null;
  for (const category of categories) {
    const key = normalize(category);
    if (key in CATEGORY_ALIASES && CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
    for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
      if (canonical && (key === alias || key.includes(alias))) return canonical;
    }
  }
  return null;
}

/**
 * Detecta la temática principal de una nota.
 * Combina palabras clave del título/copete con la categoría del feed y la sección de la URL.
 */
export function classifyCategory({ title = '', summary = '', sourceCategories = [], url = '' } = {}) {
  const titleText = normalize(title);
  const summaryText = normalize(summary);
  let section = '';
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    section = parts[0] || '';
  } catch {
    section = '';
  }

  const scores = new Map();
  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      const titleMatches = Math.min(countKeyword(titleText, keyword), 3);
      const summaryMatches = Math.min(countKeyword(summaryText, keyword), 2);
      score += titleMatches * 2.5 + summaryMatches * 0.8;
    }
    if (score > 0) scores.set(rule.name, (scores.get(rule.name) || 0) + score);
  }

  const sourceCategory = categoryFromSourceCategories(sourceCategories);
  if (sourceCategory) scores.set(sourceCategory, (scores.get(sourceCategory) || 0) + 2);

  const sectionCategory = categoryFromSection(section);
  if (sectionCategory) scores.set(sectionCategory, (scores.get(sectionCategory) || 0) + 3);

  let best = null;
  let bestScore = 0;
  for (const [name, score] of scores) {
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }

  if (best && bestScore >= 1.5) return best;
  if (sourceCategory) return sourceCategory;
  if (sectionCategory) return sectionCategory;
  return 'General';
}

/**
 * Detecta la localidad principal. Devuelve "Provincia" o "Nacional" cuando
 * la nota no está asociada a una ciudad concreta.
 */
export function classifyLocality({
  title = '',
  summary = '',
  url = '',
  sourceLocality = 'Provincia',
  category = 'General'
} = {}) {
  const titleText = normalize(title);
  const summaryText = normalize(summary);

  let section = '';
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    section = parts[0] || '';
  } catch {
    section = '';
  }

  const sectionLocality = localityFromSection(section);
  const scores = new Map();

  for (const rule of LOCALITY_RULES) {
    let score = 0;
    for (const alias of rule.aliases) {
      // "glaciar Perito Moreno" no debe convertir la nota en noticia de la localidad.
      if (rule.name === 'Perito Moreno' && /glaciar\s+(perito\s+moreno)?/.test(titleText)) continue;
      if (rule.name === 'El Calafate' && /lago\s+argentino/.test(titleText)) continue;

      const titleMatches = Math.min(countKeyword(titleText, alias), 2);
      const summaryMatches = Math.min(countKeyword(summaryText, alias), 2);
      score += titleMatches * 4 + summaryMatches * 0.8;
    }
    if (score > 0) scores.set(rule.name, score);
  }

  if (sectionLocality) {
    scores.set(sectionLocality, (scores.get(sectionLocality) || 0) + 5);
  }

  if (sourceLocality && sourceLocality !== 'Provincia' && sourceLocality !== 'Nacional') {
    // Peso bajo: la ciudad del medio es un desempate, no una prueba de que la
    // nota sea local. Así las noticias nacionales no quedan asignadas a la
    // ciudad donde se edita el diario.
    scores.set(sourceLocality, (scores.get(sourceLocality) || 0) + 1);
  }

  let best = null;
  let bestScore = 0;
  for (const [name, score] of scores) {
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }

  // Una mención fuerte de una ciudad (título o sección) gana incluso en una
  // nota nacional; si solo aparece la ciudad del medio, prevalece "Nacional".
  if (category === 'Nacionales' && bestScore < 4) return 'Nacional';
  if (best && bestScore >= 1.5) return best;

  if (sourceLocality === 'Nacional') return 'Nacional';
  if (sourceLocality && sourceLocality !== 'Provincia') return sourceLocality;

  return 'Provincia';
}

/** Devuelve una lista limpia de categorías de origen para guardar como referencia. */
export function cleanSourceCategories(categories) {
  const list = (Array.isArray(categories) ? categories : [categories])
    .map((category) => {
      if (!category) return '';
      if (typeof category === 'string') return category;
      if (typeof category === 'object') return category.name || category['#text'] || category['#cdata'] || '';
      return String(category);
    })
    .map((category) => String(category).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((category) => !/^[-–—\s]+$/.test(category))
    .filter((category) => !/^(noticias?|ultimas? noticias|último momento|destacadas?|home|inicio)$/i.test(category));

  return [...new Set(list)].slice(0, 6);
}
