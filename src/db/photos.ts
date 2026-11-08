import { db } from './db';
import { newId, nowIso } from './ids';

export async function savePhoto(p: { blob: Blob; thumbBlob: Blob; width: number; height: number }): Promise<string> {
  const ts = nowIso();
  const id = newId();
  await db.photos.add({ id, ...p, createdAt: ts, updatedAt: ts });
  return id;
}

export const getPhoto = (id: string) => db.photos.get(id);
export const deletePhoto = (id: string) => db.photos.delete(id);
