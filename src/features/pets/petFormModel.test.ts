import { describe, expect, it } from 'vitest';
import type { Pet } from '../../domain/types';
import { EMPTY_FORM, toForm, toInput } from './petFormModel';

const pet: Pet = {
  id: 'p1', name: 'Noodle', species: 'Corn Snake', sex: 'female', origin: 'captive_bred', birthDateApprox: false,
  feedingIntervalDays: 5, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {},
  sire: { name: 'Apollo', petId: 'p-apollo' }, dam: { petId: 'p-juniper' },
  createdAt: '', updatedAt: '',
};

describe('petFormModel', () => {
  it('keeps sire and dam links to other pets through an edit', () => {
    const input = toInput(toForm(pet));
    expect(input.sire).toEqual({ name: 'Apollo', morph: undefined, petId: 'p-apollo' });
    expect(input.dam).toEqual({ name: undefined, morph: undefined, petId: 'p-juniper' });
  });

  it('drops a parent with no name, morph or link', () => {
    const input = toInput({ ...EMPTY_FORM, name: 'Ziggy', species: 'Leopard Gecko' });
    expect(input.sire).toBeUndefined();
    expect(input.dam).toBeUndefined();
  });
});
