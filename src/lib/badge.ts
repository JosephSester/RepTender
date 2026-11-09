type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Spec §8: the home-screen icon badge (iOS 16.4+ for home-screen web apps).
 * Skipped without error where the Badging API is missing, not allowed, or fails.
 */
export async function updateAppBadge(count: number): Promise<void> {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    // Nice to have, never an error (spec §15).
  }
}
