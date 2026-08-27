/**
 * Extrae todos los datos de WordPress via REST API y guarda cholula_copy.json.
 *
 * Uso:
 *   node extract-wp-data.js
 *   node extract-wp-data.js --url http://localhost:8000   (override WP base URL)
 *   node extract-wp-data.js --out ./mi-salida.json
 *   node extract-wp-data.js --token <secreto>             (token del endpoint)
 *
 * El endpoint exige autenticación. El token sale de --token o de la variable de
 * entorno CHOLULA_EXPORT_SECRET, y viaja en el header Authorization: Bearer.
 * NO se guarda en el repo: este archivo está versionado.
 *
 *   PowerShell:  $env:CHOLULA_EXPORT_SECRET = "..."; node scripts/extract-wp-data.cjs
 *   bash:        CHOLULA_EXPORT_SECRET=... node scripts/extract-wp-data.cjs
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https= require('https');

// ── Config ────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const getArg  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const WP_BASE   = getArg('--url') || 'http://localhost:8000';
const OUT_FILE  = getArg('--out') || path.join(__dirname, '..', 'src', 'data', 'cholula.json');
const AUTH_TOKEN = getArg('--token') || process.env.CHOLULA_EXPORT_SECRET || process.env.EXPORT_TOKEN || null;

const ENDPOINT  = `${WP_BASE}/wp-json/cholula/v1/export`;

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchJSON(url, token) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = client.get(url, { headers }, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => errBody += chunk);
        res.on('end', () => {
          reject(new Error(`HTTP ${res.statusCode} (${res.statusMessage || 'Error'}) en ${url}\nRespuesta de WP:\n${errBody.slice(0, 500)}`));
        });
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        const clean = raw.trim().replace(/^\uFEFF/, '');
        try { resolve(JSON.parse(clean)); }
        catch (e) { reject(new Error(`JSON inválido: ${e.message}\n${clean.slice(0, 200)}`)); }
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

// ── Imágenes ──────────────────────────────────────────────────────────────────

/** Buckets cuyos items son objetos con galería. `eventos` NO va aquí: es plano. */
const PST_BUCKETS = ['hoteles', 'restaurantes', 'queHacer', 'guiasTuristicos'];

/** URL de WP -> ruta relativa dentro de uploads. Fuera de uploads, solo el nombre. */
function rutaRelativa(url) {
  const p = decodeURIComponent(new URL(url).pathname);
  return p.includes('/wp-content/uploads/')
    ? p.split('/wp-content/uploads/')[1]
    : path.basename(p);
}

function descargar(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => fs.unlink(filepath, () => reject(err)));
    }).on('error', reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nExtrayendo datos desde:\n  ${ENDPOINT}\n`);

  let data;
  try {
    data = await fetchJSON(ENDPOINT, AUTH_TOKEN);
  } catch (err) {
    console.error('❌ Error al conectar con WordPress:', err.message);
    if (/HTTP 40[13]/.test(err.message)) {
      console.error('\nEl endpoint rechazó las credenciales.');
      console.error(AUTH_TOKEN
        ? '  • Se envió un token, pero no coincide con CHOLULA_EXPORT_SECRET del servidor.'
        : '  • No se envió ningún token. Usa --token <secreto> o exporta CHOLULA_EXPORT_SECRET.');
      console.error('  • El servidor debe tener definida la constante CHOLULA_EXPORT_SECRET en wp-config.php.');
    } else {
      console.error('\nVerifica que:');
      console.error('  • El contenedor Docker está corriendo (docker ps)');
      console.error(`  • WordPress responde en ${WP_BASE}`);
      console.error('  • El plugin cholula-headless está activo');
    }
    process.exit(1);
  }

  // Estadísticas
  const counts = {
    hoteles:          (data.hoteles          || []).length,
    restaurantes:     (data.restaurantes     || []).length,
    queHacer:         (data.queHacer         || []).length,
    guiasTuristicos:  (data.guiasTuristicos  || []).length,
    eventos:          (data.eventos          || []).length,
  };

  console.log('Registros recibidos:');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`  TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)}\n`);

  // Enriquecer horarios con resumen y detalle
  for (const bucket of PST_BUCKETS) {
    if (data[bucket]) data[bucket] = data[bucket].map(enrichHorario);
  }

  // ── Descarga de imágenes ────────────────────────────────────────────────────
  //
  // Dos destinos distintos, a proposito:
  //   PST     -> public/images/<ruta en uploads>   ->  /images/...
  //   eventos -> public/eventos/<nombre de archivo> ->  /eventos/...
  //
  // Los eventos van aparte porque el sitio los sirve desde /eventos (asi estan
  // en home.json, que es lo que pinta el carrusel del home) y porque el bucket
  // es un arreglo plano de URLs, no de objetos con galeria.

  const PUBLIC_DIR  = path.join(__dirname, '..', 'public');
  const IMAGES_DIR  = path.join(PUBLIC_DIR, 'images');
  const EVENTOS_DIR = path.join(PUBLIC_DIR, 'eventos');

  const nPst = PST_BUCKETS
    .flatMap(b => data[b] || [])
    .reduce((n, item) => n + ((item.imagenes || item.galeria)?.length || 0), 0);
  const nEventos  = (data.eventos || []).length;
  const totalImgs = nPst + nEventos;

  console.log(`   (${totalImgs} URLs de imágenes: ${nPst} de PST, ${nEventos} de eventos)`);

  let count  = 0;
  let errors = 0;

  /**
   * Baja `url` si no esta ya en disco y devuelve la ruta publica con la que se
   * sustituye en el JSON. Con `aplanar`, ignora la jerarquia de uploads y deja
   * el archivo suelto en `destDir`.
   */
  async function bajar(url, destDir, prefijo, aplanar) {
    const rel      = aplanar ? path.basename(rutaRelativa(url)) : rutaRelativa(url);
    const filepath = path.join(destDir, ...rel.split('/'));

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    if (!fs.existsSync(filepath)) await descargar(url, filepath);

    count++;
    process.stdout.write(`\rProcesada ${count}/${totalImgs}`);
    return `${prefijo}/${rel}`;
  }

  if (totalImgs > 0) {
    console.log('\nDescargando imágenes...');

    for (const bucket of PST_BUCKETS) {
      for (const item of data[bucket] || []) {
        const arrKey = item.imagenes ? 'imagenes' : (item.galeria ? 'galeria' : null);
        if (!arrKey || !item[arrKey].length) continue;

        const nuevas = [];
        for (const url of item[arrKey]) {
          try {
            nuevas.push(await bajar(url, IMAGES_DIR, '/images', false));
          } catch (e) {
            errors++;
            console.error(`\n❌ Error al descargar ${url}: ${e.message}`);
            nuevas.push(url); // Mantiene la URL original en caso de error
          }
        }
        item[arrKey] = nuevas;
      }
    }

    if (nEventos) {
      // Al aplanar se pierde la carpeta de uploads, asi que dos archivos con el
      // mismo nombre en carpetas distintas se pisarian. Se avisa en vez de
      // sobrescribir en silencio.
      const vistos = new Map();
      const nuevas = [];

      for (const url of data.eventos) {
        try {
          const nombre = path.basename(rutaRelativa(url));
          if (vistos.has(nombre) && vistos.get(nombre) !== url) {
            console.warn(`\n⚠  "${nombre}" viene de dos URLs distintas; se conserva la primera:\n     ${vistos.get(nombre)}\n     ${url}`);
          } else {
            vistos.set(nombre, url);
          }
          nuevas.push(await bajar(url, EVENTOS_DIR, '/eventos', true));
        } catch (e) {
          errors++;
          console.error(`\n❌ Error al descargar ${url}: ${e.message}`);
          nuevas.push(url);
        }
      }
      data.eventos = nuevas;
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
