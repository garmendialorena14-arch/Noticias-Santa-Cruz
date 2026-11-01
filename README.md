# Santa Cruz Noticias

Dashboard local de noticias de la provincia de Santa Cruz, Argentina. Reúne notas de medios de Río Gallegos, Caleta Olivia, El Calafate, Las Heras, Puerto Deseado, Pico Truncado y otras localidades, las clasifica por temática y localidad, y conserva un archivo histórico navegable por día.

Cada noticia enlaza siempre a la nota original del medio.

## Características

- **Tablero del día** con portada destacada, grilla de noticias y estadísticas.
- **Archivo por día** con navegación por línea de fechas, selector y atajos de teclado.
- **Filtros** por temática, localidad y medio, más búsqueda de texto.
- **Fuentes configurables** desde el panel de control: activar, editar, agregar, eliminar y probar medios.
- **Actualización automática** cada 30 minutos (configurable) y actualización manual.
- **Clasificación automática** por palabras clave, categorías del feed, secciones de URL y localidad del medio.
- **Exportación** del día en CSV o JSON.
- **Tema claro/oscuro** y diseño responsive.
- **Base SQLite local** sin servicios externos ni cuentas.

## Requisitos

- Node.js **24 LTS o superior** (probado con 24.20). El proyecto usa el módulo nativo `node:sqlite`.
- No requiere compilador, Python ni base de datos externa.

## Instalación

```bash
npm install
npm start
```

Abrí [http://127.0.0.1:3000](http://127.0.0.1:3000).

La primera actualización se lanza automáticamente a los pocos segundos de iniciar el servidor. También podés usar el botón **Actualizar** del tablero.

### Variables de entorno

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP. |
| `HOST` | `127.0.0.1` | Interfaz de escucha. Usá `0.0.0.0` para acceder desde la red local. |
| `DATA_DIR` | `./data` | Carpeta de datos. |
| `DB_PATH` | `./data/news.db` | Ruta completa de la base SQLite. |
| `AUTO_REFRESH` | activo | `0` desactiva el relevamiento automático al iniciar. |

Ejemplo en PowerShell:

```powershell
$env:PORT = "8080"
npm start
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor y el scheduler. |
| `npm run dev` | Inicia con recarga automática (`node --watch`). |
| `npm run backfill` | Completa el archivo con los últimos 7 días vía API de WordPress. |
| `npm run backfill -- --days 30` | Backfill de los últimos 30 días. |
| `npm run backfill -- --days 14 --source la-prensa-de-santa-cruz` | Backfill de un medio puntual. |
| `npm run schedule-daily` | Instala una tarea programada en Windows para relevar y publicar noticias todos los días. |

El backfill solo puede recuperar historial de los medios que exponen `wp-json/wp/v2/posts`. Para el resto, el archivo se construye con cada actualización.

## Cómo funciona

1. El servidor recorre los medios habilitados.
2. Para cada medio intenta leer su feed RSS; si no hay resultados, scrapea la portada o página de listado.
3. Opcionalmente entra a las notas nuevas para completar imagen, copete, fecha y autor.
4. Clasifica cada nota por temática y localidad.
5. Guarda todo en SQLite, deduplicando por URL canónica.
6. El frontend consulta el tablero por fecha y muestra el archivo disponible.

### Estructura

```text
server/
  index.js       Servidor Express y arranque
  api.js         Endpoints REST
  config.js      Temáticas, localidades y medios iniciales
  db.js          Esquema SQLite y consultas
  refresh.js     Orquestación del relevamiento
  feed.js        Parseo RSS, scraping HTML y enriquecimiento
  classify.js    Clasificación por temática y localidad
  wp.js          Backfill vía API de WordPress
  scheduler.js   Actualización periódica
  lib/           Utilidades de fechas, texto y HTTP
public/          Interfaz (HTML, CSS y JS sin build)
scripts/
  backfill.js    Script de archivo histórico
data/news.db     Base de datos local (se crea sola)
```

### API principal

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/dashboard?date=YYYY-MM-DD` | Noticias, facetas y estadísticas del día. |
| `GET` | `/api/days` | Días con noticias y cantidades. |
| `GET` | `/api/sources` | Medios con estado y notas del día. |
| `POST` | `/api/sources` | Agregar medio. |
| `PUT` | `/api/sources/:id` | Editar o activar/desactivar medio. |
| `DELETE` | `/api/sources/:id` | Eliminar medio (las notas se conservan). |
| `POST` | `/api/sources/test` | Probar una fuente sin guardarla. |
| `POST` | `/api/refresh` | Iniciar actualización manual. |
| `POST` | `/api/fetch-date` | Buscar y traer notas de una fecha anterior puntual (`{ date: "YYYY-MM-DD" }`). |
| `GET` | `/api/status` | Estado del relevamiento y scheduler. |
| `GET` | `/api/runs` | Historial de ejecuciones. |
| `GET/PUT` | `/api/settings` | Preferencias. |
| `GET` | `/api/export?date=...&format=csv\|json` | Exportar el día. |

## Agregar un medio

Desde **Configuración → Medios → Agregar medio**:

- **Nombre** y **localidad**.
- **URL principal**: portada del medio.
- **Feed RSS**: si existe, es la vía más estable.
- **URL de listado**: página con enlaces a notas (portada o sección).
- **Patrón de enlaces**: expresión regular opcional para filtrar URLs de notas. Por ejemplo `-\\d{6}\\.html$`.
- **Tipo**: automático, solo RSS o solo HTML.
- **API de WordPress**: opcional, para habilitar backfill histórico.
- **Completar imagen y copete**: visita cada nota nueva (más lento, mejores datos).

Usá **Probar fuente** antes de guardar para verificar cuántas notas detecta y en qué modo.

## Clasificación

Las temáticas y localidades se definen en `server/config.js`. La clasificación combina:

- palabras clave ponderadas en título y copete;
- categorías declaradas por el feed;
- sección de la URL (por ejemplo `/caleta-olivia/`);
- localidad del medio como desempate.

Si agregás una localidad o temática nueva, actualizá también los alias y secciones en `server/config.js`. Al reiniciar, las notas guardadas se reclasifican automáticamente.

## Notas y límites

- Algunos portales usan Cloudflare u otras protecciones anti-bot y no pueden relevarse automáticamente.
- Otros sitios no exponen metadatos útiles en sus notas; en esos casos se guarda lo disponible en el listado.
- El relevamiento es deliberadamente conservador: límite de notas por medio, concurrencia acotada y esperas entre reintentos.
- El contenido completo no se copia: solo título, copete, imagen, fecha, autor y enlace.
- Los títulos, copetes e imágenes pertenecen a cada medio.
