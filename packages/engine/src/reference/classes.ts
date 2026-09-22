/**
 * Accuracy class table (§6.3).
 *
 * Where `perIS` is false the value is a Meltek in-house figure, NOT a statutory one.
 * The admin UI must render the note next to the value so a future engineer does not
 * assume otherwise (§5.4).
 */

export interface SeedClass {
  code: string;
  percent: number;
  perIS: boolean;
  note: string;
}

export const CLASSES: readonly SeedClass[] = [
  { code: '0.1',  percent: 0.1,   perIS: true,  note: '' },
  { code: '0.2',  percent: 0.2,   perIS: true,  note: '' },
  { code: '0.5',  percent: 0.5,   perIS: true,  note: '' },
  { code: '1.0',  percent: 1.0,   perIS: true,  note: '' },
  { code: '3.0',  percent: 3.0,   perIS: true,  note: '' },
  { code: '0.2S', percent: 0.133, perIS: false, note: 'In-house error budget. IS does not publish an ampere-turn figure for this class.' },
  { code: '0.5S', percent: 0.33,  perIS: false, note: 'In-house error budget. IS does not publish an ampere-turn figure for this class.' },
];
