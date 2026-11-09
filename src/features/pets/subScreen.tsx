import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Pet } from '../../domain/types';
import { getPet } from '../../db/pets';
import { Card } from '../../ui/Card';

/** The pet named by the `:id` route param: undefined while loading, null when it doesn't exist. */
export function useRoutePet(): Pet | null | undefined {
  const { id } = useParams();
  return useLiveQuery(async () => (id ? ((await getPet(id)) ?? null) : null), [id]);
}

export function PetNotFound() {
  return (
    <Card>
      <h2>Pet not found</h2>
      <Link to="/">Back to My Reptiles</Link>
    </Card>
  );
}

interface SubScreenHeaderProps {
  pet: Pet;
  title: string;
  subtitle?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
}

/** Top of every husbandry screen: "‹ <pet>" back to the profile, a ＋ button and the title. */
export function SubScreenHeader({ pet, title, subtitle, addLabel, onAdd }: SubScreenHeaderProps) {
  return (
    <>
      <div className="topbar">
        <Link to={`/pets/${pet.id}`}>{`‹ ${pet.name}`}</Link>
        {onAdd && (
          <button type="button" aria-label={addLabel} onClick={onAdd} style={{ fontSize: 22 }}>＋</button>
        )}
      </div>
      <h1>{title}</h1>
      {subtitle && <div className="muted">{subtitle}</div>}
    </>
  );
}

/** Asks first, then deletes; a failed delete shows an alert instead of failing silently (spec §11). */
export async function confirmDelete(what: string, remove: () => Promise<unknown>): Promise<void> {
  if (!window.confirm(`Delete this ${what}? This can’t be undone.`)) return;
  try {
    await remove();
  } catch {
    window.alert('Could not delete. Please try again.');
  }
}
