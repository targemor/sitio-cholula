const fs = require('fs');
const path = require('path');
const publicDir = path.resolve(__dirname, '../public');

const allowedNonWebp = ['favicon.png', 'favicon-48.png', 'favicon.ico'];

function removeNonWebp(dir) {
  let deletedCount = 0;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      deletedCount += removeNonWebp(fullPath);
    } else {
      const ext = path.extname(file).toLowerCase();
      const relativeName = path.relative(publicDir, fullPath).replace(/\\/g, '/');
      
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.avif'].includes(ext)) {
        if (allowedNonWebp.includes(file)) {
          console.log('Preserved favicon:', relativeName);
        } else {
          fs.unlinkSync(fullPath);
          console.log('Deleted non-webp image:', relativeName);
          deletedCount++;
        }
      }
    }
  });
  return deletedCount;
}

// Update cholula.json references to .webp
const jsonPath = path.resolve(__dirname, '../src/data/cholula.json');
if (fs.existsSync(jsonPath)) {
  let jsonStr = fs.readFileSync(jsonPath, 'utf-8');
  const updatedJson = jsonStr.replace(/\.(png|jpg|jpeg|avif|bmp|tiff)(?=")/gi, '.webp');
  if (updatedJson !== jsonStr) {
    fs.writeFileSync(jsonPath, updatedJson, 'utf-8');
    console.log('Updated cholula.json image references to .webp');
  }
}

const count = removeNonWebp(publicDir);
console.log(`\nCleaned up ${count} non-webp image file(s).`);
