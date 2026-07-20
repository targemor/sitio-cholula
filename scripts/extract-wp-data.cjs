/**
 * Extrae todos los datos de WordPress via REST API y guarda cholula_copy.json.
 *
 * Uso:
 *   node extract-wp-data.js
 *   node extract-wp-data.js --url http://localhost:8000   (override WP base URL)
 *   node extract-wp-data.js --out ./mi-salida.json
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https= require('https');

// ── Config ────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const getArg  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const WP_BASE = getArg('--url') || 'http://localhost:8000';
const OUT_FILE = getArg('--out') || path.join(__dirname, '..', 'src', 'data', 'cholula.json');

const ENDPOINT = `${WP_BASE}/wp-json/cholula/v1/export`;

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} en ${url}`));
        res.resume();
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error(`JSON inválido: ${e.message}\n${raw.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Timeout (30s)')); });
  });
}

// ── Horario helpers ───────────────────────────────────────────────────────────

const DIAS_LABEL = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};
const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_FULL  = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

function buildHorarioResumen(horario) {
  if (!horario || typeof horario !== 'object') return null;

  // Agrupar días consecutivos con el mismo horario
  const grupos = [];
  let i = 0;
  while (i < DIAS_ORDEN.length) {
    const dia   = DIAS_ORDEN[i];
    const valor = horario[dia];
    if (!valor) { i++; continue; }

    let j = i + 1;
    while (j < DIAS_ORDEN.length && horario[DIAS_ORDEN[j]] === valor) j++;

    const inicio = DIAS_LABEL[DIAS_ORDEN[i]];
    const fin    = DIAS_LABEL[DIAS_ORDEN[j - 1]];
    const rango  = j - i > 1 ? `${inicio}-${fin}` : inicio;
    grupos.push(valor.toLowerCase() === 'cerrado' ? `${rango} cerrado` : `${rango} ${valor}`);
    i = j;
  }

  return grupos.length ? grupos.join(' · ') : null;
}

function buildHorarioDetalle(horario) {
  if (!horario || typeof horario !== 'object') return null;

  const lines = DIAS_ORDEN
    .filter(d => horario[d])
    .map(d => `${DIAS_FULL[d]}: ${horario[d]}`);
  return lines.length ? lines.join(' • ') : null;
}

function enrichHorario(item) {
  if (!item.horario) return item;
  return {
    ...item,
    horario: {
      ...item.horario,
      resumen: buildHorarioResumen(item.horario),
      detalle: buildHorarioDetalle(item.horario),
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nExtrayendo datos desde:\n  ${ENDPOINT}\n`);

  let data;
  try {
    data = await fetchJSON(ENDPOINT);
  } catch (err) {
    console.error('❌ Error al conectar con WordPress:', err.message);
    console.error('\nVerifica que:');
    console.error('  • El contenedor Docker está corriendo (docker ps)');
    console.error(`  • WordPress responde en ${WP_BASE}`);
    console.error('  • El plugin cholula-headless está activo');
    process.exit(1);
  }

  // Estadísticas
  const counts = {
    hoteles:          (data.hoteles          || []).length,
    restaurantes:     (data.restaurantes     || []).length,
    queHacer:         (data.queHacer         || []).length,
    guiasTuristicos:  (data.guiasTuristicos  || []).length,
  };

  console.log('Registros recibidos:');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`  TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)}\n`);

  // Enriquecer horarios con resumen y detalle
  for (const bucket of ['hoteles', 'restaurantes', 'queHacer', 'guiasTuristicos']) {
    if (data[bucket]) data[bucket] = data[bucket].map(enrichHorario);
  }

  // Resumen de imágenes
  const totalImgs = [...(data.hoteles||[]), ...(data.restaurantes||[]),
                     ...(data.queHacer||[]), ...(data.guiasTuristicos||[])]
    .reduce((n, item) => n + ((item.imagenes || item.galeria)?.length || 0), 0);
  console.log(`   (${totalImgs} URLs de imágenes en total)`);

  // Descargar imágenes y reemplazar URLs
  const PUBLIC_DIR = path.join(__dirname, '..', 'public');
  const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');

  if (totalImgs > 0) {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('\nDescargando imágenes a la carpeta public/images...');
    let count = 0;
    let errors = 0;

    for (const bucket of ['hoteles', 'restaurantes', 'queHacer', 'guiasTuristicos']) {
      if (!data[bucket]) continue;
      for (const item of data[bucket]) {
        const arrKey = item.imagenes ? 'imagenes' : (item.galeria ? 'galeria' : null);
        if (!arrKey || !item[arrKey].length) continue;
        const newImages = [];
        for (const url of item[arrKey]) {
          try {
            const urlObj = new URL(url);
            let relativePath = decodeURIComponent(urlObj.pathname);
            if (relativePath.includes('/wp-content/uploads/')) {
              relativePath = relativePath.split('/wp-content/uploads/')[1];
            } else {
              relativePath = path.basename(relativePath);
            }
            const filepath = path.join(IMAGES_DIR, ...relativePath.split('/'));
            const fileDir = path.dirname(filepath);
            
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            
            if (!fs.existsSync(filepath)) {
              await new Promise((resolve, reject) => {
                const client = url.startsWith('https') ? https : http;
                client.get(url, (res) => {
                  if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    res.resume();
                    return;
                  }
                  const file = fs.createWriteStream(filepath);
                  res.pipe(file);
                  file.on('finish', () => {
                    file.close();
                    resolve();
                  });
                  file.on('error', (err) => {
                    fs.unlink(filepath, () => reject(err));
                  });
                }).on('error', reject);
              });
            }
            newImages.push(`/images/${relativePath}`);
            count++;
            process.stdout.write(`\rProcesada ${count}/${totalImgs}`);
          } catch (e) {
            errors++;
            console.error(`\n❌ Error al descargar imagen ${url}:`, e.message);
            newImages.push(url); // Mantiene URL original en caso de error
          }
        }
        item[arrKey] = newImages;
      }
    }
    console.log(`\n✅ ${count} imágenes procesadas (${errors} errores).`);
  }

  // Guardar JSON
  const outDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 4), 'utf8');
  console.log(`\n✅ JSON guardado en: ${OUT_FILE}`);
}

main();
