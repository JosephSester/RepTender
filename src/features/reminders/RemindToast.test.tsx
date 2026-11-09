import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RemindToast from './RemindToast';
import { hideRemindToast, showRemindToast } from './toastStore';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { renderAt } from '../../test/render';
import { mockShare, unmockShare } from '../../test/share';
import type { Pet } from '../../domain/types';

let pet: Pet;

beforeEach(async () => {
  await resetDb();
  pet = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse' });
});

afterEach(() => {
  act(() => hideRemindToast()); // the store is module state: never leak a toast into the next test
  unmockShare();
  vi.restoreAllMocks();
});

describe('Remind me toast (spec §5.3)', () => {
  it('appears after logging a feeding and adds the next feeding to Calendar', async () => {
    const { share, file } = mockShare();
    renderAt(`/pets/${pet.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '🍽️ Log feeding' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Feed Noodle' })).getByRole('button', { name: 'Save feeding' }));

    const toast = await screen.findByRole('status', { name: 'Feeding saved' });
    expect(toast).toHaveTextContent('Feeding saved');
    expect(toast).toHaveTextContent(/Next feeding \w{3}, \w{3} \d+ · 6:00 PM/);
    await userEvent.click(within(toast).getByRole('button', { name: '📅 Remind me' }));

    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const ics = await file().text();
    expect(file().name).toBe('reptender-reminder.ics');
    expect(file().type).toBe('text/calendar');
    expect(ics).toContain('SUMMARY:Feed Noodle · 1 Pinky mouse');
    expect(ics).toMatch(new RegExp(`UID:${pet.id}-\\d{4}-\\d{2}-\\d{2}@reptender`));
    expect(ics).toContain('TRIGGER:PT0S');
    await vi.waitFor(() => expect(screen.queryByRole('status', { name: 'Feeding saved' })).toBeNull()); // hides after sharing
  });

  it('shows no Remind me button when the next feeding is not in the future', async () => {
    const now = new Date(2026, 10, 8, 9, 0);
    await logFeeding({ petId: pet.id, at: new Date(2026, 10, 1, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    render(<RemindToast now={now} />);
    act(() => showRemindToast(pet.id));
    const toast = await screen.findByRole('status', { name: 'Feeding saved' });
    expect(toast).toHaveTextContent('Next feeding Fri, Nov 6 · 6:00 PM');
    expect(within(toast).queryByRole('button', { name: '📅 Remind me' })).toBeNull();
    await userEvent.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status', { name: 'Feeding saved' })).toBeNull();
  });

  it('hides by itself after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<RemindToast now={new Date(2026, 10, 8, 9, 0)} />);
      act(() => showRemindToast(pet.id));
      expect(await screen.findByRole('status', { name: 'Feeding saved' })).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.queryByRole('status', { name: 'Feeding saved' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
