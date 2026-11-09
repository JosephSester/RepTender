import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Note } from '../../domain/types';
import { deleteNote, listNotes } from '../../db/notes';
import { Card } from '../../ui/Card';
import { useNow } from '../../ui/useNow';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import NoteSheet from './NoteSheet';

export default function NotesScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const notes = useLiveQuery(() => (petId ? listNotes(petId) : undefined), [petId]);
  const [editing, setEditing] = useState<Note | 'new' | null>(null);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!notes) return null;
  const newestFirst = [...notes].reverse();

  return (
    <>
      <SubScreenHeader pet={pet} title="Notes" addLabel="New note" onAdd={() => setEditing('new')} />
      <div style={{ marginTop: 12 }} />
      {newestFirst.length === 0 && <p className="muted">No notes yet.</p>}
      {newestFirst.map((n) => (
        <Card key={n.id} role="article">
          <b>{format(parseISO(n.at), 'EEE, MMM d, yyyy · h:mm a')}</b>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.text}</div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEditing(n)}>Edit</button>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('note', () => deleteNote(n.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}
      <NoteSheet
        pet={pet}
        open={editing !== null}
        note={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
        now={now}
      />
    </>
  );
}
