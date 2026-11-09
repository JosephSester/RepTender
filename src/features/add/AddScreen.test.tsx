import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AddScreen from './AddScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { listPoops } from '../../db/poops';

const now = new Date(2026, 10, 8, 9, 0);
const renderAdd = () => render(<MemoryRouter><AddScreen now={now} /></MemoryRouter>);

beforeEach(async () => {
  await resetDb();
});

describe('AddScreen', () => {
  it('with no pets it offers to add one', async () => {
    renderAdd();
    expect(await screen.findByText('No reptiles yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a reptile' })).toHaveAttribute('href', '/pets/new');
  });

  it('with one pet it skips the pet picker', async () => {
    const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    renderAdd();
    expect(await screen.findByText('Log for Noodle')).toBeInTheDocument();
    expect(screen.queryByText('Which pet?')).toBeNull();
    expect(screen.getByRole('link', { name: '+ Add a new pet' })).toHaveAttribute('href', '/pets/new');
    await userEvent.click(screen.getByRole('button', { name: 'Poop' }));
    const sheet = screen.getByRole('dialog', { name: 'Log poop' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save poop' }));
    await vi.waitFor(async () => expect(await listPoops(noodle.id)).toHaveLength(1));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('with several pets you pick one, then any entry type opens its sheet', async () => {
    await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    renderAdd();
    expect(await screen.findByText('Which pet?')).toBeInTheDocument();
    expect(screen.getByText('Pick a pet first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Note' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Ziggy' }));
    expect(screen.getByRole('button', { name: 'Ziggy' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Log for Ziggy')).toBeInTheDocument();
    const pairs: [string, string][] = [
      ['Feeding', 'Feed Ziggy'],
      ['Regurgitation', 'Log regurgitation'],
      ['Poop', 'Log poop'],
      ['Shed', 'Log shed'],
      ['Weight', 'Log weight & length'],
      ['Habitat reading', 'Log habitat reading'],
      ['Vet visit', 'New vet visit'],
      ['Note', 'New note'],
    ];
    for (const [entry, dialog] of pairs) {
      await userEvent.click(screen.getByRole('button', { name: entry }));
      expect(await screen.findByRole('dialog', { name: dialog })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });
});
