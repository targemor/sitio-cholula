/**
 * Configuración de las páginas de directorio (hoteles, restaurantes, qué hacer, guías).
 *
 * Vive en su propio módulo porque `getStaticPaths()` se hoistea fuera del scope del
 * frontmatter: solo alcanza lo que la página importa, no sus `const` locales.
 *
 * Aquí va únicamente lo que NO depende del idioma. Los textos visibles (título,
 * SEO) están en la página, y pasan a `src/i18n/` en la Fase 5.
 */
import type { RouteKey } from "../i18n/routes";
import type { Section } from "./business-data";

export type DirectoryKey = Extract<
	RouteKey,
	"lodging" | "food" | "things" | "guides"
>;

interface Directory {
	/** Color de acento de la sección. */
	color: string;
	/** Sección de cholula.json. Los datos se piden con `getBusinesses(section, lang)`. */
	section: Section;
	/** Tipo de schema.org para el JSON-LD. */
	schema: string;
}

export const DIRECTORIES: Record<DirectoryKey, Directory> = {
	lodging: {
		color: "var(--color-primary)",
		section: "hoteles",
		schema: "LodgingBusiness",
	},
	food: {
		color: "var(--color-accent)",
		section: "restaurantes",
		schema: "FoodEstablishment",
	},
	things: {
		color: "var(--color-secondary)",
		section: "queHacer",
		schema: "TouristAttraction",
	},
	guides: {
		color: "#22c55e",
		section: "guiasTuristicos",
		schema: "LocalBusiness",
	},
};

export const DIRECTORY_KEYS = Object.keys(DIRECTORIES) as DirectoryKey[];
