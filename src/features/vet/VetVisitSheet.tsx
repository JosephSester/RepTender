import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Pet, VetVisit } from '../../domain/types';
import { combineDateTime, dateKey, isDateKey } from '../../domain/dates';
import { createVetVisit, listVetVisits, updateVetVisit } from '../../db/vetVisits';
import { deletePhoto, savePhoto } from '../../db/photos';
import { saveErrorText } from '../../db/ids';
import { photoFromFile } from '../../lib/image';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { PhotoThumb } from '../../ui/PhotoThumb';
import { clinicInfo } from './vetModel';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  visit?: VetVisit;
  now?: Date;
}

export default function VetVisitSheet(props: Props) {
  if (!props.open) return null;
  return <VetVisitForm {...props} />;
}

function VetVisitForm({ pet, onClose, visit, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const previous = useLiveQuery(() => listVetVisits(pet.id), [pet.id]);
  const nextAt0 = visit?.nextAppointment ? parseISO(visit.nextAppointment) : undefined;
  const [date, setDate] = useState(visit?.date ?? dateKey(now));
  const [reason, setReason] = useState(visit?.reason ?? '');
  const [clinic, setClinic] = useState(visit?.clinic ?? '');
  const [vet, setVet] = useState(visit?.vet ?? '');
  const [phone, setPhone] = useState(visit?.phone ?? '');
  const [cost, setCost] = useState(visit?.cost === undefined ? '' : String(visit.cost));
  const [notes, setNotes] = useState(visit?.notes ?? '');
  const [photoIds, setPhotoIds] = useState<string[]>(visit?.photoIds ?? []);
  const [added, setAdded] = useState<string[]>([]);
  const [nextDate, setNextDate] = useState(nextAt0 ? dateKey(nextAt0) : '');
  const [nextTime, setNextTime] = useState(nextAt0 ? format(nextAt0, 'HH:mm') : '09:00');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const prefilled = useRef(!!visit);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);

  // A new visit starts with the clinic details from the last visit.
  useEffect(() => {
    if (prefilled.current || !previous) return;
    prefilled.current = true;
    const c = clinicInfo(previous);
    if (!c) return;
    setClinic((v) => v || c.clinic || '');
    setVet((v) => v || c.vet || '');
    setPhone((v) => v || c.phone || '');
  }, [previous]);

  const nextAt = nextDate === '' ? undefined : combineDateTime(nextDate, nextTime);
  const valid = isDateKey(date) && nextAt !== null;
  const title = visit ? 'Edit vet visit' : 'New vet visit';

  async function onPhotos(files: File[]) {
    setError(undefined);
    for (const file of files) {
      try {
        const id = await savePhoto(await photoFromFile(file));
        if (closed.current) {
          // The sheet was dismissed while this photo was being processed.
          deletePhoto(id).catch(() => {});
          return;
        }
        setPhotoIds((ids) => [...ids, id]);
        setAdded((ids) => [...ids, id]);
      } catch {
        setError("Couldn't read that photo.");
      }
    }
  }

  function removePhoto(id: string) {
    setPhotoIds((ids) => ids.filter((x) => x !== id));
    // A photo added in this sheet is deleted now; one already saved on the visit is deleted on Save.
    if (added.includes(id)) {
      setAdded((ids) => ids.filter((x) => x !== id));
      deletePhoto(id).catch(() => {});
    }
  }

  function cancel() {
    // Dismissing mid-save would delete photos the visit being saved references.
    if (saving) return;
    for (const id of added) deletePhoto(id).catch(() => {});
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    const c = parseOptionalNumber(cost);
    if (Number.isNaN(c)) return setError('Cost must be a number');
    setError(undefined);
    setSaving(true);
    const input = {
      date, reason, clinic, vet, phone, notes, cost: c, photoIds,
      nextAppointment: nextAt ? nextAt.toISOString() : undefined,
    };
    try {
      if (visit) await updateVetVisit(visit.id, input);
      else await createVetVisit({ petId: pet.id, ...input });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={cancel} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title={title} subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Visit date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reason">
          <input value={reason} placeholder="Wellness exam" onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Clinic">
          <input value={clinic} onChange={(e) => setClinic(e.target.value)} />
        </Field>
        <Field label="Vet">
          <input value={vet} onChange={(e) => setVet(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Cost ($)">
          <input type="number" inputMode="decimal" step="any" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Notes" stack>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="label">Photos</div>
        {photoIds.length > 0 && (
          <div className="thumbs">
            {photoIds.map((id) => <PhotoThumb key={id} photoId={id} onRemove={() => removePhoto(id)} />)}
          </div>
        )}
        <label className="btn-ghost" style={{ textAlign: 'center', marginTop: 8, marginBottom: 8 }}>
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = ''; // so picking the same photo again still fires
              void onPhotos(files);
            }}
          />
        </label>

        <Field label="Next appointment">
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
        {nextDate !== '' && (
          <Field label="Appointment time">
            <input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
          </Field>
        )}
        {/* iOS date/time inputs have no clear control of their own. */}
        {nextDate !== '' && (
          <button
            type="button"
            className="btn-ghost"
            style={{ marginBottom: 8 }}
            onClick={() => {
              setNextDate('');
              setNextTime('09:00');
            }}
          >
            Clear next appointment
          </button>
        )}

        <button type="submit" className="btn-primary" disabled={saving || !valid}>Save visit</button>
      </form>
    </Sheet>
  );
}
