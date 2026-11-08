import { format } from 'date-fns';
import { monthCells, type DayMark } from '../domain/calendar';
import { dateKey } from '../domain/dates';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FILL_ORDER: DayMark[] = ['regurgitated', 'ate', 'refused', 'nextDue'];
const MARK_WORDS: Record<DayMark, string> = {
  ate: 'ate',
  refused: 'refused',
  regurgitated: 'regurgitated',
  nextDue: 'next feeding due',
  planned: 'planned feeding',
  today: 'today',
};

export interface MonthCalendarProps {
  year: number;
  month: number;
  marks: Map<string, Set<DayMark>>;
  size?: 'compact' | 'large';
  onPrev: () => void;
  onNext: () => void;
  onSelectDay?: (key: string) => void;
  selectedKey?: string;
  /** Small icon under the day number (large calendar), e.g. 🐭 for a meal. */
  dayIcon?: (key: string) => string | undefined;
}

export function MonthCalendar({
  year, month, marks, size = 'compact', onPrev, onNext, onSelectDay, selectedKey, dayIcon,
}: MonthCalendarProps) {
  const title = format(new Date(year, month, 1), 'MMMM yyyy');
  return (
    <div className={`cal cal-${size}`}>
      <div className="cal-head">
        <button type="button" aria-label="Previous month" onClick={onPrev}>‹</button>
        <b>{title}</b>
        <button type="button" aria-label="Next month" onClick={onNext}>›</button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((d, i) => (
          <div key={`w${i}`} className="cal-dow" aria-hidden="true">{d}</div>
        ))}
        {monthCells(year, month).map((day, i) => {
          if (!day) return <div key={`b${i}`} />;
          const key = dateKey(day);
          const set = marks.get(key) ?? new Set<DayMark>();
          const fill = FILL_ORDER.find((m) => set.has(m));
          const className = [
            'cal-day',
            fill && `is-${fill}`,
            set.has('planned') && 'is-planned',
            set.has('today') && 'is-today',
            selectedKey === key && 'is-selected',
          ].filter(Boolean).join(' ');
          const words = [...set].map((m) => MARK_WORDS[m]);
          const label = `${format(day, 'MMMM d')}${words.length ? `: ${words.join(', ')}` : ''}`;
          const icon = dayIcon?.(key);
          return (
            <button
              key={key}
              type="button"
              className={className}
              aria-label={label}
              disabled={!onSelectDay}
              onClick={() => onSelectDay?.(key)}
            >
              {day.getDate()}
              {icon && <small aria-hidden="true">{icon}</small>}
              {set.has('refused') && size === 'compact' && <span className="cal-x" aria-hidden="true">✕</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  return (
    <div className="cal-legend">
      <span><i className="dot is-ate" />Ate</span>
      <span><i className="dot is-refused" />Refused</span>
      <span><i className="dot is-regurgitated" />Regurgitated</span>
      <span><i className="dot is-nextDue" />Next due</span>
      <span><i className="dot is-planned" />Planned</span>
    </div>
  );
}
