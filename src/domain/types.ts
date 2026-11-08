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

export interface Settings {
  id: 'settings';
  theme: ThemePref;
  tempUnit: 'F' | 'C';
  weightUnit: 'g' | 'oz' | 'lb';
  lengthUnit: 'in' | 'cm';
  lastBackupAt?: string;
}
