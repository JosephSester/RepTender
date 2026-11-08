import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPhoto } from '../db/photos';

/** Object URL for a stored photo. Revoked automatically when the photo or component changes. */
export function usePhotoUrl(photoId: string | undefined, variant: 'thumb' | 'full' = 'thumb'): string | undefined {
  const photo = useLiveQuery(() => (photoId ? getPhoto(photoId) : undefined), [photoId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(variant === 'thumb' ? photo.thumbBlob : photo.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo, variant]);
  return url;
}
