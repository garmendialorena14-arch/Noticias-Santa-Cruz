/**
 * Configuración central del proyecto: temáticas, localidades y medios iniciales.
 * Todo lo que está acá se puede editar luego desde el panel de configuración.
 */

export const TIMEZONE = 'America/Argentina/Rio_Gallegos';
export const PROVINCE = 'Santa Cruz';

export const CATEGORIES = [
  {
    name: 'Política',
    color: '#b45309',
    bg: '#fef3c7',
    keywords: [
      'politica', 'gobierno', 'gobernador', 'vidal', 'legislatura', 'diputad', 'senador',
      'intendente', 'municipio', 'municipal', 'concejo', 'deliberante', 'elecciones',
      'candidato', 'candidatura', 'partido', 'decreto', 'ministerio', 'ministro',
      'secretario', 'funcionario', 'concejal', 'legislador', 'gobernacion', 'poder ejecutivo',
      'sindicato', 'gremio', 'paro', 'protesta', 'corte de ruta', 'medida de fuerza',
      'reclamo', 'movilizacion', 'audiencia publica', 'presupuesto participativo'
    ]
  },
  {
    name: 'Economía',
    color: '#047857',
    bg: '#d1fae5',
    keywords: [
      'economia', 'inflacion', 'dolar', 'precio', 'tarifa', 'salario', 'sueldo',
      'presupuesto', 'impuesto', 'comercio', 'industria', 'produccion', 'exportacion',
      'importacion', 'mercado', 'banco', 'credito', 'pyme', 'empleo', 'desempleo',
      'paritaria', 'aumento salarial', 'factura', 'subsidio', 'coparticipacion',
      'recaudacion', 'deuda', 'financiamiento', 'inversion', 'rentabilidad', 'canasta'
    ]
  },
  {
    name: 'Sociedad',
    color: '#0369a1',
    bg: '#e0f2fe',
    keywords: [
      'vecino', 'vecina', 'comunidad', 'barrio', 'vivienda', 'agua', 'cloaca', 'basura',
      'servicio', 'transporte', 'colectivo', 'obra', 'ruta', 'familia', 'joven', 'nino',
      'nina', 'mujer', 'adulto mayor', 'discapacidad', 'inclusion', 'religion', 'iglesia',
      'clima', 'temperatura', 'nieve', 'viento', 'calor', 'frio', 'halloween', 'navidad',
      'solidaridad', 'voluntario', 'bombero', 'defensa civil', 'proteccion civil'
    ]
  },
  {
    name: 'Policiales',
    color: '#b91c1c',
    bg: '#fee2e2',
    keywords: [
      'policia', 'policial', 'detenid', 'demorad', 'robo', 'asalto', 'hurto', 'homicidio',
      'femicidio', 'crimen', 'delito', 'accidente', 'choque', 'vuelco', 'incendio',
      'allanamiento', 'fiscal', 'juez', 'condena', 'imputad', 'causa judicial', 'denuncia',
      'violencia', 'arma', 'droga', 'narco', 'estafa', 'estupro', 'abuso', 'secuestro',
      'siniestro vial', 'motociclista', 'peatón', 'peatonal', 'herido', 'fallecido'
    ]
  },
  {
    name: 'Deportes',
    color: '#15803d',
    bg: '#dcfce7',
    keywords: [
      'futbol', 'deporte', 'deportivo', 'partido', 'torneo', 'campeonato', 'seleccion',
      'jugador', 'equipo', 'gol', 'rugby', 'basquet', 'boxeo', 'atletismo', 'natacion',
      'ciclismo', 'automovilismo', 'juegos', 'olimpiada', 'araucania', 'liga', 'estudiantes',
      'racing', 'boca', 'river', 'final', 'clasificacion', 'entrenador', 'cancha',
      'gimnasio', 'maraton', 'pesca deportiva'
    ]
  },
  {
    name: 'Cultura',
    color: '#7e22ce',
    bg: '#f3e8ff',
    keywords: [
      'cultura', 'cultural', 'teatro', 'musica', 'concierto', 'libro', 'literatura',
      'cine', 'pelicula', 'arte', 'artista', 'mural', 'museo', 'festival', 'fiesta',
      'danza', 'folclore', 'patrimonio', 'espectaculo', 'famoso', 'farandula', 'netflix',
      'serie', 'show', 'reality', 'television', 'rating', 'lali', 'wanda', 'icardi'
    ]
  },
  {
    name: 'Educación',
    color: '#1d4ed8',
    bg: '#dbeafe',
    keywords: [
      'educacion', 'escuela', 'colegio', 'universidad', 'docente', 'estudiante', 'clase',
      'aula', 'carrera', 'unpa', 'utn', 'jardin', 'secundaria', 'primaria', 'paro docente',
      'concursos docentes', 'matricula', 'egresado', 'capacitacion', 'formacion profesional',
      'guarderia', 'beca', 'alfabetizacion'
    ]
  },
  {
    name: 'Salud',
    color: '#be123c',
    bg: '#ffe4e6',
    keywords: [
      'salud', 'hospital', 'medico', 'enfermer', 'vacuna', 'sarampion', 'paciente',
      'cirugia', 'terapia', 'enfermedad', 'virus', 'dengue', 'covid', 'obra social',
      'css', 'medicamento', 'guardia', 'triage', 'epidemia', 'sanitario', 'doctor',
      'clinica', 'diagnostico', 'tratamiento', 'donacion de sangre'
    ]
  },
  {
    name: 'Turismo',
    color: '#0f766e',
    bg: '#ccfbf1',
    keywords: [
      'turismo', 'turista', 'visitante', 'hotel', 'alojamiento', 'temporada', 'glaciar',
      'excursion', 'viaje', 'vuelo', 'aerolinea',
      'crucero', 'avistaje', 'pesca', 'gastronomia', 'hoteleria', 'agencia de viajes',
      'destino', 'temporada alta', 'temporada baja'
    ]
  },
  {
    name: 'Ambiente',
    color: '#4d7c0f',
    bg: '#ecfccb',
    keywords: [
      'ambiente', 'ambiental', 'contaminacion', 'basural', 'residuo', 'reciclaje',
      'incendio forestal', 'cambio climatico',
      'sequia', 'derrame', 'area protegida', 'parque nacional',
      'ecologia', 'humo', 'saneamiento', 'vertedero', 'calentamiento global'
    ]
  },
  {
    name: 'Energía y Minería',
    color: '#a16207',
    bg: '#fef9c3',
    keywords: [
      'petroleo', 'petrolero', 'gas', 'ypf', 'mineria', 'minero', 'litio', 'hidrogeno',
      'vaca muerta', 'combustible', 'nafta', 'energia', 'electricidad', 'eolica', 'solar',
      'yacimiento', 'extraccion', 'perforacion', 'refineria', 'oleoducto', 'gasoducto',
      'sindicato petrolero', 'guenchenen', 'produccion de crudo'
    ]
  },
  {
    name: 'Nacionales',
    color: '#475569',
    bg: '#f1f5f9',
    keywords: [
      'milei', 'cristina', 'kirchner', 'congreso', 'senado nacional', 'camara de diputados',
      'casa rosada', 'buenos aires', 'gobierno nacional', 'anses', 'afip', 'arca',
      'fmi', 'corte suprema', 'elecciones nacionales', 'presidente', 'vicepresidente',
      'ministro nacional'
    ]
  },
  {
    name: 'Tecnología',
    color: '#4338ca',
    bg: '#e0e7ff',
    keywords: [
      'tecnologia', 'inteligencia artificial', 'internet', 'ciber', 'celular', 'smartphone',
      'redes sociales', 'whatsapp', 'software', 'aplicacion', 'digital', 'hackeo', 'datos',
      'startup', 'robot', 'satelite', 'conectividad', 'fibra optica'
    ]
  },
  {
    name: 'General',
    color: '#6b7280',
    bg: '#f3f4f6',
    keywords: []
  }
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

/** Alias de categorías que suelen venir en los feeds. */
export const CATEGORY_ALIASES = {
  politica: 'Política',
  'politica y economia': 'Política',
  'politica-y-economia': 'Política',
  gobierno: 'Política',
  municipal: 'Política',
  municipios: 'Política',
  economia: 'Economía',
  'economia y negocios': 'Economía',
  negocios: 'Economía',
  deporte: 'Deportes',
  deportes: 'Deportes',
  policial: 'Policiales',
  policiales: 'Policiales',
  policia: 'Policiales',
  sociedad: 'Sociedad',
  locales: 'Sociedad',
  local: 'Sociedad',
  regionales: 'Sociedad',
  'ultimas noticias': null,
  'ultimo momento': null,
  destacadas: null,
  noticias: null,
  nacional: 'Nacionales',
  nacionales: 'Nacionales',
  argentina: 'Nacionales',
  pais: 'Nacionales',
  cultura: 'Cultura',
  cultural: 'Cultura',
  espectaculos: 'Cultura',
  educacion: 'Educación',
  salud: 'Salud',
  turismo: 'Turismo',
  ambiente: 'Ambiente',
  'medio ambiente': 'Ambiente',
  ecologia: 'Ambiente',
  energia: 'Energía y Minería',
  mineria: 'Energía y Minería',
  petroleo: 'Energía y Minería',
  tecnologia: 'Tecnología',
  ciencias: 'Tecnología',
  general: 'General',
  informacion: 'General',
  'informacion general': 'General'
};

/**
 * Localidades de Santa Cruz y alias usados para detectarlas en los textos.
 * "Provincia" y "Nacional" son agrupaciones, no localidades reales.
 */
export const LOCALITIES = [
  { name: 'Río Gallegos', aliases: ['rio gallegos', 'gallegos'] },
  { name: 'Caleta Olivia', aliases: ['caleta olivia', 'caleta'] },
  { name: 'El Calafate', aliases: ['el calafate', 'calafate'] },
  { name: 'El Chaltén', aliases: ['el chalten', 'chalten', 'fitz roy'] },
  { name: 'Puerto Deseado', aliases: ['puerto deseado', 'deseado'] },
  { name: 'Pico Truncado', aliases: ['pico truncado', 'truncado'] },
  { name: 'Las Heras', aliases: ['las heras'] },
  { name: 'Río Turbio', aliases: ['rio turbio', 'turbio'] },
  { name: '28 de Noviembre', aliases: ['28 de noviembre', 'veintiocho de noviembre'] },
  { name: 'Puerto San Julián', aliases: ['puerto san julian', 'san julian'] },
  { name: 'Gobernador Gregores', aliases: ['gobernador gregores', 'gregores'] },
  { name: 'Perito Moreno', aliases: ['perito moreno'] },
  { name: 'Los Antiguos', aliases: ['los antiguos', 'antiguos'] },
  { name: 'Puerto Santa Cruz', aliases: ['puerto santa cruz'] },
  { name: 'Comandante Luis Piedra Buena', aliases: ['piedra buena', 'comandante piedra buena'] },
  { name: 'Koluel Kaike', aliases: ['koluel kaike'] },
  { name: 'Cañadón Seco', aliases: ['canadon seco'] },
  { name: 'Jaramillo', aliases: ['jaramillo'] },
  { name: 'Tres Lagos', aliases: ['tres lagos'] },
  { name: 'Zona Norte', aliases: ['zona norte'] }
];

export const LOCALITY_NAMES = LOCALITIES.map((l) => l.name);
export const GROUP_LOCALITIES = ['Provincia', 'Nacional'];

/** Secciones de URL que identifican una localidad (La Opinión Austral y otros). */
export const SECTION_LOCALITY = {
  'rio-gallegos': 'Río Gallegos',
  'caleta-olivia': 'Caleta Olivia',
  'el-calafate': 'El Calafate',
  'el-chalten': 'El Chaltén',
  'puerto-deseado': 'Puerto Deseado',
  'pico-truncado': 'Pico Truncado',
  'las-heras': 'Las Heras',
  'rio-turbio': 'Río Turbio',
  '28-de-noviembre': '28 de Noviembre',
  'puerto-san-julian': 'Puerto San Julián',
  'gobernador-gregores': 'Gobernador Gregores',
  'perito-moreno': 'Perito Moreno',
  'los-antiguos': 'Los Antiguos',
  'puerto-santa-cruz': 'Puerto Santa Cruz',
  'piedra-buena': 'Comandante Luis Piedra Buena',
  'koluel-kaike': 'Koluel Kaike',
  'canadon-seco': 'Cañadón Seco',
  'jaramillo': 'Jaramillo',
  'tres-lagos': 'Tres Lagos',
  'zona-norte': 'Zona Norte'
};

/** Secciones de URL que identifican una temática. */
export const SECTION_CATEGORY = {
  'politica-y-economia': 'Política',
  politica: 'Política',
  policiales: 'Policiales',
  policia: 'Policiales',
  deportes: 'Deportes',
  deporte: 'Deportes',
  cultura: 'Cultura',
  sociedad: 'Sociedad',
  educacion: 'Educación',
  salud: 'Salud',
  turismo: 'Turismo',
  ambiente: 'Ambiente',
  'energia-y-mineria': 'Energía y Minería',
  nacionales: 'Nacionales',
  argentina: 'Nacionales',
  tecnologia: 'Tecnología'
};

/**
 * Medios iniciales. El campo "type" puede ser:
 *  - auto: intenta RSS y, si falla, scrapea HTML.
 *  - rss: solo RSS.
 *  - html: solo HTML.
 * "enrich" indica si conviene entrar a cada nota para completar imagen, copete y fecha.
 */
export const DEFAULT_SOURCES = [
  {
    slug: 'la-opinion-austral',
    name: 'La Opinión Austral',
    locality: 'Río Gallegos',
    homepage: 'https://laopinionaustral.com.ar/',
    feed_url: null,
    list_url: 'https://laopinionaustral.com.ar/',
    article_pattern: '-\\d{6}\\.html$',
    type: 'html',
    enrich: 1,
    notes: 'Diario de Río Gallegos con secciones por localidad y cobertura provincial.'
  },
  {
    slug: 'tiempo-sur',
    name: 'Tiempo Sur',
    locality: 'Río Gallegos',
    homepage: 'https://www.tiemposur.com.ar/',
    feed_url: 'https://www.tiemposur.com.ar/feed/',
    list_url: 'https://www.tiemposur.com.ar/',
    article_pattern: null,
    type: 'auto',
    enrich: 1,
    notes: 'Diario digital de Río Gallegos con actualización permanente.'
  },
  {
    slug: 'el-diario-nuevo-dia',
    name: 'El Diario Nuevo Día',
    locality: 'Río Gallegos',
    homepage: 'https://www.eldiarionuevodia.com.ar/',
    feed_url: null,
    list_url: 'https://www.eldiarionuevodia.com.ar/',
    article_pattern: null,
    type: 'html',
    enrich: 1,
    notes: 'Diario de Río Gallegos con secciones locales, regionales y nacionales.'
  },
  {
    slug: 'el-extremo-sur',
    name: 'El Extremo Sur',
    locality: 'Río Gallegos',
    homepage: 'https://www.elextremosur.com/',
    feed_url: null,
    list_url: 'https://www.elextremosur.com/',
    article_pattern: '^/nota/\\d+-',
    type: 'html',
    enrich: 1,
    notes: 'Portal de noticias de Río Gallegos y la Patagonia.'
  },
  {
    slug: 'el-caletense',
    name: 'El Caletense',
    locality: 'Caleta Olivia',
    homepage: 'https://elcaletense.net/',
    feed_url: null,
    list_url: 'https://elcaletense.net/',
    article_pattern: '^/detalle/\\d+/',
    type: 'html',
    enrich: 1,
    notes: 'Noticias de Caleta Olivia y la Zona Norte de Santa Cruz.'
  },
  {
    slug: 'la-vanguardia-noticias',
    name: 'La Vanguardia Noticias',
    locality: 'Caleta Olivia',
    homepage: 'https://lavanguardianoticias.com.ar/',
    feed_url: null,
    list_url: 'https://lavanguardianoticias.com.ar/',
    article_pattern: '^/nota-[a-z0-9-]+-\\d+/?$',
    type: 'html',
    enrich: 0,
    notes: 'Portal de Caleta Olivia. Sus notas no siempre exponen metadatos para enriquecer.'
  },
  {
    slug: 'voces-y-apuntes',
    name: 'Voces y Apuntes',
    locality: 'Caleta Olivia',
    homepage: 'https://vocesyapuntes.com/',
    feed_url: 'https://vocesyapuntes.com/feed/',
    list_url: 'https://vocesyapuntes.com/',
    article_pattern: null,
    type: 'auto',
    enrich: 1,
    wp_api: 'https://vocesyapuntes.com/wp-json/wp/v2/posts',
    notes: 'Portal de Caleta Olivia con cobertura provincial.'
  },
  {
    slug: 'la-prensa-de-santa-cruz',
    name: 'La Prensa de Santa Cruz',
    locality: 'Caleta Olivia',
    homepage: 'https://laprensadesantacruz.com/',
    feed_url: 'https://laprensadesantacruz.com/feed/',
    list_url: 'https://laprensadesantacruz.com/',
    article_pattern: null,
    type: 'auto',
    enrich: 1,
    wp_api: 'https://laprensadesantacruz.com/wp-json/wp/v2/posts',
    notes: 'Medio de Caleta Olivia con notas de toda la provincia.'
  },
  {
    slug: 'periodico-las-heras',
    name: 'Periódico Las Heras',
    locality: 'Las Heras',
    homepage: 'https://periodicolasheras.com.ar/',
    feed_url: 'https://periodicolasheras.com.ar/feed/',
    list_url: 'https://periodicolasheras.com.ar/',
    article_pattern: null,
    type: 'auto',
    enrich: 1,
    wp_api: 'https://periodicolasheras.com.ar/wp-json/wp/v2/posts',
    notes: 'Diario de Las Heras y la cuenca carbonífera.'
  },
  {
    slug: 'deseado-noticias',
    name: 'Deseado Noticias',
    locality: 'Puerto Deseado',
    homepage: 'https://deseadonoticias.com/',
    feed_url: 'https://deseadonoticias.com/feed/',
    list_url: 'https://deseadonoticias.com/',
    article_pattern: null,
    type: 'auto',
    enrich: 1,
    wp_api: 'https://deseadonoticias.com/wp-json/wp/v2/posts',
    notes: 'Noticias de Puerto Deseado y la costa santacruceña.'
  },
  {
    slug: 'libertad-noticias',
    name: 'Libertad Noticias',
    locality: 'Pico Truncado',
    homepage: 'https://libertadnoticias.com/',
    feed_url: null,
    list_url: 'https://libertadnoticias.com/',
    article_pattern: 'articulo\\.php\\?articulo=\\d+',
    type: 'html',
    enrich: 0,
    notes: 'Portal de Pico Truncado. Sitio con metadatos limitados.'
  },
  {
    slug: 'prensa-santa-cruz',
    name: 'Prensa Santa Cruz',
    locality: 'Río Gallegos',
    homepage: 'https://noticias.santacruz.gob.ar/',
    feed_url: 'https://noticias.santacruz.gob.ar/?format=feed&type=rss',
    list_url: 'https://noticias.santacruz.gob.ar/',
    article_pattern: null,
    type: 'auto',
    enrich: 1,
    notes: 'Portal oficial de noticias del Gobierno de la Provincia de Santa Cruz.'
  }
];

export const DEFAULT_SETTINGS = {
  refresh_minutes: 30,
  max_per_source: 40,
  enrich_limit: 40,
  retention_days: 0,
  daily_backfill_days: 3,
  default_categories: [],
  default_sources: []
};
