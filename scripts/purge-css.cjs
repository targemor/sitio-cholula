#!/usr/bin/env node
/**
 * Postbuild: elimina el CSS sin usar del bundle generado por Astro.
 *
 * `src/styles/global-opt.css` es un volcado del tema WordPress/Elementor
 * original (~544 KB) del cual el sitio en Astro solo usa ~1 %. Ese CSS es
 * render-blocking y era el principal cuello de botella de FCP/LCP.
 *
 * PurgeCSS escanea el HTML y el JS ya construidos (incluye las clases que
 * añaden en runtime React y Swiper) y reescribe cada .css del dist dejando
 * solo lo que realmente se usa. Se mantienen intactas las variables CSS,
 * @font-face y @keyframes (defaults de PurgeCSS).
 */
const fs = require("fs");
const path = require("path");
const { PurgeCSS } = require("purgecss");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SRC = path.join(ROOT, "src");

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, exts, out);
    // PurgeCSS resuelve `content`/`css` como globs: en Windows las rutas con
    // backslash rompen el matcher, así que normalizamos a "/".
    else if (exts.some((e) => entry.name.endsWith(e)))
      out.push(p.split(path.sep).join("/"));
  }
  return out;
}

(async () => {
  if (!fs.existsSync(DIST)) {
    console.error("[purge-css] no existe dist/, corre astro build primero");
    process.exit(1);
  }

  const cssFiles = walk(DIST, [".css"]);
  // Escaneamos el HTML final + los componentes fuente (nombres de clase
  // reales, incluidas las condicionales tipo `className={open ? ...}`).
  // Evitamos los bundles .js minificados: sus tokens generan falsos
  // positivos que impedirían purgar el CSS del tema WordPress.
  const content = [
    ...walk(DIST, [".html"]),
    ...walk(SRC, [".astro", ".tsx", ".jsx", ".ts"]),
  ];
  if (cssFiles.length === 0) {
    console.log("[purge-css] no hay archivos .css que purgar");
    return;
  }

  let before = 0;
  let after = 0;

  const results = await new PurgeCSS().purge({
    content,
    css: cssFiles,
    // Clases que se generan/togglean en runtime y podrían no aparecer
    // literalmente en el HTML/JS estático.
    safelist: {
      // Swiper añade sus clases (swiper-slide-active, swiper-button-disabled,
      // swiper-pagination-bullet-active, etc.) en runtime.
      greedy: [/^swiper/],
      standard: [
        "active",
        "open",
        "show",
        "visible",
        "hidden",
        "loaded",
        "sticky",
        "scrolled",
        "is-active",
        "is-open",
      ],
    },
  });

  for (const res of results) {
    if (!res.file) continue;
    before += fs.statSync(res.file).size;
    fs.writeFileSync(res.file, res.css);
    after += Buffer.byteLength(res.css);
  }

  const kb = (n) => (n / 1024).toFixed(1);
  console.log(
    `[purge-css] ${cssFiles.length} archivo(s) CSS: ${kb(before)} KB -> ${kb(after)} KB ` +
      `(ahorro ${kb(before - after)} KB)`,
  );
})().catch((err) => {
  console.error("[purge-css] error:", err);
  process.exit(1);
});
