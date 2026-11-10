// Travel modes (design 2026-11-10): how you travelled. Car / Motorbike / Other (bus, BTS, train, passenger).
// Matches public.drives.mode (DB check). The mode decides which vehicles can be attached to the drive.
// Pure, no React Native imports so it runs in Node tests too.
import { pickSelected, type Car, type VehicleKind } from './vehicles.ts';

export const TRAVEL_MODES = ['car', 'motorbike', 'other'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export const DEFAULT_TRAVEL_MODE: TravelMode = 'car';

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  car: 'Car',
  motorbike: 'Motorbike',
  other: 'Other',
};

export function parseTravelMode(raw: string | null | undefined): TravelMode {
  return (TRAVEL_MODES as readonly string[]).includes(raw ?? '') ? (raw as TravelMode) : DEFAULT_TRAVEL_MODE;
}

/** The vehicle kind a mode uses; Other has no vehicle. */
export function kindForMode(mode: TravelMode): VehicleKind | null {
  return mode === 'other' ? null : mode;
}

export function carsForMode(cars: Car[], mode: TravelMode): Car[] {
  const kind = kindForMode(mode);
  return kind ? cars.filter((c) => c.kind === kind) : [];
}

/** The vehicle the pre-drive screen shows for this mode: the saved one if it still fits, else the first of that kind. */
export function vehicleForMode(cars: Car[], mode: TravelMode, savedId: string | null): Car | null {
  return pickSelected(carsForMode(cars, mode), savedId);
}

/**
 * The vehicle id to stamp on a drive: only a vehicle that still exists AND fits the mode. Anything else is null, because the
 * server refuses a drive whose vehicle is not the user's own of the matching kind (and Other drives have no vehicle).
 */
export function vehicleIdForDrive(cars: Car[], mode: TravelMode, vehicleId: string | null): string | null {
  if (vehicleId == null) return null;
  return carsForMode(cars, mode).some((c) => c.id === vehicleId) ? vehicleId : null;
}
