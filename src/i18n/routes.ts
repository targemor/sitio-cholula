/**
 * Mapa de rutas por idioma.
 *
 * La clave (`food`, `lodging`, …) es un identificador interno estable: nunca se
 * traduce y es lo que debe usar el código para referirse a una página. El slug
 * visible sí cambia por idioma, y por eso vive aquí y no incrustado en los enlaces.
 */
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

export const ROUTES = {
	home: { es: "", en: "" },
	lodging: { es: "donde-hospedarse", en: "where-to-stay" },
	food: { es: "donde-comer", en: "where-to-eat" },
	things: { es: "que-hacer", en: "things-to-do" },
	guides: { es: "guias-turisticos", en: "tour-guides" },
	privacy: { es: "aviso-de-privacidad", en: "privacy-notice" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof ROUTES;

export const ROUTE_KEYS = Object.keys(ROUTES) as RouteKey[];

/** `/donde-comer` · `/en/where-to-eat` · `/` · `/en/` */
export function localizePath(key: RouteKey, locale: Locale): string {
	const slug = ROUTES[key][locale];
	const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
	return slug ? `${prefix}/${slug}` : `${prefix}/`;
}

/** Idioma al que pertenece una ruta, leído del primer segmento. */
export function getLocaleFromPath(pathname: string): Locale {
	const [first] = pathname.replace(/^\/+/, "").split("/");
	return isLocale(first) ? first : DEFAULT_LOCALE;
}

/** Identifica qué página es una ruta, sin importar el idioma. `null` si no la conoce. */
export function getRouteKey(pathname: string): RouteKey | null {
	const locale = getLocaleFromPath(pathname);
	const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
	const slug = pathname
		.slice(prefix.length)
		.replace(/^\/+|\/+$/g, "");

	return ROUTE_KEYS.find((key) => ROUTES[key][locale] === slug) ?? null;
}

/**
 * Rutas que realmente existen en cada idioma.
 *
 * Evita emitir `hreflang` o enlaces del selector hacia páginas que darían 404.
 * Si se agrega un idioma nuevo, empieza vacío y va creciendo por fases.
 */
export const IMPLEMENTED: Record<Locale, RouteKey[]> = {
	es: ["home", "lodging", "food", "things", "guides", "privacy"],
	en: ["home", "lodging", "food", "things", "guides", "privacy"],
};

export function isImplemented(key: RouteKey, locale: Locale): boolean {
	return IMPLEMENTED[locale].includes(key);
}

/**
 * Como `localizePath`, pero cae al idioma por defecto si la página todavía no
 * existe en `locale`. Es lo que deben usar los enlaces de navegación: enviar al
 * usuario a la versión en español es mejor que enviarlo a un 404.
 */
export function localizePathSafe(key: RouteKey, locale: Locale): string {
	return localizePath(key, isImplemented(key, locale) ? locale : DEFAULT_LOCALE);
}

/**
 * La misma página en los idiomas donde existe. Se usa para los `hreflang` y para
 * el selector: si la ruta no se reconoce, devuelve vacío en vez de inventar enlaces.
 */
export function getAlternates(
	pathname: string,
): { locale: Locale; path: string }[] {
	const key = getRouteKey(pathname);
	if (!key) return [];

	return LOCALES.filter((locale) => isImplemented(key, locale)).map((locale) => ({
		locale,
		path: localizePath(key, locale),
	}));
}
