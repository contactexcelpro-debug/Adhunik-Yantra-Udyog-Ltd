/**
 * SWG table (§6.2) — the twelve rows supplied in the brief, verbatim.
 *
 * The brief asks for the full 1–50 range "from the workbook's Resistance sheet".
 * That sheet was not supplied, and ohm/m and gram/m are engineering values we are
 * forbidden to invent (rule 1). Only the verified rows are seeded. An admin can add
 * gauges through the UI. 12 gauges × 7 grades is the ~84-combination search space
 * the brief sizes in §5.10.
 *
 * `ohmPerM20c` is at 20 °C. `ohmPerM75c` is nullable and stays null until the client
 * supplies it (§12.10) — it is shown as missing, never computed as a guess.
 */

export interface SeedGauge {
  swg: number;
  diaMm: number;
  areaSqmm: number;
  ohmPerM: number;
  gramPerM: number;
}

export const SWG_TABLE: readonly SeedGauge[] = [
  { swg: 14, diaMm: 2.03,  areaSqmm: 3.236967, ohmPerM: 0.005326, gramPerM: 29.00322 },
  { swg: 15, diaMm: 1.83,  areaSqmm: 2.630561, ohmPerM: 0.006554, gramPerM: 23.56983 },
  { swg: 16, diaMm: 1.63,  areaSqmm: 2.086995, ohmPerM: 0.008261, gramPerM: 18.69947 },
  { swg: 17, diaMm: 1.42,  areaSqmm: 1.583882, ohmPerM: 0.010885, gramPerM: 14.19158 },
  { swg: 18, diaMm: 1.22,  areaSqmm: 1.169138, ohmPerM: 0.014746, gramPerM: 10.47548 },
  { swg: 19, diaMm: 1.02,  areaSqmm: 0.817234, ohmPerM: 0.021096, gramPerM:  7.32242 },
  { swg: 20, diaMm: 0.914, areaSqmm: 0.656204, ohmPerM: 0.026272, gramPerM:  5.87958 },
  { swg: 21, diaMm: 0.813, areaSqmm: 0.519191, ohmPerM: 0.033205, gramPerM:  4.65195 },
  { swg: 22, diaMm: 0.711, areaSqmm: 0.397087, ohmPerM: 0.043416, gramPerM:  3.55790 },
  { swg: 23, diaMm: 0.610, areaSqmm: 0.292285, ohmPerM: 0.058984, gramPerM:  2.61887 },
  { swg: 24, diaMm: 0.559, areaSqmm: 0.245454, ohmPerM: 0.070237, gramPerM:  2.19927 },
  { swg: 25, diaMm: 0.508, areaSqmm: 0.202709, ohmPerM: 0.085048, gramPerM:  1.81628 },
];
