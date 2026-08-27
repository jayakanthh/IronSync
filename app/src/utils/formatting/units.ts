import type { User } from '../../models';

export type UnitSystem = 'metric' | 'imperial';

export function getUnitSystem(profile: User | null): UnitSystem {
  return profile?.unitSystem === 'imperial' ? 'imperial' : 'metric';
}

// ─── Weight (kg <-> lb) ──────────────────────────────────────────────────────
export function kgToLb(kg: number): number {
  return kg * 2.20462;
}

export function lbToKg(lb: number): number {
  return lb / 2.20462;
}

export function convertWeightToDisplay(kg: number, system: UnitSystem): number {
  if (system === 'metric') return kg;
  return Math.round(kgToLb(kg) * 10) / 10;
}

export function convertWeightToCanonical(displayVal: number, system: UnitSystem): number {
  if (system === 'metric') return displayVal;
  return Math.round(lbToKg(displayVal) * 100) / 100;
}

export function getWeightUnit(system: UnitSystem): string {
  return system === 'metric' ? 'kg' : 'lb';
}

// ─── Body Measurements (cm <-> in) ──────────────────────────────────────────
export function cmToIn(cm: number): number {
  return cm * 0.393701;
}

export function inToCm(inch: number): number {
  return inch / 0.393701;
}

export function convertCmToDisplay(cm: number, system: UnitSystem): number {
  if (system === 'metric') return cm;
  return Math.round(cmToIn(cm) * 100) / 100;
}

export function convertCmToCanonical(displayVal: number, system: UnitSystem): number {
  if (system === 'metric') return displayVal;
  return Math.round(inToCm(displayVal) * 100) / 100;
}

export function getMeasurementUnit(system: UnitSystem): string {
  return system === 'metric' ? 'cm' : 'in';
}

// ─── Distance (km <-> mi) ────────────────────────────────────────────────────
export function kmToMi(km: number): number {
  return km * 0.621371;
}

export function miToKm(mi: number): number {
  return mi / 0.621371;
}

export function convertKmToDisplay(km: number, system: UnitSystem): number {
  if (system === 'metric') return km;
  return Math.round(kmToMi(km) * 100) / 100;
}

export function convertKmToCanonical(displayVal: number, system: UnitSystem): number {
  if (system === 'metric') return displayVal;
  return Math.round(miToKm(displayVal) * 100) / 100;
}

export function getDistanceUnit(system: UnitSystem): string {
  return system === 'metric' ? 'km' : 'mi';
}
