import { useEffect } from 'react';
import { badgeCount } from '../../domain/schedule';
import { updateAppBadge } from '../../lib/badge';
import { useNow } from '../../ui/useNow';
import { useScheduleSources } from './scheduleSources';

/** Keeps the app icon badge equal to the open late + due-today items (spec §8). Renders nothing. */
export default function AppBadge({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const sources = useScheduleSources();
  const count = sources ? badgeCount(sources.feedings, sources.care, now) : undefined;

  useEffect(() => {
    if (count !== undefined) void updateAppBadge(count);
  }, [count]);

  return null;
}
