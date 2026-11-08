import { usePhotoUrl } from './usePhotoUrl';

export function speciesEmoji(species: string): string {
  const s = species.toLowerCase();
  if (/(snake|python|boa|hognose|kingsnake|milk)/.test(s)) return '🐍';
  if (/(tortoise|turtle|terrapin)/.test(s)) return '🐢';
  if (/(dragon|uromastyx|tegu|monitor|iguana)/.test(s)) return '🐉';
  if (/(frog|toad)/.test(s)) return '🐸';
  return '🦎';
}

interface PetAvatarProps {
  photoId?: string;
  species: string;
  size?: number;
  round?: boolean;
}

export function PetAvatar({ photoId, species, size = 44, round = false }: PetAvatarProps) {
  const url = usePhotoUrl(photoId);
  return (
    <div
      className="pet-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.55, borderRadius: round ? '50%' : size * 0.3 }}
    >
      {url ? <img src={url} alt="" /> : speciesEmoji(species)}
    </div>
  );
}
