import { expect, it } from 'vitest';
import { parseOptionalNumber } from './numbers';

it('reads a number field: blank is undefined, junk is NaN', () => {
  expect(parseOptionalNumber('42')).toBe(42);
  expect(parseOptionalNumber(' 17.5 ')).toBe(17.5);
  expect(parseOptionalNumber('17,5')).toBe(17.5);
  expect(parseOptionalNumber('')).toBeUndefined();
  expect(parseOptionalNumber('   ')).toBeUndefined();
  expect(parseOptionalNumber('abc')).toBeNaN();
});
