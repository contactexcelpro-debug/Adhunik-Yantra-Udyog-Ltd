/**
 * B–H curves — extracted verbatim from the client's workbook (§6.1).
 * `TESLA` is the shared index; each grade's `h` array is AT/cm at that flux density.
 * `null` = the grade is not characterised at that flux density (skip during interpolation).
 *
 * These ship as seed data. At runtime the system reads curves from the database so an
 * admin can add a grade without a deploy (§3.2).
 */

export const TESLA: readonly number[] = [
  0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1,
  0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1,
  1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95,
];

export interface SeedGrade {
  code: string;
  label: string;
  note?: string;
  /** null = UNCONFIRMED, ask the client (§12.9). */
  ratePerKg: number | null;
  h: readonly (number | null)[];
}

export const GRADES: readonly SeedGrade[] = [
  {
    code: 'M-4',
    label: 'M-4 Grade',
    ratePerKg: 170,
    h: [0.013, 0.017, 0.021, 0.023, 0.026, 0.030, 0.032, 0.035, 0.037, 0.041,
        0.057, 0.070, 0.086, 0.099, 0.111, 0.123, 0.132, 0.145, 0.160, 0.165,
        0.175, 0.201, 0.224, 0.252, 0.300, 0.351, 0.420, 0.483, 0.600, 0.942, null],
  },
  {
    code: '23-MOH',
    label: '23 MOH Grade',
    ratePerKg: 210,
    h: [0.0035, 0.0058, 0.0081, 0.010, 0.012, 0.015, 0.017, 0.018, 0.021, 0.023,
        0.041, 0.057, 0.070, 0.082, 0.093, 0.103, 0.112, 0.122, 0.131, 0.137,
        0.145, 0.155, 0.175, 0.193, 0.216, 0.259, 0.295, 0.397, 0.544, 1.220, null],
  },
  {
    code: 'LASER-SCRIBED',
    label: 'Laser Scribed (HPDR)',
    note: 'Suitable for metering cores',
    ratePerKg: 350,
    h: [0.003, 0.0043, 0.0058, 0.0071, 0.0086, 0.010, 0.011, 0.0117, 0.013, 0.014,
        0.026, 0.038, 0.048, 0.060, 0.066, 0.075, 0.083, 0.091, 0.100, 0.104,
        0.114, 0.122, 0.130, 0.140, 0.162, 0.185, 0.210, 0.260, 0.360, 0.790, null],
  },
  {
    code: '30-MOH',
    label: '30 MOH Grade',
    note: 'Suitable for P.S. class cores',
    ratePerKg: null, // No rate supplied for this grade yet - see §12.9 of the build brief
    h: [0.0038, 0.0061, 0.0076, 0.0094, 0.010, 0.012, 0.014, 0.015, 0.020, 0.022,
        0.039, 0.053, 0.064, 0.076, 0.086, 0.094, 0.104, 0.113, 0.122, 0.130,
        0.137, 0.147, 0.160, 0.173, 0.190, 0.210, 0.230, 0.262, 0.338, 0.620, 1.35],
  },
];

/**
 * Named in the client's brief but with no curve data in the workbook.
 * Seeded as unavailable placeholders so an admin can fill the curve in through
 * the UI without a schema change (§6.1).
 */
export const UNCHARACTERISED_GRADES: readonly { code: string; label: string }[] = [
  { code: 'M4-PRIME', label: 'M4-Prime' },
  { code: 'MOH-PRIME', label: 'MOH-Prime' },
  { code: 'HPDR-PRIME', label: 'HPDR-Prime' },
  { code: 'NANO', label: 'Nano' },
];
