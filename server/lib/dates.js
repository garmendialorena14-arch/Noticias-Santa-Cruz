import { TIMEZONE } from '../config.js';

const MONTHS = {
  ene: 0, enero: 0,
  feb: 1, febrero: 1,
  mar: 2, marzo: 2,
  abr: 3, abril: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5,
  jul: 6, julio: 6,
  ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8,
  oct: 9, octubre: 9,
  nov: 10, noviembre: 10,
  dic: 11, diciembre: 11
};

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const longDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function pad2(value) {
  return String(value).padStart(2, '0');
}

/** Fecha YYYY-MM-DD en hora de Santa Cruz. */
export function localDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

export function todayLocal() {
  return localDate(new Date());
}

export function localTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatter.format(date);
}

export function longDate(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00-03:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return longDateFormatter.format(date);
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return localDate(date);
}

/** Lista de fechas YYYY-MM-DD entre dos extremos, descendente. */
export function dateRange(from, to) {
  const dates = [];
  let current = to;
  let guard = 0;
  while (current >= from && guard < 3660) {
    dates.push(current);
    current = addDays(current, -1);
    guard++;
  }
  return dates;
}

/**
 * Convierte fechas de feeds, JSON-LD o texto a ISO UTC.
 * Si la fecha no trae zona horaria, se asume hora de Argentina (UTC-3).
 */
export function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  let text = String(value).trim();
  if (!text) return null;

  // Algunos CMS agregan prefijos o sufijos.
  text = text
    .replace(/^(publicado|actualizado|fecha)\s*:?\s*/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();

  // ISO / RFC con zona horaria explícita.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // ISO / fecha de WordPress sin zona: se interpreta como hora argentina.
  const isoLocal = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoLocal) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = isoLocal;
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // dd/mm/yyyy [hh:mm]
  const dmy = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, day, month, year, hour = '00', minute = '00'] = dmy;
    const date = new Date(`${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00-03:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // "31 Oct 2026", "31 de octubre de 2026"
  const named = text.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]{3,})\.?\s*(?:de\s+)?(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/i);
  if (named) {
    const monthKey = named[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS[monthKey];
    if (month != null) {
      const [, day, , year, hour = '00', minute = '00'] = named;
      const date = new Date(`${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00-03:00`);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }

  // Fechas relativas ("hace 2 horas", "hace 3 días").
  const relative = text.match(/hace\s+(\d+)\s*(minuto|hora|d[ií]a|semana|mes)/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const ms = {
      minuto: 60_000,
      hora: 3_600_000,
      dia: 86_400_000,
      semana: 604_800_000,
      mes: 2_592_000_000
    }[unit];
    if (ms) return new Date(Date.now() - amount * ms).toISOString();
  }

  // Último recurso: parseo nativo (funciona con RFC 822 de RSS).
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    // Evita que "31/10/2026" caiga en el parseo nativo como mes/día.
    if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(text)) return null;
    return parsed.toISOString();
  }

  return null;
}

/**
 * Igual que parseDate, pero descarta fechas absurdas para una noticia actual.
 * Evita que un texto que menciona "1966" o una fecha muy vieja se guarde como
 * fecha de publicación.
 */
export function parseRecentDate(value, { maxAgeDays = 120, maxFutureDays = 3 } = {}) {
  const iso = parseDate(value);
  if (!iso) return null;
  const time = new Date(iso).getTime();
  const now = Date.now();
  if (time > now + maxFutureDays * 86_400_000) return null;
  if (time < now - maxAgeDays * 86_400_000) return null;
  return iso;
}

export function extractDateFromText(text) {
  if (!text) return null;
  const value = String(text).replace(/\s+/g, ' ');
  const patterns = [
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2}|Z)?/i,
    /\d{1,2}\/\d{1,2}\/\d{4}(?:[,\s]+\d{1,2}:\d{2})?/,
    /\d{1,2}\s+de\s+[a-záéíóúñ]+\s+(?:de\s+)?\d{4}/i,
    /hace\s+\d+\s+(?:minutos?|horas?|d[ií]as?|semanas?)/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const parsed = parseDate(match[0]);
      if (parsed) return parsed;
    }
  }
  return null;
}

export function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function relativeTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
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
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short'
  }).format(date);
}
