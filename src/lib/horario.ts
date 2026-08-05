/**
 * Utilidades de horarios, independientes del idioma.
 *
 * Los campos por día (`lunes`…`domingo`) son la única fuente de verdad: guardan
 * un rango `HH:MM-HH:MM` o un marcador de cierre. Los campos `resumen` y `detalle`
 * de cholula.json venían pre-formateados en español; `detalle` ahora se genera con
 * `formatHorarioDetalle()` para poder emitirlo en cualquier idioma sin duplicar el
 * dato, y `resumen` quedó sin uso.
 */

export const DAY_KEYS = [
	"lunes",
	"martes",
	"miercoles",
	"jueves",
	"viernes",
	"sabado",
	"domingo",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export interface Horario extends Partial<Record<DayKey, string>> {
	/** Resumen pre-formateado del JSON original. Sin uso en la UI. */
	resumen?: string;
	/** Detalle pre-formateado del JSON original. Reemplazado por formatHorarioDetalle(). */
	detalle?: string;
}

/** DAY_KEYS reordenado para indexar con Date#getDay() (0 = domingo). */
const WEEKDAYS: DayKey[] = [
	"domingo",
	"lunes",
	"martes",
	"miercoles",
	"jueves",
	"viernes",
	"sabado",
];

const DAY_NAMES: Record<string, Record<DayKey, string>> = {
	es: {
		lunes: "Lunes",
		martes: "Martes",
		miercoles: "Miércoles",
		jueves: "Jueves",
		viernes: "Viernes",
		sabado: "Sábado",
		domingo: "Domingo",
	},
	en: {
		lunes: "Monday",
		martes: "Tuesday",
		miercoles: "Wednesday",
		jueves: "Thursday",
		viernes: "Friday",
		sabado: "Saturday",
		domingo: "Sunday",
	},
};

const CLOSED_LABEL: Record<string, string> = { es: "cerrado", en: "closed" };

/**
 * Un slot con servicio es exactamente un rango `H:MM-H:MM`. Cualquier otro valor
 * ("cerrado", "closed", vacío) significa que ese día no abre — así la lógica no
 * depende del idioma en que esté escrito el marcador.
 */
const SLOT_RE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

/** Minutos `[inicio, fin]` del slot, o `null` si no es un rango horario. */
export function parseSlot(slot?: string): [number, number] | null {
	const match = slot?.trim().match(SLOT_RE);
	if (!match) return null;

	const start = Number(match[1]) * 60 + Number(match[2]);
	let end = Number(match[3]) * 60 + Number(match[4]);
	// Cierre pasada la medianoche: "20:00-02:00".
	if (end <= start) end += 24 * 60;

	return [start, end];
}

function isSlotOpenAt(slot: string, now: Date): boolean {
	const range = parseSlot(slot);
	if (!range) return false;

	const [start, end] = range;
	const minutes = now.getHours() * 60 + now.getMinutes();
	// Si el rango cruza medianoche, la madrugada cuenta como parte del día anterior.
	const current = end > 24 * 60 && minutes < start ? minutes + 24 * 60 : minutes;

	return current >= start && current <= end;
}

/**
 * `true` abierto, `false` cerrado, `null` si no hay horario que evaluar.
 * Solo consulta los campos por día, nunca `resumen`/`detalle`.
 */
export function isCurrentlyOpen(
	horario?: Horario | string,
	now: Date = new Date(),
): boolean | null {
	if (!horario) return null;
	if (typeof horario === "string") return isSlotOpenAt(horario, now);

	const slot = horario[WEEKDAYS[now.getDay()]];
	if (slot === undefined) return null;

	return isSlotOpenAt(slot, now);
}

/**
 * `"Lunes: 08:00-22:00 • Martes: cerrado • …"`.
 * Con `lang = "es"` reproduce exactamente el campo `detalle` de cholula.json.
 */
export function formatHorarioDetalle(
	horario?: Horario | string,
	lang = "es",
): string {
	if (!horario) return "";
	if (typeof horario === "string") return horario;

	const names = DAY_NAMES[lang] ?? DAY_NAMES.es;
	const closed = CLOSED_LABEL[lang] ?? CLOSED_LABEL.es;

	return DAY_KEYS.flatMap((key) => {
		const slot = horario[key];
		if (slot === undefined) return [];
		return [`${names[key]}: ${parseSlot(slot) ? slot : closed}`];
	}).join(" • ");
}
