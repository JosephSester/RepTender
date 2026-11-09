import Dexie from 'dexie';
import type { Note } from '../domain/types';
import { db } from './db';
import { newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface NoteInput {
  petId: string;
  at: string;
  text: string;
}

function checkText(text: string): void {
  if (!text.trim()) throw new ValidationError('Write something first');
}

export async function addNote(input: NoteInput): Promise<Note> {
  requireDateTime(input.at);
  checkText(input.text);
  return db.transaction('rw', [db.pets, db.notes], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const note: Note = { id: newId(), petId: input.petId, at: input.at, text: input.text.trim(), createdAt: ts, updatedAt: ts };
    await db.notes.add(note);
    return note;
  });
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'at' | 'text'>>): Promise<void> {
  if (patch.at !== undefined) requireDateTime(patch.at);
  if (patch.text !== undefined) checkText(patch.text);
  const next: Partial<Note> = { ...patch, updatedAt: nowIso() };
  if (patch.text !== undefined) next.text = patch.text.trim();
  const changed = await db.notes.update(id, next);
  if (!changed) throw new Error(`Note ${id} not found`);
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export const listNotes = (petId: string): Promise<Note[]> =>
  db.notes.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
