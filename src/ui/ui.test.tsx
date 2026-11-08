import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DayMark } from '../domain/calendar';
import { Pill } from './Pill';
import { Stepper } from './Stepper';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { speciesEmoji } from './PetAvatar';
import { MonthCalendar } from './MonthCalendar';

describe('Pill', () => {
  it('renders its tone as a class', () => {
    render(<Pill tone="late">1 day late</Pill>);
    expect(screen.getByText('1 day late')).toHaveClass('pill', 'pill-late');
  });
});

describe('Stepper', () => {
  it('steps up and down and stops at the minimum', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper label="quantity" value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
    rerender(<Stepper label="quantity" value={1} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });
});

describe('Segmented', () => {
  it('marks the current option and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Outcome"
        value="ate"
        onChange={onChange}
        options={[{ value: 'ate', label: 'Ate it' }, { value: 'refused', label: 'Refused' }]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Ate it' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Refused' }));
    expect(onChange).toHaveBeenCalledWith('refused');
  });
});

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Feed Noodle">x</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Feed Noodle">body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Feed Noodle' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('speciesEmoji', () => {
  it('maps common species', () => {
    expect(speciesEmoji('Corn Snake')).toBe('🐍');
    expect(speciesEmoji('Ball Python')).toBe('🐍');
    expect(speciesEmoji('Russian Tortoise')).toBe('🐢');
    expect(speciesEmoji('Bearded Dragon')).toBe('🐉');
    expect(speciesEmoji('Leopard Gecko')).toBe('🦎');
  });
});

describe('MonthCalendar', () => {
  const marks = new Map<string, Set<DayMark>>([
    ['2026-11-03', new Set<DayMark>(['ate'])],
    ['2026-11-08', new Set<DayMark>(['nextDue', 'today'])],
  ]);

  it('shows every day with an accessible label and mark classes', () => {
    render(<MonthCalendar year={2026} month={10} marks={marks} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    const ate = screen.getByRole('button', { name: 'November 3: ate' });
    expect(ate).toHaveClass('is-ate');
    expect(screen.getByRole('button', { name: 'November 8: next feeding due, today' })).toHaveClass('is-nextDue', 'is-today');
    expect(screen.getAllByRole('button', { name: /^November \d+/ })).toHaveLength(30);
  });

  it('changes month and selects days', async () => {
    const onPrev = vi.fn();
    const onSelectDay = vi.fn();
    render(
      <MonthCalendar year={2026} month={10} marks={marks} onPrev={onPrev} onNext={() => {}} onSelectDay={onSelectDay} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onPrev).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'November 3: ate' }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-11-03');
  });
});
