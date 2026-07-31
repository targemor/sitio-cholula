import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

async function convertImagesToWebp(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await convertImagesToWebp(fullPath);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.avif'].includes(ext)) {
        const outputFilename = entry.name.replace(new RegExp(`\\${ext}$`, 'i'), '.webp');
        const outputPath = path.join(dir, outputFilename);

        try {
          // Check if webp exists and is up to date
          try {
            const srcStat = await fs.stat(fullPath);
            const outStat = await fs.stat(outputPath);
            if (outStat.mtime >= srcStat.mtime) {
              console.log(`Skipped (up to date): ${outputPath}`);
              continue;
            }
          } catch {
            // Webp doesn't exist, proceed with conversion
          }

          await sharp(fullPath)
            .webp({ quality: 80 })
            .toFile(outputPath);
          console.log(`Converted: ${fullPath} -> ${outputPath}`);
        } catch (error) {
          console.error(`Error converting ${fullPath}:`, error);
        }
      }
    }
  }
}

// Sync updated images from "Fotos itinerarios cholula" to active site directories
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

  console.log('Syncing matching updated images...');
  for (const { src, dest } of syncMap) {
    const srcPath = path.join(publicDir, src);
    const destPath = path.join(publicDir, dest);
    try {
      await fs.access(srcPath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(srcPath, destPath);
      console.log(`Synced updated image: ${src} -> ${dest}`);
    } catch (err) {
      console.warn(`Could not sync ${src} to ${dest}:`, err.message);
    }
  }
}

async function run() {
  console.log(`Starting conversion in: ${publicDir}`);
  await convertImagesToWebp(publicDir);
  await syncUpdatedImages();
  console.log('Conversion and sync complete!');
}

run();
