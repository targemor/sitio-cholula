/**
 * Configuración de idiomas del sitio.
 *
 * El español no lleva prefijo (`/donde-comer`) porque esas URLs ya están indexadas;
 * el resto de idiomas vive bajo su prefijo (`/en/where-to-eat`). Esto debe coincidir
 * con el bloque `i18n` de astro.config.mjs.
 */

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

/** Etiquetas BCP-47 para `<html lang>` y `hreflang`. */
export const LOCALE_TAGS: Record<Locale, string> = {
	es: "es-MX",
	en: "en-US",
};

/** Formato que espera Open Graph (guion bajo). */
export const OG_LOCALES: Record<Locale, string> = {
	es: "es_MX",
	en: "en_US",
};

/** Nombre del idioma en su propio idioma, para el selector. */
export const LOCALE_NAMES: Record<Locale, string> = {
	es: "Español",
	en: "English",
};

/**
 * Idiomas cuya traducción todavía no está completa.
 *
 * Se sirven con `noindex` y quedan fuera del sitemap: publicar contenido en español
 * bajo URLs `/en/` sería contenido duplicado y perjudica el posicionamiento.
 * Vaciar este array cuando la traducción esté lista (Fase 5).
 */
export const DRAFT_LOCALES: Locale[] = ["en"];

export function isDraftLocale(locale: Locale): boolean {
	return DRAFT_LOCALES.includes(locale);
}

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}
