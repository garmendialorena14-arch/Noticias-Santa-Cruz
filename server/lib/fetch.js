const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'es-AR,es;q=0.9,en;q=0.5'
};

const MAX_BYTES = 12 * 1024 * 1024;

function sniffCharset(buffer) {
  const head = buffer.subarray(0, 4096).toString('latin1');
  const meta =
    head.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_-]+)/i) ||
    head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9_-]+)/i);
  return meta ? meta[1] : null;
}

function normalizeCharset(charset) {
  if (!charset) return null;
  const value = charset.toLowerCase().replace(/["'\s]/g, '');
  const map = {
    'iso-8859-1': 'windows-1252',
    iso88591: 'windows-1252',
    latin1: 'windows-1252',
    'latin-1': 'windows-1252',
    utf8: 'utf-8',
    'utf-8': 'utf-8'
  };
  return map[value] || value;
}

export function decodeBuffer(buffer, contentType = '') {
  if (!buffer || buffer.length === 0) return '';

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer.subarray(3));
  }

  const headerMatch = String(contentType || '').match(/charset\s*=\s*["']?([a-z0-9_-]+)/i);
  const charset = normalizeCharset(headerMatch?.[1] || sniffCharset(buffer) || 'utf-8');

  try {
    return new TextDecoder(charset, { fatal: false }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(buffer);
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    }
  }
}

/**
 * Descarga una página respetando el charset real del sitio.
 * Devuelve también la URL final (por redirecciones).
 */
export async function fetchPage(url, options = {}) {
  const { timeout = 20_000, headers = {}, retries = 1 } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
        headers: { ...DEFAULT_HEADERS, ...headers }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_BYTES) {
        throw new Error(`Respuesta demasiado grande (${Math.round(buffer.length / 1024 / 1024)} MB)`);
      }

      return {
        text: decodeBuffer(buffer, response.headers.get('content-type') || ''),
        status: response.status,
        url: response.url || url,
        contentType: response.headers.get('content-type') || ''
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function fetchJson(url, options = {}) {
  const page = await fetchPage(url, {
    ...options,
    headers: { accept: 'application/json,text/plain,*/*', ...(options.headers || {}) }
  });
  try {
    return JSON.parse(page.text);
  } catch {
    throw new Error('La respuesta no es JSON válido');
  }
}
