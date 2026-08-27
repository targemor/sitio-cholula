/**
 * Contenido editorial del home, resuelto por idioma.
 *
 * `home.json` es la base: lo lleva todo en español, más los campos que no se
 * traducen (imágenes, mapas, iconos, claves de ruta). `home.<lang>.json` es un
 * overlay indexado por `id` que solo trae los campos traducibles.
 *
 * Se hace así, y no con archivos paralelos completos, por la misma razón que
 * `cholula.en.json`: si alguien cambia una imagen en el archivo base, el otro
 * idioma no se queda con la ruta vieja. Y si falta una traducción, cae al
 * español en vez de dejar un hueco.
 */
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";
import type { RouteKey } from "../i18n/routes";
import base from "../data/home.json";
import en from "../data/home.en.json";
import cholulaData from "../data/cholula.json";

export interface Imperdible {
	id: string;
	img: string;
	mapUrl: string;
	categoryEmoji: string;
	nombre: string;
	categoria: string;
	descripcion: string;
	/** Deben ser subcadenas exactas de `descripcion`: el carrusel las resalta con regex. */
	highlights: string[];
}

export interface VisitanosItem {
	id: string;
	route: RouteKey;
	img: string;
	icons: string[];
	title: string;
}

export interface Artesania {
	id: string;
	href: string;
	mapsUrl: string;
	images: string[];
	label: string;
	address: string;
	descripcion: string;
}

export interface HomeContent {
	imperdibles: Imperdible[];
	eventos: string[];
	visitanos: VisitanosItem[];
	artesanias: Artesania[];
}

/** Overlays por idioma. El idioma por defecto no necesita uno: ya es la base. */
const OVERLAYS: Partial<Record<Locale, any>> = { en };

function merge<T extends { id: string }>(items: T[], overlay: any): T[] {
	if (!overlay) return items;
	return items.map((item) => ({ ...item, ...(overlay[item.id] ?? {}) }));
}

/**
 * Resuelve la lista de eventos: usa el array de `cholula.json` (extraído de
 * WordPress) cuando tiene contenido; de lo contrario, cae al listado estático
 * de `home.json` como fallback para desarrollo local sin extract.
 *
 * Las rutas en `cholula.json.eventos` ya son locales (e.g. `/eventos/feria.webp`)
 * porque `extract-wp-data.cjs` las descarga y reescribe antes de guardar el JSON.
 */
function resolveEventos(): string[] {
	const wpEventos = (cholulaData as any).eventos;
	if (Array.isArray(wpEventos) && wpEventos.length > 0) {
		return wpEventos;
	}
	return base.eventos;
}

export function getHomeContent(locale: Locale): HomeContent {
	const overlay = locale === DEFAULT_LOCALE ? null : OVERLAYS[locale];

	return {
		imperdibles: merge(base.imperdibles as Imperdible[], overlay?.imperdibles),
		eventos: resolveEventos(),
		visitanos: merge(base.visitanos as VisitanosItem[], overlay?.visitanos),
		artesanias: merge(base.artesanias as Artesania[], overlay?.artesanias),
	};
}

