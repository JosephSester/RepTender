import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { AppRoutes } from './App';
import { resetDb } from '../db/db';

beforeEach(async () => {
  await resetDb();
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the caught error
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('#/crash-test shows the crash screen (for the iPhone checklist)', async () => {
  render(
    <ErrorBoundary onReload={vi.fn()}>
      <MemoryRouter initialEntries={['/crash-test']}>
        <AppRoutes />
      </MemoryRouter>
    </ErrorBoundary>,
  );
  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Crash test: this screen breaks on purpose.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
});
