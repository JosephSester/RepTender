import type { ThemePref } from '../domain/types';

export const THEME_STORAGE_KEY = 'reptender-theme';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'auto') return systemDark ? 'dark' : 'light';
  return pref;
}

export function applyTheme(
  pref: ThemePref,
  systemDark: boolean,
  root: HTMLElement = document.documentElement,
): ResolvedTheme {
  const theme = resolveTheme(pref, systemDark);
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref); // read by the pre-paint script in index.html
  } catch {
    // storage can be unavailable (private mode); the theme still applies for this session
  }
  return theme;
}
