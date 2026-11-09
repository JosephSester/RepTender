import { useRef, useState } from 'react';
import { createBackupFile, markBackedUp } from '../../db/backup';
import { deliverFile } from '../../lib/deliver';
import { formatBytes } from '../../lib/storage';

/**
 * Spec §9 export, in two taps: "Export backup" builds the file, "Save backup file" shares it.
 * iOS only opens the share sheet when navigator.share runs right inside a tap, and building the
 * file (database reads, photo encoding) takes too long to do first.
 */
export function ExportBackupButton() {
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [skipped, setSkipped] = useState(0); // photos that couldn't be read and were left out of the file
  const busy = useRef(false); // double-tap guard (state updates land a render later)

  const prepare = async () => {
    if (busy.current) return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    setNote(undefined);
    setSkipped(0);
    try {
      const made = await createBackupFile();
      setSkipped(made.skippedPhotos);
      setFile(made.file);
    } catch {
      setError("Couldn't make the backup. Please try again.");
    } finally {
      busy.current = false;
      setPreparing(false);
    }
  };

  const save = async (ready: File) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    let delivered = false;
    try {
      const result = await deliverFile(ready); // first thing in the tap
      if (result !== 'cancelled') {
        delivered = true;
        await markBackedUp();
        setFile(null);
        setNote(result === 'shared' ? 'Backup saved.' : `Downloaded ${ready.name}.`);
      }
    } catch {
      if (delivered) {
        // The file went out, only the "last backup" date could not be written.
        setFile(null);
        setError("The backup was saved, but the last backup date couldn't be recorded.");
      } else {
        setError("Couldn't save the backup. Please try again.");
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <div>
      {error && <div role="alert" className="form-error">{error}</div>}
      {file ? (
        <>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => save(file)}>
            {`Save backup file (${formatBytes(file.size)})`}
          </button>
          <p className="muted setting-note">Pick Save to Files (or iCloud Drive, AirDrop, Mail).</p>
        </>
      ) : (
        <button type="button" className="btn-ghost" disabled={preparing} onClick={prepare}>
          {preparing ? 'Preparing backup…' : 'Export backup'}
        </button>
      )}
      {skipped > 0 && (
        <p role="alert" className="setting-note warn">
          {skipped === 1
            ? "1 photo couldn't be read and was left out."
            : `${skipped} photos couldn't be read and were left out.`}{' '}
          Everything else is in the backup.
        </p>
      )}
      {note && <p role="status" className="muted setting-note">{note}</p>}
    </div>
  );
}
