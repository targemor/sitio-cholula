/**
 * merge-csv-guias-tours.cjs
 * Merges GuiasCertificados.csv → cholula.json[guiasTuristicos]
 * Merges TourOperadores_Pagina.csv → cholula.json[queHacer]
 * Rules:
 *  - Never removes existing keys from JSON entries.
 *  - Updates whatsapp, clasificacion/tipo, descripcion, idiomas from CSV when entry already exists.
 *  - Adds new entries not yet in JSON.
 *  - Scans public/images dirs to build galeria arrays for new entries.
 *  - Copies new images from Nuevos PST pendientes to canonical image paths.
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public');
const dataDir = path.resolve(__dirname, '../src/data');
const cholulaJsonPath = path.join(dataDir, 'cholula.json');
const csvBase = path.join(publicDir, 'Fotos itinerarios cholula/Nuevos PST pendientes');

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/\r/g, '');
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

function normalizeName(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function slugify(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanPhone(s) {
  return (s || '').replace(/\D/g, '');
}

function buildHorarioDefault() {
  return {
    lunes: '08:00-22:00', martes: '08:00-22:00', miercoles: '08:00-22:00',
    jueves: '08:00-22:00', viernes: '08:00-22:00', sabado: '08:00-22:00',
    domingo: '08:00-22:00',
    resumen: 'Lun-Dom 08:00-22:00',
    detalle: 'Lunes: 08:00-22:00 • Martes: 08:00-22:00 • Miércoles: 08:00-22:00 • Jueves: 08:00-22:00 • Viernes: 08:00-22:00 • Sábado: 08:00-22:00 • Domingo: 08:00-22:00'
  };
}

function getWebpImagesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.webp$/i.test(f))
    .map(f => path.join(dir, f));
}

function copyFileSafe(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`  Copied: ${path.relative(publicDir, src)} → ${path.relative(publicDir, dest)}`);
}

// ─── Guías Certificados ─────────────────────────────────────────────────────

function mergeGuias(data) {
  const csvPath = path.join(csvBase, 'GuiasCertificados.csv');
  const rows = parseCSV(csvPath);
  console.log(`\n[GUÍAS] CSV rows: ${rows.length}`);

  rows.forEach(row => {
    const nombre = row['nombre'];
    const slug = slugify(nombre);
    const normNombre = normalizeName(nombre);

    // Try to find existing entry
    const existingIdx = data.guiasTuristicos.findIndex(
      g => normalizeName(g.nombre) === normNombre
    );

    // Determine images: scan Nuevos PST pendientes for matching folder
    let galeriaFromNew = [];
    const imageDestDir = path.join(publicDir, 'images/guias-turisticos', slug);
    let imageSrcDir = null;

    // Match by name keyword in the Guías certificados subdirectories
    const guidasDir = path.join(csvBase, 'Guías certificados');
    if (fs.existsSync(guidasDir)) {
      const subDirs = fs.readdirSync(guidasDir)
        .filter(d => fs.statSync(path.join(guidasDir, d)).isDirectory());
      for (const sd of subDirs) {
        const normSD = normalizeName(sd);
        // Match: e.g. "alejandratoxqui" in "alejandratoxquiquitarlaimagenquehayahorayponerest"
        if (normSD.includes(normNombre.slice(0, 8)) || normNombre.includes(normSD.slice(0, 8))) {
          imageSrcDir = path.join(guidasDir, sd);
          break;
        }
      }
      // Also try: "ABY" for Abigail
      if (!imageSrcDir) {
        for (const sd of subDirs) {
          const normSD = normalizeName(sd);
          if (
            normNombre.slice(0,3) === normSD.slice(0,3) ||
            (normNombre.includes('abigail') && normSD.includes('aby'))
          ) {
            imageSrcDir = path.join(guidasDir, sd);
            break;
          }
        }
      }
    }

    if (imageSrcDir) {
      const webps = getWebpImagesFromDir(imageSrcDir);
      webps.forEach(src => {
        const destFile = path.join(imageDestDir, path.basename(src));
        copyFileSafe(src, destFile);
        galeriaFromNew.push(`/images/guias-turisticos/${slug}/${path.basename(src)}`);
      });
    }

    // Build social from CSV
    const social = {};
    if (row['facebook'] && row['facebook'].trim()) {
      let fb = row['facebook'].trim();
      if (!fb.startsWith('http')) fb = 'https://' + fb;
      social.facebook = fb;
    }
    if (row['instagram'] && row['instagram'].trim()) {
      let ig = row['instagram'].trim();
      if (!ig.startsWith('http')) ig = 'https://www.instagram.com/' + ig.replace(/^@/, '');
      social.instagram = ig;
    }

    const whatsapp = cleanPhone(row['whatsapp']);
    const clasificacion = row['clasificacion'] || 'Guía de Turistas General Acreditado NOM-08';
    const especializacion = row['especializacion'] || '';
    const idiomas = row['idiomas'] || '';

    if (existingIdx >= 0) {
      // MERGE: keep all existing keys, only update/add from CSV
      const existing = data.guiasTuristicos[existingIdx];
      console.log(`  [UPDATE] Guía: ${nombre}`);

      if (whatsapp) existing.whatsapp = whatsapp;
      if (Object.keys(social).length) {
        existing.social = { ...existing.social, ...social };
      }
      if (clasificacion) existing.clasificacionSectur = true;
      if (!existing.clasificacion) existing.clasificacion = clasificacion;
      if (especializacion && !existing.especializacion) existing.especializacion = especializacion;
      if (idiomas && !existing.idiomas) existing.idiomas = idiomas;
      // Update gallery with new images if found (prepend new ones, don't remove old)
      if (galeriaFromNew.length > 0) {
        const existing_gallery = existing.galeria || [];
        // Replace gallery entirely with new if we have new ones with same person
        existing.galeria = [...new Set([...galeriaFromNew, ...existing_gallery])];
      }
    } else {
      // NEW entry
      console.log(`  [NEW] Guía: ${nombre}`);
      const newEntry = {
        nombre,
        galeria: galeriaFromNew.length > 0 ? galeriaFromNew : [],
        clasificacion,
        especializacion,
        idiomas,
        certificacionSectur: true,
        social,
        horario: buildHorarioDefault(),
        whatsapp
      };
      data.guiasTuristicos.push(newEntry);
    }
  });
}

// ─── Tour Operadores ─────────────────────────────────────────────────────────

function mergeTourOperadores(data) {
  const csvPath = path.join(csvBase, 'TourOperadores_Pagina.csv');
  const rows = parseCSV(csvPath);
  console.log(`\n[TOURS] CSV rows: ${rows.length}`);

  rows.forEach(row => {
    const nombreCSV = row['nombre'];
    const normNombre = normalizeName(nombreCSV);
    const slug = slugify(nombreCSV);

    // Match name variations (e.g. "Cholula Free Walking Tour" vs "Tour Cholula Free Walk Tour")
    const existingIdx = data.queHacer.findIndex(q => {
      const n = normalizeName(q.nombre);
      return n === normNombre ||
        n.includes(normNombre.slice(0, 8)) ||
        normNombre.includes(n.slice(0, 8)) ||
        // Special alias: "tip tours" vs "TIP TOURS"
        (normNombre.includes('tip') && n.includes('tip')) ||
        (normNombre.includes('freewal') && n.includes('freewal')) ||
        (normNombre.includes('turibike') && n.includes('turibike')) ||
        (normNombre.includes('turiwheel') && n.includes('turiwheel')) ||
        (normNombre.includes('2rb') && n.includes('2rb')) ||
        (normNombre.includes('2ruedas') && n.includes('2ruedas')) ||
        (normNombre.includes('consentido') && n.includes('consentido')) ||
        (normNombre.includes('terraequus') && n.includes('terraequus'));
    });

    // Look for images in Nuevos PST pendientes (by directory name match)
    let galeriaFromNew = [];
    const imageDestDir = path.join(publicDir, 'images/que-hacer', slug);
    let imageSrcDir = null;

    const pstSubDirs = fs.readdirSync(csvBase)
      .filter(d => fs.statSync(path.join(csvBase, d)).isDirectory());

    for (const sd of pstSubDirs) {
      const normSD = normalizeName(sd);
      if (
        normSD.includes(normNombre.slice(0, 6)) ||
        normNombre.includes(normSD.slice(0, 6)) ||
        (normNombre.includes('terraequus') && normSD.includes('terraequus'))
      ) {
        imageSrcDir = path.join(csvBase, sd);
        break;
      }
    }

    if (imageSrcDir) {
      const webps = getWebpImagesFromDir(imageSrcDir);
      webps.forEach(src => {
        const destFile = path.join(imageDestDir, path.basename(src));
        copyFileSafe(src, destFile);
        galeriaFromNew.push(`/images/que-hacer/${slug}/${path.basename(src)}`);
      });
    }

    // Build social from CSV
    const social = {};
    if (row['facebook'] && row['facebook'].trim()) {
      let fb = row['facebook'].trim();
      if (!fb.startsWith('http') && !fb.startsWith('facebook')) {
        fb = 'https://www.facebook.com/' + fb.replace(/^@/, '');
      } else if (!fb.startsWith('http')) {
        fb = 'https://' + fb;
      }
      social.facebook = fb;
    }
    if (row['instagram'] && row['instagram'].trim()) {
      let ig = row['instagram'].trim();
      if (!ig.startsWith('http')) ig = 'https://www.instagram.com/' + ig.replace(/^@/, '');
      social.instagram = ig;
    }

    const whatsapp = cleanPhone(row['whatsapp']);
    const clasificacion = row['clasificacion'] || '';
    const descripcionCSV = row['descripcion_breve'] || '';
    const toursQueOfrece = row['tours_que_ofrece'] || '';
    const idiomas = row['idiomas'] || '';

    if (existingIdx >= 0) {
      const existing = data.queHacer[existingIdx];
      console.log(`  [UPDATE] Tour: ${existing.nombre} ← CSV: ${nombreCSV}`);

      if (whatsapp) existing.whatsapp = whatsapp;
      if (Object.keys(social).length) {
        existing.social = { ...existing.social, ...social };
      }
      if (clasificacion && !existing.clasificacion) existing.clasificacion = clasificacion;
      if (toursQueOfrece && !existing.toursQueOfrece) existing.toursQueOfrece = toursQueOfrece;
      if (idiomas && !existing.idiomas) existing.idiomas = idiomas;
      // Update gallery with new images (prepend)
      if (galeriaFromNew.length > 0) {
        const existingGallery = existing.galeria || [];
        existing.galeria = [...new Set([...galeriaFromNew, ...existingGallery])];
      }
    } else {
      // NEW entry
      console.log(`  [NEW] Tour: ${nombreCSV}`);
      // Build emoji description from CSV
      let emoji = '🗺️';
      if (clasificacion.toLowerCase().includes('biciclet')) emoji = '🚲';
      else if (clasificacion.toLowerCase().includes('carrit') || clasificacion.toLowerCase().includes('rueda')) emoji = '🚋';
      else if (clasificacion.toLowerCase().includes('pie') || clasificacion.toLowerCase().includes('walk')) emoji = '🚶';
      else if (clasificacion.toLowerCase().includes('equino') || clasificacion.toLowerCase().includes('caball')) emoji = '🐴';
      const descripcion = `${emoji} ${descripcionCSV}`;

      const newEntry = {
        nombre: nombreCSV,
        galeria: galeriaFromNew,
        tipo: clasificacion,
        descripcion,
        toursQueOfrece,
        idiomas,
        certificacionSectur: false,
        social,
        horario: buildHorarioDefault(),
        whatsapp
      };
      data.queHacer.push(newEntry);
    }
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const data = JSON.parse(fs.readFileSync(cholulaJsonPath, 'utf-8'));
  console.log('Loaded cholula.json');
  console.log(`  guiasTuristicos: ${data.guiasTuristicos.length}`);
  console.log(`  queHacer: ${data.queHacer.length}`);

  mergeGuias(data);
  mergeTourOperadores(data);

  fs.writeFileSync(cholulaJsonPath, JSON.stringify(data, null, 4), 'utf-8');
  console.log('\n✅ cholula.json updated successfully');
  console.log(`  guiasTuristicos: ${data.guiasTuristicos.length}`);
  console.log(`  queHacer: ${data.queHacer.length}`);
}

main();
