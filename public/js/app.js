/* ==========================================================================
   Santa Cruz Noticias — aplicación de frontend
   ========================================================================== */

const TZ = 'America/Argentina/Rio_Gallegos';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  date: null,
  today: null,
  data: null,
  meta: null,
  settings: null,
  sources: [],
  filters: { category: null, categories: [], locality: null, source: null, sources: [], q: '' },
  expanded: { categories: false, localities: false, sources: false },
  refreshing: false,
  statusTimer: null,
  loading: true,
  sourceFormOpen: false,
  searchingDate: false,
  defaultsInitialized: false
};

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value) || 0);
}

function localDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function todayLocal() {
  return localDate(new Date());
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return localDate(date);
}

function longDate(dateString) {
  const date = new Date(`${dateString}T12:00:00-03:00`);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function shortDate(dateString) {
  const date = new Date(`${dateString}T12:00:00-03:00`);
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short'
  }).format(date);
}

function timeOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function fullDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function relativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return shortDate(localDate(date));
}

function timeLabel(value) {
  if (!value) return '';
  const local = localDate(value);
  if (local === state.date) return timeOfDay(value);
  return relativeTime(value);
}

function debounce(fn, delay = 160) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function isHttp(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

/* --------------------------------------------------------------------------
   Iconos
   -------------------------------------------------------------------------- */

const ICONS = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"></path><path d="M20 4 10 14"></path><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"></path></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3 2"></path></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>',
  newspaper: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2V5Z"></path><path d="M17 8h3v9a2 2 0 0 1-2 2h-1"></path><path d="M7 8h7M7 11h7M7 14h4"></path></svg>'
};

/* --------------------------------------------------------------------------
   Tema
   -------------------------------------------------------------------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('scn-theme', theme);
  } catch {
    // sin almacenamiento disponible
  }
  const button = $('#themeBtn');
  if (button) {
    button.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    button.title = theme === 'dark' ? 'Tema claro' : 'Tema oscuro';
  }
}

function initTheme() {
  let theme = 'light';
  try {
    theme = localStorage.getItem('scn-theme') || 'light';
  } catch {
    theme = 'light';
  }
  applyTheme(theme);
}

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

function toast(title, message = '', type = 'ok', timeout = 5200) {
  const container = $('#toasts');
  const element = document.createElement('div');
  element.className = `toast${type === 'error' ? ' toast--error' : type === 'warn' ? ' toast--warn' : ''}`;
  element.innerHTML = `
    <div style="flex:1">
      <strong>${escapeHtml(title)}</strong>
      ${message ? `<p>${escapeHtml(message)}</p>` : ''}
    </div>
    <button class="toast__close" type="button" aria-label="Cerrar aviso">×</button>
  `;
  const remove = () => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(6px)';
    setTimeout(() => element.remove(), 180);
  };
  element.querySelector('.toast__close').addEventListener('click', remove);
  container.appendChild(element);
  if (timeout) setTimeout(remove, timeout);
}

/* --------------------------------------------------------------------------
   Carga de datos
   -------------------------------------------------------------------------- */

async function loadMeta() {
  try {
    const meta = await api('/api/meta');
    state.meta = meta;
    const datalist = $('#localitiesList');
    datalist.innerHTML = meta.localities.map((locality) => `<option value="${escapeHtml(locality)}"></option>`).join('');
  } catch (error) {
    console.warn('No se pudo cargar la metadata', error);
  }
}

async function loadDashboard() {
  state.loading = true;
  renderSkeletons();
  updateDateHeader();

  try {
    const data = await api(`/api/dashboard?date=${encodeURIComponent(state.date)}`);
    state.data = data;
    state.today = data.today;
    state.settings = data.settings;
    if (!state.defaultsInitialized && data.settings) {
      state.defaultsInitialized = true;
      if (Array.isArray(data.settings.default_categories) && data.settings.default_categories.length) {
        state.filters.categories = [...data.settings.default_categories];
      }
      if (Array.isArray(data.settings.default_sources) && data.settings.default_sources.length) {
        state.filters.sources = [...data.settings.default_sources];
      }
    }
    state.loading = false;
    renderAll();
  } catch (error) {
    state.loading = false;
    state.data = null;
    renderAll();
    toast('No se pudo cargar el tablero', error.message, 'error');
  }
}

async function loadSources() {
  try {
    const data = await api(`/api/sources?date=${encodeURIComponent(state.date)}`);
    state.sources = data.sources;
    renderSourcesList();
  } catch (error) {
    toast('No se pudieron cargar los medios', error.message, 'error');
  }
}

/* --------------------------------------------------------------------------
   Fecha y navegación
   -------------------------------------------------------------------------- */

function updateDateHeader() {
  const isToday = state.date === state.today;
  const isYesterday = state.date === addDays(state.today, -1);
  $('#dateLabel').textContent = isToday ? 'Hoy' : isYesterday ? 'Ayer' : shortDate(state.date);
  $('#dateFull').textContent = longDate(state.date);
  const picker = $('#datePicker');
  picker.value = state.date;
  picker.max = state.today;
  $('#nextDay').disabled = state.date >= state.today;
  $('#nextDay').style.opacity = state.date >= state.today ? '0.4' : '';
  $('#todayBtn').hidden = isToday;
}

function setDate(date, options = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return;
  state.date = date;
  if (options.updateHash !== false) {
    try {
      history.replaceState(null, '', `#fecha=${date}`);
    } catch {
      // sin historial disponible
    }
  }
  closeFilters();
  loadDashboard();
}

function initDate() {
  state.today = todayLocal();
  state.date = state.today;
  const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('fecha');
  if (hash && /^\d{4}-\d{2}-\d{2}$/.test(hash) && hash <= state.today) {
    state.date = hash;
  }
}

/* --------------------------------------------------------------------------
   Render principal
   -------------------------------------------------------------------------- */

function renderSkeletons() {
  $('#featured').innerHTML = '<div class="skeleton skeleton-featured"></div>';
  $('#articles').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton skeleton-card"></div>').join('');
  $('#emptyState').hidden = true;
  $('#resultCount').textContent = 'Cargando noticias…';
  $('#stats').innerHTML = '';
  $('#filtersContent').innerHTML = '';
  $('#activeFilters').innerHTML = '';
}

function renderAll() {
  renderStats();
  renderArchive();
  renderFilters();
  renderActiveFilters();
  renderFeed();
}

function renderStats() {
  const stats = state.data?.stats || {};
  const total = stats.total || 0;
  const sources = stats.sources || 0;
  const localities = stats.localities || 0;
  const lastUpdate = stats.lastUpdate;

  const items = [
    {
      label: 'Noticias del día',
      value: formatNumber(total),
      hint: state.date === state.today ? 'Actualizado hoy' : shortDate(state.date),
      accent: true
    },
    {
      label: 'Medios relevados',
      value: formatNumber(sources),
      hint: `${formatNumber(stats.sourcesEnabled || 0)} configurados`
    },
    {
      label: 'Localidades',
      value: formatNumber(localities),
      hint: 'Con noticias publicadas'
    },
    {
      label: 'Última actualización',
      value: lastUpdate ? relativeTime(lastUpdate) : '—',
      hint: lastUpdate ? timeOfDay(lastUpdate) : 'Sin datos'
    }
  ];

  $('#stats').innerHTML = items
    .map(
      (item) => `
        <div class="stat${item.accent ? ' stat--accent' : ''}">
          <span class="stat__label">${escapeHtml(item.label)}</span>
          <span class="stat__value">${escapeHtml(item.value)}</span>
          <span class="stat__hint">${escapeHtml(item.hint)}</span>
        </div>
      `
    )
    .join('');
}

function renderArchive() {
  const counts = new Map((state.data?.days || []).map((day) => [day.date, day.count]));
  const dates = [];
  for (let index = 20; index >= 0; index--) {
    dates.push(addDays(state.date, -index));
  }

  const weekdayFormatter = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short' });
  const dayFormatter = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: 'numeric' });

  $('#archiveRail').innerHTML = dates
    .map((date) => {
      const count = counts.get(date) || 0;
      const dateObject = new Date(`${date}T12:00:00-03:00`);
      const isActive = date === state.date;
      return `
        <button class="day-chip${isActive ? ' is-active' : ''}" type="button" data-date="${date}" title="${escapeHtml(longDate(date))}: ${count} noticias">
          <span class="day-chip__weekday">${escapeHtml(weekdayFormatter.format(dateObject).replace('.', ''))}</span>
          <span class="day-chip__day">${escapeHtml(dayFormatter.format(dateObject))}</span>
          <span class="day-chip__count${count ? '' : ' is-empty'}">${count ? count : '—'}</span>
        </button>
      `;
    })
    .join('');

  $('#archiveRail').scrollLeft = $('#archiveRail').scrollWidth;
}

function categoryInfo(name) {
  return state.meta?.categories?.find((category) => category.name === name) || {
    name: name || 'General',
    color: '#6b7280',
    bg: '#f3f4f6'
  };
}

function renderFilters() {
  if (!state.data) return;
  const facets = state.data.facets || { categories: [], localities: [], sources: [] };
  const container = $('#filtersContent');

  container.innerHTML = `
    ${renderFilterGroup('Temáticas', facets.categories, 'category', 'categories', true)}
    ${renderFilterGroup('Localidades', facets.localities, 'locality', 'localities', false)}
    ${renderFilterGroup('Medios', facets.sources, 'source', 'sources', false)}
  `;

  $$('.filter-item', container).forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.filterType;
      const value = button.dataset.value || null;
      state.filters[type] = state.filters[type] === value ? null : value;
      renderFilters();
      renderActiveFilters();
      renderFeed();
    });
  });

  $$('.filter-more', container).forEach((button) => {
    button.addEventListener('click', () => {
      state.expanded[button.dataset.group] = true;
      renderFilters();
    });
  });

  $('#clearFiltersBtn').hidden = !hasFilters();
}

function renderFilterGroup(title, items, filterKey, groupKey, withColors) {
  const active = state.filters[filterKey];
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const limit = state.expanded[groupKey] ? items.length : 7;
  const visible = items.slice(0, limit);

  const allItem = `
    <button class="filter-item${!active ? ' is-active' : ''}" type="button" data-filter-type="${filterKey}" data-value="">
      <span class="filter-item__name">Todas</span>
      <span class="filter-item__count">${total}</span>
    </button>
  `;

  const list = visible
    .map((item) => {
      const info = withColors ? categoryInfo(item.name) : null;
      const dot = info
        ? `<span class="filter-item__dot" style="--dot-color:${escapeHtml(info.color)}"></span>`
        : '';
      return `
        <button class="filter-item${active === item.name ? ' is-active' : ''}" type="button"
          data-filter-type="${filterKey}" data-value="${escapeHtml(item.name)}">
          ${dot}
          <span class="filter-item__name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="filter-item__count">${item.count}</span>
        </button>
      `;
    })
    .join('');

  const more =
    items.length > limit
      ? `<button class="filter-more" type="button" data-group="${groupKey}">Ver todas (${items.length})</button>`
      : '';

  return `
    <div class="filter-group">
      <h3 class="filter-group__title"><span>${escapeHtml(title)}</span></h3>
      <div class="filter-list">${allItem}${list}</div>
      ${more}
    </div>
  `;
}

function hasFilters() {
  return Boolean(
    state.filters.category ||
    state.filters.categories?.length ||
    state.filters.locality ||
    state.filters.source ||
    state.filters.sources?.length ||
    state.filters.q.trim()
  );
}

function renderActiveFilters() {
  const chips = [];
  if (state.filters.category) chips.push(['category', 'Temática', state.filters.category, state.filters.category]);
  if (state.filters.categories?.length) {
    for (const cat of state.filters.categories) {
      chips.push(['category-item', 'Interés', cat, cat]);
    }
  }
  if (state.filters.locality) chips.push(['locality', 'Localidad', state.filters.locality, state.filters.locality]);
  if (state.filters.source) chips.push(['source', 'Medio', state.filters.source, state.filters.source]);
  if (state.filters.sources?.length) {
    for (const src of state.filters.sources) {
      chips.push(['source-item', 'Medio', src, src]);
    }
  }
  if (state.filters.q.trim()) chips.push(['q', 'Búsqueda', state.filters.q.trim(), 'q']);

  const defCats = state.settings?.default_categories || [];
  const defSources = state.settings?.default_sources || [];
  const hasDefaults = defCats.length > 0 || defSources.length > 0;
  const isDefaultActive = (
    !state.filters.category &&
    !state.filters.source &&
    state.filters.categories?.length === defCats.length &&
    state.filters.sources?.length === defSources.length
  );

  const resetBtn = hasDefaults && !isDefaultActive
    ? `<button id="applyDefaultsBtn" class="link-btn" type="button" style="font-size:12px;margin-left:6px;">Restablecer a mis preferencias</button>`
    : '';

  $('#activeFilters').innerHTML = chips
    .map(
      ([key, label, value, itemVal]) => `
        <span class="filter-chip">
          ${escapeHtml(label)}: ${escapeHtml(value)}
          <button type="button" data-clear-filter="${key}" data-value="${escapeHtml(itemVal || '')}" aria-label="Quitar filtro ${escapeHtml(label)}">${ICONS.close}</button>
        </span>
      `
    )
    .join('') + resetBtn;

  $$('#activeFilters [data-clear-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.clearFilter;
      const val = button.dataset.value;
      if (key === 'category-item') {
        state.filters.categories = state.filters.categories.filter((c) => c !== val);
      } else if (key === 'source-item') {
        state.filters.sources = state.filters.sources.filter((s) => s !== val);
      } else if (key === 'q') {
        state.filters.q = '';
        $('#searchInput').value = '';
      } else {
        state.filters[key] = null;
      }
      renderFilters();
      renderActiveFilters();
      renderFeed();
    });
  });

  $('#applyDefaultsBtn')?.addEventListener('click', () => {
    state.filters.categories = [...(state.settings?.default_categories || [])];
    state.filters.sources = [...(state.settings?.default_sources || [])];
    state.filters.category = null;
    state.filters.source = null;
    renderFilters();
    renderActiveFilters();
    renderFeed();
  });
}

function filteredArticles() {
  if (!state.data) return [];
  const query = normalize(state.filters.q);
  return state.data.articles.filter((article) => {
    if (state.filters.category && article.category !== state.filters.category) return false;
    if (state.filters.categories?.length && !state.filters.categories.includes(article.category)) return false;
    if (state.filters.locality && article.locality !== state.filters.locality) return false;
    if (state.filters.source && article.source_name !== state.filters.source) return false;
    if (state.filters.sources?.length && !state.filters.sources.includes(article.source_name)) return false;
    if (query) {
      const haystack = normalize(
        `${article.title} ${article.summary || ''} ${article.source_name} ${article.locality} ${article.category}`
      );
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function renderFeed() {
  const articles = filteredArticles();
  const featuredContainer = $('#featured');
  const grid = $('#articles');
  const empty = $('#emptyState');

  $('#resultCount').textContent = state.loading
    ? 'Cargando noticias…'
    : `${formatNumber(articles.length)} ${articles.length === 1 ? 'noticia' : 'noticias'}${
        hasFilters() && state.data ? ` de ${formatNumber(state.data.articles.length)}` : ''
      }`;

  if (state.loading) return;

  if (!articles.length) {
    featuredContainer.innerHTML = '';
    grid.innerHTML = '';
    empty.hidden = false;
    renderEmptyState();
    return;
  }

  empty.hidden = true;

  const showFeatured = !hasFilters() && articles.length >= 4 && articles[0].image_url;
  const featured = showFeatured ? articles[0] : null;
  const rest = featured ? articles.slice(1) : articles;

  featuredContainer.innerHTML = featured ? renderFeatured(featured) : '';
  grid.innerHTML = rest.map((article, index) => renderCard(article, index)).join('');

  attachImageFallbacks();
}

function renderEmptyState() {
  const emptyTitle = $('#emptyTitle');
  const emptyText = $('#emptyText');
  const refreshButton = $('#emptyRefreshBtn');
  const searchDateButton = $('#emptySearchDateBtn');
  const clearFiltersButton = $('#emptyClearFiltersBtn');
  const yesterdayButton = $('#emptyYesterdayBtn');

  const totalArticles = state.data?.articles?.length || 0;
  const isPast = state.date !== state.today;

  // Caso 1: Hay noticias en la base para esta fecha, pero los filtros o preferencias las ocultan
  if (totalArticles > 0) {
    emptyTitle.textContent = 'No hay resultados con tus filtros o preferencias';
    emptyText.textContent = `Hay ${formatNumber(totalArticles)} ${totalArticles === 1 ? 'noticia disponible' : 'noticias disponibles'} en esta fecha en otras temáticas o medios.`;
    refreshButton.hidden = true;
    if (searchDateButton) {
      searchDateButton.hidden = !isPast;
      if (isPast) {
        searchDateButton.textContent = state.searchingDate ? 'Buscando noticias…' : 'Buscar más en los medios';
        searchDateButton.disabled = Boolean(state.searchingDate);
      }
    }
    if (clearFiltersButton) clearFiltersButton.hidden = false;
    yesterdayButton.hidden = false;
    yesterdayButton.textContent = 'Ver el día anterior';
    return;
  }

  // Caso 2: No hay ninguna noticia guardada en la base para esta fecha
  if (clearFiltersButton) clearFiltersButton.hidden = true;

  if (isPast) {
    emptyTitle.textContent = 'No hay noticias registradas para este día';
    emptyText.textContent =
      'No hay notas guardadas para esta fecha en la base de datos. Hacé clic en "Buscar noticias" para relevar las publicaciones de este día en los medios.';
    refreshButton.hidden = true;
    if (searchDateButton) {
      searchDateButton.hidden = false;
      searchDateButton.textContent = state.searchingDate ? 'Buscando noticias…' : 'Buscar noticias de esta fecha';
      searchDateButton.disabled = Boolean(state.searchingDate);
    }
    yesterdayButton.hidden = false;
    yesterdayButton.textContent = 'Ver el día anterior';
    return;
  }

  // Caso 3: Es hoy y la base de datos está vacía
  emptyTitle.textContent = 'Todavía no hay noticias de hoy';
  emptyText.textContent =
    'Actualizá los medios para buscar las últimas publicaciones. El primer relevamiento puede tardar un minuto.';
  refreshButton.hidden = false;
  if (searchDateButton) searchDateButton.hidden = true;
  yesterdayButton.hidden = false;
  yesterdayButton.textContent = 'Ver el día anterior';
}

async function searchDateNews() {
  if (state.searchingDate) return;
  state.searchingDate = true;
  renderEmptyState();
  const refreshBtn = $('#refreshBtn');
  if (refreshBtn) {
    refreshBtn.classList.add('is-spinning');
    refreshBtn.disabled = true;
  }
  toast('Buscando noticias', `Relevando notas del ${shortDate(state.date)} en los medios…`);

  try {
    const res = await api('/api/fetch-date', {
      method: 'POST',
      body: JSON.stringify({ date: state.date })
    });
    if (res.found > 0) {
      // Si hay filtros o preferencias que ocultarían los resultados recién traídos, los limpiamos
      if (hasFilters()) {
        state.filters = { category: null, categories: [], locality: null, source: null, sources: [], q: '' };
        const searchInput = $('#searchInput');
        if (searchInput) searchInput.value = '';
      }
      toast('Noticias encontradas', `Se encontraron ${res.found} notas (${res.added} nuevas) para el ${shortDate(state.date)}.`, 'ok');
    } else {
      toast('Sin resultados', `Los medios no tienen notas públicas registradas para el ${shortDate(state.date)}.`, 'warn');
    }
    await loadDashboard();
  } catch (error) {
    toast('Error en la búsqueda', error.message, 'error');
  } finally {
    state.searchingDate = false;
    if (refreshBtn) {
      refreshBtn.classList.remove('is-spinning');
      refreshBtn.disabled = false;
    }
    renderEmptyState();
  }
}

function categoryBadge(article, onImage = false) {
  const info = categoryInfo(article.category);
  return `<span class="badge${onImage ? ' badge--on-image' : ''}" style="--badge-color:${escapeHtml(
    info.color
  )};--badge-bg:${escapeHtml(info.bg)}">${escapeHtml(article.category || 'General')}</span>`;
}

function articleMeta(article) {
  return `
    <span class="meta__source">${escapeHtml(article.source_name)}</span>
    <span class="meta__sep"></span>
    <span class="meta__item">${ICONS.pin}${escapeHtml(article.locality)}</span>
    <span class="meta__sep"></span>
    <span class="meta__item" title="${escapeHtml(fullDateTime(article.published_at))}">${ICONS.clock}${escapeHtml(
      timeLabel(article.published_at)
    )}</span>
  `;
}

function renderFeatured(article) {
  const url = isHttp(article.url) ? article.url : '#';
  return `
    <article class="featured-card">
      <a class="featured-card__media" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(
        article.title
      )}">
        <img src="${escapeHtml(article.image_url)}" alt="" loading="eager" data-fallback />
      </a>
      <div class="featured-card__body">
        ${categoryBadge(article)}
        <h2 class="featured-card__title">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a>
        </h2>
        ${article.summary ? `<p class="featured-card__summary">${escapeHtml(article.summary)}</p>` : ''}
        <div class="meta">
          ${articleMeta(article)}
          <span class="meta__sep"></span>
          <a class="meta__link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
            Leer en ${escapeHtml(article.source_name)} ${ICONS.external}
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderPlaceholder(article) {
  const info = categoryInfo(article.category);
  return `
    <div class="news-card__placeholder" style="--badge-color:${escapeHtml(info.color)};--badge-bg:${escapeHtml(info.bg)}">
      <div class="placeholder-graphic" aria-hidden="true">
        ${ICONS.newspaper}
        <span class="placeholder-source">${escapeHtml(article.source_name)}</span>
      </div>
    </div>
  `;
}

function renderCard(article, index) {
  const url = isHttp(article.url) ? article.url : '#';
  return `
    <article class="news-card" style="--i:${index}">
      <div class="news-card__media">
        ${
          article.image_url
            ? `<img src="${escapeHtml(article.image_url)}" alt="" loading="lazy" data-fallback />`
            : renderPlaceholder(article)
        }
        <span class="news-card__badge">${categoryBadge(article, true)}</span>
        <a class="news-card__external" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
          aria-label="Abrir nota en ${escapeHtml(article.source_name)}">${ICONS.external}</a>
      </div>
      <div class="news-card__body">
        <h3 class="news-card__title">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a>
        </h3>
        ${article.summary ? `<p class="news-card__summary">${escapeHtml(article.summary)}</p>` : ''}
        <div class="news-card__footer">
          <span class="meta__source">${escapeHtml(article.source_name)}</span>
          <span class="news-card__locality">${ICONS.pin}${escapeHtml(article.locality)}</span>
          <span class="news-card__time" title="${escapeHtml(fullDateTime(article.published_at))}">${escapeHtml(
            timeLabel(article.published_at)
          )}</span>
        </div>
      </div>
    </article>
  `;
}

function attachImageFallbacks() {
  $$('img[data-fallback]').forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        image.style.display = 'none';
        const media = image.closest('.news-card__media, .featured-card__media');
        if (media && !media.querySelector('.news-card__placeholder')) {
          media.insertAdjacentHTML(
            'beforeend',
            `<div class="news-card__placeholder"><div class="placeholder-graphic">${ICONS.newspaper}</div></div>`
          );
        }
      },
      { once: true }
    );
  });
}

/* --------------------------------------------------------------------------
   Actualización
   -------------------------------------------------------------------------- */

function setRefreshState(running) {
  state.refreshing = running;
  const button = $('#refreshBtn');
  button.disabled = running;
  button.classList.toggle('is-spinning', running);
  button.querySelector('span').textContent = running ? 'Actualizando…' : 'Actualizar';
}

async function triggerRefresh() {
  // Si estamos viendo una fecha anterior, actualizar significa relevar esa fecha en los medios
  if (state.date !== state.today) {
    return searchDateNews();
  }

  if (state.refreshing) return;
  try {
    await api('/api/refresh', { method: 'POST', body: JSON.stringify({}) });
    setRefreshState(true);
    toast('Actualizando medios', 'Estamos recorriendo las portadas y feeds de hoy. Esto puede tardar unos segundos.');
    pollStatus();
  } catch (error) {
    if (error.status === 409) {
      setRefreshState(true);
      pollStatus();
      return;
    }
    toast('No se pudo iniciar la actualización', error.message, 'error');
  }
}

async function pollStatus() {
  clearTimeout(state.statusTimer);
  try {
    const status = await api('/api/status');
    if (status.running) {
      setRefreshState(true);
      state.statusTimer = setTimeout(pollStatus, 2200);
      return;
    }

    const wasRefreshing = state.refreshing;
    setRefreshState(false);

    if (wasRefreshing) {
      const run = status.lastRun;
      if (run) {
        if (run.added > 0) {
          const filterNote = hasFilters() ? ' (algunas pueden estar filtradas por tus preferencias actuales)' : '';
          const message = `Se incorporaron ${formatNumber(run.added)} noticias nuevas (${formatNumber(run.found || 0)} verificadas)${filterNote}${run.errors ? ` · ${run.errors} medios con aviso` : ''}.`;
          toast('Actualización terminada', message, run.errors ? 'warn' : 'ok');
        } else {
          const message = `Todas las portadas y feeds están al día (${formatNumber(run.found || 0)} noticias verificadas). No hay publicaciones nuevas por el momento.`;
          toast('Medios al día', message, 'ok');
        }
      } else {
        toast('Actualización terminada', 'Los medios se encuentran al día.', 'ok');
      }
      await loadDashboard();
      if (state.sourceFormOpen || $('#settingsDialog').open) await loadSources();
    }
  } catch (error) {
    setRefreshState(false);
    toast('No se pudo consultar el estado', error.message, 'error');
  }
}

async function checkStatusOnLoad() {
  try {
    const status = await api('/api/status');
    if (status.running) {
      setRefreshState(true);
      pollStatus();
    }
  } catch {
    // silencioso
  }
}

/* --------------------------------------------------------------------------
   Configuración: modal, medios y preferencias
   -------------------------------------------------------------------------- */

function openSettings(tab = 'sources') {
  const dialog = $('#settingsDialog');
  switchTab(tab);
  if (!dialog.open) dialog.showModal();
  loadSources();
  renderPreferences();
}

function closeSettings() {
  const dialog = $('#settingsDialog');
  if (dialog.open) dialog.close();
}

function switchTab(tab) {
  $$('.tab').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
  $$('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
}

function renderSourcesList() {
  const container = $('#sourcesList');
  if (!container) return;
  if (!state.sources.length) {
    container.innerHTML = '<p class="hint">No hay medios configurados. Agregá el primero con el botón de arriba.</p>';
    return;
  }

  container.innerHTML = state.sources
    .map((source) => {
      const statusPill =
        source.last_status === 'error'
          ? '<span class="pill pill--error">Error</span>'
          : source.last_status === 'ok'
            ? '<span class="pill">OK</span>'
            : '<span class="pill">Sin datos</span>';
      const typePill = `<span class="pill${source.type === 'html' ? ' pill--html' : ''}">${
        source.type === 'rss' ? 'RSS' : source.type === 'html' ? 'HTML' : 'Auto'
      }</span>`;
      const errorText = source.last_error ? ` · ${source.last_error}` : '';
      return `
        <div class="source-row${source.enabled ? '' : ' is-disabled'}" data-source-id="${source.id}">
          <label class="switch" title="${source.enabled ? 'Desactivar' : 'Activar'} ${escapeHtml(source.name)}">
            <input type="checkbox" data-action="toggle" ${source.enabled ? 'checked' : ''} aria-label="Activar ${escapeHtml(
              source.name
            )}" />
            <span></span>
          </label>
          <div class="source-row__info">
            <div class="source-row__name">
              ${escapeHtml(source.name)}
              ${typePill}
              ${statusPill}
            </div>
            <div class="source-row__meta" title="${escapeHtml(
              `${source.locality} · ${source.article_count} noticias del día${errorText}`
            )}">
              ${escapeHtml(source.locality)} · ${source.article_count} del día · ${
                source.last_fetch_at ? `últ. ${escapeHtml(relativeTime(source.last_fetch_at))}` : 'sin relevar'
              }${errorText ? ` · ${escapeHtml(source.last_error)}` : ''}
            </div>
          </div>
          <div class="source-row__actions">
            <button class="icon-btn" type="button" data-action="edit" aria-label="Editar ${escapeHtml(
              source.name
            )}" title="Editar">${ICONS.edit}</button>
            <button class="icon-btn" type="button" data-action="delete" aria-label="Eliminar ${escapeHtml(
              source.name
            )}" title="Eliminar">${ICONS.trash}</button>
          </div>
        </div>
      `;
    })
    .join('');

  $$('.source-row', container).forEach((row) => {
    const id = Number(row.dataset.sourceId);
    const source = state.sources.find((item) => item.id === id);
    if (!source) return;

    row.querySelector('[data-action="toggle"]').addEventListener('change', async (event) => {
      try {
        await api(`/api/sources/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled: event.target.checked })
        });
        await loadSources();
        toast(event.target.checked ? 'Medio activado' : 'Medio desactivado', source.name);
      } catch (error) {
        event.target.checked = !event.target.checked;
        toast('No se pudo cambiar el medio', error.message, 'error');
      }
    });

    row.querySelector('[data-action="edit"]').addEventListener('click', () => openSourceForm(source));
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`¿Eliminar "${source.name}"? Las noticias ya guardadas se conservan en el archivo.`)) return;
      try {
        await api(`/api/sources/${id}`, { method: 'DELETE' });
        await loadSources();
        await loadDashboard();
        toast('Medio eliminado', source.name);
      } catch (error) {
        toast('No se pudo eliminar el medio', error.message, 'error');
      }
    });
  });
}

function openSourceForm(source = null) {
  const form = $('#sourceForm');
  form.hidden = false;
  state.sourceFormOpen = true;
  form.reset();
  $('#sourceFormTitle').textContent = source ? 'Editar medio' : 'Agregar medio';
  $('#sourceFormMessage').textContent = '';
  $('#sourceFormMessage').className = 'form-message';

  form.elements.namedItem('id').value = source?.id || '';
  form.elements.namedItem('name').value = source?.name || '';
  form.elements.namedItem('locality').value = source?.locality || '';
  form.elements.namedItem('homepage').value = source?.homepage || '';
  form.elements.namedItem('feed_url').value = source?.feed_url || '';
  form.elements.namedItem('list_url').value = source?.list_url || '';
  form.elements.namedItem('article_pattern').value = source?.article_pattern || '';
  form.elements.namedItem('type').value = source?.type || 'auto';
  form.elements.namedItem('wp_api').value = source?.wp_api || '';
  form.elements.namedItem('notes').value = source?.notes || '';
  form.elements.namedItem('enrich').checked = source ? Boolean(source.enrich) : true;
  form.elements.namedItem('enabled').checked = source ? Boolean(source.enabled) : true;

  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  form.elements.namedItem('name').focus({ preventScroll: true });
}

function closeSourceForm() {
  const form = $('#sourceForm');
  form.hidden = true;
  state.sourceFormOpen = false;
  $('#sourceFormMessage').textContent = '';
}

function sourceFormPayload() {
  const form = $('#sourceForm');
  const payload = {
    name: form.elements.namedItem('name').value.trim(),
    locality: form.elements.namedItem('locality').value.trim() || 'Provincia',
    homepage: form.elements.namedItem('homepage').value.trim() || null,
    feed_url: form.elements.namedItem('feed_url').value.trim() || null,
    list_url: form.elements.namedItem('list_url').value.trim() || null,
    article_pattern: form.elements.namedItem('article_pattern').value.trim() || null,
    type: form.elements.namedItem('type').value,
    wp_api: form.elements.namedItem('wp_api').value.trim() || null,
    notes: form.elements.namedItem('notes').value.trim() || null,
    enrich: form.elements.namedItem('enrich').checked,
    enabled: form.elements.namedItem('enabled').checked
  };
  return payload;
}

async function submitSourceForm(event) {
  event.preventDefault();
  const form = $('#sourceForm');
  const id = Number(form.elements.namedItem('id').value) || null;
  const message = $('#sourceFormMessage');
  const payload = sourceFormPayload();

  if (!payload.name) {
    message.textContent = 'El nombre del medio es obligatorio.';
    message.className = 'form-message is-error';
    return;
  }

  try {
    if (id) {
      await api(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/sources', { method: 'POST', body: JSON.stringify(payload) });
    }
    message.textContent = 'Medio guardado. Se aplicará en la próxima actualización.';
    message.className = 'form-message is-ok';
    closeSourceForm();
    await loadSources();
    await loadDashboard();
    toast(id ? 'Medio actualizado' : 'Medio agregado', payload.name);
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message is-error';
  }
}

async function testSource() {
  const message = $('#sourceFormMessage');
  const payload = sourceFormPayload();
  if (!payload.feed_url && !payload.list_url && !payload.homepage) {
    message.textContent = 'Indicá una URL de feed, listado o principal.';
    message.className = 'form-message is-error';
    return;
  }
  message.textContent = 'Probando fuente…';
  message.className = 'form-message';
  try {
    const result = await api('/api/sources/test', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        enrich: false
      })
    });
    const sample = result.sample?.[0]?.title ? ` Ejemplo: “${result.sample[0].title}”.` : '';
    message.textContent = `Fuente OK (${result.mode.toUpperCase()}): ${result.count} notas detectadas.${sample}`;
    message.className = 'form-message is-ok';
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message is-error';
  }
}

function renderPreferences() {
  if (!state.settings) return;
  const form = $('#prefsForm');
  for (const key of ['refresh_minutes', 'max_per_source', 'enrich_limit', 'retention_days']) {
    const field = form.elements.namedItem(key);
    if (field) field.value = state.settings[key] ?? '';
  }

  // Intereses predeterminados (temáticas)
  const catList = $('#defaultCategoriesList');
  if (catList && state.meta?.categories) {
    const selectedCats = new Set(state.settings.default_categories || []);
    catList.innerHTML = state.meta.categories
      .map((cat) => {
        const checked = selectedCats.has(cat.name) ? 'checked' : '';
        return `
          <label class="prefs-chip-item">
            <input type="checkbox" name="default_category" value="${escapeHtml(cat.name)}" ${checked} />
            <span class="filter-item__dot" style="--dot-color:${escapeHtml(cat.color)}"></span>
            <span>${escapeHtml(cat.name)}</span>
          </label>
        `;
      })
      .join('');
  }

  // Medios predeterminados
  const srcList = $('#defaultSourcesList');
  if (srcList) {
    const selectedSources = new Set(state.settings.default_sources || []);
    const availableSources = state.sources.length
      ? state.sources
      : (state.data?.facets?.sources || []).map((s) => ({ name: s.name }));
    srcList.innerHTML = availableSources
      .map((source) => {
        const checked = selectedSources.has(source.name) ? 'checked' : '';
        return `
          <label class="prefs-chip-item">
            <input type="checkbox" name="default_source" value="${escapeHtml(source.name)}" ${checked} />
            <span>${escapeHtml(source.name)}</span>
          </label>
        `;
      })
      .join('');
  }
}

async function submitPreferences(event) {
  event.preventDefault();
  const form = $('#prefsForm');
  const payload = {};
  for (const key of ['refresh_minutes', 'max_per_source', 'enrich_limit', 'retention_days']) {
    payload[key] = Number(form.elements.namedItem(key).value) || 0;
  }

  const checkedCategories = $$('input[name="default_category"]:checked', form).map((input) => input.value);
  const checkedSources = $$('input[name="default_source"]:checked', form).map((input) => input.value);
  payload.default_categories = checkedCategories;
  payload.default_sources = checkedSources;

  try {
    const result = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
    state.settings = result.settings;
    state.filters.categories = [...(result.settings.default_categories || [])];
    state.filters.sources = [...(result.settings.default_sources || [])];
    state.filters.category = null;
    state.filters.source = null;
    renderFilters();
    renderActiveFilters();
    renderFeed();
    toast('Preferencias guardadas', 'Tus intereses y medios predeterminados fueron actualizados.');
  } catch (error) {
    toast('No se pudieron guardar las preferencias', error.message, 'error');
  }
}

function downloadExport(format) {
  const url = `/api/export?date=${encodeURIComponent(state.date)}&format=${format}`;
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
  toast('Exportación iniciada', `Formato ${format.toUpperCase()} · ${state.date}`);
}

/* --------------------------------------------------------------------------
   Filtros móviles
   -------------------------------------------------------------------------- */

function openFilters() {
  $('#sidebar').classList.add('is-open');
  $('#backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeFilters() {
  $('#sidebar').classList.remove('is-open');
  $('#backdrop').hidden = true;
  document.body.style.overflow = '';
}

/* --------------------------------------------------------------------------
   Eventos
   -------------------------------------------------------------------------- */

function bindEvents() {
  $('#prevDay').addEventListener('click', () => setDate(addDays(state.date, -1)));
  $('#nextDay').addEventListener('click', () => {
    if (state.date < state.today) setDate(addDays(state.date, 1));
  });
  $('#todayBtn').addEventListener('click', () => setDate(state.today));
  $('#datePicker').addEventListener('change', (event) => {
    if (event.target.value) setDate(event.target.value);
  });

  $('#archiveRail').addEventListener('click', (event) => {
    const chip = event.target.closest('.day-chip');
    if (chip?.dataset.date) setDate(chip.dataset.date);
  });

  const search = $('#searchInput');
  const applySearch = debounce(() => {
    state.filters.q = search.value;
    renderActiveFilters();
    renderFeed();
  }, 140);
  search.addEventListener('input', applySearch);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      state.filters.q = search.value;
      renderActiveFilters();
      renderFeed();
      search.blur();
    }
    if (event.key === 'Escape') {
      search.value = '';
      state.filters.q = '';
      renderActiveFilters();
      renderFeed();
      search.blur();
    }
  });

  $('#refreshBtn').addEventListener('click', triggerRefresh);
  $('#emptyRefreshBtn').addEventListener('click', triggerRefresh);
  $('#emptySearchDateBtn')?.addEventListener('click', searchDateNews);
  $('#emptyClearFiltersBtn')?.addEventListener('click', () => {
    state.filters = { category: null, categories: [], locality: null, source: null, sources: [], q: '' };
    if (search) search.value = '';
    renderFilters();
    renderActiveFilters();
    renderFeed();
  });
  $('#emptyYesterdayBtn').addEventListener('click', () => setDate(addDays(state.date, -1)));

  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  $('#settingsBtn').addEventListener('click', () => openSettings('sources'));
  $('#footerSettingsBtn').addEventListener('click', () => openSettings('sources'));
  $('#closeSettingsBtn').addEventListener('click', closeSettings);
  $('#settingsDialog').addEventListener('click', (event) => {
    if (event.target === $('#settingsDialog')) closeSettings();
  });

  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('#addSourceBtn').addEventListener('click', () => openSourceForm());
  $('#cancelSourceBtn').addEventListener('click', closeSourceForm);
  $('#sourceForm').addEventListener('submit', submitSourceForm);
  $('#testSourceBtn').addEventListener('click', testSource);
  $('#prefsForm').addEventListener('submit', submitPreferences);

  $('#enrichImagesBtn')?.addEventListener('click', async () => {
    const btn = $('#enrichImagesBtn');
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Buscando fotos…';
    toast('Buscando fotos', 'Rastreando las páginas originales de las notas sin imagen…');
    try {
      const res = await api('/api/enrich-images', {
        method: 'POST',
        body: JSON.stringify({ limit: 150 })
      });
      toast('Fotos actualizadas', `Se completaron fotos para ${res.enriched || 0} notas.`);
      await loadDashboard();
    } catch (err) {
      toast('Error al buscar fotos', err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  $('#selectAllCategoriesBtn')?.addEventListener('click', () => {
    $$('#defaultCategoriesList input[type="checkbox"]').forEach((cb) => (cb.checked = true));
  });
  $('#clearAllCategoriesBtn')?.addEventListener('click', () => {
    $$('#defaultCategoriesList input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  });
  $('#selectAllSourcesBtn')?.addEventListener('click', () => {
    $$('#defaultSourcesList input[type="checkbox"]').forEach((cb) => (cb.checked = true));
  });
  $('#clearAllSourcesBtn')?.addEventListener('click', () => {
    $$('#defaultSourcesList input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  });

  $('#exportBtn').addEventListener('click', () => downloadExport('csv'));
  $('#exportCsvBtn').addEventListener('click', () => downloadExport('csv'));
  $('#exportJsonBtn').addEventListener('click', () => downloadExport('json'));

  $('#filtersBtn').addEventListener('click', openFilters);
  $('#closeFiltersBtn').addEventListener('click', closeFilters);
  $('#backdrop').addEventListener('click', closeFilters);

  $('#clearFiltersBtn').addEventListener('click', () => {
    state.filters = { category: null, categories: [], locality: null, source: null, sources: [], q: '' };
    $('#searchInput').value = '';
    renderFilters();
    renderActiveFilters();
    renderFeed();
  });

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

    if (event.key === '/' && !typing && !$('#settingsDialog').open) {
      event.preventDefault();
      search.focus();
      return;
    }

    if (event.key === 'Escape') {
      if ($('#settingsDialog').open) {
        closeSettings();
      } else if ($('#sidebar').classList.contains('is-open')) {
        closeFilters();
      }
    }

    if (!typing && !$('#settingsDialog').open) {
      if (event.key === 'ArrowLeft') setDate(addDays(state.date, -1));
      if (event.key === 'ArrowRight' && state.date < state.today) setDate(addDays(state.date, 1));
    }
  });
}

/* --------------------------------------------------------------------------
   Inicio
   -------------------------------------------------------------------------- */

async function init() {
  initTheme();
  initDate();
  bindEvents();
  updateDateHeader();

  await Promise.allSettled([loadMeta(), loadDashboard()]);
  checkStatusOnLoad();

  // Mantiene el reloj de “hace X” y detecta el cambio de día a medianoche
  setInterval(() => {
    const currentToday = todayLocal();
    if (currentToday && state.today && currentToday !== state.today) {
      const wasOnToday = state.date === state.today;
      state.today = currentToday;
      if (wasOnToday) {
        state.date = currentToday;
      }
      updateDateHeader();
      loadDashboard();
    } else if (state.data && !state.loading) {
      renderFeed();
    }
  }, 60_000);
}

init();
