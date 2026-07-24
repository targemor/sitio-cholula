/**
 * merge-csv-to-json.cjs
 * Fusiona hoteles.csv y restaurantes.csv con cholula.json
 *  - Agrega campos faltantes (no quita keys existentes)
 *  - Detecta y reporta diferencias en contacto/redes
 *  - Actualiza teléfonos, whatsapp, social desde CSV si difieren
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, '..', 'src', 'data');
const JSON_FILE   = path.join(DATA_DIR, 'cholula.json');
const HOT_CSV     = path.join(DATA_DIR, 'hoteles.csv');
const REST_CSV    = path.join(DATA_DIR, 'restaurantes.csv');

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());

  // Skip first row (color legend), second row is headers
  const headers = splitCSVLine(lines[1]);
  const rows = [];

  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── Normalizar teléfono para comparar ─────────────────────────────────────────
function normPhone(p) {
  // Si hay múltiples teléfonos (ej: "222 247 1011 / 222 247 1012"), tomar el primero
  const first = (p || '').split(/[/\\|,]/)[0];
  return first.replace(/\D/g, '');
}

// ── Normalizar instagram para comparar ────────────────────────────────────────
function normIG(s) {
  return (s || '')
    .replace('https://www.instagram.com/', '')
    .replace('https://instagram.com/', '')
    .replace('@', '')
    .replace(/\/\?.*$/, '')   // quitar /?hl=es y similares
    .replace(/\/$/, '')
    .toLowerCase()
    .trim();
}

// ── Log de cambios ────────────────────────────────────────────────────────────
const diffs = [];
function log(tipo, nombre, campo, antes, despues) {
  diffs.push({ tipo, nombre, campo, antes, despues });
  const changed = antes !== despues;
  const prefix = changed ? '⚠️  DIFERENCIA' : '✅ igual';
  if (changed) {
    console.log(`  ${prefix} [${tipo}] "${nombre}" → ${campo}:`);
    console.log(`     CSV:  ${despues}`);
    console.log(`     JSON: ${antes}`);
  }
}

// ── HOTELES ───────────────────────────────────────────────────────────────────
function mergeHoteles(jsonHoteles, csvRows) {
  console.log('\n══════════════════════════════════════════');
  console.log('  HOTELES — Fusión y detección de cambios');
  console.log('══════════════════════════════════════════');

  const updated = jsonHoteles.map(hotel => {
    // Buscar por nombre aproximado (normalizado)
    const csvRow = csvRows.find(r => {
      const csvName = r.nombre.toLowerCase().trim();
      const jsonName = hotel.nombre.toLowerCase().trim();
      return csvName === jsonName ||
             csvName.includes(jsonName) ||
             jsonName.includes(csvName);
    });

    if (!csvRow) {
      console.log(`  ⚠️  Sin match en CSV: "${hotel.nombre}"`);
      return hotel;
    }

    console.log(`\n  📌 ${hotel.nombre}`);

    const merged = { ...hotel };

    // ── Campos nuevos a agregar ──
    const nuevos = {
      zona:                   csvRow.zona                  || undefined,
      distanciaGranPiramide:  csvRow.distancia_gran_piramide || undefined,
      categoriaPrecio:        csvRow.categoria_precio       || undefined,
      aceptaMascotas:         csvRow.acepta_mascotas        || undefined,
      tieneAlberca:           csvRow.tiene_alberca          || undefined,
      tieneSpa:               csvRow.tiene_spa              || undefined,
      terraza:                csvRow.terraza                || undefined,
      recepcion24h:           csvRow.recepcion_24h          || undefined,
      amenidades:             csvRow.amenidades             || undefined,
      precioNocheMxn:         csvRow.precio_noche_mxn       || undefined,
      tamanioCategoria:       csvRow['tamaño_categoria']    || undefined,
      perfilIdeal:            csvRow.perfil_ideal           || undefined,
    };

    for (const [key, val] of Object.entries(nuevos)) {
      if (val && !merged[key]) {
        merged[key] = val;
        console.log(`     ➕ Agregado: ${key} = "${val}"`);
      }
    }

    // ── Detectar y actualizar contacto ──
    // Teléfono
    const csvTel = normPhone(csvRow.telefono);
    const jsonTel = normPhone(merged.telefono);
    if (csvTel) {
      log('Hotel', hotel.nombre, 'telefono', jsonTel, csvTel);
      if (csvTel !== jsonTel) merged.telefono = csvTel;
    }

    // WhatsApp
    const csvWA = normPhone(csvRow.whatsapp);
    const jsonWA = normPhone(merged.whatsapp);
    if (csvWA) {
      log('Hotel', hotel.nombre, 'whatsapp', jsonWA, csvWA);
      if (csvWA !== jsonWA) merged.whatsapp = csvWA;
    }

    // Email
    const csvEmail = (csvRow.email || '').toLowerCase().trim();
    const jsonEmail = (merged.email || '').toLowerCase().trim();
    if (csvEmail) {
      log('Hotel', hotel.nombre, 'email', jsonEmail, csvEmail);
      if (csvEmail !== jsonEmail) merged.email = csvEmail;
    }

    // Sitio web
    const csvWeb = (csvRow.sitio_web || '').trim();
    const jsonWeb = (merged.sitioWeb || '').trim();
    if (csvWeb) {
      log('Hotel', hotel.nombre, 'sitioWeb', jsonWeb, csvWeb);
      // Solo actualizar si JSON está vacío o muy diferente
      if (!jsonWeb) merged.sitioWeb = csvWeb;
    }

    // Instagram
    const csvIG = normIG(csvRow.instagram);
    const jsonIG = normIG(merged.social?.instagram);
    if (csvIG) {
      log('Hotel', hotel.nombre, 'social.instagram', jsonIG, csvIG);
      if (csvIG !== jsonIG && csvIG) {
        if (!merged.social) merged.social = {};
        merged.social.instagram = `https://www.instagram.com/${csvIG}`;
      }
    }

    // Google Maps
    const csvMaps = (csvRow.maps || '').trim();
    const jsonMaps = (merged.googleMaps || '').trim();
    if (csvMaps && !jsonMaps) {
      merged.googleMaps = csvMaps;
      console.log(`     ➕ Agregado: googleMaps = "${csvMaps}"`);
    }

    return merged;
  });

  return updated;
}

// ── RESTAURANTES ──────────────────────────────────────────────────────────────
function mergeRestaurantes(jsonRests, csvRows) {
  console.log('\n══════════════════════════════════════════════');
  console.log('  RESTAURANTES — Fusión y detección de cambios');
  console.log('══════════════════════════════════════════════');

  const updated = jsonRests.map(rest => {
    const csvRow = csvRows.find(r => {
      const csvName = r.nombre.toLowerCase().trim();
      const jsonName = rest.nombre.toLowerCase().trim();
      return csvName === jsonName ||
             csvName.includes(jsonName) ||
             jsonName.includes(csvName);
    });

    if (!csvRow) {
      console.log(`  ⚠️  Sin match en CSV: "${rest.nombre}"`);
      return rest;
    }

    console.log(`\n  📌 ${rest.nombre}`);

    const merged = { ...rest };

    // ── Campos nuevos a agregar ──
    const nuevos = {
      categoriaPrecio:       csvRow.categoria_precio        || undefined,
      petFriendly:           csvRow.pet_friendly            || undefined,
      musicaEnVivo:          csvRow.musica_en_vivo          || undefined,
      precioPpMxn:           csvRow.precio_pp_mxn           || undefined,
      reservacionRecomendada: csvRow.reservacion_recomendada || undefined,
      ocasionIdeal:          csvRow.ocasion_ideal           || undefined,
      perfilIdeal:           csvRow.perfil_ideal            || undefined,
      etiquetasChatbot:      csvRow.etiquetas_chatbot       || undefined,
      espacioFisico:         csvRow.espacio_fisico          || undefined,
    };

    // idealPara — solo agregar si JSON no lo tiene
    if (csvRow.ocasion_ideal && !merged.idealPara) {
      merged.idealPara = csvRow.ocasion_ideal;
      console.log(`     ➕ Agregado: idealPara = "${csvRow.ocasion_ideal}"`);
    }

    for (const [key, val] of Object.entries(nuevos)) {
      if (val && merged[key] === undefined) {
        merged[key] = val;
        console.log(`     ➕ Agregado: ${key} = "${val}"`);
      }
    }

    // ── Detectar y actualizar contacto ──
    // Teléfono
    const csvTel = normPhone(csvRow.telefono);
    const jsonTel = normPhone(merged.telefono || merged.whatsapp);
    if (csvTel) {
      log('Restaurante', rest.nombre, 'telefono', normPhone(merged.telefono), csvTel);
      if (!merged.telefono && csvTel) merged.telefono = csvTel;
      else if (csvTel && normPhone(merged.telefono) !== csvTel) {
        merged.telefono = csvTel;
      }
    }

    // WhatsApp (en CSV hay solo 1 campo telefono, lo cruzamos con whatsapp del JSON)
    const jsonWA = normPhone(merged.whatsapp);
    if (csvTel && jsonWA && csvTel !== jsonWA) {
      log('Restaurante', rest.nombre, 'whatsapp', jsonWA, csvTel);
    }

    // Instagram
    const csvIG = normIG(csvRow.instagram);
    const jsonIG = normIG(merged.social?.instagram);
    if (csvIG) {
      log('Restaurante', rest.nombre, 'social.instagram', jsonIG, csvIG);
      if (csvIG !== jsonIG) {
        if (!merged.social) merged.social = {};
        merged.social.instagram = `https://www.instagram.com/${csvIG}`;
      }
    }

    // Google Maps
    const csvMaps = (csvRow.maps || '').trim();
    const jsonMaps = (merged.googleMaps || '').trim();
    if (csvMaps && !jsonMaps) {
      merged.googleMaps = csvMaps;
      console.log(`     ➕ Agregado: googleMaps = "${csvMaps}"`);
    }

    return merged;
  });

  return updated;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  const json = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const csvHoteles = parseCSV(HOT_CSV);
  const csvRestaurantes = parseCSV(REST_CSV);

  console.log(`\nHoteles en JSON: ${json.hoteles.length}`);
  console.log(`Hoteles en CSV:  ${csvHoteles.length}`);
  console.log(`Restaurantes en JSON: ${json.restaurantes.length}`);
  console.log(`Restaurantes en CSV:  ${csvRestaurantes.length}`);

  json.hoteles = mergeHoteles(json.hoteles, csvHoteles);
  json.restaurantes = mergeRestaurantes(json.restaurantes, csvRestaurantes);

  // Guardar
  fs.writeFileSync(JSON_FILE, JSON.stringify(json, null, 4), 'utf8');
  console.log(`\n\n✅ cholula.json actualizado.`);

  // Reporte de diferencias
  const changed = diffs.filter(d => d.antes !== d.despues);
  console.log(`\n📋 RESUMEN: ${changed.length} diferencias de contacto/redes encontradas y actualizadas:`);
  changed.forEach(d => {
    console.log(`   [${d.tipo}] "${d.nombre}" → ${d.campo}`);
    console.log(`     Antes (JSON): "${d.antes}"`);
    console.log(`     Ahora (CSV):  "${d.despues}"`);
  });

  if (changed.length === 0) {
    console.log('   (ninguna)');
  }
}

main();
