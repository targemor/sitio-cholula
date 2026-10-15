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

/** Los horarios están en hora de Cholula, no en la del navegador del visitante. */
const TIME_ZONE = "America/Mexico_City";

const WEEKDAY_INDEX: Record<string, number> = {
	Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Día de la semana (0 = domingo) y minuto del día en hora de Cholula. */
function cholulaClock(now: Date): { day: number; minutes: number } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return {
		day: WEEKDAY_INDEX[get("weekday")] ?? now.getDay(),
		minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
	};
}

const DAY = 24 * 60;

export interface OpenStatus {
	open: boolean;
	/** "HH:MM" de la próxima apertura si abre hoy más tarde (solo cuando está cerrado). */
	opensAt?: string;
}

/**
 * Estado en este momento, o `null` si no hay horario que evaluar.
 * Solo consulta los campos por día, nunca `resumen`/`detalle`.
 *
 * - El cierre es exclusivo: con "11:30-18:30", a las 18:30 ya está cerrado.
 * - La madrugada de un rango que cruza medianoche ("16:00-02:00") se evalúa con
 *   el horario del día ANTERIOR: el sábado 01:00 depende del slot del viernes.
 */
export function getOpenStatus(
	horario?: Horario | string,
	now: Date = new Date(),
): OpenStatus | null {
	if (!horario) return null;

	const { day, minutes } = cholulaClock(now);
	const slotFor = (d: number) =>
		typeof horario === "string" ? horario : horario[WEEKDAYS[(d + 7) % 7]];

	const today = slotFor(day);
	if (typeof horario !== "string" && today === undefined) return null;

	// 1) Madrugada: ¿sigue abierto el turno de ayer?
	const yesterday = parseSlot(slotFor(day - 1));
	if (yesterday && yesterday[1] > DAY && minutes < yesterday[1] - DAY) {
		return { open: true };
	}

	// 2) Turno de hoy.
	const range = parseSlot(today);
	if (!range) return { open: false };
	const [start, end] = range;
	if (minutes >= start && minutes < end) return { open: true };

	return minutes < start ? { open: false, opensAt: today!.trim().split("-")[0].trim() } : { open: false };
}

/** `true` abierto, `false` cerrado, `null` si no hay horario que evaluar. */
export function isCurrentlyOpen(
	horario?: Horario | string,
	now: Date = new Date(),
): boolean | null {
	return getOpenStatus(horario, now)?.open ?? null;
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
