import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { applyTheme, resolveTheme, THEME_STORAGE_KEY } from './theme';
import ThemeSync from './ThemeSync';
import { resetDb } from '../db/db';
import { updateSettings } from '../db/settings';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

describe('resolveTheme', () => {
  it('follows the system only for auto', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and remembers the preference', () => {
    expect(applyTheme('dark', false)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('ThemeSync', () => {
  it('applies the saved setting', async () => {
    await updateSettings({ theme: 'dark' });
    render(<ThemeSync />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });
});
