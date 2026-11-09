import { useRef, useState, type ChangeEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { parseBackup, restoreBackup, summarizeBackup, summaryText, type ParsedBackup } from '../../db/backup';
import { BackupError } from '../../db/backupSchema';
import { Sheet } from '../../ui/Sheet';

interface Pending {
  backup: ParsedBackup;
  summary: string;
}

/** Spec §9 import: validate, show a summary, then replace all data in one transaction. */
export function ImportBackup() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const restoringRef = useRef(false); // double-tap guard (state updates land a render later)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires onChange
    if (!file) return;
    setError(undefined);
    setNote(undefined);
    try {
      const backup = parseBackup(await file.text());
      setPending({ backup, summary: summaryText(summarizeBackup(backup)) });
    } catch (err) {
      setError(err instanceof BackupError ? err.message : "Couldn't read that file.");
    }
  };

  const restore = async () => {
    if (!pending || restoringRef.current) return;
    restoringRef.current = true;
    setRestoring(true);
    try {
      await restoreBackup(pending.backup);
      setNote(`Backup imported: ${pending.summary}.`);
    } catch {
      setError('Import failed. Your data was not changed.');
    } finally {
      setPending(null);
      restoringRef.current = false;
      setRestoring(false);
    }
  };

  const cancel = () => {
    if (!restoringRef.current) setPending(null);
  };

  return (
    <div>
      {error && <div role="alert" className="form-error">{error}</div>}
      <label className="btn-ghost" style={{ textAlign: 'center' }}>
        Import backup
        <input type="file" accept="application/json,.json" hidden onChange={onFile} />
      </label>
      {note && <p role="status" className="muted setting-note">{note}</p>}

      <Sheet open={pending !== null} onClose={cancel} title="Import backup">
        {pending && (
          <>
            <h2 className="rounded" style={{ marginTop: 0 }}>Import backup?</h2>
            <p>{`This backup has ${pending.summary}, exported ${format(parseISO(pending.backup.exportedAt), 'MMM d, yyyy')}.`}</p>
            <p className="warn">Importing replaces all data on this iPhone. Export a backup first if you might need what's here now.</p>
            <div className="data-actions">
              <button type="button" className="btn-primary" disabled={restoring} onClick={restore}>Replace all data</button>
              <button type="button" className="btn-ghost" disabled={restoring} onClick={cancel}>Cancel</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
