// Pure rules for the car picker on the pre-drive screen.
/** public.vehicles.kind (DB check constraint). Chosen when the vehicle is added, never changed. */
export type VehicleKind = 'car' | 'motorbike';

/** Old cached lists (before motorbikes existed) have no kind: those are cars. */
export function normaliseKind(raw: unknown): VehicleKind {
  return raw === 'motorbike' ? 'motorbike' : 'car';
}

/** A vehicle in the garage. Named Car from before motorbikes; `kind` says which it is. */
export interface Car {
  id: string;
  nickname: string;
  make: string | null;
  model: string | null;
  /** One of the 8 keys in theme/tokens carColours (DB check constraint). */
  colour: string;
  kind: VehicleKind;
}

/** The saved car if it still exists, else the first one, else null. */
export function pickSelected(cars: Car[], savedId: string | null): Car | null {
  return cars.find((c) => c.id === savedId) ?? cars[0] ?? null;
}

/** "Sport yellow · Honda Civic". Empty make/model are skipped. */
export function carSubtitle(car: Car, colourLabel: string): string {
  const what = [car.make, car.model].map((s) => s?.trim()).filter(Boolean).join(' ');
  return what ? `${colourLabel} · ${what}` : colourLabel;
}

/** Totals for one car's Garage card, from the drives on this phone. */
export function carStats(
  drives: { vehicleId: string | null; distanceM: number }[],
  carId: string,
): { drives: number; distanceM: number } {
  let count = 0;
  let distanceM = 0;
  for (const d of drives) {
    if (d.vehicleId !== carId) continue;
    count += 1;
    distanceM += d.distanceM;
  }
  return { drives: count, distanceM };
}
