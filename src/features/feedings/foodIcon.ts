export function foodIcon(foodItem: string): string {
  const f = foodItem.toLowerCase();
  if (/(mouse|mice|rat|pinky|fuzzy|hopper)/.test(f)) return '🐭';
  if (/cricket/.test(f)) return '🦗';
  if (/(dubia|roach)/.test(f)) return '🪳';
  if (/(worm|larva)/.test(f)) return '🪱';
  if (/(green|veg|weed|leaf|salad)/.test(f)) return '🥬';
  return '🍽️';
}
