import type { Origin, ParentRef, Pet, Sex } from '../../domain/types';
import type { PetInput } from '../../db/pets';
import { ValidationError } from '../../db/ids';

export interface FormState {
  photoId?: string;
  name: string;
  species: string;
  morph: string;
  sex: Sex;
  birthDate: string;
  birthDateApprox: boolean;
  origin: Origin;
  description: string;
  acquiredFrom: string;
  acquiredDate: string;
  pricePaid: string;
  sireName: string;
  sireMorph: string;
  /** A link to another pet. The form has no picker for it yet, but an edit must keep it. */
  sirePetId?: string;
  damName: string;
  damMorph: string;
  damPetId?: string;
  feedingIntervalDays: string;
  usualFoodItem: string;
  usualQuantity: string;
  usualFeedTime: string;
}

export const EMPTY_FORM: FormState = {
  name: '', species: '', morph: '', sex: 'unknown', birthDate: '', birthDateApprox: false,
  origin: 'unknown', description: '', acquiredFrom: '', acquiredDate: '', pricePaid: '',
  sireName: '', sireMorph: '', damName: '', damMorph: '',
  feedingIntervalDays: '7', usualFoodItem: '', usualQuantity: '1', usualFeedTime: '18:00',
};

export function toForm(pet: Pet): FormState {
  return {
    photoId: pet.photoId,
    name: pet.name,
    species: pet.species,
    morph: pet.morph ?? '',
    sex: pet.sex,
    birthDate: pet.birthDate ?? '',
    birthDateApprox: pet.birthDateApprox,
    origin: pet.origin,
    description: pet.description ?? '',
    acquiredFrom: pet.acquiredFrom ?? '',
    acquiredDate: pet.acquiredDate ?? '',
    pricePaid: pet.pricePaid === undefined ? '' : String(pet.pricePaid),
    sireName: pet.sire?.name ?? '',
    sireMorph: pet.sire?.morph ?? '',
    sirePetId: pet.sire?.petId,
    damName: pet.dam?.name ?? '',
    damMorph: pet.dam?.morph ?? '',
    damPetId: pet.dam?.petId,
    feedingIntervalDays: String(pet.feedingIntervalDays),
    usualFoodItem: pet.usualFoodItem ?? '',
    usualQuantity: String(pet.usualQuantity),
    usualFeedTime: pet.usualFeedTime ?? '18:00',
  };
}

const opt = (s: string) => s.trim() || undefined;

function parent(name: string, morph: string, petId: string | undefined): ParentRef | undefined {
  if (!opt(name) && !opt(morph) && !petId) return undefined;
  return { name: opt(name), morph: opt(morph), petId };
}

/** Every optional key is present (possibly undefined) so updatePet clears emptied fields. */
export function toInput(f: FormState): PetInput {
  let pricePaid: number | undefined;
  if (f.pricePaid.trim()) {
    pricePaid = Number(f.pricePaid);
    if (!Number.isFinite(pricePaid) || pricePaid < 0) throw new ValidationError('Price must be a number');
  }
  return {
    photoId: f.photoId,
    name: f.name,
    species: f.species,
    morph: opt(f.morph),
    sex: f.sex,
    birthDate: opt(f.birthDate),
    birthDateApprox: f.birthDateApprox,
    origin: f.origin,
    description: opt(f.description),
    acquiredFrom: opt(f.acquiredFrom),
    acquiredDate: opt(f.acquiredDate),
    pricePaid,
    sire: parent(f.sireName, f.sireMorph, f.sirePetId),
    dam: parent(f.damName, f.damMorph, f.damPetId),
    feedingIntervalDays: Number(f.feedingIntervalDays),
    usualFoodItem: opt(f.usualFoodItem),
    usualQuantity: Number(f.usualQuantity),
    usualFeedTime: opt(f.usualFeedTime),
  };
}
