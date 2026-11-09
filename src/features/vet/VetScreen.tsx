import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import type { VetVisit } from '../../domain/types';
import { deleteVetVisit, listVetVisits } from '../../db/vetVisits';
import { Card } from '../../ui/Card';
import { Sheet } from '../../ui/Sheet';
import { FullPhoto, PhotoThumb } from '../../ui/PhotoThumb';
import { useNow } from '../../ui/useNow';
import { formatDateKey, plural } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import { clinicInfo, telHref, upcomingAppointment } from './vetModel';
import VetVisitSheet from './VetVisitSheet';

export default function VetScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const visits = useLiveQuery(() => (petId ? listVetVisits(petId) : undefined), [petId]);
  const [editing, setEditing] = useState<VetVisit | 'new' | null>(null);
  const [viewing, setViewing] = useState<string>();

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!visits) return null;

  const clinic = clinicInfo(visits);
  const next = upcomingAppointment(visits, now);
  const history = [...visits].reverse();

  return (
    <>
      <SubScreenHeader pet={pet} title="Vet visits" addLabel="New vet visit" onAdd={() => setEditing('new')} />

      {next && (
        <Card role="group" aria-label="Next appointment" style={{ marginTop: 12 }}>
          <div className="label" style={{ margin: 0 }}>Next appointment</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{format(next.at, 'EEE, MMM d, yyyy · h:mm a')}</div>
          {(next.visit.clinic ?? clinic?.clinic) && <div className="muted">{next.visit.clinic ?? clinic?.clinic}</div>}
        </Card>
      )}

      {clinic && (
        <>
          <div className="label">Clinic</div>
          <Card>
            {clinic.clinic && <b>{clinic.clinic}</b>}
            <div className="muted">
              {clinic.vet && <span>{clinic.vet}</span>}
              {clinic.vet && clinic.phone && <span> · </span>}
              {clinic.phone && (telHref(clinic.phone) ? <a href={telHref(clinic.phone)}>{clinic.phone}</a> : <span>{clinic.phone}</span>)}
            </div>
          </Card>
        </>
      )}

      <div className="label">History</div>
      {history.length === 0 && <p className="muted">No vet visits logged yet.</p>}
      {history.map((v) => (
        <Card key={v.id} role="article">
          <b>{[formatDateKey(v.date), v.reason].filter(Boolean).join(' · ')}</b>
          {v.notes && <div style={{ marginTop: 2 }}>{v.notes}</div>}
          {(v.cost !== undefined || v.photoIds.length > 0) && (
            <div className="muted">
              {[v.cost !== undefined && `$${v.cost}`, v.photoIds.length > 0 && plural(v.photoIds.length, 'photo')]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {v.photoIds.length > 0 && (
            <div className="thumbs">
              {v.photoIds.map((id) => <PhotoThumb key={id} photoId={id} onOpen={() => setViewing(id)} />)}
            </div>
          )}
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEditing(v)}>Edit</button>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('vet visit', () => deleteVetVisit(v.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}

      <VetVisitSheet
        pet={pet}
        open={editing !== null}
        visit={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
        now={now}
      />
      <Sheet open={viewing !== undefined} onClose={() => setViewing(undefined)} title="Photo">
        {viewing && <FullPhoto photoId={viewing} />}
      </Sheet>
    </>
  );
}
