import type { LengthUnit, TempUnit, WeightUnit } from './types';

export interface Units {
  temp: TempUnit;
  weight: WeightUnit;
  length: LengthUnit;
}

/** Spec §6 / Settings defaults: °F, g, in. */
export const DEFAULT_UNITS: Units = { temp: 'F', weight: 'g', length: 'in' };

const G_PER_OZ = 28.349523125;
const G_PER_LB = 453.59237;
const MM_PER_IN = 25.4;

export const tempFromC = (c: number, unit: TempUnit): number => (unit === 'F' ? (c * 9) / 5 + 32 : c);
export const tempToC = (value: number, unit: TempUnit): number => (unit === 'F' ? ((value - 32) * 5) / 9 : value);

export function weightFromG(g: number, unit: WeightUnit): number {
  if (unit === 'oz') return g / G_PER_OZ;
  if (unit === 'lb') return g / G_PER_LB;
  return g;
}
export function weightToG(value: number, unit: WeightUnit): number {
  if (unit === 'oz') return value * G_PER_OZ;
  if (unit === 'lb') return value * G_PER_LB;
  return value;
}

export const lengthFromMm = (mm: number, unit: LengthUnit): number => (unit === 'in' ? mm / MM_PER_IN : mm / 10);
export const lengthToMm = (value: number, unit: LengthUnit): number => (unit === 'in' ? value * MM_PER_IN : value * 10);

export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r; // no "-0"
}

/** Spec §7 rule 10: g and °F whole, in 1 decimal; the Plan 3 units get sensible precision too. */
const TEMP_DECIMALS: Record<TempUnit, number> = { F: 0, C: 1 };
const WEIGHT_DECIMALS: Record<WeightUnit, number> = { g: 0, oz: 1, lb: 2 };
const LENGTH_DECIMALS: Record<LengthUnit, number> = { in: 1, cm: 1 };

export const displayTemp = (c: number, unit: TempUnit): number => roundTo(tempFromC(c, unit), TEMP_DECIMALS[unit]);
export const displayWeight = (g: number, unit: WeightUnit): number => roundTo(weightFromG(g, unit), WEIGHT_DECIMALS[unit]);
export const displayLength = (mm: number, unit: LengthUnit): number => roundTo(lengthFromMm(mm, unit), LENGTH_DECIMALS[unit]);

export const formatTemp = (c: number, unit: TempUnit): string => `${displayTemp(c, unit)}°${unit}`;
export const formatWeight = (g: number, unit: WeightUnit): string => `${displayWeight(g, unit)} ${unit}`;
export const formatLength = (mm: number, unit: LengthUnit): string => `${displayLength(mm, unit)} ${unit}`;
export const formatHumidity = (pct: number): string => `${Math.round(pct)}%`;
