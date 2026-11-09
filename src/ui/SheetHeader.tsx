import { PetAvatar } from './PetAvatar';

interface SheetHeaderProps {
  photoId?: string;
  species: string;
  title: string;
  subtitle?: string;
}

export function SheetHeader({ photoId, species, title, subtitle }: SheetHeaderProps) {
  return (
    <div className="row" style={{ marginBottom: 4 }}>
      <PetAvatar photoId={photoId} species={species} size={40} />
      <div>
        <div className="rounded" style={{ fontSize: 18 }}>{title}</div>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
    </div>
  );
}
