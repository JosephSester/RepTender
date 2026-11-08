import { expect, it } from 'vitest';
import { foodIcon } from './foodIcon';

it('picks an icon by food name', () => {
  expect(foodIcon('Pinky mouse')).toBe('🐭');
  expect(foodIcon('Rat pup')).toBe('🐭');
  expect(foodIcon('Crickets')).toBe('🦗');
  expect(foodIcon('Dubia roaches')).toBe('🪳');
  expect(foodIcon('Mealworms')).toBe('🪱');
  expect(foodIcon('Greens')).toBe('🥬');
  expect(foodIcon('Pellets')).toBe('🍽️');
});
