import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isValid } from 'date-fns';
import { nextFeedingDue } from '../../domain/feeding';
import { feedingEvent } from '../../domain/reminders';
import { getPet } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { deliverFile } from '../../lib/deliver';
import { formatDue } from '../pets/format';
import { calendarFile, REMINDER_FILE } from './calendarFile';
import { hideRemindToast, TOAST_MS, useRemindToast } from './toastStore';

/** Spec §5.3: after a feeding is saved, offer to put the next one in Calendar (spec §8). */
export default function RemindToast({ now: fixedNow }: { now?: Date }) {
  const toast = useRemindToast();
  const petId = toast?.petId;
  const data = useLiveQuery(async () => {
    if (!petId) return null;
    const pet = await getPet(petId);
    return pet ? { pet, feedings: await listFeedings(petId) } : null;
  }, [petId]);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    if (!toast || sharing) return;
    const id = window.setTimeout(hideRemindToast, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast, sharing]);

  if (!toast || !data || data.pet.id !== toast.petId) return null;
  const now = fixedNow ?? new Date();
  const due = nextFeedingDue(data.pet, data.feedings);
  const upcoming = !!due && isValid(due) && due.getTime() > now.getTime();

  const remind = async () => {
    if (!due || sharing) return;
    setSharing(true);
    try {
      // Built and shared synchronously inside the tap (see deliverFile).
      await deliverFile(calendarFile([feedingEvent(data.pet, due)], REMINDER_FILE));
      hideRemindToast();
    } catch {
      setError("Couldn't create the calendar event.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="toast" role="status" aria-label="Feeding saved">
      <div className="grow">
        <b>Feeding saved</b>
        <div className="toast-sub">{error ?? `Next feeding ${formatDue(due, now)}`}</div>
      </div>
      {upcoming && (
        <button type="button" className="btn" disabled={sharing} onClick={remind}>
          📅 Remind me
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={hideRemindToast}>
        ✕
      </button>
    </div>
  );
}
