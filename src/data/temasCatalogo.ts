/**
 * Catálogo Oficial de Temas y Categorías (MNEMOSINE BI)
 * Mapeo relacional: Tema -> Categoría Principal y Categoría Secundaria
 * Origen: tablas PostgreSQL 'temas_completo' y 'categorias_tema'
 */

export interface TemaCatalogoItem {
  id: number;
  nombre: string;
  activo: boolean;
  categoria: string;
  categoria_secundaria: string | null;
}

export const TEMAS_CATALOGO: TemaCatalogoItem[] = [
  {
    "id": 16,
    "nombre": "COMERCIO",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 26,
    "nombre": "DESARROLLO ECONÓMICO",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 33,
    "nombre": "EMPLEO",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 39,
    "nombre": "FINANZAS",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Transparencia y Rendición de Cuentas"
  },
  {
    "id": 47,
    "nombre": "INVERSIONES",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 100,
    "nombre": "ORGANISMOS EMPRESARIALES",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 66,
    "nombre": "PENSIONES",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 69,
    "nombre": "PREDIAL",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 71,
    "nombre": "PROMOCIÓN TURÍSTICA",
    "activo": false,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": null
  },
  {
    "id": 84,
    "nombre": "TECNOLOGÍA",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Educación, Cultura y Deporte"
  },
  {
    "id": 88,
    "nombre": "TURISMO",
    "activo": true,
    "categoria": "Economía y Finanzas Públicas",
    "categoria_secundaria": "Entretenimiento, Viralidad y Tendencias"
  },
  {
    "id": 7,
    "nombre": "ARTE",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Entretenimiento, Viralidad y Tendencias"
  },
  {
    "id": 13,
    "nombre": "CAPACITACIÓN",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 21,
    "nombre": "CURSO",
    "activo": false,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": null
  },
  {
    "id": 23,
    "nombre": "DEPORTE",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 30,
    "nombre": "EDUCACIÓN",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 31,
    "nombre": "EDUCACIÓN VIAL",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 37,
    "nombre": "FESTIVALES",
    "activo": false,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": null
  },
  {
    "id": 58,
    "nombre": "MUSEOS",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Entretenimiento, Viralidad y Tendencias"
  },
  {
    "id": 64,
    "nombre": "PATRIMONIO CULTURAL",
    "activo": true,
    "categoria": "Educación, Cultura y Deporte",
    "categoria_secundaria": "Entretenimiento, Viralidad y Tendencias"
  },
  {
    "id": 95,
    "nombre": "ESPECTÁCULOS",
    "activo": true,
    "categoria": "Entretenimiento, Viralidad y Tendencias",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 38,
    "nombre": "FESTIVIDADES",
    "activo": true,
    "categoria": "Entretenimiento, Viralidad y Tendencias",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 83,
    "nombre": "TEATRO",
    "activo": true,
    "categoria": "Entretenimiento, Viralidad y Tendencias",
    "categoria_secundaria": "Educación, Cultura y Deporte"
  },
  {
    "id": 96,
    "nombre": "TENDENCIAS VIRALES",
    "activo": true,
    "categoria": "Entretenimiento, Viralidad y Tendencias",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 2,
    "nombre": "AEROPUERTO",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 3,
    "nombre": "AGUA",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Medio Ambiente y Sustentabilidad"
  },
  {
    "id": 5,
    "nombre": "ALUMBRADO",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Seguridad y Justicia"
  },
  {
    "id": 91,
    "nombre": "AMBULANTAJE",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 55,
    "nombre": "AUTOTRANSPORTE",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 98,
    "nombre": "CARRETERAS",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 22,
    "nombre": "DEMOLICIÓN",
    "activo": false,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": null
  },
  {
    "id": 28,
    "nombre": "DRENAJE",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 41,
    "nombre": "FUMIGACIÓN",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 45,
    "nombre": "INFRAESTRUCTURA",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 101,
    "nombre": "INUNDACIÓN",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Medio Ambiente y Sustentabilidad"
  },
  {
    "id": 49,
    "nombre": "LIMPIEZA",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 52,
    "nombre": "MANTENIMIENTO",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 59,
    "nombre": "NUEVOS PROYECTOS",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 60,
    "nombre": "OBRA PÚBLICA",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 62,
    "nombre": "PANTEONES",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 63,
    "nombre": "PARQUES Y JARDINES",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Medio Ambiente y Sustentabilidad"
  },
  {
    "id": 65,
    "nombre": "PAVIMENTO",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 67,
    "nombre": "PLANEACIÓN URBANA",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Medio Ambiente y Sustentabilidad"
  },
  {
    "id": 78,
    "nombre": "RUTAS",
    "activo": false,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": null
  },
  {
    "id": 82,
    "nombre": "SERVICIOS PÚBLICOS",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 87,
    "nombre": "TRANSPORTE",
    "activo": false,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": null
  },
  {
    "id": 92,
    "nombre": "VIALIDAD",
    "activo": true,
    "categoria": "Infraestructura y Servicios Públicos",
    "categoria_secundaria": "Seguridad y Justicia"
  },
  {
    "id": 15,
    "nombre": "CLIMA",
    "activo": true,
    "categoria": "Medio Ambiente y Sustentabilidad",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 17,
    "nombre": "CONTAMINACIÓN AUDITIVA",
    "activo": true,
    "categoria": "Medio Ambiente y Sustentabilidad",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 18,
    "nombre": "CONTINGENCIA AMBIENTAL",
    "activo": true,
    "categoria": "Medio Ambiente y Sustentabilidad",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 50,
    "nombre": "LLUVIAS",
    "activo": true,
    "categoria": "Medio Ambiente y Sustentabilidad",
    "categoria_secundaria": "Infraestructura y Servicios Públicos"
  },
  {
    "id": 54,
    "nombre": "MEDIO AMBIENTE",
    "activo": true,
    "categoria": "Medio Ambiente y Sustentabilidad",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 74,
    "nombre": "REFORESTACIÓN",
    "activo": true,
    "categoria": "Medio Ambiente y Sustentabilidad",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 42,
    "nombre": "INAUGURACIÓN",
    "activo": false,
    "categoria": "Otros",
    "categoria_secundaria": null
  },
  {
    "id": 72,
    "nombre": "RANKING",
    "activo": false,
    "categoria": "Otros",
    "categoria_secundaria": null
  },
  {
    "id": 103,
    "nombre": "ANTICORRUPCIÓN",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Transparencia y Rendición de Cuentas"
  },
  {
    "id": 10,
    "nombre": "BRIGADAS DE ATENCIÓN MUNICIPAL",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 11,
    "nombre": "CABILDO",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Transparencia y Rendición de Cuentas"
  },
  {
    "id": 32,
    "nombre": "ELECCIONES 2026",
    "activo": false,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": null
  },
  {
    "id": 44,
    "nombre": "INFORME",
    "activo": false,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": null
  },
  {
    "id": 57,
    "nombre": "MULTAS",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Seguridad y Justicia"
  },
  {
    "id": 99,
    "nombre": "PARTIDOS POLÍTICOS",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 12,
    "nombre": "PROCESOS ELECTORALES",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 73,
    "nombre": "REELECCIÓN",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 75,
    "nombre": "REGLAMENTACIÓN",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Transparencia y Rendición de Cuentas"
  },
  {
    "id": 85,
    "nombre": "TOMA DE PROTESTA",
    "activo": true,
    "categoria": "Política y Gobierno",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 19,
    "nombre": "CONTROL CANINO",
    "activo": true,
    "categoria": "Salud Pública",
    "categoria_secundaria": "Infraestructura y Servicios Públicos"
  },
  {
    "id": 79,
    "nombre": "SALUD",
    "activo": true,
    "categoria": "Salud Pública",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 89,
    "nombre": "VACUNACIÓN",
    "activo": true,
    "categoria": "Salud Pública",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 1,
    "nombre": "ACCIDENTES",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Infraestructura y Servicios Públicos"
  },
  {
    "id": 4,
    "nombre": "ALCOHOLÍMETRO",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 9,
    "nombre": "BOMBEROS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 14,
    "nombre": "CLAUSURA",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 25,
    "nombre": "DESAPARECIDOS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 27,
    "nombre": "DETENCIONES",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 29,
    "nombre": "DROGAS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 36,
    "nombre": "FEMINICIDIOS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 40,
    "nombre": "FRAUDES",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Transparencia y Rendición de Cuentas"
  },
  {
    "id": 102,
    "nombre": "FUERZAS ARMADAS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 43,
    "nombre": "INCENDIOS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Medio Ambiente y Sustentabilidad"
  },
  {
    "id": 46,
    "nombre": "INSPECCIÓN",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 48,
    "nombre": "JUSTICIA",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 61,
    "nombre": "POLICÍAS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 70,
    "nombre": "PREVENCIÓN",
    "activo": false,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": null
  },
  {
    "id": 68,
    "nombre": "PREVENCIÓN DEL DELITO",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 8,
    "nombre": "PROTECCIÓN CIVIL",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Salud Pública"
  },
  {
    "id": 77,
    "nombre": "ROBOS",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 80,
    "nombre": "SEGURIDAD",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 81,
    "nombre": "SERVICIO MILITAR NACIONAL",
    "activo": false,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 90,
    "nombre": "VANDALISMO",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 93,
    "nombre": "VIOLENCIA",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 94,
    "nombre": "VIOLENCIA CONTRA LA MUJER",
    "activo": true,
    "categoria": "Seguridad y Justicia",
    "categoria_secundaria": "Sociedad y Derechos Humanos"
  },
  {
    "id": 6,
    "nombre": "APOYOS SOCIALES",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 24,
    "nombre": "DERECHOS HUMANOS",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 34,
    "nombre": "EMPODERAMIENTO DE LA MUJER",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Economía y Finanzas Públicas"
  },
  {
    "id": 35,
    "nombre": "FAMILIA",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Educación, Cultura y Deporte"
  },
  {
    "id": 51,
    "nombre": "MANIFESTACIONES",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 53,
    "nombre": "MASCOTAS",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 56,
    "nombre": "MIGRANTES",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 76,
    "nombre": "RELIGIÓN",
    "activo": true,
    "categoria": "Sociedad y Derechos Humanos",
    "categoria_secundaria": "Educación, Cultura y Deporte"
  },
  {
    "id": 20,
    "nombre": "CORRUPCIÓN",
    "activo": true,
    "categoria": "Transparencia y Rendición de Cuentas",
    "categoria_secundaria": "Política y Gobierno"
  },
  {
    "id": 86,
    "nombre": "TRANSPARENCIA",
    "activo": true,
    "categoria": "Transparencia y Rendición de Cuentas",
    "categoria_secundaria": "Política y Gobierno"
  }
];

/**
 * Normaliza strings para comparación estricta insensible a acentos y mayúsculas
 */
export function normalizeCategoryName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Determina si un tema pertenece a alguna de las categorías especificadas
 * (ya sea como Categoría Principal o como Categoría Secundaria).
 */
export function matchesCategory(
  item: { categoria?: string | null; categoria_secundaria?: string | null },
  targetCategories: string[]
): { matches: boolean; isPrimary: boolean; isSecondary: boolean } {
  if (!targetCategories || targetCategories.length === 0) {
    return { matches: true, isPrimary: true, isSecondary: false };
  }

  const normalizedTargets = targetCategories.map(normalizeCategoryName);
  const normPrimary = normalizeCategoryName(item.categoria);
  const normSecondary = normalizeCategoryName(item.categoria_secundaria);

  const isPrimary = Boolean(normPrimary && normalizedTargets.includes(normPrimary));
  const isSecondary = Boolean(normSecondary && normalizedTargets.includes(normSecondary));

  return {
    matches: isPrimary || isSecondary,
    isPrimary,
    isSecondary
  };
}

/**
 * Devuelve el catálogo filtrado por una lista de categorías seleccionadas.
 * Cada tema retornado indica si la categoría seleccionada coincide como principal o secundaria.
 */
export function getTemasForCategorias(targetCategories: string[]): Array<TemaCatalogoItem & { isPrimary: boolean; isSecondary: boolean }> {
  if (!targetCategories || targetCategories.length === 0) {
    return TEMAS_CATALOGO.map(t => ({
      ...t,
      isPrimary: true,
      isSecondary: false
    }));
  }

  const results: Array<TemaCatalogoItem & { isPrimary: boolean; isSecondary: boolean }> = [];

  for (const item of TEMAS_CATALOGO) {
    const { matches, isPrimary, isSecondary } = matchesCategory(item, targetCategories);
    if (matches) {
      results.push({
        ...item,
        isPrimary,
        isSecondary
      });
    }
  }

  return results;
}

/**
 * Mapa rápido por nombre en mayúsculas para búsquedas O(1)
 */
export const TEMA_BY_NAME_MAP: Map<string, TemaCatalogoItem> = new Map(
  TEMAS_CATALOGO.map((t) => [t.nombre.trim().toUpperCase(), t])
);

/**
 * Obtiene la categoría principal y secundaria de un tema por su nombre
 */
export function getTemaMetadata(temaName: string): TemaCatalogoItem | undefined {
  if (!temaName) return undefined;
  return TEMA_BY_NAME_MAP.get(temaName.trim().toUpperCase());
}

/**
 * Las 11 Categorías Oficiales del Sistema (tabla PostgreSQL categorias_tema)
 * NINGÚN tema debe figurar nunca en la lista de categorías.
 */
export const CATEGORIAS_OFICIALES = [
  'Política y Gobierno',
  'Seguridad y Justicia',
  'Economía y Finanzas Públicas',
  'Infraestructura y Servicios Públicos',
  'Sociedad y Derechos Humanos',
  'Medio Ambiente y Sustentabilidad',
  'Salud Pública',
  'Educación, Cultura y Deporte',
  'Transparencia y Rendición de Cuentas',
  'Entretenimiento, Viralidad y Tendencias',
  'Otros'
] as const;

export type CategoriaOficial = typeof CATEGORIAS_OFICIALES[number];

/**
 * Valida si un string corresponde a una de las 11 Categorías Oficiales
 */
export function isCategoriaOficial(name: string | null | undefined): boolean {
  if (!name) return false;
  const norm = normalizeCategoryName(name);
  return CATEGORIAS_OFICIALES.some((c) => normalizeCategoryName(c) === norm);
}

/**
 * Obtiene el nombre canónico de la categoría oficial si coincide
 */
export function matchCategoriaOficial(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const norm = normalizeCategoryName(name);
  return CATEGORIAS_OFICIALES.find((c) => normalizeCategoryName(c) === norm);
}

