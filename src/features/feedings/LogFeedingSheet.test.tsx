import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogFeedingSheet from './LogFeedingSheet';
import { db, resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listFeedings, listRegurgitations, logFeeding } from '../../db/feedings';
import type { Pet } from '../../domain/types';

const now = new Date(2026, 10, 8, 18, 12);
const lastMealAt = new Date(2026, 10, 3, 18, 0).toISOString();
let pet: Pet;

beforeEach(async () => {
  await resetDb();
  pet = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse' });
  await logFeeding({ petId: pet.id, at: lastMealAt, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
});

function open(onClose = vi.fn()) {
  render(
    <LogFeedingSheet
      pet={pet}
      open
      onClose={onClose}
      lastMealAt={lastMealAt}
      currentDue={new Date(2026, 10, 8, 18, 0)}
      now={now}
    />,
  );
  return onClose;
}

describe('LogFeedingSheet', () => {
  it('starts from the pet usual meal and previews the next feeding', async () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Feed Noodle' })).toBeInTheDocument();
    expect(screen.getByText('Last fed Nov 3 · 5 days ago')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pinky mouse' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-08');
    expect(screen.getByLabelText('Time')).toHaveValue('18:12');
    expect(screen.getByText('Next feeding → Fri, Nov 13')).toBeInTheDocument();
  });

  it('saves an eaten meal', async () => {
    const onClose = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const latest = (await listFeedings(pet.id)).at(-1)!;
    expect(latest).toMatchObject({ outcome: 'ate', quantity: 2, foodItem: 'Pinky mouse', at: now.toISOString() });
  });

  it('a refusal keeps the current due date', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Refused' }));
    expect(screen.getByText('Next feeding → Today')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(async () => expect((await listFeedings(pet.id)).at(-1)!.outcome).toBe('refused'));
  });

  it('Regurgitated saves the meal, the regurgitation and the push-back', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Regurgitated' }));
    expect(screen.getByRole('checkbox', { name: 'Push next feeding back?' })).toBeChecked();
    expect(screen.getByLabelText('Push back (days)')).toHaveValue(10);
    expect(screen.getByText('Next feeding → Wed, Nov 18')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(async () => expect(await listRegurgitations(pet.id)).toHaveLength(1));
    const meal = (await listFeedings(pet.id)).at(-1)!;
    expect(meal.outcome).toBe('ate');
    expect((await listRegurgitations(pet.id))[0]!.feedingId).toBe(meal.id);
    expect((await getPet(pet.id))!.nextFeedingOverride).toBe(new Date(2026, 10, 18, 18, 0).toISOString());
  });

  it('turning push-back off previews the normal interval', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Regurgitated' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Push next feeding back?' }));
    expect(screen.getByText('Next feeding → Fri, Nov 13')).toBeInTheDocument();
  });

  it('adds a custom food with "+ Other"', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: '+ Other' }));
    await userEvent.type(screen.getByLabelText('Other food'), 'Black soldier fly larvae');
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(async () => expect((await listFeedings(pet.id)).at(-1)!.foodItem).toBe('Black soldier fly larvae'));
    expect(await db.foodItems.where('name').equals('Black soldier fly larvae').count()).toBe(1);
  });
});
