/**
 * Eventos: colección del CPT `evento` de WordPress, con fallback al JSON estático.
 *
 * `cholula.json.eventos` tiene dos formas posibles según la versión del plugin
 * que corra en el WordPress del que se extrajo:
 *
 *   - Vieja: `string[]` con las URLs de los carteles (solo servía al carrusel).
 *   - Nueva: la colección completa (`titulo`, `dia`, `mes`, `ubicacion`, ...).
 *
 * Aquí se aceptan las dos para que el front no dependa de cuándo se actualice
 * el backend: mientras llegue la forma vieja, la cartelera sigue leyendo
 * `eventos.json`, y en cuanto llegue la nueva pasa a usar WordPress sola.
 */
import cholulaData from "../data/cholula.json";
import eventosBase from "../data/eventos.json";
import type { Evento } from "../components/EventosSection";

/** Lo que viene de WP: los campos vacíos llegan como `null`. */
type EventoWP = {
	id?: number | null;
	titulo?: string | null;
	descripcion?: string | null;
	dia?: number | null;
	mes?: string | null;
	mes_corto?: string | null;
	dia_semana?: string | null;
	ubicacion?: string | null;
	horario?: string | null;
	imagen?: string | null;
	url_info?: string | null;
	categoria?: string | null;
};

function rawEventos(): unknown[] {
	const wp = (cholulaData as any).eventos;
	return Array.isArray(wp) ? wp : [];
}

/** La forma nueva trae objetos; la vieja, strings con la URL del cartel. */
function esColeccion(items: unknown[]): items is EventoWP[] {
	return items.length > 0 && typeof items[0] === "object" && items[0] !== null;
}

/**
 * Rellena los huecos: WP manda `null` en los campos sin capturar y la cartelera
 * los pinta directo. `dia` se deja en `null` a propósito — React no renderiza
 * nada, mientras que un 0 sí se vería en el bloque de fecha.
 */
function normalizar(e: EventoWP, i: number): Evento {
	return {
		id: typeof e.id === "number" ? e.id : i,
		titulo: e.titulo ?? "",
		descripcion: e.descripcion ?? "",
		dia: typeof e.dia === "number" ? e.dia : null,
		mes: e.mes ?? "",
		mes_corto: e.mes_corto ?? "",
		dia_semana: e.dia_semana ?? "",
		ubicacion: e.ubicacion ?? "",
		horario: e.horario ?? "",
		imagen: e.imagen ?? "",
		url_info: e.url_info ?? null,
		categoria: e.categoria ?? "",
	};
}

const MESES_MAP: Record<string, number> = {
	enero: 1, ene: 1, jan: 1, january: 1,
	febrero: 2, feb: 2, february: 2,
	marzo: 3, mar: 3, march: 3,
	abril: 4, abr: 4, apr: 4, april: 4,
	mayo: 5, may: 5,
	junio: 6, jun: 6, june: 6,
	julio: 7, jul: 7, july: 7,
	agosto: 8, ago: 8, aug: 8, august: 8,
	septiembre: 9, sep: 9, setiembre: 9, september: 9,
	octubre: 10, oct: 10, october: 10,
	noviembre: 11, nov: 11, november: 11,
	diciembre: 12, dic: 12, dec: 12, december: 12,
};

function getMesNum(mes?: string | null, mesCorto?: string | null): number {
	if (mesCorto) {
		const k = mesCorto.trim().toLowerCase();
		if (MESES_MAP[k]) return MESES_MAP[k];
	}
	if (mes) {
		const k = mes.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
		if (MESES_MAP[k]) return MESES_MAP[k];
	}
	return 99;
}

function ordenarPorFecha(list: Evento[]): Evento[] {
	return [...list].sort((a, b) => {
		const mA = getMesNum(a.mes, a.mes_corto);
		const mB = getMesNum(b.mes, b.mes_corto);
		if (mA !== mB) return mA - mB;
		const dA = a.dia ?? 99;
		const dB = b.dia ?? 99;
		return dA - dB;
	});
}

/**
 * Colección completa para la cartelera (`EventosSection`).
 * Cae a `eventos.json` mientras WordPress no envíe la forma nueva.
 */
export function getEventos(): Evento[] {
	const items = rawEventos();
	if (!esColeccion(items)) return ordenarPorFecha(eventosBase as Evento[]);

	const eventos = items.filter((e) => e && e.titulo).map(normalizar);
	return ordenarPorFecha(eventos.length > 0 ? eventos : (eventosBase as Evento[]));
}

/**
 * Solo las URLs de los carteles, para cualquier carrusel de imágenes.
 * Sirve con las dos formas del JSON.
 */
export function getEventosImagenes(): string[] {
	const items = rawEventos();

	if (!esColeccion(items)) {
		return items.filter((i): i is string => typeof i === "string" && i.length > 0);
	}

	return items
		.map((e) => e?.imagen ?? "")
		.filter((url): url is string => url.length > 0);
}
