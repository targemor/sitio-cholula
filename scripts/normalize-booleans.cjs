#!/usr/bin/env node
/**
 * Normaliza a booleanos los campos Sí/No de src/data/cholula.json.
 *
 * Estos campos eran prosa en español ("Sí", "No", "Sí, con previo aviso"), así que
 * cualquier lógica que dependiera de ellos se rompía al traducir el catálogo: un
 * "Yes" no pasa un `startsWith("sí")`. Tras este paso el dato es neutral al idioma.
 *
 * Los matices ("con previo aviso", "vista a volcanes y pirámide") no se pierden:
 * pasan a un campo `<campo>Nota` aparte, que sí es texto traducible.
 *
 * Idempotente: si el campo ya es booleano, no lo toca.
 *
 * Uso:
 *   node scripts/normalize-booleans.cjs [--dry-run] [--file <ruta>]
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const fileArg = args.indexOf("--file");
const FILE =
	fileArg !== -1 && args[fileArg + 1]
		? path.resolve(args[fileArg + 1])
		: path.join(__dirname, "..", "src", "data", "cholula.json");

/**
 * Lista blanca deliberada. NO detectar por patrón: en este dataset
 * `distanciaGranPiramide` ("No caminable; aprox. 10 min en coche...") y
 * `caracteristicasEspeciales` ("No acepta reservaciones") empiezan con "No"
 * pero son prosa, no banderas.
 */
const CAMPOS_PUROS = [
	"tieneAlberca",
	"tieneSpa",
	"recepcion24h",
	"petFriendly",
	"musicaEnVivo",
];

/** Estos traen un matiz después del "Sí" que se conserva en `<campo>Nota`. */
const CAMPOS_CON_NOTA = ["aceptaMascotas", "terraza"];

const TODOS = [...CAMPOS_PUROS, ...CAMPOS_CON_NOTA];

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");
/** "sí"/"si" al inicio, pero nunca "sin". */
const AFIRMATIVO = /^si\b/;
/** El "Sí" inicial en el texto original (NFC), para poder recortarlo. */
const PREFIJO_AFIRMATIVO = new RegExp("^s(?:\\u00ed|i)", "i");
const NEGATIVO = /^no\b/;

function normalizar(str) {
	return str.trim().toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

/** true | false | null (null = no es un Sí/No reconocible). */
function aBooleano(valor) {
	const n = normalizar(valor);
	if (AFIRMATIVO.test(n)) return true;
	if (NEGATIVO.test(n)) return false;
	return null;
}

/** "Sí, con previo aviso" → "con previo aviso" · "Sí" → null */
function extraerNota(valor) {
	const texto = valor.normalize("NFC").trim();
	const prefijo = texto.match(PREFIJO_AFIRMATIVO);
	if (!prefijo) return null;

	let resto = texto.slice(prefijo[0].length).trim();
	if (/^[,:;·—–-]/.test(resto)) {
		resto = resto.slice(1).trim();
	} else if (resto.startsWith("(") && resto.endsWith(")")) {
		resto = resto.slice(1, -1).trim();
	}

	return resto.length > 0 ? resto : null;
}

/** Reconstruye el registro insertando `<campo>Nota` justo después de su campo. */
function normalizarRegistro(registro, stats) {
	const salida = {};

	for (const [clave, valor] of Object.entries(registro)) {
		if (!TODOS.includes(clave)) {
			salida[clave] = valor;
			continue;
		}

		if (typeof valor === "boolean") {
			stats.yaBooleanos++;
			salida[clave] = valor;
			continue;
		}

		if (typeof valor !== "string") {
			stats.avisos.push(
				`${registro.nombre} · ${clave}: tipo inesperado (${typeof valor}), se deja igual`,
			);
			salida[clave] = valor;
			continue;
		}

		const bool = aBooleano(valor);
		if (bool === null) {
			stats.avisos.push(
				`${registro.nombre} · ${clave}: ${JSON.stringify(valor)} no es Sí/No, se deja igual`,
			);
			salida[clave] = valor;
			continue;
		}

		salida[clave] = bool;
		stats.convertidos++;

		if (CAMPOS_CON_NOTA.includes(clave)) {
			const nota = bool ? extraerNota(valor) : null;
			if (nota) {
				salida[`${clave}Nota`] = nota;
				stats.notas.push(`${registro.nombre} · ${clave}: ${JSON.stringify(nota)}`);
			}
		}
	}

	return salida;
}

/* ── Ejecución ─────────────────────────────────────────────────────────────── */
if (!fs.existsSync(FILE)) {
	console.error(`[normalize-booleans] no existe ${FILE}`);
	process.exit(1);
}

const crudo = fs.readFileSync(FILE, "utf8");
const data = JSON.parse(crudo);

const stats = { convertidos: 0, yaBooleanos: 0, notas: [], avisos: [] };
let registros = 0;

for (const [seccion, lista] of Object.entries(data)) {
	if (!Array.isArray(lista)) continue;
	data[seccion] = lista.map((registro) => {
		registros++;
		return normalizarRegistro(registro, stats);
	});
}

console.log(`[normalize-booleans] ${path.relative(process.cwd(), FILE)}`);
console.log(`  registros revisados : ${registros}`);
console.log(`  campos convertidos  : ${stats.convertidos}`);
console.log(`  ya eran booleanos   : ${stats.yaBooleanos}`);
console.log(`  notas conservadas   : ${stats.notas.length}`);

if (stats.notas.length) {
	console.log("\n  Matices movidos a <campo>Nota:");
	stats.notas.forEach((n) => console.log(`    ${n}`));
}

if (stats.avisos.length) {
	console.log("\n  AVISOS (sin tocar):");
	stats.avisos.forEach((a) => console.log(`    ${a}`));
}

if (DRY_RUN) {
	console.log("\n  --dry-run: no se escribió nada.");
	process.exit(0);
}

if (stats.convertidos === 0) {
	console.log("\n  Nada que convertir; el archivo ya está normalizado.");
	process.exit(0);
}

// El extractor de WordPress escribe con indentación de 4; se respeta.
const finDeLinea = crudo.endsWith("\n") ? "\n" : "";
fs.writeFileSync(FILE, JSON.stringify(data, null, 4) + finDeLinea, "utf8");
console.log(`\n  Escrito ${path.relative(process.cwd(), FILE)}`);
