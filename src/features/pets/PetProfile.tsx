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
import { formatDateKey, formatDue } from './format';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { TONE } from './PetsHome';
import './profile.css';

const SEX = { female: '♀ Female', male: '♂ Male', unknown: '' } as const;
const ORIGIN = { captive_bred: 'Captive bred', wild_caught: 'Wild caught', unknown: '' } as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const parentText = (p?: ParentRef) => [p?.name, p?.morph].filter(Boolean).join(' · ');

export default function PetProfile({ now: fixedNow }: { now?: Date }) {
  const { id } = useParams();
  const now = useNow(fixedNow);
  const detail = usePetDetail(id);
  const [month, setMonth] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
  const [logOpen, setLogOpen] = useState(false);
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
        <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={() => setLogOpen(true)}>
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

      <div className="stats">
        <Stat label="Length" value="—" />
        <Stat label="Weight" value="—" />
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
        open={logOpen}
        pet={pet}
        lastMealAt={lastMeal(feedings)?.at}
        currentDue={due}
        now={now}
        onClose={() => setLogOpen(false)}
      />
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
