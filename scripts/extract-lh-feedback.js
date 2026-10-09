import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidatePaths = [
  path.resolve(__dirname, '../lighthouse-mobile.json'),
  path.resolve(__dirname, '../lighthouse-mobile.report.json'),
  path.resolve(__dirname, '../lighthouse-report.json'),
  path.resolve(__dirname, '../lighthouse-report.report.json'),
];

const target = candidatePaths.find((p) => fs.existsSync(p));

if (!target) {
  console.log('No se encontró archivo de reporte lighthouse JSON (lighthouse-mobile.json).');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(target, 'utf-8'));
const audits = data.audits;
const categories = data.categories;

console.log('='.repeat(70));
console.log(`  PUNTUACIÓN LIGHTHOUSE (MOBILE): ${Math.round(categories.performance.score * 100)} / 100`);
console.log('='.repeat(70));
console.log(`  FCP (First Contentful Paint):    ${audits['first-contentful-paint']?.displayValue}`);
console.log(`  LCP (Largest Contentful Paint):  ${audits['largest-contentful-paint']?.displayValue}`);
console.log(`  TBT (Total Blocking Time):       ${audits['total-blocking-time']?.displayValue}`);
console.log(`  CLS (Cumulative Layout Shift):   ${audits['cumulative-layout-shift']?.displayValue}`);
console.log(`  Speed Index:                     ${audits['speed-index']?.displayValue}`);

console.log('\n--- ELEMENTO LCP IDENTIFICADO ---');
if (audits['largest-contentful-paint-element']?.details?.items) {
  audits['largest-contentful-paint-element'].details.items.forEach((item) => {
    console.log(item.node?.snippet || item.node?.nodeLabel || item);
  });
}

console.log('\n--- PRINCIPALES OPORTUNIDADES DE MEJORA ---');
for (const [key, audit] of Object.entries(audits)) {
  if (audit.score !== null && audit.score < 0.9 && audit.details?.type === 'opportunity') {
    console.log(`\n🔴 ${audit.title} - ${audit.displayValue || ''}`);
    if (audit.details.items) {
      audit.details.items.slice(0, 5).forEach((item) => {
        const desc = item.url || item.node?.snippet || item.source || JSON.stringify(item).slice(0, 100);
        console.log(`   -> ${desc} (${item.wastedBytes ? Math.round(item.wastedBytes / 1024) + ' KB ahorrables' : ''} ${item.wastedMs ? item.wastedMs + ' ms' : ''})`);
      });
    }
  }
}

console.log('\n--- DIAGNÓSTICOS CLAVE ---');
for (const [key, audit] of Object.entries(audits)) {
  if (audit.score !== null && audit.score < 0.8 && audit.details?.type === 'table' && audit.details?.items?.length) {
    console.log(`\n⚠️  ${audit.title}`);
    audit.details.items.slice(0, 3).forEach((item) => {
      const desc = item.url || item.node?.snippet || item.source || JSON.stringify(item).slice(0, 120);
      console.log(`   -> ${desc}`);
    });
  }
}
console.log('\n' + '='.repeat(70));
