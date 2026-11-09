import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet } from './pets';
import { addNote, deleteNote, listNotes, updateNote } from './notes';
import { ValidationError } from './ids';

const at = (d: number) => new Date(2026, 10, d, 19, 0).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('adds, lists oldest first, edits and deletes notes', async () => {
  await addNote({ petId, at: at(7), text: 'Moved to the 40-gal tank.' });
  const first = await addNote({ petId, at: at(2), text: '  Eyes going blue.\nSkipped a meal.  ' });
  expect(first.text).toBe('Eyes going blue.\nSkipped a meal.');
  expect((await listNotes(petId)).map((n) => n.at)).toEqual([at(2), at(7)]);
  await updateNote(first.id, { text: 'Eyes blue', at: at(3) });
  expect((await listNotes(petId))[0]).toMatchObject({ text: 'Eyes blue', at: at(3) });
  await deleteNote(first.id);
  expect(await listNotes(petId)).toHaveLength(1);
});

it('rejects an empty note, a bad time and a missing pet', async () => {
  await expect(addNote({ petId, at: at(2), text: '   ' })).rejects.toBeInstanceOf(ValidationError);
  await expect(addNote({ petId, at: '', text: 'Hi' })).rejects.toBeInstanceOf(ValidationError);
  await expect(addNote({ petId: 'missing', at: at(2), text: 'Hi' })).rejects.toThrow('not found');
  await expect(updateNote('missing', { text: 'Hi' })).rejects.toThrow('not found');
});
