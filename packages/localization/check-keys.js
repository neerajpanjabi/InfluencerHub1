// Fails if en.json and ar.json do not have identical key sets (no half-translated UI).
const en = require('./messages/en.json');
const ar = require('./messages/ar.json');
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const a = new Set(flat(en)), b = new Set(flat(ar));
const missingAr = [...a].filter((k) => !b.has(k)), missingEn = [...b].filter((k) => !a.has(k));
if (missingAr.length || missingEn.length) {
  console.error('Missing in ar:', missingAr, '\nMissing in en:', missingEn);
  process.exit(1);
}
console.log(`✔ ${a.size} keys present in both en and ar`);
