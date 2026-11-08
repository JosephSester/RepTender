import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PetsHome from './PetsHome';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';

const now = new Date(2026, 10, 8, 9, 0);
const at = (d: number) => new Date(2026, 10, d, 18, 0).toISOString();

async function addPet(name: string, species: string, interval: number, fedOn: number, food = 'Pinky mouse') {
  const p = await createPet({ name, species, feedingIntervalDays: interval, usualFoodItem: food });
  await logFeeding({ petId: p.id, at: at(fedOn), foodItem: food, quantity: 1, outcome: 'ate' });
  return p;
}

const renderHome = () => render(<MemoryRouter><PetsHome now={now} /></MemoryRouter>);

beforeEach(async () => {
  await resetDb();
});

describe('PetsHome', () => {
  it('shows an empty state with a link to add a pet', async () => {
    renderHome();
    expect(await screen.findByRole('link', { name: 'Add your first reptile' })).toHaveAttribute('href', '/pets/new');
  });

  it('lists pets by urgency with status pills and a hungry banner', async () => {
    const noodle = await addPet('Noodle', 'Corn Snake', 5, 3);
    await addPet('Ziggy', 'Leopard Gecko', 3, 7, 'Crickets');
    await addPet('Basil', 'Bearded Dragon', 2, 5, 'Dubia roaches');
    renderHome();

    expect(await screen.findByText('Basil is hungry')).toBeInTheDocument();
    expect(screen.getByText('3 pets · 1 due today · 1 late')).toBeInTheDocument();

    const cards = screen.getAllByRole('link', { name: /Noodle|Ziggy|Basil/ });
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Basil', 'Noodle', 'Ziggy']);
    expect(within(cards[0]!).getByText('1 day late')).toHaveClass('pill-late');
    expect(within(cards[1]!).getByText('Today')).toHaveClass('pill-due');
    expect(within(cards[2]!).getByText('In 2 days')).toHaveClass('pill-ok');
    expect(cards[1]).toHaveAttribute('href', `/pets/${noodle.id}`);
  });

  it('logs a feeding from the hungry banner', async () => {
    await addPet('Noodle', 'Corn Snake', 5, 3);
    renderHome();
    await userEvent.click(await screen.findByRole('button', { name: 'Log' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Feed Noodle' })).getByRole('button', { name: 'Save feeding' }));
    expect(await screen.findByText('In 5 days')).toBeInTheDocument();
  });
});
