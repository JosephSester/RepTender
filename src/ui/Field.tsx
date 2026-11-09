import type { ReactNode } from 'react';

/** A form row. The label text comes first so getByLabelText(label) finds the control. */
export function Field({ label, stack = false, children }: { label: string; stack?: boolean; children: ReactNode }) {
  return (
    <label className={stack ? 'field stack' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}

interface DateTimeFieldsProps {
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  dateLabel?: string;
  timeLabel?: string;
}

/** Date + time inputs. Combine their values with combineDateTime() (null when cleared). */
export function DateTimeFields({ date, time, onDate, onTime, dateLabel = 'Date', timeLabel = 'Time' }: DateTimeFieldsProps) {
  return (
    <>
      <Field label={dateLabel}>
        <input type="date" value={date} onChange={(e) => onDate(e.target.value)} />
      </Field>
      <Field label={timeLabel}>
        <input type="time" value={time} onChange={(e) => onTime(e.target.value)} />
      </Field>
    </>
  );
}
