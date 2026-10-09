/**
 * Descarga Roboto (subsets latin + latin-ext) desde Google Fonts y lo deja
 * self-hosted en public/fonts + src/styles/fonts.css.
 *
 * Por qué: el CSS de Google Fonts añade un origen extra (DNS+TLS), una cadena
 * CSS -> woff2 y compite con el CSS crítico. Servido desde el mismo origen
 * (con preload) elimina esa cadena. Roboto v51 es una fuente variable: un solo
 * archivo por subset cubre todos los pesos.
 *
 * Uso: node scripts/self-host-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "fonts");
const CSS_OUT = path.join(ROOT, "src", "styles", "fonts.css");

const GOOGLE_CSS =
  "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SUBSETS = ["latin", "latin-ext"];

const css = await (await fetch(GOOGLE_CSS, { headers: { "User-Agent": UA } })).text();

// Cada bloque va precedido por /* subset */
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)].map(
  (m) => ({ subset: m[1], body: m[2] }),
);

fs.mkdirSync(OUT_DIR, { recursive: true });

const chosen = new Map(); // subset -> { url, range }
for (const b of blocks) {
  if (!SUBSETS.includes(b.subset)) continue;
  const url = b.body.match(/url\(([^)]+)\)/)?.[1];
  const range = b.body.match(/unicode-range:\s*([^;]+);/)?.[1];
  if (!url) continue;
  const prev = chosen.get(b.subset);
  if (prev && prev.url !== url) {
    console.warn(
      `[fonts] ${b.subset}: URL distinta entre pesos (${prev.url} vs ${url}); se usa la primera`,
    );
    continue;
  }
  chosen.set(b.subset, { url, range });
}

let out = `/* Generado por scripts/self-host-fonts.mjs — Roboto variable (300–900), self-hosted */\n`;
for (const [subset, { url, range }] of chosen) {
  const file = `roboto-${subset}.woff2`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(path.join(OUT_DIR, file), buf);
  console.log(`[fonts] ${file}: ${(buf.length / 1024).toFixed(1)} KB`);
  out += `@font-face {
  font-family: "Roboto";
  font-style: normal;
  font-weight: 300 900;
  font-stretch: 100%;
  font-display: swap;
  src: url("/fonts/${file}") format("woff2");
  unicode-range: ${range};
}
`;
}
fs.writeFileSync(CSS_OUT, out);
console.log(`[fonts] escrito ${path.relative(ROOT, CSS_OUT)}`);
