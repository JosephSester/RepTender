/** Text from a number field: undefined when blank, NaN when it isn't a number. Accepts a decimal comma. */
export function parseOptionalNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
