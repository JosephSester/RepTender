import { useEffect, useState } from 'react';
import { readStorageEstimate, storageWarning } from '../../lib/storage';

/** The Settings storage warning (spec §9), checked once when Settings opens. */
export function useStorageWarning(): string | null {
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void readStorageEstimate().then((estimate) => {
      if (live) setWarning(storageWarning(estimate));
    });
    return () => {
      live = false;
    };
  }, []);
  return warning;
}
