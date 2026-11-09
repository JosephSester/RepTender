import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegurgitationSheet from './RegurgitationSheet';
import { resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listFeedings, listRegurgitations, logFeeding } from '../../db/feedings';
import type { FeedingOutcome, Pet } from '../../domain/types';

const now = new Date(2026, 10, 8, 9, 0);
const at = (d: number, h = 18, m = 0) => new Date(2026, 10, d, h, m).toISOString();
let pet: Pet;

const meal = (d: number, outcome: FeedingOutcome = 'ate') =>
  logFeeding({ petId: pet.id, at: at(d), foodItem: 'Pinky mouse', quantity: 1, outcome });

function open(onClose = vi.fn()) {
  render(<RegurgitationSheet pet={pet} open onClose={onClose} now={now} />);
  return onClose;
}

beforeEach(async () => {
  await resetDb();
  pet = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse' });
});

describe('RegurgitationSheet', () => {
  it('lists the last 5 eaten meals, newest first and selected', async () => {
    for (const d of [1, 2, 3, 4, 5, 6]) await meal(d);
    await meal(7, 'refused');
    open();
    expect(screen.getByRole('dialog', { name: 'Log regurgitation' })).toBeInTheDocument();
    const picks = await screen.findAllByRole('button', { name: /Pinky mouse$/ });
    expect(picks.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Nov 6 · 6:00 PM, 1 Pinky mouse',
      'Nov 5 · 6:00 PM, 1 Pinky mouse',
      'Nov 4 · 6:00 PM, 1 Pinky mouse',
      'Nov 3 · 6:00 PM, 1 Pinky mouse',
      'Nov 2 · 6:00 PM, 1 Pinky mouse',
    ]);
    expect(picks[0]).toHaveAttribute('aria-pressed', 'true');
    expect(picks[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves against the chosen meal and pushes the next feeding back', async () => {
    await meal(2);
    await meal(5);
    const onClose = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Nov 2 · 6:00 PM, 1 Pinky mouse' }));
    fireEvent.change(screen.getByLabelText('Found date'), { target: { value: '2026-11-03' } });
    fireEvent.change(screen.getByLabelText('Found time'), { target: { value: '07:30' } });
    await userEvent.type(screen.getByLabelText('Notes'), 'Warm side was 80°');
    expect(screen.getByRole('checkbox', { name: 'Push next feeding back?' })).toBeChecked();
    expect(screen.getByLabelText('Push back (days)')).toHaveValue(10);
    expect(screen.getByText('Next feeding → Fri, Nov 13')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save regurgitation' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const [first] = await listFeedings(pet.id);
    const [r] = await listRegurgitations(pet.id);
    expect(r).toMatchObject({
      feedingId: first!.id, at: new Date(2026, 10, 3, 7, 30).toISOString(), pushBackDays: 10, notes: 'Warm side was 80°',
    });
    expect((await getPet(pet.id))!.nextFeedingOverride).toBe(new Date(2026, 10, 13, 18, 0).toISOString());
  });

  it('with push-back off it previews the normal schedule and sets no override', async () => {
    await meal(3);
    const onClose = open();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Push next feeding back?' }));
    expect(screen.queryByLabelText('Push back (days)')).toBeNull();
    expect(screen.getByText('Next feeding → Today')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Save regurgitation' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await listRegurgitations(pet.id)).toHaveLength(1);
    expect((await getPet(pet.id))!.nextFeedingOverride).toBeUndefined();
  });

  it('survives a cleared Found date and blocks saving', async () => {
    await meal(3);
    open();
    await screen.findByRole('button', { name: /Pinky mouse$/ });
    await userEvent.clear(screen.getByLabelText('Found date'));
    expect(screen.getByRole('dialog', { name: 'Log regurgitation' })).toBeInTheDocument();
    expect(screen.getByText('Next feeding → —')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
  });

  it('blocks a found time before the meal, and a bad push-back', async () => {
    await meal(3);
    open();
    await screen.findByRole('button', { name: /Pinky mouse$/ });
    fireEvent.change(screen.getByLabelText('Found date'), { target: { value: '2026-11-03' } });
    fireEvent.change(screen.getByLabelText('Found time'), { target: { value: '07:00' } });
    expect(screen.getByText('Found time is before that meal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Found time'), { target: { value: '20:00' } });
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Push back (days)'), { target: { value: '0' } });
    expect(screen.getByText('Next feeding → —')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
  });

  it('survives a huge push-back while typing, with an inline reason and Save disabled', async () => {
    await meal(3);
    open();
    await screen.findByRole('button', { name: /Pinky mouse$/ });
    const days = screen.getByLabelText('Push back (days)');
    await userEvent.clear(days);
    await userEvent.type(days, '999999999');
    expect(screen.getByRole('dialog', { name: 'Log regurgitation' })).toBeInTheDocument();
    expect(screen.getByText('Push back must be a whole number from 1 to 365 days.')).toBeInTheDocument();
    expect(screen.getByText('Next feeding → —')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
    fireEvent.change(days, { target: { value: '365' } });
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeEnabled();
  });

  it('says when there is no eaten meal to pick', async () => {
    await meal(3, 'refused');
    open();
    expect(await screen.findByText(/No eaten meals logged yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
  });
});
