export type Sex = 'male' | 'female' | 'unknown';
export type Origin = 'captive_bred' | 'wild_caught' | 'unknown';

export interface ParentRef {
  name?: string;
  morph?: string;
  petId?: string;
}

export interface HabitatTargets {
  warmMinC?: number;
  warmMaxC?: number;
  coolMinC?: number;
  coolMaxC?: number;
  humidityMin?: number;
  humidityMax?: number;
}

interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface Pet extends Timestamps {
  id: string;
  name: string;
  photoId?: string;
  species: string;
  morph?: string;
  sex: Sex;
  birthDate?: string; // yyyy-MM-dd
  birthDateApprox: boolean;
  description?: string;
  origin: Origin;
  acquiredFrom?: string;
  acquiredDate?: string; // yyyy-MM-dd
  pricePaid?: number;
  sire?: ParentRef;
  dam?: ParentRef;
  feedingIntervalDays: number;
  usualFoodItem?: string;
  usualQuantity: number;
  usualFeedTime?: string; // HH:mm
  enclosureLabel?: string;
  habitatTargets: HabitatTargets;
  nextFeedingOverride?: string; // ISO datetime
  /** yyyy-MM-dd. Set by Mark "in blue" (spec §5.7), cleared when the next shed is logged. */
  inBlueSince?: string;
  archivedAt?: string;
}

export type FeedingOutcome = 'ate' | 'refused';

export interface Feeding extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  foodItem: string;
  quantity: number;
  outcome: FeedingOutcome;
  notes?: string;
}

export interface Regurgitation extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime it was found
  feedingId: string;
  pushBackDays?: number;
  notes?: string;
}

export type PoopKind = 'normal' | 'runny' | 'urate_only' | 'abnormal';

export interface Poop extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  kind: PoopKind;
  notes?: string;
}

export type ShedQuality = 'complete' | 'partial' | 'stuck';

export interface Shed extends Timestamps {
  id: string;
  petId: string;
  date: string; // yyyy-MM-dd
  inBlueDate?: string; // yyyy-MM-dd
  quality: ShedQuality;
  notes?: string;
}

/** At least one of weightG / lengthMm is set. Canonical units: grams and millimetres. */
export interface Measurement extends Timestamps {
  id: string;
  petId: string;
  date: string; // yyyy-MM-dd
  weightG?: number;
  lengthMm?: number;
}

/** At least one value is set. Canonical unit: °C. */
export interface HabitatReading extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  warmC?: number;
  coolC?: number;
  humidityPct?: number;
}

export interface CareTask extends Timestamps {
  id: string;
  /** Empty means the task is for all pets. */
  petId?: string;
  name: string;
  intervalDays: number;
  timeOfDay?: string; // HH:mm
  archivedAt?: string;
}

export interface CareCompletion extends Timestamps {
  id: string;
  taskId: string;
  at: string; // ISO datetime
}

export interface VetVisit extends Timestamps {
  id: string;
  petId: string;
  date: string; // yyyy-MM-dd
  clinic?: string;
  vet?: string;
  phone?: string;
  reason?: string;
  notes?: string;
  cost?: number;
  photoIds: string[];
  nextAppointment?: string; // ISO datetime
}

export interface Note extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  text: string;
}

export interface Photo extends Timestamps {
  id: string;
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
}

export interface FoodItem extends Timestamps {
  id: string;
  name: string;
  isCustom: boolean;
}

export type ThemePref = 'light' | 'dark' | 'auto';
export type TempUnit = 'F' | 'C';
export type WeightUnit = 'g' | 'oz' | 'lb';
export type LengthUnit = 'in' | 'cm';

export interface Settings {
  id: 'settings';
  theme: ThemePref;
  tempUnit: TempUnit;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  lastBackupAt?: string;
}
