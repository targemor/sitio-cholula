/**
 * Itinerarios del home, resueltos por idioma.
 *
 * `itinerario.json` es la base en español; `itinerario.<lang>.json` es un overlay
 * indexado por `id` de itinerario que refleja la estructura y solo trae los campos
 * traducibles. Los arrays (`elementos`, `dias`, `consejos`) se fusionan **por
 * posición**, porque no tienen id propio: si el overlay trae menos elementos que
 * la base, los que sobran se quedan en español en vez de desaparecer.
 */
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";
import base from "../data/itinerario.json";
import en from "../data/itinerario.en.json";

const OVERLAYS: Partial<Record<Locale, any>> = { en };

function isPlainObject(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fusión profunda: el overlay pisa la base; lo que no trae, se hereda. */
function deepMerge(baseValue: any, overlayValue: any): any {
	if (overlayValue === undefined) return baseValue;

	if (Array.isArray(baseValue) && Array.isArray(overlayValue)) {
		return baseValue.map((item, i) => deepMerge(item, overlayValue[i]));
	}

	if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
		const out: Record<string, any> = { ...baseValue };
		for (const [key, value] of Object.entries(overlayValue)) {
			out[key] = deepMerge(baseValue[key], value);
		}
		return out;
	}

	return overlayValue;
}

export function getItinerarios(locale: Locale): any[] {
	const overlay = locale === DEFAULT_LOCALE ? null : OVERLAYS[locale];
	if (!overlay) return base.itinerarios;

	return base.itinerarios.map((itinerario: any) =>
		deepMerge(itinerario, overlay[itinerario.id]),
	);
}
