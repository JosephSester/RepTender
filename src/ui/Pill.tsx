import type { ReactNode } from 'react';

export type PillTone = 'ok' | 'due' | 'late' | 'neutral';

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
