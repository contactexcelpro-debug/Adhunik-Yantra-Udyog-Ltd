/**
 * Seed / reset the reference data.
 *
 *   npm run seed            - create the store if absent, report what is in it
 *   npm run seed -- --force - reset reference data back to the §6 seed values
 *
 * Reference data lives in the database and is seeded from code, so an admin can add a
 * steel grade without a deploy (§3.2). This script is the initial load and the escape
 * hatch back to the shipped values.
 */
import { seedReferenceData } from '@meltek/engine';
import { createStore } from './store/index.js';

const force = process.argv.includes('--force');
const store = await createStore();

if (force) {
  const seed = seedReferenceData();
  for (const grade of seed.grades) await store.saveGrade(grade);
  for (const gauge of seed.gauges) await store.saveGauge(gauge);
  await store.saveCopperRate(seed.copperRatePerKg);
  console.log('Reference data reset to the values in §6 of the brief.');
}

const ref = await store.getReference();
const settings = await store.getSettingRows();
const unconfirmed = settings.filter((s) => !s.isConfirmed);

console.log(`store            ${store.kind}`);
console.log(`steel grades     ${ref.grades.length} (${ref.grades.filter((g) => g.curve.some((p) => p.hAtCm !== null)).length} characterised)`);
console.log(`wire gauges      ${ref.gauges.length}`);
console.log(`accuracy classes ${ref.classes.length}`);
console.log(`dies             ${ref.dies.length}${ref.dies.length === 0 ? '  (§12.8 - not supplied; manufacturability checks disabled)' : ''}`);
console.log(`slit widths      ${ref.slitWidthsMm.length}${ref.slitWidthsMm.length === 0 ? '  (§12.7 - not supplied; rounding to the nearest 5 mm)' : ''}`);
console.log(`copper rate      INR ${ref.copperRatePerKg}/kg`);
console.log(`unconfirmed      ${unconfirmed.length} process settings: ${unconfirmed.map((s) => s.key).join(', ')}`);

const noRate = ref.grades.filter((g) => g.ratePerKg === null && g.curve.some((p) => p.hAtCm !== null));
if (noRate.length) console.log(`no rate on record ${noRate.map((g) => g.code).join(', ')}  (§12.9)`);

await store.close();
