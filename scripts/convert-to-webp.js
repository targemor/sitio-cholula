import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

// Argumentos CLI
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

// Extensiones soportadas
const RASTER_EXTS = ['.png', '.jpg', '.jpeg', '.avif', '.webp'];
const PRESERVED_FILES = new Set(['favicon.png', 'favicon-48.png', 'favicon.ico', 'favicon.webp', 'favicon-48.webp']);

// Variantes responsivas solicitadas para CloudFront / <picture>
const RESPONSIVE_WIDTHS = [400, 800, 1200];
const RESPONSIVE_VARIANT_REGEX = /-(400|800|1200)w\.webp$/i;

/**
 * REGLAS DE DIMENSIONES POR COMPONENTE:
 * Cada regla define las dimensiones máximas (maxWidth, maxHeight) y calidad WebP
 * calculadas para ajustarse exactamente al diseño y medidas de los componentes:
 *
 * 1. Logos específicos: Header/Footer renderiza México a 65x24px -> máx 320x120 (4x retina).
 * 2. Visítanos: Grid 2 columnas (ancho ~680px), altura 230px desktop / 190px móvil -> máx 900x600.
 * 3. Imperdibles: Carousel split (~800px) + modal lightbox (max 90vw x 80vh) -> máx 1440x1080.
 * 4. Itinerarios: Hero banner en timeline (1280px x 240px) -> máx 1440x720.
 * 5. Eventos: Card 300px alto + modal max 900px ancho -> máx 1200x900.
 * 6. Business Cards: Grid 3 columnas (~470px ancho x 560px alto) -> máx 1080x1080 (2x retina).
 * 7. General: Límite de seguridad para evitar subida de fotos crudas de cámara (4K-6K) -> máx 1440x1080.
 */
const COMPONENT_RULES = [
  {
    name: 'Logo México (Header/Footer: 65x24px)',
    match: (rel) => /mexico\.webp$/i.test(rel),
    maxWidth: 160,
    maxHeight: 60,
    quality: 86,
  },
  {
    name: 'Logo Puebla (Header: 75x24px)',
    match: (rel) => /logo_puebla/i.test(rel),
    maxWidth: 180,
    maxHeight: 60,
    quality: 86,
  },
  {
    name: 'Logo Cholula & Pueblo Mágico (Header: 56x48px)',
    match: (rel) => /logo_cholula|cholula_pueblo_magico/i.test(rel),
    maxWidth: 140,
    maxHeight: 120,
    quality: 86,
  },
  {
    name: 'Logo Cholula lo tiene todo (Header: 92x92px)',
    match: (rel) => /cholula.*logo/i.test(rel),
    maxWidth: 160,
    maxHeight: 160,
    quality: 86,
  },
  {
    name: 'Logo Guía Cholula',
    match: (rel) => /logo_guia/i.test(rel),
    maxWidth: 600,
    maxHeight: 200,
    quality: 85,
  },
  {
    name: 'Croquis móvil (Home)',
    match: (rel) => /CROQUIS_MOVIL/i.test(rel),
    maxWidth: 800,
    maxHeight: 1400,
    quality: 84,
  },
  {
    name: 'Hero / Fondo Bienvenido',
    match: (rel) => /hero-poster|piramide_mamona/i.test(rel),
    maxWidth: 1600,
    maxHeight: 900,
    quality: 84,
  },
  {
    name: 'Visítanos Cards (Home: ~680x230px)',
    match: (rel) => /home[\\/]visitanos/i.test(rel),
    maxWidth: 960,
    maxHeight: 600,
    quality: 84,
  },
  {
    name: 'Imperdibles Carousel & Modal (Lightbox)',
    match: (rel) =>
      /home[\\/]imperdibles|IMPERDIBLES/i.test(rel) ||
      /home[\\/](CERRO-ZAPOTECAS|CONVENTO-DE-SAN-GABRIEL|COSME-DEL-RAZO|IGLESIA-|PARQUE-SORIA|PARROQUIA-|PORTAL-GUERRERO|SANTUARIO-|ZONA-ARQUE)/i.test(rel),
    maxWidth: 1440,
    maxHeight: 1080,
    quality: 84,
  },
  {
    name: 'Itinerarios Hero Banner (1280x240px)',
    match: (rel) => /itinerarios/i.test(rel) && !/Nuevos PST/i.test(rel),
    maxWidth: 1440,
    maxHeight: 720,
    quality: 84,
  },
  {
    name: 'Eventos (Cards & Modal)',
    match: (rel) => /eventos/i.test(rel),
    maxWidth: 1200,
    maxHeight: 900,
    quality: 84,
  },
  {
    name: 'Business Cards (Directorio 470x560px & Artesanías)',
    match: (rel) =>
      /images[\\/](hoteles|restaurantes|que-hacer|guias-turisticos|2025|2026)/i.test(rel) ||
      /home[\\/]artesanias/i.test(rel) ||
      /Nuevos PST pendientes/i.test(rel),
    maxWidth: 1080,
    maxHeight: 1080,
    quality: 84,
  },
  {
    name: 'General / Fallback',
    match: () => true,
    maxWidth: 1440,
    maxHeight: 1080,
    quality: 84,
  },
];

function getRuleForPath(relPath) {
  return COMPONENT_RULES.find((r) => r.match(relPath)) || COMPONENT_RULES[COMPONENT_RULES.length - 1];
}

const stats = {
  scanned: 0,
  converted: 0,
  resized: 0,
  variantsGenerated: 0,
  skipped: 0,
  errors: 0,
  originalBytes: 0,
  finalBytes: 0,
};

async function safeWriteFile(filePath, buffer) {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp.webp`;
  await fs.writeFile(tempPath, buffer);
  try {
    await fs.rename(tempPath, filePath);
  } catch (err) {
    if (err.code === 'EEXIST' || err.code === 'EPERM' || err.code === 'EBUSY') {
      try {
        await fs.unlink(filePath);
      } catch {}
      await fs.rename(tempPath, filePath);
    } else {
      throw err;
    }
  }
}

async function checkVariantsExist(dir, baseName) {
  for (const w of RESPONSIVE_WIDTHS) {
    const variantPath = path.join(dir, `${baseName}-${w}w.webp`);
    try {
      await fs.access(variantPath);
    } catch {
      return false;
    }
  }
  return true;
}

async function processImage(fullPath, relPath) {
  const ext = path.extname(fullPath).toLowerCase();
  const filename = path.basename(fullPath);

  // Omitir archivos preservados, temporales o variantes ya generadas
  if (PRESERVED_FILES.has(filename) || filename.includes('.tmp.') || RESPONSIVE_VARIANT_REGEX.test(filename)) {
    return;
  }

  stats.scanned++;
  const rule = getRuleForPath(relPath);
  const isWebp = ext === '.webp';
  const baseName = path.basename(fullPath, ext);
  const dir = path.dirname(fullPath);

  const allVariantsExist = await checkVariantsExist(dir, baseName);

  let inputBuffer;
  let meta;
  try {
    inputBuffer = await fs.readFile(fullPath);
    meta = await sharp(inputBuffer).metadata();
  } catch (err) {
    console.error(`  [ERROR] No se pudo leer ${relPath}: ${err.message}`);
    stats.errors++;
    return;
  }

  const origSize = inputBuffer.length;
  const origW = meta.width || 0;
  const origH = meta.height || 0;
  const exceedsDimensions = origW > rule.maxWidth || origH > rule.maxHeight;

  // Si ya es WebP, todas las 3 variantes existen, no excede dimensiones y no es force, omitir
  if (isWebp && allVariantsExist && !exceedsDimensions && !isForce) {
    stats.skipped++;
    stats.originalBytes += origSize;
    stats.finalBytes += origSize;
    return;
  }

  stats.originalBytes += origSize;

  try {
    // 1. Generar variantes responsivas: [nombre]-400w.webp, [nombre]-800w.webp, [nombre]-1200w.webp
    for (const w of RESPONSIVE_WIDTHS) {
      const variantPath = path.join(dir, `${baseName}-${w}w.webp`);

      // Si no es force y la variante individual ya existe, omitir re-cálculo de esa variante
      if (!isForce && allVariantsExist) {
        continue;
      }

      const variantBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: w,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: rule.quality,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer();

      if (!isDryRun) {
        await safeWriteFile(variantPath, variantBuffer);
      }
      stats.variantsGenerated++;
    }

    // 2. Gestionar la versión base [nombre].webp para compatibilidad retroactiva
    const baseWebpPath = path.join(dir, `${baseName}.webp`);
    let finalBaseSize = origSize;

    if (!isWebp) {
      const baseBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: rule.maxWidth,
          height: rule.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: rule.quality,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer();

      finalBaseSize = baseBuffer.length;
      if (!isDryRun) {
        await safeWriteFile(baseWebpPath, baseBuffer);
        if (fullPath !== baseWebpPath) {
          try {
            await fs.unlink(fullPath);
          } catch {}
        }
      }
      stats.converted++;
    } else if (exceedsDimensions || isForce) {
      const baseBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: rule.maxWidth,
          height: rule.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: rule.quality,
          effort: 4,
          smartSubsample: true,
        })
        .toBuffer();

      if (baseBuffer.length < origSize || exceedsDimensions) {
        finalBaseSize = baseBuffer.length;
        if (!isDryRun) {
          await safeWriteFile(baseWebpPath, baseBuffer);
        }
        stats.resized++;
      }
    }

    stats.finalBytes += finalBaseSize;

    const actionTag = !isWebp ? 'CONVERTIDO' : (exceedsDimensions ? 'REDIMENSIONADO' : 'RESPONSIVE');
    console.log(
      `✓ [${actionTag}] ${relPath} [${rule.name}]\n` +
      `   ${origW}x${origH} (${(origSize / 1024).toFixed(1)} KB) -> ` +
      `Variantes generadas: 400w, 800w, 1200w WebP`
    );
  } catch (err) {
    console.error(`  [ERROR] Falló optimización de ${relPath}: ${err.message}`);
    stats.errors++;
  }
}

async function walkDirectory(dir) {
  async function collectFiles(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      console.error(`Error leyendo directorio ${currentDir}:`, error);
      return [];
    }

    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(fullPath)));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (RASTER_EXTS.includes(ext) && !RESPONSIVE_VARIANT_REGEX.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    return files;
  }

  const allFiles = await collectFiles(dir);

  // Procesamiento concurrente controlado (6 en paralelo para aprovechar CPU)
  const CONCURRENCY = 6;
  let idx = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, allFiles.length) }, async () => {
    while (idx < allFiles.length) {
      const fullPath = allFiles[idx++];
      const relPath = path.relative(publicDir, fullPath).replace(/\\/g, '/');
      await processImage(fullPath, relPath);
    }
  });

  await Promise.all(workers);
}

// Sincronizar imágenes actualizadas desde "Fotos itinerarios cholula"
async function syncUpdatedImages() {
  const syncMap = [
    // Itinerarios
    { src: 'Fotos itinerarios cholula/no te puedes ir sin_.webp', dest: 'itinerarios/no te puedes ir sin_.webp' },
    { src: 'Fotos itinerarios cholula/solo tienes unas horas.webp', dest: 'itinerarios/solo tienes unas horas.webp' },
    { src: 'Fotos itinerarios cholula/te quedas el fin de semana.webp', dest: 'itinerarios/te quedas el fin de semana.webp' },
    { src: 'Fotos itinerarios cholula/tienes tres dias.webp', dest: 'itinerarios/tienes tres dias.webp' },
    // Imperdibles (home)
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/Cerro zapotecas Anabeli Arredondo.webp', dest: 'home/CERRO-ZAPOTECAS.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/convento de san gabriel y capilla real Anabeli arredondo.webp', dest: 'home/CONVENTO-DE-SAN-GABRIEL.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/Santa María xixitla Mike Santana.webp', dest: 'home/IGLESIA-DE-SANTA-MARIA-XIXITLA.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/iglesia De Santiago mixquitla - Mike Santana.webp', dest: 'home/IGLESIA-DE-SANTIAGO.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/parroquia de san pedro - Mike santana.webp', dest: 'home/PARROQUIA-DE-SAN-PEDRO.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/Portal Guerrero - Mike Santana.webp', dest: 'home/PORTAL-GUERRERO.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/Santuario de la virgen de los remedios - Mike Santana_.webp', dest: 'home/SANTUARIO-DE-LA-VIRGEN-DE-LOS-REMEDIOS.webp' },
    { src: 'Fotos itinerarios cholula/IMPERDIBLES SOLO FOTOS/Zona arqueológica Mike Santana_.webp', dest: 'home/ZONA-ARQUELÓGICA.webp' },
  ];

  console.log('\nSincronizando imágenes actualizadas...');
  for (const { src, dest } of syncMap) {
    const srcPath = path.join(publicDir, src);
    const destPath = path.join(publicDir, dest);
    try {
      await fs.access(srcPath);
      if (!isDryRun) {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
        console.log(`  ✓ Sincronizado: ${src} -> ${dest}`);
      } else {
        console.log(`  [DRY-RUN] Sincronizaría: ${src} -> ${dest}`);
      }
    } catch {
      // Si la fuente no existe, se omite silenciosamente
    }
  }
}

// Actualizar referencias en src/data/cholula.json si quedaron archivos .png/.jpg convertidos
async function updateJsonReferences() {
  const jsonPath = path.join(__dirname, '../src/data/cholula.json');
  try {
    const raw = await fs.readFile(jsonPath, 'utf-8');
    const updated = raw.replace(/\.(png|jpg|jpeg|avif)(?=")/gi, '.webp');
    if (updated !== raw) {
      if (!isDryRun) {
        await fs.writeFile(jsonPath, updated, 'utf-8');
      }
      console.log('\n✓ Referencias en cholula.json actualizadas automáticamente a .webp');
    }
  } catch {}
}

async function run() {
  const startTime = Date.now();
  console.log('='.repeat(70));
  console.log(`  OPTIMIZADOR DE ASSETS Y GENERACIÓN DE WEBP RESPONSIVO (400w, 800w, 1200w)`);
  if (isDryRun) console.log('  [MODO DRY-RUN ACTIVADO - No se modificarán archivos]');
  if (isForce) console.log('  [MODO FORCE ACTIVADO - Se re-procesarán todas las imágenes]');
  console.log(`  Directorio base: ${publicDir}`);
  console.log('='.repeat(70) + '\n');

  await syncUpdatedImages();
  await walkDirectory(publicDir);
  await updateJsonReferences();

  const totalSaved = stats.originalBytes - stats.finalBytes;
  const savedMB = (totalSaved / (1024 * 1024)).toFixed(2);
  const totalOrigMB = (stats.originalBytes / (1024 * 1024)).toFixed(2);
  const totalFinalMB = (stats.finalBytes / (1024 * 1024)).toFixed(2);
  const overallPct = stats.originalBytes > 0 ? ((totalSaved / stats.originalBytes) * 100).toFixed(1) : 0;
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('  RESUMEN DE OPTIMIZACIÓN');
  console.log('='.repeat(70));
  console.log(`  Total imágenes base analizadas:    ${stats.scanned}`);
  console.log(`  Variantes responsivas generadas:   ${stats.variantsGenerated}`);
  console.log(`  Convertidas a WebP:                ${stats.converted}`);
  console.log(`  Redimensionadas (ajuste tamaño):   ${stats.resized}`);
  console.log(`  Omitidas (ya optimizadas):         ${stats.skipped}`);
  console.log(`  Errores:                           ${stats.errors}`);
  console.log(`  Peso base original:                ${totalOrigMB} MB`);
  console.log(`  Peso base optimizado:              ${totalFinalMB} MB`);
  console.log(`  Ahorro peso base:                  ${savedMB} MB (-${overallPct}%)`);
  console.log(`  Tiempo de ejecución:               ${duration}s`);
  console.log('='.repeat(70) + '\n');
}

run();
