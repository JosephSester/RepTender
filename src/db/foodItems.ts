import type { FoodItem } from '../domain/types';
import { db, DEFAULT_FOOD_ITEMS } from './db';
import { newId, nowIso, ValidationError } from './ids';

const rank = (f: FoodItem) => (f.isCustom ? DEFAULT_FOOD_ITEMS.length : DEFAULT_FOOD_ITEMS.indexOf(f.name));

export async function listFoodItems(): Promise<FoodItem[]> {
  const all = await db.foodItems.toArray();
  return all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export async function addFoodItem(name: string): Promise<FoodItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError('Enter a food name');
  const existing = await db.foodItems.where('name').equalsIgnoreCase(trimmed).first();
  if (existing) return existing;
  const ts = nowIso();
  const item: FoodItem = { id: newId(), name: trimmed, isCustom: true, createdAt: ts, updatedAt: ts };
  await db.foodItems.add(item);
  return item;
}
