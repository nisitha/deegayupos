/**
 * Smart Multi-Unit Detection & Measurement Converter for Deegayu Weda Madura POS
 * Handles Weight (g <-> kg), Volume (ml <-> L), Ayurvedic Fractional units (Kalan, Manchadi),
 * and Discrete Retail Packs (Bottles, Packets, Boxes).
 */

export type UnitMode = 'weight_g' | 'volume_ml' | 'fractional' | 'discrete';

export interface QuickPreset {
  label: string;
  valueInBase: number;
  displayValue: number;
  unit: string;
}

export interface UnitConfig {
  mode: UnitMode;
  baseUnit: string;
  alternateUnit?: string;
  multiplier?: number; // Multiply alternate unit by this to get base unit (e.g. 1000 for kg->g)
  allowDecimals: boolean;
  step: string;
  quickPresets: QuickPreset[];
  label: string;
}

const WEIGHT_G_PRESETS: QuickPreset[] = [
  { label: '50g', valueInBase: 50, displayValue: 50, unit: 'g' },
  { label: '100g', valueInBase: 100, displayValue: 100, unit: 'g' },
  { label: '250g', valueInBase: 250, displayValue: 250, unit: 'g' },
  { label: '500g', valueInBase: 500, displayValue: 500, unit: 'g' },
  { label: '1 kg', valueInBase: 1000, displayValue: 1, unit: 'kg' },
  { label: '2 kg', valueInBase: 2000, displayValue: 2, unit: 'kg' },
  { label: '5 kg', valueInBase: 5000, displayValue: 5, unit: 'kg' },
];

const VOLUME_ML_PRESETS: QuickPreset[] = [
  { label: '50ml', valueInBase: 50, displayValue: 50, unit: 'ml' },
  { label: '100ml', valueInBase: 100, displayValue: 100, unit: 'ml' },
  { label: '250ml', valueInBase: 250, displayValue: 250, unit: 'ml' },
  { label: '500ml', valueInBase: 500, displayValue: 500, unit: 'ml' },
  { label: '750ml', valueInBase: 750, displayValue: 750, unit: 'ml' },
  { label: '1 L', valueInBase: 1000, displayValue: 1, unit: 'L' },
  { label: '2 L', valueInBase: 2000, displayValue: 2, unit: 'L' },
];

const FRACTIONAL_KALAN_PRESETS: QuickPreset[] = [
  { label: '0.5', valueInBase: 0.5, displayValue: 0.5, unit: 'Kalan' },
  { label: '1', valueInBase: 1, displayValue: 1, unit: 'Kalan' },
  { label: '1.5', valueInBase: 1.5, displayValue: 1.5, unit: 'Kalan' },
  { label: '2', valueInBase: 2, displayValue: 2, unit: 'Kalan' },
  { label: '2.5', valueInBase: 2.5, displayValue: 2.5, unit: 'Kalan' },
  { label: '5', valueInBase: 5, displayValue: 5, unit: 'Kalan' },
];

/**
 * Detects unit configuration from product database unit and name pattern
 */
export function detectUnitConfig(product: {
  name?: string;
  unit?: string | null;
}): UnitConfig {
  const name = (product.name || '').trim();
  const unit = (product.unit || '').trim().toLowerCase();
  const lowerName = name.toLowerCase();

  // 1. Gram / Kilogram Weight Mode (type: 'weight_g')
  // Triggered when product unit or name ends with / specifies 1g, g, gram, grams
  // Excluding mg, multi-pack names like "10g Box", "20g Pack", "100g Pkt", "7g Churnaya"
  const isPackagedFixedWeight =
    /\b([2-9]\d*|\d{2,})\s*g\b/i.test(name) || // e.g. 7g, 20g, 50g, 100g
    /\b(box|pack|pkt|packet|sachet|tea|bottle|btl|cap|tablet)\b/i.test(lowerName);

  const isExplicitGramUnit = unit === 'g' || unit === '1g' || unit === 'gram' || unit === 'grams';
  const hasBaseGramPattern =
    /\b1\s*g\b/i.test(name) ||
    lowerName.endsWith(' 1g') ||
    lowerName.endsWith('1g') ||
    lowerName.includes('(1g)') ||
    lowerName.includes('/g') ||
    lowerName.includes('per g') ||
    lowerName.includes('per gram');

  if ((isExplicitGramUnit || hasBaseGramPattern) && !isPackagedFixedWeight) {
    return {
      mode: 'weight_g',
      baseUnit: 'g',
      alternateUnit: 'kg',
      multiplier: 1000,
      allowDecimals: true,
      step: 'any',
      quickPresets: WEIGHT_G_PRESETS,
      label: 'Weight (g / kg)',
    };
  }

  // 2. Milliliter / Liter Volume Mode (type: 'volume_ml')
  // Triggered when product specifies loose 1ml, ml, milliliter
  // Excluding fixed bottled SKUs like 375ml, 750ml, 180ml, 100ml, 60ml, 55ml, 50ml, etc.
  const isPackagedFixedVolume =
    /\b([2-9]\d*|\d{2,})\s*ml\b/i.test(name) || // e.g. 25ml, 50ml, 375ml
    /\b(bottle|btl|jar|can|tin)\b/i.test(lowerName);

  const isExplicitMlUnit = unit === 'ml' || unit === '1ml' || unit === 'milliliter' || unit === 'millilitre';
  const hasBaseMlPattern =
    /\b1\s*ml\b/i.test(name) ||
    lowerName.endsWith(' 1ml') ||
    lowerName.endsWith('1ml') ||
    lowerName.includes('/ml') ||
    lowerName.includes('per ml') ||
    lowerName.includes('loose oil');

  if ((isExplicitMlUnit || hasBaseMlPattern) && !isPackagedFixedVolume) {
    return {
      mode: 'volume_ml',
      baseUnit: 'ml',
      alternateUnit: 'L',
      multiplier: 1000,
      allowDecimals: true,
      step: 'any',
      quickPresets: VOLUME_ML_PRESETS,
      label: 'Volume (ml / L)',
    };
  }

  // 3. Traditional Ayurvedic / Fractional Unit Mode (type: 'fractional')
  // Triggered for Kalan (කලං), Manchadi, Palama, or bulk kg/L items
  const isKalan =
    lowerName.includes('kalan') ||
    name.includes('කලං') ||
    lowerName.includes('manchadi') ||
    lowerName.includes('palama');

  const isBulkKgOrL =
    unit === 'kg' ||
    unit === 'kilogram' ||
    unit === 'l' ||
    unit === 'liter' ||
    unit === 'litre' ||
    lowerName.includes('/kg') ||
    lowerName.includes('/l');

  if (isKalan) {
    return {
      mode: 'fractional',
      baseUnit: 'Kalan',
      allowDecimals: true,
      step: 'any',
      quickPresets: FRACTIONAL_KALAN_PRESETS,
      label: 'Traditional Unit (Kalan / කලං)',
    };
  }

  if (isBulkKgOrL) {
    const isKg = unit === 'kg' || lowerName.includes('/kg');
    return {
      mode: 'fractional',
      baseUnit: isKg ? 'kg' : 'L',
      allowDecimals: true,
      step: 'any',
      quickPresets: [
        { label: '0.25', valueInBase: 0.25, displayValue: 0.25, unit: isKg ? 'kg' : 'L' },
        { label: '0.5', valueInBase: 0.5, displayValue: 0.5, unit: isKg ? 'kg' : 'L' },
        { label: '1', valueInBase: 1, displayValue: 1, unit: isKg ? 'kg' : 'L' },
        { label: '2', valueInBase: 2, displayValue: 2, unit: isKg ? 'kg' : 'L' },
        { label: '5', valueInBase: 5, displayValue: 5, unit: isKg ? 'kg' : 'L' },
      ],
      label: isKg ? 'Bulk Weight (kg)' : 'Bulk Volume (L)',
    };
  }

  // 4. Discrete Unit Mode (type: 'discrete')
  // Default for Bottles, Boxes, Packets, Soaps, general whole numbers (1, 2, 3...)
  const discreteUnit = unit || 'pcs';
  return {
    mode: 'discrete',
    baseUnit: discreteUnit,
    allowDecimals: false,
    step: '1',
    quickPresets: [
      { label: '1', valueInBase: 1, displayValue: 1, unit: discreteUnit },
      { label: '2', valueInBase: 2, displayValue: 2, unit: discreteUnit },
      { label: '3', valueInBase: 3, displayValue: 3, unit: discreteUnit },
      { label: '5', valueInBase: 5, displayValue: 5, unit: discreteUnit },
      { label: '10', valueInBase: 10, displayValue: 10, unit: discreteUnit },
      { label: '12', valueInBase: 12, displayValue: 12, unit: discreteUnit },
    ],
    label: `Discrete Unit (${discreteUnit})`,
  };
}

/**
 * Calculates baseQuantity (e.g. In grams or ml) from display quantity and selected unit
 */
export function calculateBaseQuantity(
  displayQty: number,
  selectedUnit: string,
  config: UnitConfig
): number {
  if (config.mode === 'weight_g') {
    if (selectedUnit === 'kg') {
      return Math.round(displayQty * 1000 * 1000) / 1000; // to nearest 0.001g
    }
    return Math.round(displayQty * 1000) / 1000;
  }

  if (config.mode === 'volume_ml') {
    if (selectedUnit === 'L') {
      return Math.round(displayQty * 1000 * 1000) / 1000; // to nearest 0.001ml
    }
    return Math.round(displayQty * 1000) / 1000;
  }

  return Math.round(displayQty * 1000) / 1000;
}

/**
 * Calculates displayQuantity from baseQuantity (e.g. 2000g in kg mode => 2)
 */
export function calculateDisplayQuantity(
  baseQty: number,
  selectedUnit: string,
  config: UnitConfig
): number {
  if (config.mode === 'weight_g' && selectedUnit === 'kg') {
    return Math.round((baseQty / 1000) * 1000) / 1000;
  }
  if (config.mode === 'volume_ml' && selectedUnit === 'L') {
    return Math.round((baseQty / 1000) * 1000) / 1000;
  }
  return baseQty;
}

/**
 * Formats line item quantity and unit for Display and Receipts
 * e.g. "2 kg (2,000 g)" or "250 g" or "2.5 Kalan" or "3 Bottles"
 */
export function formatQuantityWithUnit(
  baseQuantity: number,
  selectedUnit: string | undefined,
  config: UnitConfig
): string {
  if (config.mode === 'weight_g') {
    const unit = selectedUnit || config.baseUnit;
    if (unit === 'kg') {
      const kgVal = Math.round((baseQuantity / 1000) * 1000) / 1000;
      return `${kgVal} kg (${baseQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} g)`;
    }
    return `${baseQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`;
  }

  if (config.mode === 'volume_ml') {
    const unit = selectedUnit || config.baseUnit;
    if (unit === 'L') {
      const lVal = Math.round((baseQuantity / 1000) * 1000) / 1000;
      return `${lVal} L (${baseQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} ml)`;
    }
    return `${baseQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} ml`;
  }

  if (config.mode === 'fractional') {
    const formatted = baseQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return `${formatted} ${config.baseUnit}`;
  }

  // Discrete
  return `${baseQuantity} ${config.baseUnit || 'pcs'}`;
}

