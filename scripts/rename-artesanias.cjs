const fs = require('fs');
const path = require('path');
const dir = './public/home/artesanias';
const webps = fs.readdirSync(dir).filter(f => f.endsWith('.webp')).sort();
webps.forEach((f, i) => {
  const newName = 'artesania-' + String(i+1).padStart(2,'0') + '.webp';
  fs.renameSync(path.join(dir, f), path.join(dir, newName));
  console.log(f + ' -> ' + newName);
});
