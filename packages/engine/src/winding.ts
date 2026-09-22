import { MissingReferenceData } from './types.js';

/**
 * §12.1 - Winding allowance.
 *
 * The client confirmed the governing factors: number of secondary turns, wire
 * selection (single SWG or several in parallel), a stacking factor that differs by SWG
 * when multi-layer, interlayer insulation type, and minimum epoxy thickness for the
 * insulation level. The NUMBERS for those factors have not been supplied.
 *
 * The signature is built now and throws until the tables exist. The values are not
 * estimated. Today the allowance is a hand-entered process setting.
 *
 * Intended chain once the tables arrive:
 *   turnsPerLayer = (pi x bore circumference available) / (wireDia / layerStackingFactor)
 *   layers        = ceil(N / turnsPerLayer)
 *   windingBuild  = layers x wireDia + (layers - 1) x interlayerThickness
 *   allowance     = windingBuild + minEpoxyThickness
 */
export interface WindingInputs {
  turns: number;
  wireDiaMm: number;
  parallelStrands: number;
  boreIdMm: number;
}

export interface WindingReference {
  /** Stacking factor per SWG when winding multi-layer. NOT SUPPLIED. */
  layerStackingFactorBySwg: Record<number, number> | null;
  /** Interlayer insulation thickness by type, mm. NOT SUPPLIED. */
  interlayerThicknessMm: number | null;
  /** Minimum epoxy thickness for the insulation level, mm. NOT SUPPLIED. */
  minEpoxyThicknessMm: number | null;
}

export interface WindingResult {
  turnsPerLayer: number;
  layers: number;
  windingBuildMm: number;
  allowanceMm: number;
}

export function computeWindingAllowance(
  inputs: WindingInputs,
  ref: WindingReference,
): WindingResult {
  const missing: string[] = [];
  if (ref.layerStackingFactorBySwg === null) missing.push('layer stacking factor by SWG');
  if (ref.interlayerThicknessMm === null) missing.push('interlayer insulation thickness');
  if (ref.minEpoxyThicknessMm === null) missing.push('minimum epoxy thickness');

  if (missing.length > 0) {
    // TODO(client §12.1): supply these tables, then this function replaces the
    // hand-entered windingAllowanceMm process setting.
    throw new MissingReferenceData(
      `The winding allowance cannot be calculated yet: ${missing.join(', ')} not on record. Set the allowance by hand under Settings until these are entered.`,
      { missing },
    );
  }

  const stacking = ref.layerStackingFactorBySwg![inputs.wireDiaMm] ?? 1;
  const effectiveDia = inputs.wireDiaMm / stacking;
  const turnsPerLayer = (Math.PI * inputs.boreIdMm) / effectiveDia;
  const layers = Math.ceil(inputs.turns / turnsPerLayer);
  const windingBuildMm =
    layers * inputs.wireDiaMm * inputs.parallelStrands + (layers - 1) * ref.interlayerThicknessMm!;
  return {
    turnsPerLayer,
    layers,
    windingBuildMm,
    allowanceMm: windingBuildMm + ref.minEpoxyThicknessMm!,
  };
}
