import { describe, expect, it } from 'vitest';
import {
  displayLength, displayTemp, displayWeight, formatHumidity, formatLength, formatTemp, formatWeight,
  lengthFromMm, lengthToMm, roundTo, tempFromC, tempToC, weightFromG, weightToG,
} from './units';

describe('conversions (spec §7 rule 10)', () => {
  it('temperature both ways', () => {
    expect(tempFromC(30, 'F')).toBeCloseTo(86, 6);
    expect(tempToC(86, 'F')).toBeCloseTo(30, 6);
    expect(tempFromC(30, 'C')).toBe(30);
    expect(tempToC(30, 'C')).toBe(30);
  });
  it('weight both ways', () => {
    expect(weightToG(1, 'oz')).toBeCloseTo(28.3495, 4);
    expect(weightToG(1, 'lb')).toBeCloseTo(453.5924, 4);
    expect(weightFromG(453.59237, 'lb')).toBeCloseTo(1, 6);
    expect(weightFromG(42, 'g')).toBe(42);
  });
  it('length both ways', () => {
    expect(lengthToMm(18, 'in')).toBeCloseTo(457.2, 6);
    expect(lengthToMm(45, 'cm')).toBe(450);
    expect(lengthFromMm(457.2, 'cm')).toBeCloseTo(45.72, 6);
  });
});

describe('display rounding', () => {
  it('rounds to a number of decimals', () => {
    expect(roundTo(17.46, 1)).toBe(17.5);
    expect(roundTo(87.98, 0)).toBe(88);
  });
  it('g and °F to whole numbers, in to 1 decimal place', () => {
    expect(formatWeight(41.6, 'g')).toBe('42 g');
    expect(formatTemp(31.1, 'F')).toBe('88°F');
    expect(formatLength(457.2, 'in')).toBe('18 in');
    expect(formatLength(444.5, 'in')).toBe('17.5 in');
  });
  it('the other units', () => {
    expect(formatWeight(42.52, 'oz')).toBe('1.5 oz');
    expect(formatWeight(1000, 'lb')).toBe('2.2 lb');
    expect(formatTemp(31.14, 'C')).toBe('31.1°C');
    expect(formatLength(457.2, 'cm')).toBe('45.7 cm');
    expect(formatHumidity(52.4)).toBe('52%');
  });
  it('a value typed in the user unit shows back exactly', () => {
    expect(displayTemp(tempToC(88, 'F'), 'F')).toBe(88);
    expect(displayWeight(weightToG(1.5, 'oz'), 'oz')).toBe(1.5);
    expect(displayLength(lengthToMm(17.5, 'in'), 'in')).toBe(17.5);
  });
});
