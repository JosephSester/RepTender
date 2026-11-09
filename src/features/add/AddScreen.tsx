import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { lastMeal, nextFeedingDue } from '../../domain/feeding';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { Card } from '../../ui/Card';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import RegurgitationSheet from '../regurgitation/RegurgitationSheet';
import LogPoopSheet from '../poop/LogPoopSheet';
import LogShedSheet from '../sheds/LogShedSheet';
import LogMeasurementSheet from '../weight/LogMeasurementSheet';
import LogHabitatSheet from '../habitat/LogHabitatSheet';
import VetVisitSheet from '../vet/VetVisitSheet';
import NoteSheet from '../notes/NoteSheet';

/** Spec §5.14 entry types, in order. */
const ENTRIES = [
  { type: 'feeding', icon: '🍽️', label: 'Feeding' },
  { type: 'regurgitation', icon: '🤢', label: 'Regurgitation' },
  { type: 'poop', icon: '💩', label: 'Poop' },
  { type: 'shed', icon: '🐍', label: 'Shed' },
  { type: 'weight', icon: '⚖️', label: 'Weight' },
  { type: 'habitat', icon: '🌡️', label: 'Habitat reading' },
  { type: 'vet', icon: '🩺', label: 'Vet visit' },
  { type: 'note', icon: '📝', label: 'Note' },
] as const;

type EntryType = (typeof ENTRIES)[number]['type'];

export default function AddScreen({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const pets = useLiveQuery(() => listActivePets(), []);
  const [picked, setPicked] = useState<string>();
  const [open, setOpen] = useState<EntryType | null>(null);
  // With a single pet the picker is skipped.
  const pet = pets?.length === 1 ? pets[0] : pets?.find((p) => p.id === picked);
  const petId = pet?.id;
  const feedings = useLiveQuery(() => (petId ? listFeedings(petId) : []), [petId]);

  if (!pets) return null;
  const close = () => setOpen(null);

  return (
    <>
      <h1>Add</h1>

      {pets.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <h2 style={{ margin: '4px 0' }}>No reptiles yet</h2>
          <p className="muted">Add a pet first, then log anything for it here.</p>
          <Link className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
            Add a reptile
          </Link>
        </Card>
      ) : (
        <>
          {pets.length > 1 && (
            <>
              <div className="label">Which pet?</div>
              <div className="chips">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip ${p.id === pet?.id ? 'on' : ''}`}
                    aria-pressed={p.id === pet?.id}
                    onClick={() => setPicked(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="label">{pet ? `Log for ${pet.name}` : 'Pick a pet first'}</div>
          <div className="tiles">
            {ENTRIES.map((e) => (
              <button key={e.type} type="button" className="tile" disabled={!pet} onClick={() => setOpen(e.type)}>
                <span className="tile-ic" aria-hidden="true">{e.icon}</span>
                <b>{e.label}</b>
              </button>
            ))}
          </div>
          <Link className="btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
            + Add a new pet
          </Link>
        </>
      )}

      {pet && feedings && (
        <>
          <LogFeedingSheet
            open={open === 'feeding'}
            pet={pet}
            lastMealAt={lastMeal(feedings)?.at}
            currentDue={nextFeedingDue(pet, feedings)}
            now={now}
            onClose={close}
          />
          <RegurgitationSheet open={open === 'regurgitation'} pet={pet} now={now} onClose={close} />
          <LogPoopSheet open={open === 'poop'} pet={pet} now={now} onClose={close} />
          <LogShedSheet open={open === 'shed'} pet={pet} now={now} onClose={close} />
          <LogMeasurementSheet open={open === 'weight'} pet={pet} now={now} onClose={close} />
          <LogHabitatSheet open={open === 'habitat'} pet={pet} now={now} onClose={close} />
          <VetVisitSheet open={open === 'vet'} pet={pet} now={now} onClose={close} />
          <NoteSheet open={open === 'note'} pet={pet} now={now} onClose={close} />
        </>
      )}
    </>
  );
}
