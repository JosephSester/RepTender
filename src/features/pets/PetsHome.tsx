import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { listArchivedPets, unarchivePet } from '../../db/pets';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { PetAvatar } from '../../ui/PetAvatar';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { usePetSummaries, type PetSummary } from './usePetSummaries';

export const TONE: Record<PetSummary['status'], PillTone> = { late: 'late', today: 'due', soon: 'ok' };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function bannerLine(s: PetSummary): string {
  const when = s.status === 'today' && s.due ? 'Due today' : s.label;
  const food = s.pet.usualFoodItem ? ` · ${s.pet.usualQuantity} ${s.pet.usualFoodItem}` : '';
  return `${when}${food}`;
}

export default function PetsHome({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const summaries = usePetSummaries(now);
  const archived = useLiveQuery(() => listArchivedPets(), []);
  const [logFor, setLogFor] = useState<PetSummary | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  if (!summaries) return null;

  const today = summaries.filter((s) => s.status === 'today').length;
  const late = summaries.filter((s) => s.status === 'late').length;
  const subtitle = [
    plural(summaries.length, 'pet'),
    today ? `${today} due today` : '',
    late ? `${late} late` : '',
  ].filter(Boolean).join(' · ');
  const urgent = summaries.find((s) => s.status !== 'soon');

  async function onUnarchive(id: string) {
    try {
      await unarchivePet(id);
    } catch {
      window.alert('Could not unarchive. Please try again.');
    }
  }

  return (
    <>
      <h1>My Reptiles</h1>
      <div className="muted">{subtitle}</div>

      {urgent && (
        <div className="banner">
          <div className="row">
            <div className="grow">
              <div className="rounded" style={{ fontSize: 17 }}>{`${urgent.pet.name} is hungry`}</div>
              <div>{bannerLine(urgent)}</div>
            </div>
            <button type="button" className="btn" onClick={() => setLogFor(urgent)}>Log</button>
          </div>
        </div>
      )}

      {summaries.length === 0 && (
        <Card>
          <h2 style={{ margin: '4px 0' }}>No reptiles yet</h2>
          <p className="muted">Add your first pet to start tracking feedings.</p>
          <Link className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
            Add your first reptile
          </Link>
        </Card>
      )}

      {summaries.map((s) => (
        <Link key={s.pet.id} to={`/pets/${s.pet.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <Card>
            <div className="row">
              <PetAvatar photoId={s.pet.photoId} species={s.pet.species} />
              <div className="grow">
                <h3 style={{ margin: 0, fontSize: 16 }}>{s.pet.name}</h3>
                <div className="muted">{[s.pet.species, s.pet.morph].filter(Boolean).join(' · ')}</div>
                <div className={`bar ${s.status === 'late' ? 'late' : s.status === 'today' ? 'due' : ''}`}>
                  <i style={{ width: `${Math.round(s.progress * 100)}%` }} />
                </div>
              </div>
              <Pill tone={TONE[s.status]}>{s.label}</Pill>
            </div>
          </Card>
        </Link>
      ))}

      {summaries.length > 0 && (
        <Link className="btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
          + Add reptile
        </Link>
      )}

      {archived && archived.length > 0 && (
        <>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginTop: 8 }}
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
          </button>
          {showArchived && (
            <div style={{ marginTop: 8 }}>
              {archived.map((p) => (
                <Card key={p.id} role="group" aria-label={`${p.name} (archived)`}>
                  <div className="row">
                    <PetAvatar photoId={p.photoId} species={p.species} />
                    <div className="grow">
                      <h3 style={{ margin: 0, fontSize: 16 }}>{p.name}</h3>
                      <div className="muted">{`Archived ${format(parseISO(p.archivedAt!), 'MMM d, yyyy')}`}</div>
                    </div>
                    <button type="button" className="btn" onClick={() => onUnarchive(p.id)}>Unarchive</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {logFor && (
        <LogFeedingSheet
          open
          pet={logFor.pet}
          lastMealAt={logFor.meal?.at}
          currentDue={logFor.due}
          now={now}
          onClose={() => setLogFor(null)}
        />
      )}
    </>
  );
}
