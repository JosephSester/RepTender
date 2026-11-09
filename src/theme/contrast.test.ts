import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// npm test runs from the project root.
const css = readFileSync('src/theme/tokens.css', 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const stops = (gradient: string) => gradient.match(/#[0-9a-f]{6}/gi) ?? [];

describe.each([
  ['light', tokens(':root,')],
  ['dark', tokens(":root[data-theme='dark']")],
])('%s theme text contrast (WCAG AA, 4.5:1)', (_name, t) => {
  it('refused calendar days', () => {
    expect(contrast(t['late-text']!, t['late-bg']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('regurgitated calendar days', () => {
    expect(contrast(t['on-late-fill']!, t['late-text']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('next-due calendar days', () => {
    expect(contrast(t['on-amber']!, t['amber']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('hungry banner text on every gradient stop', () => {
    const colors = stops(t['banner']!);
    expect(colors.length).toBeGreaterThan(1);
    for (const c of colors) expect(contrast(t['on-banner']!, c)).toBeGreaterThanOrEqual(4.5);
  });
});
