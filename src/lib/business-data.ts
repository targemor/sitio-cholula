/**
 * Catálogo de negocios resuelto por idioma.
 *
 * `cholula.en.json` es un diccionario **por campo y por valor**, no un overlay por
 * registro. Se eligió así al medir los datos: 552 instancias de texto se reducen a
 * 366 valores únicos (34% de repetición), y un registro nuevo cuyo valor ya exista
 * en el diccionario se traduce sin tocar nada.
 *
 * El campo acota el contexto, así que un mismo texto no puede acabar traducido de
 * dos maneras distintas. Lo que no esté en el diccionario cae al español.
 */
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";
import cholulaData from "../data/cholula.json";
import en from "../data/cholula.en.json";

type FieldDictionary = Record<string, Record<string, string>>;

const DICTIONARIES: Partial<Record<Locale, FieldDictionary>> = {
	en: en as unknown as FieldDictionary,
};

/**
 * Campos con texto traducible. Es una lista blanca a propósito: fuera quedan
 * `nombre`, teléfonos, direcciones, URLs, galerías y horarios, que no se traducen
 * ni deben tocarse por accidente.
 */
const TRANSLATABLE = [
	"categoria",
	"categoriaPrecio",
	"zona",
	"dondeEsta",
	"tamanioCategoria",
	"clasificacion",
	"idiomas",
	"tipo",
	"especializacion",
	"toursQueOfrece",
	"descripcion",
	"distanciaGranPiramide",
	"amenidades",
	"tipoComida",
	"ambiente",
	"caracteristicasEspeciales",
	"espacioFisico",
	"idealPara",
	"ocasionIdeal",
	"perfilIdeal",
	"aceptaMascotasNota",
	"terrazaNota",
] as const;

export type Section = "hoteles" | "restaurantes" | "queHacer" | "guiasTuristicos";

function localizeItem(item: any, dict: FieldDictionary): any {
	const out = { ...item };

	for (const field of TRANSLATABLE) {
		const value = out[field];
		if (typeof value !== "string") continue;
		const translated = dict[field]?.[value];
		if (translated) out[field] = translated;
	}

	return out;
}

export function getBusinesses(section: Section, locale: Locale): any[] {
	const items = (cholulaData as any)[section] ?? [];
	const dict = locale === DEFAULT_LOCALE ? null : DICTIONARIES[locale];
	if (!dict) return items;

	// El orden se preserva: los enlaces profundos `?id=N` usan el índice del array.
	return items.map((item: any) => localizeItem(item, dict));
}

/** Valores de campos traducibles que el diccionario todavía no cubre. */
export function findUntranslated(locale: Locale): { field: string; value: string }[] {
	const dict = DICTIONARIES[locale];
	if (!dict) return [];

	const all = [
		...cholulaData.hoteles,
		...cholulaData.restaurantes,
		...cholulaData.queHacer,
		...cholulaData.guiasTuristicos,
	];

	const missing = new Map<string, { field: string; value: string }>();
	for (const item of all as any[]) {
		for (const field of TRANSLATABLE) {
			const value = item[field];
			if (typeof value !== "string" || dict[field]?.[value]) continue;
			missing.set(`${field}::${value}`, { field, value });
		}
	}

	return [...missing.values()];
}
