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
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        const outputFilename = entry.name.replace(new RegExp(`\\${ext}$`, 'i'), '.webp');
        const outputPath = path.join(dir, outputFilename);

        try {
          // Check if the webp file already exists to avoid redundant conversions
          try {
            await fs.access(outputPath);
            console.log(`Skipped (already exists): ${outputPath}`);
            continue; // Skip if it exists
          } catch {
            // File does not exist, proceed with conversion
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

async function run() {
  console.log(`Starting conversion in: ${publicDir}`);
  await convertImagesToWebp(publicDir);
  console.log('Conversion complete!');
}

run();
