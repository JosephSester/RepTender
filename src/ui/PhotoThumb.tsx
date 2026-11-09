import { usePhotoUrl } from './usePhotoUrl';

interface PhotoThumbProps {
  photoId: string;
  onOpen?: () => void;
  onRemove?: () => void;
}

export function PhotoThumb({ photoId, onOpen, onRemove }: PhotoThumbProps) {
  const url = usePhotoUrl(photoId);
  const img = url && <img src={url} alt="" />;
  return (
    <span className="thumb-wrap">
      {onOpen ? (
        <button type="button" className="thumb" aria-label="Open photo" onClick={onOpen}>{img}</button>
      ) : (
        <span className="thumb">{img}</span>
      )}
      {onRemove && (
        <button type="button" className="thumb-remove" aria-label="Remove photo" onClick={onRemove}>✕</button>
      )}
    </span>
  );
}

export function FullPhoto({ photoId }: { photoId: string }) {
  const url = usePhotoUrl(photoId, 'full');
  return url ? <img className="photo-full" src={url} alt="Visit photo" /> : null;
}
