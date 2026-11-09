import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';
import { speciesEmoji } from '../../ui/PetAvatar';
import { usePhotoUrl } from '../../ui/usePhotoUrl';
import { useNow } from '../../ui/useNow';
import { buildMonthMarks } from '../../domain/calendar';
import { dueStatus, lastMeal, nextFeedingDue, statusLabel } from '../../domain/feeding';
import { formatAge } from '../../domain/age';
import type { ParentRef, Pet } from '../../domain/types';
import { usePetDetail } from './usePetDetail';
import { usePetHusbandry } from './usePetHusbandry';
import { husbandryTiles, sizeStats, type TileKey } from './husbandrySummary';
import { formatDateKey, formatDue } from './format';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import RegurgitationSheet from '../regurgitation/RegurgitationSheet';
import LogPoopSheet from '../poop/LogPoopSheet';
import LogShedSheet from '../sheds/LogShedSheet';
import { useUnits } from '../settings/useUnits';
import { TONE } from './PetsHome';
import './profile.css';

const SEX = { female: '♀ Female', male: '♂ Male', unknown: '' } as const;
const ORIGIN = { captive_bred: 'Captive bred', wild_caught: 'Wild caught', unknown: '' } as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const parentText = (p?: ParentRef) => [p?.name, p?.morph].filter(Boolean).join(' · ');

type QuickSheet = 'feed' | 'regurg' | 'poop' | 'shed';

/** Spec §5.2 item 5. */
const QUICK_LOG: { sheet: QuickSheet; icon: string; label: string }[] = [
  { sheet: 'feed', icon: '🍽️', label: 'Fed' },
  { sheet: 'regurg', icon: '🤢', label: 'Regurg.' },
  { sheet: 'poop', icon: '💩', label: 'Poop' },
  { sheet: 'shed', icon: '🐍', label: 'Shed' },
];

/** Spec §5.2 item 6. */
const TILES: { key: TileKey; path: string; icon: string; name: string }[] = [
  { key: 'sheds', path: 'sheds', icon: '🐍', name: 'Sheds' },
  { key: 'poop', path: 'poop', icon: '💩', name: 'Poop' },
  { key: 'weight', path: 'weight', icon: '⚖️', name: 'Weight' },
  { key: 'habitat', path: 'habitat', icon: '🌡️', name: 'Habitat' },
  { key: 'care', path: 'care', icon: '🧽', name: 'Care tasks' },
  { key: 'vet', path: 'vet', icon: '🩺', name: 'Vet visits' },
  { key: 'notes', path: 'notes', icon: '📝', name: 'Notes' },
];

export default function PetProfile({ now: fixedNow }: { now?: Date }) {
  const { id } = useParams();
  const now = useNow(fixedNow);
  const detail = usePetDetail(id);
  const husbandry = usePetHusbandry(id);
  const units = useUnits();
  const [month, setMonth] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
  const [sheet, setSheet] = useState<QuickSheet | null>(null);
  const heroUrl = usePhotoUrl(detail?.pet?.photoId, 'full');

  if (!detail) return null;
  const { pet, feedings, regurgitations } = detail;
  if (!pet) {
    return (
      <Card>
        <h2>Pet not found</h2>
        <Link to="/">Back to My Reptiles</Link>
      </Card>
    );
  }
  if (!husbandry || !units) return null;

  const due = nextFeedingDue(pet, feedings);
  const status = dueStatus(due, now);
  const marks = buildMonthMarks({
    ...month, feedings, regurgitations, nextDue: due, intervalDays: pet.feedingIntervalDays, now,
  });
  const inMonth = feedings.filter((f) => {
    const d = parseISO(f.at);
    return d.getFullYear() === month.year && d.getMonth() === month.month;
  });
  const meals = inMonth.filter((f) => f.outcome === 'ate').length;
  const refusals = inMonth.length - meals;
  const shift = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const chips = [SEX[pet.sex], pet.birthDate ? formatAge(pet.birthDate, now, pet.birthDateApprox) : '', ORIGIN[pet.origin]]
    .filter(Boolean);
  const tiles = husbandryTiles(husbandry, units, now);
  const size = sizeStats(husbandry.measurements, units);
  const close = () => setSheet(null);

  return (
    <div className="profile">
      <div className="hero" style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}>
        <div className="topbar hero-top">
          <Link to="/">‹ Pets</Link>
          <Link to={`/pets/${pet.id}/edit`}>Edit</Link>
        </div>
        {!heroUrl && <span className="hero-emoji" aria-hidden="true">{speciesEmoji(pet.species)}</span>}
        <div className="hero-name">
          <h1>{pet.name}</h1>
          <div>{[pet.species, pet.morph].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="chips" style={{ margin: '10px 0' }}>
          {chips.map((c) => <span key={c} className="chip">{c}</span>)}
        </div>
      )}

      <Card>
        <div className="row">
          <div className="grow">
            <div className="label" style={{ margin: 0 }}>Next feeding</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{formatDue(due, now)}</div>
            <div className="muted">
              {`Every ${plural(pet.feedingIntervalDays, 'day').replace(/^1 day$/, 'day')}`}
              {pet.usualFoodItem ? ` · ${pet.usualQuantity} ${pet.usualFoodItem}` : ''}
            </div>
          </div>
          <Pill tone={TONE[status]}>{statusLabel(due, now)}</Pill>
        </div>
        <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={() => setSheet('feed')}>
          🍽️ Log feeding
        </button>
      </Card>

      <Card>
        <MonthCalendar {...month} marks={marks} onPrev={() => shift(-1)} onNext={() => shift(1)} />
        <CalendarLegend />
        <div className="row cal-foot">
          <span className="grow muted">{`${plural(meals, 'meal')} · ${plural(refusals, 'refusal')} this month`}</span>
          <Link to={`/pets/${pet.id}/feedings`}>See all ›</Link>
        </div>
      </Card>

      <div className="label">Quick log</div>
      <div className="quick-log">
        {QUICK_LOG.map((q) => (
          <button key={q.sheet} type="button" onClick={() => setSheet(q.sheet)}>
            <span aria-hidden="true">{q.icon}</span>
            {q.label}
          </button>
        ))}
      </div>

      <div className="label">Husbandry</div>
      <div className="tiles">
        {TILES.map((t) => (
          <Link key={t.key} to={`/pets/${pet.id}/${t.path}`} className={t.key === 'notes' ? 'tile wide' : 'tile'}>
            <span className="tile-ic" aria-hidden="true">{t.icon}</span>
            <b>{t.name}</b>
            <span className="muted">{tiles[t.key]}</span>
          </Link>
        ))}
      </div>

      <div className="stats">
        <Stat label="Length" value={size.length} />
        <Stat label="Weight" value={size.weight} />
        <Stat label="Born" value={formatDateKey(pet.birthDate)} />
        <Stat label="Age" value={pet.birthDate ? formatAge(pet.birthDate, now, pet.birthDateApprox) : '—'} />
      </div>

      <Lineage pet={pet} />
      {(pet.acquiredFrom || pet.acquiredDate || pet.pricePaid !== undefined) && (
        <>
          <div className="label">From</div>
          <Card>
            {pet.acquiredFrom && <b>{pet.acquiredFrom}</b>}
            <div className="muted">
              {[pet.acquiredDate && `Bought ${formatDateKey(pet.acquiredDate)}`, pet.pricePaid !== undefined && `$${pet.pricePaid}`]
                .filter(Boolean).join(' · ')}
            </div>
          </Card>
        </>
      )}
      {pet.description && (
        <>
          <div className="label">About</div>
          <Card>{pet.description}</Card>
        </>
      )}

      <LogFeedingSheet
        open={sheet === 'feed'}
        pet={pet}
        lastMealAt={lastMeal(feedings)?.at}
        currentDue={due}
        now={now}
        onClose={close}
      />
      <RegurgitationSheet open={sheet === 'regurg'} pet={pet} now={now} onClose={close} />
      <LogPoopSheet open={sheet === 'poop'} pet={pet} now={now} onClose={close} />
      <LogShedSheet open={sheet === 'shed'} pet={pet} now={now} onClose={close} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Lineage({ pet }: { pet: Pet }) {
  const sire = parentText(pet.sire);
  const dam = parentText(pet.dam);
  if (!sire && !dam) return null;
  return (
    <>
      <div className="label">Lineage</div>
      <Card>
        {sire && <div className="row"><span className="grow">♂ Sire</span><b>{sire}</b></div>}
        {dam && <div className="row"><span className="grow">♀ Dam</span><b>{dam}</b></div>}
      </Card>
    </>
  );
}
