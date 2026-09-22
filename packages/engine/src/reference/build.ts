import type { ReferenceData, SteelGrade, WireGauge, AccuracyClass, BhPoint } from '../types.js';
import { GRADES, TESLA, UNCHARACTERISED_GRADES } from './curves.js';
import { SWG_TABLE } from './swg.js';
import { CLASSES } from './classes.js';

/** §6.4 — all rates carry an effectiveFrom date in the database and are snapshotted on approval. */
export const COPPER_RATE_PER_KG = 1410;

export function buildCurve(h: readonly (number | null)[]): BhPoint[] {
  return TESLA.map((teslaT, i) => ({ teslaT, hAtCm: h[i] ?? null }));
}

/**
 * Seed reference data, exactly as supplied in §6. Used to seed the database and to
 * drive the engine test vectors. The engine never imports this implicitly — callers
 * pass reference data in (§3.2).
 */
export function seedReferenceData(): ReferenceData {
  const grades: SteelGrade[] = GRADES.map((g) => ({
    code: g.code,
    label: g.label,
    note: g.note ?? null,
    ratePerKg: g.ratePerKg,
    densityGCm3: null,
    stackingFactor: null,
    isAvailable: true,
    curve: buildCurve(g.h),
  }));

  // Named in the client's brief, no curve data exists. Seeded unavailable so they are
  // visible in admin and can be characterised through the UI without a schema change.
  for (const u of UNCHARACTERISED_GRADES) {
    grades.push({
      code: u.code,
      label: u.label,
      note: 'No B-H curve on record. Add the curve before this grade can be used in a calculation.',
      ratePerKg: null,
      densityGCm3: null,
      stackingFactor: null,
      isAvailable: false,
      curve: [],
    });
  }

  const gauges: WireGauge[] = SWG_TABLE.map((w) => ({
    swg: w.swg,
    diaMm: w.diaMm,
    areaSqmm: w.areaSqmm,
    ohmPerM20c: w.ohmPerM,
    ohmPerM75c: null, // §12.10 — data does not exist yet
    gramPerM: w.gramPerM,
    isAvailable: true,
  }));

  const classes: AccuracyClass[] = CLASSES.map((c) => ({
    code: c.code,
    percent: c.percent,
    perIS: c.perIS,
    note: c.note,
    maxFluxDensityT: null,
  }));

  return {
    grades,
    gauges,
    classes,
    dies: [], // §12.8 — die register not supplied; manufacturability checks stay disabled
    slitWidthsMm: [], // §12.7 — falls back to settings.slitStepMm
    copperRatePerKg: COPPER_RATE_PER_KG,
  };
}
