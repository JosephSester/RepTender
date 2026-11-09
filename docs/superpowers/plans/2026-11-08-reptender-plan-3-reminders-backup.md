# RepTender Plan 3: Reminders & Backup: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish RepTender v1 on top of the live Plan 2 app: the Settings Units picker; Calendar reminders as `.ics` files (the "📅 Remind me" toast after Log a Feeding, "Add to Calendar" on care tasks and the next vet appointment, and "Add all reminders"); the app icon badge; backup export and import with validation, a summary, a 30-day reminder and a storage warning; and a top-level error screen that can still export a backup. Also the ledger carry-overs: the feeding-interval cap, invalid-date guards and a smaller main chunk.

**Architecture:** Same layering as Plans 1–2. Pure rules go in `src/domain/`: the `.ics` generator, the reminder event builders, the badge count and the backup age. File delivery (share sheet, else download), base64 and storage helpers go in `src/lib/`. The backup's read/validate/replace logic lives in `src/db/`. The UI pieces go in `src/features/reminders/`, `src/features/backup/` and the existing Settings, Schedule, Care and Vet screens. **No Dexie schema change**: the database stays at version 2, and the backup file records that number.

**Tech Stack:** Vite 8 (Rolldown), React 19, TypeScript 5.9, React Router 7 (HashRouter), Dexie 4 + dexie-react-hooks, date-fns 4, vite-plugin-pwa 2, Vitest 5 + jsdom + Testing Library + fake-indexeddb. **No new dependencies.** Web APIs: `navigator.share` / `canShare` (files), `navigator.setAppBadge` / `clearAppBadge`, `navigator.storage.estimate` / `persist`.

**Spec:** `docs/superpowers/specs/2026-11-08-reptender-design.md`. Read §5.3, §5.10, §5.11, §5.13, §5.15, §8, §9, §11, §12 and §15 before starting. Also read `docs/superpowers/plans/2026-11-08-reptender-plan-1-ledger.md` and `docs/superpowers/plans/2026-11-08-reptender-plan-2-ledger.md` (the review rulings and carry-overs this plan folds in).

**Validation:** the plan author applied every task's code in order to a scratch copy of `main` (`4f83d8c`) outside the repo. After each task `tsc --noEmit` was clean and the full suite passed; the "confirm they fail" steps were run and fail as described. `npm run build` was clean (no chunk-size warning), and the final suite passed 3 runs in a row. A browser rehearsal on localhost also checked the toast, the Units picker (it found the `updateSettings` lost-update race fixed in Task 2), the crash screen, and a real-Blob photo export → import round trip.

## Global Constraints

- Developer machine: Windows 11, Node v24.13.0, npm 11.6.2. Commands below are shell-agnostic `npm`/`npx`/`git` calls.
- Package versions are the ones Plans 1–2 installed (`react@19.3.1 react-dom@19.3.1 react-router-dom@7.18.5 dexie@4.4.7 dexie-react-hooks@4.4.0 date-fns@4.4.0 vite@8.3.6 vite-plugin-pwa@2.0.0`, `vitest@5.1.0 jsdom@31.0.0 @testing-library/react@16.3.3 @testing-library/user-event@14.6.8 fake-indexeddb@6.2.8 typescript@5.9.3`). **Do not install or upgrade anything.**
- Vite `base` and the PWA `scope`/`start_url` stay `/RepTender/`. The site is served at `https://josephsester.github.io/RepTender/`.
- Routing: `HashRouter` only (GitHub Pages has no server rewrites).
- **The phone holds real data in Dexie schema version 2.** Plan 3 makes no schema change. Never change `db.version(...)` stores, and never write code that clears tables, except `restoreBackup` after the user confirms an import.
- Canonical units in the DB: grams, millimetres, °C. All IDs come from `crypto.randomUUID()`. Timestamps are ISO strings (`new Date().toISOString()`). Date-only fields use `yyyy-MM-dd`.
- All date comparisons use **calendar days in the phone's local time zone** (date-fns `differenceInCalendarDays`, `isSameDay`, `startOfDay`).
- Calendar events (spec §8): single events (never `RRULE`), an alert at the start (`TRIGGER:PT0S`), UTC times, CRLF line endings, stable UIDs `<id>-<yyyy-MM-dd>@reptender`.
- **Sharing must start inside the tap.** Anything that calls `deliverFile` builds its file synchronously from data already loaded, and calls `deliverFile` before any `await`. iOS refuses `navigator.share` once the user gesture has expired. The backup export is two taps for this reason (Task 9).
- Never call `format()` / `toISOString()` on a date that might be invalid (a stored out-of-range interval, a cleared input, an imported value). Check with `isValid` / `isDateKey` first, or use the guarded helpers (`formatDue`, `formatDateKey`, `statusLabel`, `formatDay`).
- Every one-tap write is guarded against double taps (an in-flight ref or a `disabled` flag that is set before the first `await`). Every failed write shows an inline `role="alert"` message (spec §11).
- Text inputs stay at 16px (set in `src/theme/base.css`) so iOS never zooms. Do not set a smaller `font-size` on any `input`, `select` or `textarea`.
- Layering: `src/domain/` imports only `date-fns` and other `src/domain/` files. `src/lib/` has no React and no DB. `src/ui/` never imports `src/db/` (except the existing `usePhotoUrl`). `src/db/` may import `src/domain/` and `src/lib/`. Features may import all of them.
- Tests pass a fixed `now` where a screen takes one. A test that stubs anything (`window.confirm`, `console.error`, `URL.createObjectURL`, `navigator.share`, `Blob`, …) restores it in `afterEach` (`vi.restoreAllMocks()`, `vi.unstubAllGlobals()`, `unmockShare()`, `delete navigator.<api>`). A test that starts async work (a save, a share, a restore) waits for it to finish (`vi.waitFor` / `findBy…`) before it ends.
- jsdom has no Web Share API, no Badging API and no `navigator.storage`; tests define them with `Object.defineProperty(navigator, …, { configurable: true })` and delete them afterwards. fake-indexeddb only keeps **real** Blobs: tests that store and read back photo bytes use `vi.stubGlobal('Blob', (await import('node:buffer')).Blob)` (imported statically as `import { Blob as NodeBlob } from 'node:buffer'`).
- Windows file names are case-insensitive: never create two files in one folder whose names differ only in case (for example `RemindToast.tsx` and `remindToast.ts`).
- Commits: small and frequent, conventional style (`feat:`, `fix:`, `test:`, `chore:`). Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `npm test` and `npm run typecheck` before every commit. Both must pass.
- **Do not push.** Implementers commit on their branch only. The controller merges to `main` and pushes as the **JosephSester** account (`GH_TOKEN="$(gh auth token --user JosephSester)" git push`, Git Bash), which deploys to GitHub Pages.

## File Structure (new and changed in Plan 3)

```
vite.config.ts                         + vendor code splitting (react / vendor chunks)
src/
  main.tsx                             + ui/settings.css, ui/toast.css; ErrorBoundary around App; persist() catch
  app/App.tsx                          + <AppBadge />, route /crash-test
  app/AppShell.tsx                     + <RemindToast />
  app/ErrorBoundary.tsx                error boundary + CrashScreen (Reload, Export backup)
  app/CrashTest.tsx                    #/crash-test (throws on purpose, for the iPhone checklist)
  domain/feeding.ts                    + MAX_FEEDING_INTERVAL_DAYS, isValidFeedingInterval, invalid-date guards
  domain/ics.ts                        CalendarEvent, eventUid, buildIcs (escaping, folding, VALARM)
  domain/reminders.ts                  feedingEvent, careEvent, vetEvent, allReminders
  domain/schedule.ts                   + badgeCount
  domain/backupStatus.ts               "Last backup N days ago", amber after 30 days
  db/pets.ts                           interval cap (1–365)
  db/settings.ts                       atomic updateSettings
  db/backupSchema.ts                   BackupError, BackupTables, per-table validation, references, v1 → v2
  db/backup.ts                         readAllTables, pruneOrphans, createBackup(File), parseBackup, restoreBackup, summary
  lib/deliver.ts                       deliverFile: navigator.share({ files }) → download link fallback
  lib/badge.ts                         updateAppBadge (setAppBadge / clearAppBadge, never throws)
  lib/base64.ts                        blobToDataUrl, dataUrlToBlob
  lib/storage.ts                       storageWarning (> 80%), readStorageEstimate, formatBytes
  features/pets/format.ts              formatDue / formatDateKey guards, formatMoney
  features/pets/PetForm.tsx            interval input max 365
  features/pets/PetProfile.tsx         formatMoney
  features/feedings/LogFeedingSheet.tsx  shows the Remind me toast after a save
  features/reminders/calendarFile.ts   calendarFile (text/calendar File)
  features/reminders/toastStore.ts     showRemindToast / hideRemindToast / useRemindToast
  features/reminders/RemindToast.tsx   "Feeding saved · Next feeding … · 📅 Remind me"
  features/reminders/RemindersButton.tsx  "Add all reminders" (Schedule + Settings)
  features/schedule/scheduleSources.ts loadScheduleSources / useScheduleSources (shared data)
  features/schedule/ScheduleScreen.tsx uses useScheduleSources, + Add all reminders
  features/schedule/AppBadge.tsx       keeps the icon badge in sync
  features/care/CareTasksScreen.tsx    + 📅 Add <task> to Calendar
  features/vet/VetScreen.tsx           + 📅 Add to Calendar on Next appointment, formatMoney
  features/settings/UnitsCard.tsx      °F/°C · g/oz/lb · in/cm
  features/settings/SettingsScreen.tsx Units card, "Reminders & data" card (reminders, export, last backup, import, storage)
  features/backup/ExportBackupButton.tsx  two-tap export (prepare → save), records lastBackupAt
  features/backup/ImportBackup.tsx     file picker → summary sheet → Replace all data
  features/backup/useStorageWarning.ts storage estimate on Settings open
  ui/settings.css                      Settings rows, amber .warn, .data-actions
  ui/toast.css                         toast, crash screen
  test/share.ts                        mockShare / unmockShare / stubObjectUrls (test helper)
docs/iphone-checklist.md               + Plan 3 checks 17–25 (Calendar hand-off risk and fallbacks, badge, backup, error screen)
```
Tests sit next to their source as `*.test.ts(x)`.

**Routes added:** `/crash-test` (outside the tab-bar shell, not linked anywhere).

**Plan steps that edit part of a file** say "In `<file>`, replace" followed by the exact old text and the new text. The old text appears exactly once in the file at that point of the plan. All other steps give whole files.

---

### Task 1: Ledger carry-overs: feeding-interval cap, invalid-date guards, money format, smaller chunks

The Plan 2 final review carried two items here: a pet's `feedingIntervalDays` has no upper bound (a 9-digit value overflows the Date range, and `formatDue` then throws inside render → white screen), and `statusLabel` prints "In NaN days" for such a date. A backup import (Task 8) can also bring in any stored value, so the display helpers must never throw. Two cheap user-visible minors from the ledgers come along: prices and vet costs print `$85.5` instead of `$85.50`, and the main JS chunk is 506 kB (over Vite's 500 kB warning). Splitting React and the other libraries into their own chunks fixes the warning without lazy routes (no Suspense, no test changes) and lets the phone keep the library chunks cached across app updates.

**Files:**
- Modify: `src/domain/feeding.ts` (`MAX_FEEDING_INTERVAL_DAYS`, `isValidFeedingInterval`, invalid-date guards)
- Modify: `src/db/pets.ts` (interval cap in `createPet` / `updatePet`)
- Modify: `src/features/pets/PetForm.tsx` (`max` on the interval input)
- Modify: `src/features/pets/format.ts` (`formatDue` / `formatDateKey` guards, `formatMoney`)
- Modify: `src/features/pets/PetProfile.tsx`, `src/features/vet/VetScreen.tsx` (use `formatMoney`)
- Modify: `vite.config.ts` (vendor chunks)
- Test: `src/domain/feedingLimits.test.ts`, `src/db/petLimits.test.ts`, `src/features/pets/formatGuards.test.ts`, `src/features/pets/PetFormLimits.test.tsx`

**Interfaces:**
- Consumes: `createPet`, `updatePet`, `getPet` (`src/db/pets.ts`), `PetForm` (Plan 1), `resetDb`
- Produces:
  - `src/domain/feeding.ts`: `MAX_FEEDING_INTERVAL_DAYS = 365`, `isValidFeedingInterval(days: number): boolean`; `dueStatus(invalidDate, now)` → `'soon'`; `statusLabel(invalidDate, now)` → `'—'`
  - `src/db/pets.ts`: `createPet` / `updatePet` throw `ValidationError('Feed every must be 1 to 365 days')` outside 1–365
  - `src/features/pets/format.ts`: `formatDue(invalidDate, now)` → `'—'`; `formatDateKey('garbage')` → `'—'`; `formatMoney(n: number): string` (`$65`, `$85.50`)

- [ ] **Step 1: Write the failing tests in `src/domain/feedingLimits.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { dueStatus, isValidFeedingInterval, MAX_FEEDING_INTERVAL_DAYS, statusLabel } from './feeding';

const now = new Date(2026, 10, 8, 9, 0);

describe('feeding interval limit', () => {
  it('accepts whole days from 1 to 365', () => {
    expect(MAX_FEEDING_INTERVAL_DAYS).toBe(365);
    expect(isValidFeedingInterval(1)).toBe(true);
    expect(isValidFeedingInterval(365)).toBe(true);
    expect(isValidFeedingInterval(0)).toBe(false);
    expect(isValidFeedingInterval(366)).toBe(false);
    expect(isValidFeedingInterval(2.5)).toBe(false);
    expect(isValidFeedingInterval(Number.NaN)).toBe(false);
  });
});

describe('an out-of-range due date never breaks the status', () => {
  it('reads as far away, with a dash for a label', () => {
    const overflowed = new Date(Number.NaN);
    expect(dueStatus(overflowed, now)).toBe('soon');
    expect(statusLabel(overflowed, now)).toBe('—');
  });
});
```

- [ ] **Step 2: Write the failing tests in `src/db/petLimits.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet, getPet, updatePet } from './pets';

beforeEach(async () => {
  await resetDb();
});

it('rejects a feeding interval over 365 days on create and update', async () => {
  await expect(createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 366 })).rejects.toThrow(
    'Feed every must be 1 to 365 days',
  );
  const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 365 });
  await expect(updatePet(p.id, { feedingIntervalDays: 999999999 })).rejects.toThrow('Feed every must be 1 to 365 days');
  await expect(updatePet(p.id, { feedingIntervalDays: 0 })).rejects.toThrow('Feed every must be 1 to 365 days');
  expect((await getPet(p.id))!.feedingIntervalDays).toBe(365);
});
```

- [ ] **Step 3: Write the failing tests in `src/features/pets/formatGuards.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDue, formatMoney } from './format';

const now = new Date(2026, 10, 8, 9, 0);

describe('format guards', () => {
  it('formatDue shows a dash for an invalid date instead of throwing', () => {
    expect(formatDue(new Date(Number.NaN), now)).toBe('—');
  });
  it('formatDateKey shows a dash for a malformed key', () => {
    expect(formatDateKey('2026-13-45')).toBe('—');
    expect(formatDateKey('not a date')).toBe('—');
    expect(formatDateKey('2026-03-03')).toBe('Mar 3, 2026');
  });
});

describe('formatMoney', () => {
  it('drops .00 but keeps cents', () => {
    expect(formatMoney(65)).toBe('$65');
    expect(formatMoney(85.5)).toBe('$85.50');
    expect(formatMoney(0.1 + 0.2)).toBe('$0.30');
  });
});
```

- [ ] **Step 4: Write the failing tests in `src/features/pets/PetFormLimits.test.tsx`**

```tsx
import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetForm from './PetForm';
import { db, resetDb } from '../../db/db';

beforeEach(async () => {
  await resetDb();
});

it('refuses a feeding interval over 365 days with an inline reason', async () => {
  render(
    <MemoryRouter initialEntries={['/pets/new']}>
      <Routes>
        <Route path="/pets/new" element={<PetForm />} />
      </Routes>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Name'), 'Noodle');
  await user.type(screen.getByLabelText('Species'), 'Corn Snake');
  const interval = screen.getByLabelText('Feed every (days)');
  expect(interval).toHaveAttribute('max', '365');
  await user.clear(interval);
  await user.type(interval, '999999999');
  await user.click(screen.getByRole('button', { name: 'Save pet' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Feed every must be 1 to 365 days');
  expect(await db.pets.count()).toBe(0);
});
```

- [ ] **Step 5: Run them and confirm they fail**

Run: `npm test -- src/domain/feedingLimits.test.ts src/db/petLimits.test.ts src/features/pets/formatGuards.test.ts src/features/pets/PetFormLimits.test.tsx`
Expected: FAIL (7 tests): `MAX_FEEDING_INTERVAL_DAYS` is undefined, `statusLabel` returns `In NaN days`, `formatDue` / `formatDateKey` throw `RangeError: Invalid time value`, `formatMoney is not a function`, the 366-day pet is created, and the interval input has no `max`.

- [ ] **Step 6: In `src/domain/feeding.ts`, replace**

```ts
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
```

with:

```ts
import { addDays, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
```

- [ ] **Step 7: In `src/domain/feeding.ts`, replace**

```ts
export const isValidPushBackDays = (days: number): boolean =>
  Number.isInteger(days) && days >= 1 && days <= MAX_PUSH_BACK_DAYS;
```

with:

```ts
export const isValidPushBackDays = (days: number): boolean =>
  Number.isInteger(days) && days >= 1 && days <= MAX_PUSH_BACK_DAYS;

/** Upper bound for a pet's feeding interval, for the same reason as MAX_PUSH_BACK_DAYS. */
export const MAX_FEEDING_INTERVAL_DAYS = 365;

export const isValidFeedingInterval = (days: number): boolean =>
  Number.isInteger(days) && days >= 1 && days <= MAX_FEEDING_INTERVAL_DAYS;
```

- [ ] **Step 8: In `src/domain/feeding.ts`, replace**

```ts
export function dueStatus(due: Date | null, now: Date): DueStatus {
  if (!due) return 'today';
```

with:

```ts
export function dueStatus(due: Date | null, now: Date): DueStatus {
  if (!due) return 'today';
  if (!isValid(due)) return 'soon'; // an overflowed due date is "far away", never late
```

- [ ] **Step 9: In `src/domain/feeding.ts`, replace**

```ts
  if (!due) return 'No feedings yet';
  const days = differenceInCalendarDays(due, now);
```

with:

```ts
  if (!due) return 'No feedings yet';
  if (!isValid(due)) return '—';
  const days = differenceInCalendarDays(due, now);
```

- [ ] **Step 10: In `src/db/pets.ts`, replace**

```ts
import { DEFAULT_FEED_TIME } from '../domain/dates';
```

with:

```ts
import { DEFAULT_FEED_TIME } from '../domain/dates';
import { isValidFeedingInterval, MAX_FEEDING_INTERVAL_DAYS } from '../domain/feeding';
```

- [ ] **Step 11: In `src/db/pets.ts`, replace**

```ts
  if (p.feedingIntervalDays !== undefined && !(Number.isInteger(p.feedingIntervalDays) && p.feedingIntervalDays >= 1)) {
    throw new ValidationError('Feed every must be at least 1 day');
  }
```

with:

```ts
  if (p.feedingIntervalDays !== undefined && !isValidFeedingInterval(p.feedingIntervalDays)) {
    throw new ValidationError(`Feed every must be 1 to ${MAX_FEEDING_INTERVAL_DAYS} days`);
  }
```

- [ ] **Step 12: In `src/features/pets/PetForm.tsx`, replace**

```tsx
      <Field label="Feed every (days)"><input type="number" inputMode="numeric" min={1} {...text('feedingIntervalDays')} /></Field>
```

with:

```tsx
      <Field label="Feed every (days)">
        <input type="number" inputMode="numeric" min={1} max={MAX_FEEDING_INTERVAL_DAYS} {...text('feedingIntervalDays')} />
      </Field>
```

- [ ] **Step 13: In `src/features/pets/PetForm.tsx`, replace**

```tsx
import { ValidationError } from '../../db/ids';
```

with:

```tsx
import { ValidationError } from '../../db/ids';
import { MAX_FEEDING_INTERVAL_DAYS } from '../../domain/feeding';
```

- [ ] **Step 14: Replace the whole of `src/features/pets/format.ts`**

```ts
import { differenceInCalendarDays, format, isValid } from 'date-fns';
import { isDateKey, parseDateKey } from '../../domain/dates';

export function formatDue(due: Date | null, now: Date): string {
  if (!due) return 'No feedings yet';
  if (!isValid(due)) return '—'; // format() throws on an Invalid Date (e.g. an overflowed interval)
  const days = differenceInCalendarDays(due, now);
  const time = format(due, 'h:mm a');
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${format(due, 'EEE, MMM d')} · ${time}`;
}

export function formatDateKey(key?: string): string {
  return key && isDateKey(key) ? format(parseDateKey(key), 'MMM d, yyyy') : '—';
}

/** "$65" for whole amounts, "$85.50" when there are cents. */
export function formatMoney(n: number): string {
  const cents = Math.round(n * 100);
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Calendar days back from `now`: "today", "1 day ago", "N days ago". */
export function formatDaysAgo(then: Date, now: Date): string {
  const n = differenceInCalendarDays(now, then);
  if (n <= 0) return 'today';
  return `${plural(n, 'day')} ago`;
}
```

- [ ] **Step 15: In `src/features/pets/PetProfile.tsx`, replace**

```tsx
pet.pricePaid !== undefined && `$${pet.pricePaid}`]
```

with:

```tsx
pet.pricePaid !== undefined && formatMoney(pet.pricePaid)]
```

- [ ] **Step 16: In `src/features/pets/PetProfile.tsx`, replace**

```tsx
import { formatDateKey, formatDue } from './format';
```

with:

```tsx
import { formatDateKey, formatDue, formatMoney } from './format';
```

- [ ] **Step 17: In `src/features/vet/VetScreen.tsx`, replace**

```tsx
              {[v.cost !== undefined && `$${v.cost}`, v.photoIds.length > 0 && plural(v.photoIds.length, 'photo')]
```

with:

```tsx
              {[v.cost !== undefined && formatMoney(v.cost), v.photoIds.length > 0 && plural(v.photoIds.length, 'photo')]
```

- [ ] **Step 18: In `src/features/vet/VetScreen.tsx`, replace**

```tsx
import { formatDateKey, plural } from '../pets/format';
```

with:

```tsx
import { formatDateKey, formatMoney, plural } from '../pets/format';
```

- [ ] **Step 19: In `vite.config.ts`, replace**

```ts
  plugins: [
    react(),
```

with:

```ts
  build: {
    rolldownOptions: {
      output: {
        // Keep the app chunk small (it was 506 kB): React and the other libraries get their own
        // chunks, which also stay cached on the phone when only app code changes.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
```

- [ ] **Step 20: Run everything, then build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass. The build lists `react-*.js` (~257 kB), `vendor-*.js` (~150 kB) and `index-*.js` (~106 kB) with no "Some chunks are larger than 500 kB" warning, then `dist/sw.js`.

- [ ] **Step 21: Commit**

```bash
git add -A
git commit -m "fix: cap the feeding interval, guard due-date labels, format money, split vendor chunks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Units picker in Settings

Spec §5.15 Units: temperature (°F/°C), weight (g/oz/lb), length (in/cm). The fields already exist in `Settings` (`tempUnit`, `weightUnit`, `lengthUnit`) and every screen already reads them through `useUnits()` and converts with `src/domain/units.ts`, so this task only writes them. It also stops dropping the `updateSettings` promise for the theme switch (Plan 1 ledger, Task 12 minor): a failed write now shows an inline alert instead of an unhandled rejection.

`updateSettings` is a read-modify-write of the single Settings row. With three unit pickers on one card, two quick taps can overlap and the second write puts back the first one's stale value (seen in a browser rehearsal: °C, oz, cm tapped quickly saved only cm). It now runs in one `rw` transaction, which Dexie serializes.

**Files:**
- Create: `src/features/settings/UnitsCard.tsx`, `src/ui/settings.css`
- Modify: `src/db/settings.ts` (atomic `updateSettings`), `src/features/settings/SettingsScreen.tsx` (renders the Units card; theme write errors), `src/main.tsx` (imports `ui/settings.css`)
- Test: `src/features/settings/UnitsCard.test.tsx`, `src/db/settings.test.ts`

**Interfaces:**
- Consumes: `getSettings`, `updateSettings` (`src/db/settings.ts`), `saveErrorText` (`src/db/ids.ts`), `Segmented`, `Card`, `useUnits` (unchanged), `formatWeight` (`src/domain/units.ts`)
- Produces:
  - `UnitsCard({ settings }: { settings: Settings })` (named export): a `group` named "Units" with three radio groups named `Temperature` (`°F`, `°C`), `Weight` (`g`, `oz`, `lb`) and `Length` (`in`, `cm`)
  - CSS classes `.setting-row`, `.setting-note`, `.warn` (amber text), `.data-actions` (used again in Tasks 6 and 9)
  - `updateSettings(patch)` unchanged signature; concurrent calls no longer lose each other's fields

- [ ] **Step 1: Write the failing tests in `src/features/settings/UnitsCard.test.tsx`**

```tsx
import { beforeEach, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { useUnits } from './useUnits';
import { resetDb } from '../../db/db';
import { getSettings } from '../../db/settings';
import { formatWeight } from '../../domain/units';

beforeEach(async () => {
  await resetDb();
});

const renderSettings = () => render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
const radio = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name });

it('shows the stored units, °F · g · in by default', async () => {
  renderSettings();
  const card = await screen.findByRole('group', { name: 'Units' });
  expect(within(card).getAllByRole('radiogroup').map((g) => g.getAttribute('aria-label'))).toEqual([
    'Temperature', 'Weight', 'Length',
  ]);
  expect(radio('Temperature', '°F')).toHaveAttribute('aria-checked', 'true');
  expect(radio('Weight', 'g')).toHaveAttribute('aria-checked', 'true');
  expect(radio('Length', 'in')).toHaveAttribute('aria-checked', 'true');
});

it('saves each unit, and screens reading useUnits follow', async () => {
  renderSettings();
  const units = renderHook(() => useUnits());
  await userEvent.click(await screen.findByRole('radio', { name: '°C' }));
  await userEvent.click(screen.getByRole('radio', { name: 'oz' }));
  await userEvent.click(screen.getByRole('radio', { name: 'cm' }));
  await vi.waitFor(async () =>
    expect(await getSettings()).toMatchObject({ tempUnit: 'C', weightUnit: 'oz', lengthUnit: 'cm' }),
  );
  await waitFor(() => expect(radio('Weight', 'oz')).toHaveAttribute('aria-checked', 'true'));
  await waitFor(() => expect(units.result.current).toEqual({ temp: 'C', weight: 'oz', length: 'cm' }));
  expect(formatWeight(42, units.result.current!.weight)).toBe('1.5 oz');

  await userEvent.click(screen.getByRole('radio', { name: 'lb' }));
  await vi.waitFor(async () => expect((await getSettings()).weightUnit).toBe('lb'));
});
```

- [ ] **Step 2: Write the failing tests in `src/db/settings.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { getSettings, updateSettings } from './settings';

beforeEach(async () => {
  await resetDb();
});

it('overlapping updates keep every change (no lost update)', async () => {
  await Promise.all([
    updateSettings({ tempUnit: 'C' }),
    updateSettings({ weightUnit: 'oz' }),
    updateSettings({ lengthUnit: 'cm' }),
    updateSettings({ theme: 'dark' }),
  ]);
  expect(await getSettings()).toMatchObject({ tempUnit: 'C', weightUnit: 'oz', lengthUnit: 'cm', theme: 'dark' });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/settings/UnitsCard.test.tsx src/db/settings.test.ts`
Expected: FAIL: `Unable to find role="group" and name "Units"` / `Unable to find role="radio" and name "°C"`, and the overlapping updates keep only the last change (`tempUnit` is still `'F'`).

- [ ] **Step 4: Replace the whole of `src/db/settings.ts`**

```ts
import type { Settings } from '../domain/types';
import { db, DEFAULT_SETTINGS } from './db';

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

/** Read-modify-write in one transaction, so quick taps on different pickers never undo each other. */
export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, id: 'settings' });
  });
}
```

- [ ] **Step 5: Create `src/ui/settings.css`**

```css
/* ---------- Settings (Plan 3) ---------- */
.setting-row {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}
.setting-row > span {
  font-weight: 700;
}
.setting-note {
  margin: 8px 2px 0;
  font-size: 13px;
}
.warn {
  color: var(--due-text);
  font-weight: 700;
}
.data-actions {
  display: grid;
  gap: 8px;
}
.data-actions .muted {
  font-size: 13px;
  margin: -2px 2px 4px;
}
```

- [ ] **Step 6: Create `src/features/settings/UnitsCard.tsx`**

```tsx
import { useState } from 'react';
import type { LengthUnit, Settings, TempUnit, WeightUnit } from '../../domain/types';
import { updateSettings } from '../../db/settings';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';

const TEMPS = [
  { value: 'F', label: '°F' },
  { value: 'C', label: '°C' },
] as const;
const WEIGHTS = [
  { value: 'g', label: 'g' },
  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
] as const;
const LENGTHS = [
  { value: 'in', label: 'in' },
  { value: 'cm', label: 'cm' },
] as const;

type UnitPatch = Partial<Pick<Settings, 'tempUnit' | 'weightUnit' | 'lengthUnit'>>;

/** Spec §5.15 Units. Records stay in canonical units (g, mm, °C); this only changes the display. */
export function UnitsCard({ settings }: { settings: Settings }) {
  const [error, setError] = useState<string>();
  const save = (patch: UnitPatch) => {
    setError(undefined);
    updateSettings(patch).catch((err: unknown) => setError(saveErrorText(err)));
  };

  return (
    <>
      <div className="label">Units</div>
      <Card role="group" aria-label="Units">
        {error && <div role="alert" className="form-error">{error}</div>}
        <div className="setting-row">
          <span>Temperature</span>
          <Segmented<TempUnit> label="Temperature" options={TEMPS} value={settings.tempUnit} onChange={(tempUnit) => save({ tempUnit })} />
        </div>
        <div className="setting-row">
          <span>Weight</span>
          <Segmented<WeightUnit> label="Weight" options={WEIGHTS} value={settings.weightUnit} onChange={(weightUnit) => save({ weightUnit })} />
        </div>
        <div className="setting-row" style={{ marginBottom: 0 }}>
          <span>Length</span>
          <Segmented<LengthUnit> label="Length" options={LENGTHS} value={settings.lengthUnit} onChange={(lengthUnit) => save({ lengthUnit })} />
        </div>
        <p className="muted setting-note">Changing units only changes how values are shown. Nothing is lost.</p>
      </Card>
    </>
  );
}
```

- [ ] **Step 7: Replace the whole of `src/features/settings/SettingsScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';
import { saveErrorText } from '../../db/ids';
import type { ThemePref } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { loadSampleData } from '../../dev/sampleData';
import { UnitsCard } from './UnitsCard';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
] as const;

export default function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  const petCount = useLiveQuery(async () => (await listActivePets()).length, []);
  const [loading, setLoading] = useState(false);
  const [themeError, setThemeError] = useState<string>();
  if (!settings) return null;

  return (
    <>
      <h1>Settings</h1>
      <Card style={{ marginTop: 12 }}>
        <div className="row">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          <div className="grow">
            <b style={{ fontSize: 17 }}>RepTender</b>
            <div className="muted">{`${petCount ?? 0} pets · version ${__APP_VERSION__}`}</div>
          </div>
        </div>
      </Card>

      <div className="label">Appearance</div>
      <Card>
        {themeError && <div role="alert" className="form-error">{themeError}</div>}
        <Segmented<ThemePref>
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) => {
            setThemeError(undefined);
            updateSettings({ theme }).catch((err: unknown) => setThemeError(saveErrorText(err)));
          }}
        />
        <p className="muted setting-note">Auto follows your iPhone's light/dark setting.</p>
      </Card>

      <UnitsCard settings={settings} />

      {import.meta.env.DEV && (
        <>
          <div className="label">Developer</div>
          <button
            type="button"
            className="btn-ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await loadSampleData();
              } finally {
                setLoading(false);
              }
            }}
          >
            Load sample pets
          </button>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 8: In `src/main.tsx`, replace**

```tsx
import './ui/husbandry.css';
```

with:

```tsx
import './ui/husbandry.css';
import './ui/settings.css';
```

- [ ] **Step 9: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add the Units picker to Settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Calendar events: the `.ics` generator and the reminder builders

Spec §8 and §12 (".ics generation" is a domain unit test). Everything here is pure: no React, no DB, no browser APIs.

- Each event is a **single** timed event (no `RRULE`: late feedings would make a repeating event drift) with an alert **at the start time** (`TRIGGER:PT0S`).
- Times are written in UTC (`DTSTART:20261113T230000Z`), so the phone's Calendar shows them in local time with no `VTIMEZONE` block.
- **Stable UIDs** `<id>-<yyyy-MM-dd>@reptender` (spec §8 `<petId|taskId>-<dueDate>@reptender`): adding the same reminder twice updates the event instead of duplicating it in calendars that honour UIDs. Vet appointments use the visit id (a pet id would collide with that pet's feeding reminder on the same day).
- Care tasks with no time of day are put at **09:00** on their due day (an alert at midnight helps nobody). Feedings always have a time (`usualFeedTime`, default 18:00).
- "Add all reminders" (`allReminders`) takes the next occurrence of every feeding and care task and **skips** ones already in the past (late or earlier today): the badge and the Today list cover those, and a calendar alert in the past never fires. A pet with no meals yet has no due date and is skipped too.
- Text is escaped (`\`, `;`, `,`, newlines) and lines are folded at 75 octets (RFC 5545 §3.1), counting UTF-8 bytes so an emoji is never split.

**Files:**
- Create: `src/domain/ics.ts`, `src/domain/reminders.ts`
- Test: `src/domain/ics.test.ts`, `src/domain/reminders.test.ts`

**Interfaces:**
- Consumes: `dateKey`, `atTime` (`src/domain/dates.ts`), `nextFeedingDue` (`src/domain/feeding.ts`), `careNextDue` (`src/domain/care.ts`), `FeedingSource`, `CareSource` (`src/domain/schedule.ts`), `Pet`, `CareTask`, `VetVisit` (`src/domain/types.ts`)
- Produces:
  - `src/domain/ics.ts`: `interface CalendarEvent { uid: string; title: string; start: Date; durationMinutes: number; description?: string; location?: string }`, `eventUid(id: string, day: Date): string`, `icsDateTime(d: Date): string`, `escapeText(s: string): string`, `foldLine(line: string): string`, `buildIcs(events: readonly CalendarEvent[], stamp: Date): string`
  - `src/domain/reminders.ts`: `CARE_REMINDER_TIME = '09:00'`, `feedingEvent(pet, due: Date): CalendarEvent`, `careEventStart(task, due: Date): Date`, `careEvent(task, petName: string | undefined, due: Date): CalendarEvent`, `vetEvent(petName: string, visit, clinic?: string): CalendarEvent | null`, `allReminders(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): CalendarEvent[]` (sorted by start)

- [ ] **Step 1: Write the failing tests in `src/domain/ics.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, eventUid, foldLine, icsDateTime, type CalendarEvent } from './ics';

const utf8Length = (s: string) => new TextEncoder().encode(s).length;
const unfold = (ics: string) => ics.replace(/\r\n /g, '');

const event: CalendarEvent = {
  uid: 'pet-1-2026-11-13@reptender',
  title: 'Feed Noodle · 1 Pinky mouse',
  start: new Date(Date.UTC(2026, 10, 13, 23, 0)),
  durationMinutes: 15,
};

describe('ics helpers', () => {
  it('writes UTC date-times', () => {
    expect(icsDateTime(new Date(Date.UTC(2026, 10, 13, 23, 0, 5)))).toBe('20261113T230005Z');
  });
  it('builds stable UIDs from an id and the local due day', () => {
    expect(eventUid('pet-1', new Date(2026, 10, 13, 18, 0))).toBe('pet-1-2026-11-13@reptender');
  });
  it('escapes text values', () => {
    expect(escapeText('Mist, then soak; back\\slash\nline 2')).toBe('Mist\\, then soak\\; back\\\\slash\\nline 2');
  });
  it('folds long lines at 75 octets without splitting a character', () => {
    const line = `SUMMARY:${'🦎 Feed Noodle '.repeat(8)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(utf8Length(part)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(unfold(folded)).toBe(line);
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
  });
});

describe('buildIcs', () => {
  it('writes one single (non-repeating) event with an alert at the start', () => {
    const ics = buildIcs([{ ...event, description: 'Logged in RepTender', location: 'Home, warm side' }], new Date(Date.UTC(2026, 10, 8, 17, 0)));
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.split('\r\n').filter(Boolean)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RepTender//Reminders//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:pet-1-2026-11-13@reptender',
      'DTSTAMP:20261108T170000Z',
      'DTSTART:20261113T230000Z',
      'DTEND:20261113T231500Z',
      'SUMMARY:Feed Noodle · 1 Pinky mouse',
      'DESCRIPTION:Logged in RepTender',
      'LOCATION:Home\\, warm side',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Feed Noodle · 1 Pinky mouse',
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
    expect(ics).not.toContain('RRULE');
  });

  it('puts several events in one calendar', () => {
    const ics = buildIcs([event, { ...event, uid: 'task-1-2026-11-09@reptender', title: 'Mist · Ziggy' }], new Date());
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics).toContain('UID:task-1-2026-11-09@reptender');
  });
});
```

- [ ] **Step 2: Write the failing tests in `src/domain/reminders.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { CareCompletion, CareTask, Feeding, Pet, VetVisit } from './types';
import { allReminders, CARE_REMINDER_TIME, careEvent, careEventStart, feedingEvent, vetEvent } from './reminders';

const now = new Date(2026, 10, 8, 9, 0);
const iso = (d: number, h = 18, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const base = { createdAt: iso(1, 8), updatedAt: iso(1, 8) };

function pet(id: string, name: string, interval: number, extra: Partial<Pet> = {}): Pet {
  return {
    ...base, id, name, species: 'Reptile', sex: 'unknown', origin: 'unknown', birthDateApprox: false,
    feedingIntervalDays: interval, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {}, ...extra,
  };
}
const meal = (petId: string, d: number): Feeding => ({
  ...base, id: `f-${petId}-${d}`, petId, at: iso(d), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
});
const task = (id: string, name: string, intervalDays: number, extra: Partial<CareTask> = {}): CareTask => ({
  ...base, id, name, intervalDays, ...extra,
});
const done = (taskId: string, d: number, h = 9): CareCompletion => ({ ...base, id: `c-${taskId}-${d}`, taskId, at: iso(d, h) });

describe('single events', () => {
  it('a feeding: "Feed <name> · <qty> <food>" at the due time, 15 minutes', () => {
    const due = new Date(2026, 10, 13, 18, 0);
    const e = feedingEvent(pet('p1', 'Noodle', 5, { usualFoodItem: 'Pinky mouse' }), due);
    expect(e).toMatchObject({ uid: 'p1-2026-11-13@reptender', title: 'Feed Noodle · 1 Pinky mouse', durationMinutes: 15 });
    expect(e.start.getTime()).toBe(due.getTime());
    expect(feedingEvent(pet('p2', 'Ziggy', 3), due).title).toBe('Feed Ziggy');
  });

  it('a care task: at its time of day, or 09:00 when it has none', () => {
    const day = new Date(2026, 10, 9);
    expect(CARE_REMINDER_TIME).toBe('09:00');
    expect(careEventStart(task('t1', 'Mist', 2), day).getTime()).toBe(new Date(2026, 10, 9, 9, 0).getTime());
    const timed = new Date(2026, 10, 9, 20, 30);
    expect(careEventStart(task('t1', 'Mist', 2, { timeOfDay: '20:30' }), timed).getTime()).toBe(timed.getTime());
    expect(careEvent(task('t1', 'Mist', 2), 'Ziggy', day)).toMatchObject({ uid: 't1-2026-11-09@reptender', title: 'Mist · Ziggy' });
    expect(careEvent(task('t2', 'Fresh water', 2), undefined, day).title).toBe('Fresh water · All pets');
  });

  it('a vet appointment: one hour, with the clinic as the location', () => {
    const visit: Pick<VetVisit, 'id' | 'nextAppointment' | 'clinic' | 'reason'> = {
      id: 'v1', nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(), reason: 'Wellness exam',
    };
    const e = vetEvent('Noodle', visit, 'Exotic Animal Clinic')!;
    expect(e).toMatchObject({
      uid: 'v1-2027-06-14@reptender', title: 'Vet · Noodle', durationMinutes: 60,
      location: 'Exotic Animal Clinic', description: 'Follow-up after: Wellness exam',
    });
    expect(e.start.getTime()).toBe(new Date(2027, 5, 14, 10, 0).getTime());
    expect(vetEvent('Noodle', { id: 'v2' })).toBeNull();
    expect(vetEvent('Noodle', { id: 'v3', nextAppointment: 'garbage' })).toBeNull();
  });
});

describe('allReminders (Add all reminders)', () => {
  it('has the next occurrence of every feeding and care task, soonest first, skipping past ones', () => {
    const noodle = pet('p1', 'Noodle', 5, { usualFoodItem: 'Pinky mouse' }); // fed Nov 3 → today 18:00
    const basil = pet('p2', 'Basil', 2); // fed Nov 5 → Nov 7: late, skipped
    const ziggy = pet('p3', 'Ziggy', 3); // fed Nov 8 → Nov 11
    const newbie = pet('p4', 'Newbie', 7); // never fed: no due date, skipped
    const huge = pet('p5', 'Overflow', 999999999); // out-of-range stored interval: skipped, no crash
    const events = allReminders(
      [
        { pet: noodle, feedings: [meal('p1', 3)] },
        { pet: basil, feedings: [meal('p2', 5)] },
        { pet: ziggy, feedings: [meal('p3', 8)] },
        { pet: newbie, feedings: [] },
        { pet: huge, feedings: [meal('p5', 1)] },
      ],
      [
        { task: task('t1', 'Spot clean', 1), pet: basil, completions: [done('t1', 7)] }, // today 09:00: just past
        { task: task('t2', 'Fresh water', 2), completions: [done('t2', 7)] }, // Nov 9 09:00
        { task: task('t3', 'Mist', 1, { timeOfDay: '20:00' }), pet: ziggy, completions: [done('t3', 7, 20)] }, // today 20:00
      ],
      now,
    );
    expect(events.map((e) => e.title)).toEqual([
      'Feed Noodle · 1 Pinky mouse', 'Mist · Ziggy', 'Fresh water · All pets', 'Feed Ziggy',
    ]);
    expect(events.map((e) => e.uid)).toEqual([
      'p1-2026-11-08@reptender', 't3-2026-11-08@reptender', 't2-2026-11-09@reptender', 'p3-2026-11-11@reptender',
    ]);
    expect(events[2]!.start.getTime()).toBe(new Date(2026, 10, 9, 9, 0).getTime());
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/domain/ics.test.ts src/domain/reminders.test.ts`
Expected: FAIL with `Failed to resolve import "./ics"` / `"./reminders"`.

- [ ] **Step 4: Create `src/domain/ics.ts`**

```ts
import { addMinutes } from 'date-fns';
import { dateKey } from './dates';

/** One single (non-repeating) calendar event. Spec §8. */
export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  durationMinutes: number;
  description?: string;
  location?: string;
}

/** Spec §8 stable UID: `<petId|taskId>-<dueDate>@reptender`, the due date as the local yyyy-MM-dd. */
export const eventUid = (id: string, day: Date): string => `${id}-${dateKey(day)}@reptender`;

/** UTC form, e.g. 20261113T230000Z. */
export const icsDateTime = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 §3.3.11 TEXT escaping. */
export const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const encoder = new TextEncoder();

/** RFC 5545 §3.1: at most 75 octets per line; continuation lines start with one space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // the leading space of a continuation counts
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function eventLines(e: CalendarEvent, stamp: Date): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsDateTime(stamp)}`,
    `DTSTART:${icsDateTime(e.start)}`,
    `DTEND:${icsDateTime(addMinutes(e.start, e.durationMinutes))}`,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    // Spec §8: an alert at the start time.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(e.title)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
  ];
}

/** One VCALENDAR holding every event, CRLF line endings, folded lines. */
export function buildIcs(events: readonly CalendarEvent[], stamp: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RepTender//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((e) => eventLines(e, stamp)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
```

- [ ] **Step 5: Create `src/domain/reminders.ts`**

```ts
import { isValid, parseISO } from 'date-fns';
import type { CareTask, Pet, VetVisit } from './types';
import { atTime } from './dates';
import { nextFeedingDue } from './feeding';
import { careNextDue } from './care';
import type { CareSource, FeedingSource } from './schedule';
import { eventUid, type CalendarEvent } from './ics';

/** A care task with no time of day is reminded at this time on its due day. */
export const CARE_REMINDER_TIME = '09:00';

const FEEDING_MINUTES = 15;
const CARE_MINUTES = 15;
const VET_MINUTES = 60;

/** Spec §8 "Feed Noodle · 1 pinky mouse" at the next due date and time. */
export function feedingEvent(pet: Pick<Pet, 'id' | 'name' | 'usualFoodItem' | 'usualQuantity'>, due: Date): CalendarEvent {
  return {
    uid: eventUid(pet.id, due),
    title: pet.usualFoodItem ? `Feed ${pet.name} · ${pet.usualQuantity} ${pet.usualFoodItem}` : `Feed ${pet.name}`,
    start: due,
    durationMinutes: FEEDING_MINUTES,
  };
}

/** careNextDue() is the start of the day when the task has no time of day: remind at 09:00 instead. */
export function careEventStart(task: Pick<CareTask, 'timeOfDay'>, due: Date): Date {
  return task.timeOfDay ? due : atTime(due, CARE_REMINDER_TIME);
}

export function careEvent(task: Pick<CareTask, 'id' | 'name' | 'timeOfDay'>, petName: string | undefined, due: Date): CalendarEvent {
  return {
    uid: eventUid(task.id, due),
    title: `${task.name} · ${petName ?? 'All pets'}`,
    start: careEventStart(task, due),
    durationMinutes: CARE_MINUTES,
  };
}

/** The visit's next appointment, or null when it has none (or it can't be read). */
export function vetEvent(
  petName: string,
  visit: Pick<VetVisit, 'id' | 'nextAppointment' | 'clinic' | 'reason'>,
  clinic?: string,
): CalendarEvent | null {
  if (!visit.nextAppointment) return null;
  const start = parseISO(visit.nextAppointment);
  if (!isValid(start)) return null;
  return {
    uid: eventUid(visit.id, start),
    title: `Vet · ${petName}`,
    start,
    durationMinutes: VET_MINUTES,
    location: visit.clinic ?? clinic,
    description: visit.reason ? `Follow-up after: ${visit.reason}` : undefined,
  };
}

const upcoming = (start: Date, now: Date) => isValid(start) && start.getTime() > now.getTime();

/**
 * Spec §8 "Add all reminders": the next occurrence of every feeding and care task.
 * Past ones (late, or earlier today) are skipped: an alert in the past never fires.
 */
export function allReminders(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const { pet, feedings: list } of feedings) {
    const due = nextFeedingDue(pet, list);
    if (due && upcoming(due, now)) events.push(feedingEvent(pet, due));
  }
  for (const { task, pet, completions } of care) {
    const due = careNextDue(task, completions);
    if (!isValid(due)) continue;
    const event = careEvent(task, pet?.name, due);
    if (upcoming(event.start, now)) events.push(event);
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
}
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the .ics generator and the reminder event builders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: File delivery and the "📅 Remind me" toast after Log a Feeding

Spec §5.3 ("After saving, a toast with a 📅 Remind me button") and §8 (delivery: `navigator.share({ files })` first, else a download link to a blob URL).

- `deliverFile` calls `navigator.share` **before any `await`**, and every caller builds its file synchronously inside the tap handler from data already on screen. iOS only opens the share sheet during a user gesture; an `await` on IndexedDB first can lose the gesture (`NotAllowedError`). If sharing is unavailable, `canShare` says no, or `share` fails for any reason other than the user cancelling, it falls back to a download link.
- The toast lives in `AppShell`, so it shows after a feeding is logged from any of the four places that open `LogFeedingSheet` (Home banner, profile, Schedule, Add tab) and survives the sheet closing. A tiny external store (`showRemindToast(petId)`) connects the two. The toast reads the pet and its feedings live, so "Next feeding" is the real next due **after** the save (for an eaten meal, a refusal or a regurgitation with push-back alike).
- The **Remind me** button only shows when the next due is in the future. It is disabled while the share sheet is open (no double tap), and the toast hides itself after 10 seconds unless that is happening.

**Files:**
- Create: `src/lib/deliver.ts`, `src/features/reminders/calendarFile.ts`, `src/features/reminders/toastStore.ts`, `src/features/reminders/RemindToast.tsx`, `src/ui/toast.css`, `src/test/share.ts`
- Modify: `src/app/AppShell.tsx` (renders the toast), `src/features/feedings/LogFeedingSheet.tsx` (shows it after a save), `src/main.tsx` (imports `ui/toast.css`)
- Test: `src/lib/deliver.test.ts`, `src/features/reminders/RemindToast.test.tsx`

**Interfaces:**
- Consumes: `buildIcs`, `CalendarEvent` (Task 3), `feedingEvent` (Task 3), `nextFeedingDue` (`src/domain/feeding.ts`), `getPet`, `listFeedings`, `formatDue` (`src/features/pets/format.ts`), `renderAt` (`src/test/render.tsx`)
- Produces:
  - `src/lib/deliver.ts`: `type DeliverResult = 'shared' | 'downloaded' | 'cancelled'`, `deliverFile(file: File): Promise<DeliverResult>`, `downloadFile(file: File): void`
  - `src/features/reminders/calendarFile.ts`: `REMINDER_FILE = 'reptender-reminder.ics'`, `ALL_REMINDERS_FILE = 'reptender-reminders.ics'`, `calendarFile(events: readonly CalendarEvent[], name: string, stamp?: Date): File` (`type: 'text/calendar'`)
  - `src/features/reminders/toastStore.ts`: `showRemindToast(petId: string): void`, `hideRemindToast(): void`, `useRemindToast(): { petId: string; id: number } | null`, `TOAST_MS = 10_000`
  - `RemindToast` (default export, no props except `now?: Date` for tests): a `status` region "Feeding saved" with a button named `📅 Remind me` and one named `Dismiss`
  - `src/test/share.ts`: `mockShare(canShare?: boolean)` → `{ share, file(n?: number): File }`, `unmockShare()`, `stubObjectUrls()`

- [ ] **Step 1: Create `src/test/share.ts`** (test helper, used again in Tasks 5, 6, 9 and 10)

```ts
import { vi } from 'vitest';

type ShareFn = (data: ShareData) => Promise<void>;

/** Pretend the browser can share files. `file(n)` is the first file of the n-th share call. */
export function mockShare(canShare = true) {
  const share = vi.fn<ShareFn>(async () => {});
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => canShare), configurable: true, writable: true });
  return {
    share,
    file: (n = 0): File => share.mock.calls[n]![0].files![0]!,
  };
}

/** Undo mockShare (jsdom has no Web Share API of its own). */
export function unmockShare(): void {
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
}

/** jsdom can't make object URLs for its own Blobs: stub them, and stop the anchor click from navigating. */
export function stubObjectUrls() {
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:reptender-test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { create, revoke, click };
}
```

- [ ] **Step 2: Write the failing tests in `src/lib/deliver.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverFile } from './deliver';
import { mockShare, stubObjectUrls, unmockShare } from '../test/share';

const file = () => new File(['BEGIN:VCALENDAR'], 'reptender-reminder.ics', { type: 'text/calendar' });

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

describe('deliverFile (spec §8: share sheet, else a download link)', () => {
  it('opens the share sheet when the browser can share the file', async () => {
    const { share, file: shared } = mockShare();
    const urls = stubObjectUrls();
    const f = file();
    expect(await deliverFile(f)).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(shared()).toBe(f);
    expect(urls.click).not.toHaveBeenCalled();
  });

  it('reports a cancelled share sheet without downloading', async () => {
    const { share } = mockShare();
    share.mockRejectedValueOnce(new DOMException('Share canceled', 'AbortError'));
    const urls = stubObjectUrls();
    expect(await deliverFile(file())).toBe('cancelled');
    expect(urls.click).not.toHaveBeenCalled();
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    const { share } = mockShare();
    share.mockRejectedValueOnce(new DOMException('No user gesture', 'NotAllowedError'));
    const urls = stubObjectUrls();
    expect(await deliverFile(file())).toBe('downloaded');
    expect(urls.click).toHaveBeenCalledTimes(1);
  });

  it('downloads a blob URL when files cannot be shared', async () => {
    const { share } = mockShare(false);
    const urls = stubObjectUrls();
    const f = file();
    expect(await deliverFile(f)).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(urls.create).toHaveBeenCalledWith(f);
    const anchor = urls.click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('reptender-reminder.ics');
    expect(anchor.getAttribute('href')).toBe('blob:reptender-test');
    expect(anchor.isConnected).toBe(false); // removed again after the click
  });

  it('downloads when there is no Web Share API at all', async () => {
    const urls = stubObjectUrls();
    expect(await deliverFile(file())).toBe('downloaded');
    expect(urls.click).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Write the failing tests in `src/features/reminders/RemindToast.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RemindToast from './RemindToast';
import { hideRemindToast, showRemindToast } from './toastStore';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { renderAt } from '../../test/render';
import { mockShare, unmockShare } from '../../test/share';
import type { Pet } from '../../domain/types';

let pet: Pet;

beforeEach(async () => {
  await resetDb();
  pet = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse' });
});

afterEach(() => {
  act(() => hideRemindToast()); // the store is module state: never leak a toast into the next test
  unmockShare();
  vi.restoreAllMocks();
});

describe('Remind me toast (spec §5.3)', () => {
  it('appears after logging a feeding and adds the next feeding to Calendar', async () => {
    const { share, file } = mockShare();
    renderAt(`/pets/${pet.id}`);
    await userEvent.click(await screen.findByRole('button', { name: '🍽️ Log feeding' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Feed Noodle' })).getByRole('button', { name: 'Save feeding' }));

    const toast = await screen.findByRole('status', { name: 'Feeding saved' });
    expect(toast).toHaveTextContent('Feeding saved');
    expect(toast).toHaveTextContent(/Next feeding \w{3}, \w{3} \d+ · 6:00 PM/);
    await userEvent.click(within(toast).getByRole('button', { name: '📅 Remind me' }));

    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const ics = await file().text();
    expect(file().name).toBe('reptender-reminder.ics');
    expect(file().type).toBe('text/calendar');
    expect(ics).toContain('SUMMARY:Feed Noodle · 1 Pinky mouse');
    expect(ics).toMatch(new RegExp(`UID:${pet.id}-\\d{4}-\\d{2}-\\d{2}@reptender`));
    expect(ics).toContain('TRIGGER:PT0S');
    await vi.waitFor(() => expect(screen.queryByRole('status', { name: 'Feeding saved' })).toBeNull()); // hides after sharing
  });

  it('shows no Remind me button when the next feeding is not in the future', async () => {
    const now = new Date(2026, 10, 8, 9, 0);
    await logFeeding({ petId: pet.id, at: new Date(2026, 10, 1, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    render(<RemindToast now={now} />);
    act(() => showRemindToast(pet.id));
    const toast = await screen.findByRole('status', { name: 'Feeding saved' });
    expect(toast).toHaveTextContent('Next feeding Fri, Nov 6 · 6:00 PM');
    expect(within(toast).queryByRole('button', { name: '📅 Remind me' })).toBeNull();
    await userEvent.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status', { name: 'Feeding saved' })).toBeNull();
  });

  it('hides by itself after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<RemindToast now={new Date(2026, 10, 8, 9, 0)} />);
      act(() => showRemindToast(pet.id));
      expect(await screen.findByRole('status', { name: 'Feeding saved' })).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.queryByRole('status', { name: 'Feeding saved' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/lib/deliver.test.ts src/features/reminders`
Expected: FAIL with `Failed to resolve import "./deliver"` / `"./RemindToast"`.

- [ ] **Step 5: Create `src/lib/deliver.ts`**

```ts
export type DeliverResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Spec §8 / §9: hand a file to the share sheet (Calendar, Files, AirDrop, Mail) when the browser
 * can share files, otherwise fall back to a download link to a blob URL.
 *
 * Call it straight from a tap handler with a file built synchronously: `navigator.share` must run
 * before any `await`, or iOS rejects it for lack of a user gesture.
 */
export async function deliverFile(file: File): Promise<DeliverResult> {
  const canShareFiles =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError (the gesture expired) or a share target failure: download instead.
    }
  }
  downloadFile(file);
  return 'downloaded';
}

/** A temporary <a download> on a blob URL. The URL is revoked a minute later. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
```

- [ ] **Step 6: Create `src/features/reminders/calendarFile.ts`**

```ts
import { buildIcs, type CalendarEvent } from '../../domain/ics';

export const REMINDER_FILE = 'reptender-reminder.ics';
export const ALL_REMINDERS_FILE = 'reptender-reminders.ics';

/** The .ics file handed to Calendar (spec §8). Built synchronously so it can be shared inside a tap. */
export function calendarFile(events: readonly CalendarEvent[], name: string, stamp: Date = new Date()): File {
  return new File([buildIcs(events, stamp)], name, { type: 'text/calendar' });
}
```

- [ ] **Step 7: Create `src/features/reminders/toastStore.ts`**

```ts
import { useSyncExternalStore } from 'react';

/** How long the toast stays up on its own. */
export const TOAST_MS = 10_000;

export interface RemindToastState {
  petId: string;
  /** Changes on every show, so the same pet logged twice restarts the timer. */
  id: number;
}

let state: RemindToastState | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called by LogFeedingSheet after a successful save. */
export function showRemindToast(petId: string): void {
  state = { petId, id: ++seq };
  emit();
}

export function hideRemindToast(): void {
  if (!state) return;
  state = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRemindToast(): RemindToastState | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}
```

- [ ] **Step 8: Create `src/features/reminders/RemindToast.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isValid } from 'date-fns';
import { nextFeedingDue } from '../../domain/feeding';
import { feedingEvent } from '../../domain/reminders';
import { getPet } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { deliverFile } from '../../lib/deliver';
import { formatDue } from '../pets/format';
import { calendarFile, REMINDER_FILE } from './calendarFile';
import { hideRemindToast, TOAST_MS, useRemindToast } from './toastStore';

/** Spec §5.3: after a feeding is saved, offer to put the next one in Calendar (spec §8). */
export default function RemindToast({ now: fixedNow }: { now?: Date }) {
  const toast = useRemindToast();
  const petId = toast?.petId;
  const data = useLiveQuery(async () => {
    if (!petId) return null;
    const pet = await getPet(petId);
    return pet ? { pet, feedings: await listFeedings(petId) } : null;
  }, [petId]);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    if (!toast || sharing) return;
    const id = window.setTimeout(hideRemindToast, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast, sharing]);

  if (!toast || !data || data.pet.id !== toast.petId) return null;
  const now = fixedNow ?? new Date();
  const due = nextFeedingDue(data.pet, data.feedings);
  const upcoming = !!due && isValid(due) && due.getTime() > now.getTime();

  const remind = async () => {
    if (!due || sharing) return;
    setSharing(true);
    try {
      // Built and shared synchronously inside the tap (see deliverFile).
      await deliverFile(calendarFile([feedingEvent(data.pet, due)], REMINDER_FILE));
      hideRemindToast();
    } catch {
      setError("Couldn't create the calendar event.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="toast" role="status" aria-label="Feeding saved">
      <div className="grow">
        <b>Feeding saved</b>
        <div className="toast-sub">{error ?? `Next feeding ${formatDue(due, now)}`}</div>
      </div>
      {upcoming && (
        <button type="button" className="btn" disabled={sharing} onClick={remind}>
          📅 Remind me
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={hideRemindToast}>
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Create `src/ui/toast.css`**

```css
/* ---------- toast (Plan 3) ---------- */
.toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom) + 76px);
  width: min(398px, calc(100% - 32px));
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--text);
  color: var(--bg);
  border-radius: 16px;
  padding: 8px 4px 8px 14px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  z-index: 30;
}
.toast-sub {
  font-size: 13px;
}
.toast .btn {
  background: var(--amber);
  color: var(--on-amber);
  min-height: 44px;
  white-space: nowrap;
}
.toast-close {
  background: none;
  border: 0;
  color: inherit;
  font-size: 18px;
  min-width: 44px;
  min-height: 44px;
}
```

- [ ] **Step 10: Replace the whole of `src/app/AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';
import RemindToast from '../features/reminders/RemindToast';

export default function AppShell() {
  return (
    <div className="shell">
      <main className="screen">
        <Outlet />
      </main>
      <TabBar />
      <RemindToast />
    </div>
  );
}
```

- [ ] **Step 11: In `src/features/feedings/LogFeedingSheet.tsx`, replace**

```tsx
            : undefined,
      });
      onClose();
```

with:

```tsx
            : undefined,
      });
      showRemindToast(pet.id); // spec §5.3: "📅 Remind me" (shown by AppShell)
      onClose();
```

- [ ] **Step 12: In `src/features/feedings/LogFeedingSheet.tsx`, replace**

```tsx
import { formatDay, previewNextDue, type LogOutcome } from './logModel';
```

with:

```tsx
import { formatDay, previewNextDue, type LogOutcome } from './logModel';
import { showRemindToast } from '../reminders/toastStore';
```

- [ ] **Step 13: In `src/main.tsx`, replace**

```tsx
import './ui/settings.css';
```

with:

```tsx
import './ui/settings.css';
import './ui/toast.css';
```

- [ ] **Step 14: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: add the Remind me toast after logging a feeding, with share-or-download delivery

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: "Add to Calendar" on care tasks and the vet next appointment

Spec §5.10/§8 ("Care tasks and vet appointments have the same button") and §5.11 ("A next-appointment card with 📅 Add to Calendar"). Each button makes one single event (Task 3) and delivers it like the toast (Task 4). A button only shows when its event is still in the future (a late task's event would already be past, and the alert would never fire). One-tap writes are guarded: the care button goes through the screen's existing in-flight set, the vet button through a `sharing` flag.

**Files:**
- Modify: `src/features/care/CareTasksScreen.tsx`, `src/features/vet/VetScreen.tsx`
- Test: `src/features/care/CareCalendar.test.tsx`, `src/features/vet/VetCalendar.test.tsx`

**Interfaces:**
- Consumes: `careEvent`, `careEventStart`, `vetEvent` (Task 3), `deliverFile` (Task 4), `calendarFile`, `REMINDER_FILE` (Task 4), `mockShare`, `unmockShare` (Task 4), `createCareTask`, `completeCareTask`, `createVetVisit`
- Produces:
  - Care task cards get a button named `Add <task> to Calendar` (text 📅) while the task's next reminder is in the future
  - The vet "Next appointment" card gets a button named `📅 Add to Calendar` while the appointment is in the future

- [ ] **Step 1: Write the failing tests in `src/features/care/CareCalendar.test.tsx`**

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareTasksScreen from './CareTasksScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { completeCareTask, createCareTask } from '../../db/care';
import { mockShare, unmockShare } from '../../test/share';

const now = new Date(2026, 10, 8, 9, 0);
let noodle: string;

beforeEach(async () => {
  await resetDb();
  noodle = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  const mist = await createCareTask({ petId: noodle, name: 'Mist', intervalDays: 2, timeOfDay: '20:00' });
  await completeCareTask(mist.id, new Date(2026, 10, 7, 20, 0).toISOString()); // due Nov 9, 8:00 PM
  const water = await createCareTask({ name: 'Fresh water', intervalDays: 2 });
  await completeCareTask(water.id, new Date(2026, 10, 7, 9, 0).toISOString()); // due Nov 9 → 09:00
  const clean = await createCareTask({ petId: noodle, name: 'Spot clean', intervalDays: 1 });
  await completeCareTask(clean.id, new Date(2026, 10, 6, 9, 0).toISOString()); // 1 day late
});

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

const renderCare = () =>
  render(
    <MemoryRouter initialEntries={[`/pets/${noodle}/care`]}>
      <Routes>
        <Route path="/pets/:id/care" element={<CareTasksScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );

it('adds a care task to Calendar as one event at its time', async () => {
  const { share, file } = mockShare();
  renderCare();
  const card = await screen.findByRole('article', { name: 'Mist' });
  await userEvent.click(within(card).getByRole('button', { name: 'Add Mist to Calendar' }));
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const ics = await file().text();
  expect(ics).toContain('SUMMARY:Mist · Noodle');
  expect(ics).toMatch(/UID:[\w-]+-2026-11-09@reptender/);
  expect(ics).toContain(`DTSTART:${new Date(2026, 10, 9, 20, 0).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
});

it('uses 09:00 for a task with no time, and names All-pets tasks', async () => {
  const { share, file } = mockShare();
  renderCare();
  await userEvent.click(await screen.findByRole('button', { name: 'Add Fresh water to Calendar' }));
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const ics = await file().text();
  expect(ics).toContain('SUMMARY:Fresh water · All pets');
  expect(ics).toContain(`DTSTART:${new Date(2026, 10, 9, 9, 0).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
});

it('offers no calendar button for a late task', async () => {
  renderCare();
  const card = await screen.findByRole('article', { name: 'Spot clean' });
  expect(within(card).getByText('1 day late')).toBeInTheDocument();
  expect(within(card).queryByRole('button', { name: 'Add Spot clean to Calendar' })).toBeNull();
});
```

- [ ] **Step 2: Write the failing tests in `src/features/vet/VetCalendar.test.tsx`**

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VetScreen from './VetScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { createVetVisit } from '../../db/vetVisits';
import { mockShare, unmockShare } from '../../test/share';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

const renderVet = () =>
  render(
    <MemoryRouter initialEntries={[`/pets/${petId}/vet`]}>
      <Routes>
        <Route path="/pets/:id/vet" element={<VetScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );

it('adds the next appointment to Calendar', async () => {
  const visit = await createVetVisit({
    petId, date: '2026-06-14', reason: 'Wellness exam', clinic: 'Exotic Animal Clinic',
    nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(),
  });
  const { share, file } = mockShare();
  renderVet();
  const card = await screen.findByRole('group', { name: 'Next appointment' });
  await userEvent.click(within(card).getByRole('button', { name: '📅 Add to Calendar' }));
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const ics = await file().text();
  expect(ics).toContain('SUMMARY:Vet · Noodle');
  expect(ics).toContain(`UID:${visit.id}-2027-06-14@reptender`);
  expect(ics).toContain('LOCATION:Exotic Animal Clinic');
  expect(ics).toContain('DESCRIPTION:Follow-up after: Wellness exam');
});

it('offers no button once the appointment time has passed', async () => {
  await createVetVisit({ petId, date: '2026-06-14', nextAppointment: new Date(2026, 10, 8, 8, 0).toISOString() });
  renderVet();
  const card = await screen.findByRole('group', { name: 'Next appointment' }); // still listed today
  expect(within(card).queryByRole('button', { name: '📅 Add to Calendar' })).toBeNull();
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/care/CareCalendar.test.tsx src/features/vet/VetCalendar.test.tsx`
Expected: FAIL: `Unable to find role="button" and name "Add Mist to Calendar"` / `"📅 Add to Calendar"`. (The two "no button" tests already pass.)

- [ ] **Step 4: In `src/features/care/CareTasksScreen.tsx`, replace**

```tsx
              <Pill tone={TONE[dueStatus(due, now)]}>{statusLabel(due, now)}</Pill>
              <button type="button" className="btn" onClick={() => setEditing(task)}>Edit</button>
```

with:

```tsx
              <Pill tone={TONE[dueStatus(due, now)]}>{statusLabel(due, now)}</Pill>
              {isValid(due) && careEventStart(task, due).getTime() > now.getTime() && (
                <button
                  type="button"
                  className="btn"
                  aria-label={`Add ${task.name} to Calendar`}
                  disabled={busy.has(`cal-${task.id}`)}
                  // deliverFile runs synchronously inside the tap (iOS needs the gesture for the share sheet).
                  onClick={() =>
                    run(`cal-${task.id}`, () =>
                      deliverFile(calendarFile([careEvent(task, task.petId ? pet.name : undefined, due)], REMINDER_FILE)),
                    )
                  }
                >
                  📅
                </button>
              )}
              <button type="button" className="btn" onClick={() => setEditing(task)}>Edit</button>
```

- [ ] **Step 5: In `src/features/care/CareTasksScreen.tsx`, replace**

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import type { CareTask } from '../../domain/types';
```

with:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { isValid } from 'date-fns';
import type { CareTask } from '../../domain/types';
import { careEvent, careEventStart } from '../../domain/reminders';
import { deliverFile } from '../../lib/deliver';
import { calendarFile, REMINDER_FILE } from '../reminders/calendarFile';
```

- [ ] **Step 6: In `src/features/vet/VetScreen.tsx`, replace**

```tsx
          {(next.visit.clinic ?? clinic?.clinic) && <div className="muted">{next.visit.clinic ?? clinic?.clinic}</div>}
        </Card>
```

with:

```tsx
          {(next.visit.clinic ?? clinic?.clinic) && <div className="muted">{next.visit.clinic ?? clinic?.clinic}</div>}
          {nextEvent && nextEvent.start.getTime() > now.getTime() && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 8 }}
              disabled={sharing}
              onClick={async () => {
                if (sharing) return;
                setSharing(true);
                try {
                  await deliverFile(calendarFile([nextEvent], REMINDER_FILE));
                } finally {
                  setSharing(false);
                }
              }}
            >
              📅 Add to Calendar
            </button>
          )}
        </Card>
```

- [ ] **Step 7: In `src/features/vet/VetScreen.tsx`, replace**

```tsx
  const next = upcomingAppointment(visits, now);
```

with:

```tsx
  const next = upcomingAppointment(visits, now);
  const nextEvent = next ? vetEvent(pet.name, next.visit, clinic?.clinic) : null;
```

- [ ] **Step 8: In `src/features/vet/VetScreen.tsx`, replace**

```tsx
  const [viewing, setViewing] = useState<string>();
```

with:

```tsx
  const [viewing, setViewing] = useState<string>();
  const [sharing, setSharing] = useState(false);
```

- [ ] **Step 9: In `src/features/vet/VetScreen.tsx`, replace**

```tsx
import VetVisitSheet from './VetVisitSheet';
```

with:

```tsx
import VetVisitSheet from './VetVisitSheet';
import { vetEvent } from '../../domain/reminders';
import { deliverFile } from '../../lib/deliver';
import { calendarFile, REMINDER_FILE } from '../reminders/calendarFile';
```

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add Add to Calendar to care tasks and the next vet appointment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: "Add all reminders" on the Schedule tab and in Settings

Spec §5.13 ("📅 Add all reminders to Calendar"), §5.15 (Reminders & data: "Add reminders to Calendar") and §8 ("one `.ics` file with the next occurrence of every feeding and care task"). The Schedule screen's data loading moves into `useScheduleSources()` so the Schedule tab, this button, Settings and the app badge (Task 7) all read the same active pets, feedings and care tasks (archived pets and their tasks stay out). The button builds the file from data already loaded, synchronously inside the tap (see Task 4), and says what happened in a `status` line.

**Files:**
- Create: `src/features/schedule/scheduleSources.ts`, `src/features/reminders/RemindersButton.tsx`
- Modify: `src/features/schedule/ScheduleScreen.tsx` (uses the hook, adds the button), `src/features/settings/SettingsScreen.tsx` (adds the "Reminders & data" card)
- Test: `src/features/reminders/RemindersButton.test.tsx`

**Interfaces:**
- Consumes: `allReminders` (Task 3), `deliverFile` (Task 4), `calendarFile`, `ALL_REMINDERS_FILE` (Task 4), `FeedingSource`, `CareSource` (`src/domain/schedule.ts`), `listActivePets`, `listFeedings`, `listCareTasks`, `listAllCompletions`, `plural`, `UnitsCard` (Task 2)
- Produces:
  - `src/features/schedule/scheduleSources.ts`: `interface ScheduleSources { feedings: FeedingSource[]; care: CareSource[] }`, `loadScheduleSources(): Promise<ScheduleSources>`, `useScheduleSources(): ScheduleSources | undefined`
  - `RemindersButton({ sources, label, now? }: { sources: ScheduleSources | undefined; label: string; now?: Date })` (named export)
  - Schedule tab button `📅 Add all reminders to Calendar`; Settings card "Reminders & data" (`group` named so) with `📅 Add reminders to Calendar`

- [ ] **Step 1: Write the failing tests in `src/features/reminders/RemindersButton.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScheduleScreen from '../schedule/ScheduleScreen';
import SettingsScreen from '../settings/SettingsScreen';
import { resetDb } from '../../db/db';
import { archivePet, createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { completeCareTask, createCareTask } from '../../db/care';
import { mockShare, stubObjectUrls, unmockShare } from '../../test/share';

const now = new Date(2026, 10, 8, 9, 0);
const t = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();

async function pet(name: string, interval: number, food: string, fedDay: number) {
  const p = await createPet({ name, species: 'Reptile', feedingIntervalDays: interval, usualFoodItem: food });
  await logFeeding({ petId: p.id, at: t(fedDay, 18), foodItem: food, quantity: 1, outcome: 'ate' });
  return p;
}

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

describe('Add all reminders (spec §8)', () => {
  beforeEach(async () => {
    await resetDb();
    await pet('Basil', 2, 'Dubia roaches', 5); // late: skipped
    await pet('Noodle', 5, 'Pinky mouse', 3); // today 6 PM
    const ziggy = await pet('Ziggy', 3, 'Crickets', 7); // Nov 10
    const pebble = await pet('Pebble', 2, 'Greens', 7); // archived: skipped
    await archivePet(pebble.id);
    const mist = await createCareTask({ petId: ziggy.id, name: 'Mist', intervalDays: 2 });
    await completeCareTask(mist.id, t(7, 20)); // Nov 9, 09:00
  });

  it('shares one .ics with the next occurrence of every feeding and care task', async () => {
    const { share, file } = mockShare();
    render(<MemoryRouter><ScheduleScreen now={now} /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: '📅 Add all reminders to Calendar' }));
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(file().name).toBe('reptender-reminders.ics');
    const ics = await file().text();
    expect([...ics.matchAll(/^SUMMARY:(.*)$/gm)].map((m) => m[1]!.trim())).toEqual([
      'Feed Noodle · 1 Pinky mouse', 'Mist · Ziggy', 'Feed Ziggy · 1 Crickets',
    ]);
    expect(await screen.findByRole('status')).toHaveTextContent('Shared 3 reminders.');
  });

  it('says how to finish when the file was downloaded instead', async () => {
    // Settings uses the real clock: a task created now is always due in the future.
    await createCareTask({ name: 'Deep clean', intervalDays: 30 });
    mockShare(false);
    stubObjectUrls();
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    const card = await screen.findByRole('group', { name: 'Reminders & data' });
    await userEvent.click(within(card).getByRole('button', { name: '📅 Add reminders to Calendar' }));
    expect(await within(card).findByRole('status')).toHaveTextContent(
      /^Downloaded reptender-reminders\.ics \(\d+ reminders?\)\. Open it to add them to Calendar\.$/,
    );
  });
});

it('says so when there is nothing to remind', async () => {
  await resetDb();
  const { share } = mockShare();
  render(<MemoryRouter><ScheduleScreen now={now} /></MemoryRouter>);
  await userEvent.click(await screen.findByRole('button', { name: '📅 Add all reminders to Calendar' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Nothing coming up to remind you about.');
  expect(share).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/features/reminders/RemindersButton.test.tsx`
Expected: FAIL: `Unable to find role="button" and name "📅 Add all reminders to Calendar"` and `Unable to find role="group" and name "Reminders & data"`.

- [ ] **Step 3: Create `src/features/schedule/scheduleSources.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import type { CareSource, FeedingSource } from '../../domain/schedule';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { listAllCompletions, listCareTasks } from '../../db/care';

export interface ScheduleSources {
  feedings: FeedingSource[];
  care: CareSource[];
}

/** Active pets with their feedings, and the care tasks of active pets plus All-pets tasks. */
export async function loadScheduleSources(): Promise<ScheduleSources> {
  const pets = await listActivePets();
  const byId = new Map(pets.map((p) => [p.id, p]));
  const feedings = await Promise.all(pets.map(async (pet) => ({ pet, feedings: await listFeedings(pet.id) })));
  const completions = await listAllCompletions();
  const care = (await listCareTasks())
    .filter((task) => !task.petId || byId.has(task.petId)) // hide tasks of archived pets
    .map((task) => ({
      task,
      pet: task.petId ? byId.get(task.petId) : undefined,
      completions: completions.filter((c) => c.taskId === task.id),
    }));
  return { feedings, care };
}

/** Live: Schedule, "Add all reminders" and the app badge all read the same data. */
export function useScheduleSources(): ScheduleSources | undefined {
  return useLiveQuery(loadScheduleSources, []);
}
```

- [ ] **Step 4: Create `src/features/reminders/RemindersButton.tsx`**

```tsx
import { useState } from 'react';
import { allReminders } from '../../domain/reminders';
import { deliverFile } from '../../lib/deliver';
import { plural } from '../pets/format';
import type { ScheduleSources } from '../schedule/scheduleSources';
import { ALL_REMINDERS_FILE, calendarFile } from './calendarFile';

interface Props {
  sources: ScheduleSources | undefined;
  label: string;
  /** Tests only; otherwise the moment of the tap. */
  now?: Date;
}

/** Spec §8 "Add all reminders": one .ics with the next occurrence of every feeding and care task. */
export function RemindersButton({ sources, label, now }: Props) {
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string>();

  const onClick = async () => {
    if (!sources || sharing) return;
    const stamp = now ?? new Date();
    const events = allReminders(sources.feedings, sources.care, stamp);
    if (events.length === 0) {
      setNote('Nothing coming up to remind you about.');
      return;
    }
    setSharing(true);
    setNote(undefined);
    try {
      // Built synchronously, so the share sheet opens inside the tap (see deliverFile).
      const result = await deliverFile(calendarFile(events, ALL_REMINDERS_FILE, stamp));
      const count = plural(events.length, 'reminder');
      if (result === 'shared') setNote(`Shared ${count}.`);
      if (result === 'downloaded') setNote(`Downloaded ${ALL_REMINDERS_FILE} (${count}). Open it to add them to Calendar.`);
    } catch {
      setNote("Couldn't create the calendar file.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn-ghost" disabled={!sources || sharing} onClick={onClick}>
        {label}
      </button>
      {note && <p role="status" className="muted setting-note">{note}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Replace the whole of `src/features/schedule/ScheduleScreen.tsx`**

```tsx
import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';
import { lastMeal, statusLabel } from '../../domain/feeding';
import { comingUp, todayItems, type ScheduleItem } from '../../domain/schedule';
import { toggleCareToday } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { formatDay } from '../feedings/logModel';
import { TONE } from '../pets/PetsHome';
import { RemindersButton } from '../reminders/RemindersButton';
import { useScheduleSources } from './scheduleSources';

type FeedingItem = Extract<ScheduleItem, { kind: 'feeding' }>;

function checkLabel(item: ScheduleItem): string {
  if (item.kind === 'care') return `${item.title} done today`;
  return item.done ? `Fed ${item.pet.name} today` : `Log feeding for ${item.pet.name}`;
}

export default function ScheduleScreen({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const data = useScheduleSources();
  const [feeding, setFeeding] = useState<FeedingItem | null>(null);
  const [error, setError] = useState<string>();
  // Task ids with a one-tap write in flight, so a double tap can't toggle twice.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  if (!data) return null;
  const today = todayItems(data.feedings, data.care, now);
  const upcoming = comingUp(data.feedings, data.care, now);
  const doneCount = today.filter((i) => i.done).length;

  const onCheck = async (item: ScheduleItem) => {
    if (item.kind === 'feeding') {
      if (!item.done) setFeeding(item);
      return;
    }
    const id = item.task.id;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setBusy(new Set(inFlight.current));
    setError(undefined);
    try {
      // The timestamp is the moment of the tap, not the last render's clock.
      await toggleCareToday(id, fixedNow ?? new Date());
    } catch (err) {
      setError(saveErrorText(err));
    } finally {
      inFlight.current.delete(id);
      setBusy(new Set(inFlight.current));
    }
  };

  return (
    <>
      <h1>Today</h1>
      <div className="muted">{`${format(now, 'EEEE, MMM d')} · ${doneCount} of ${today.length} done`}</div>
      {error && <div role="alert" className="form-error">{error}</div>}

      <Card role="region" aria-label="Today's checklist" style={{ marginTop: 12 }}>
        {today.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing due today.</p>}
        {today.map((item) => (
          <div key={item.key} className="entry" role="group" aria-label={item.title}>
            <button
              type="button"
              className="check"
              aria-pressed={item.done}
              aria-label={checkLabel(item)}
              disabled={item.kind === 'feeding' ? item.done : busy.has(item.task.id)}
              onClick={() => onCheck(item)}
            >
              {item.done ? '✓' : ''}
            </button>
            <div className="grow">
              <b>{item.title}</b>
              <div className="muted">{item.detail}</div>
            </div>
            {!item.done && <Pill tone={TONE[item.status]}>{statusLabel(item.due, now)}</Pill>}
          </div>
        ))}
      </Card>

      <section aria-label="Coming up">
        <div className="label">Coming up</div>
        {upcoming.length === 0 && <p className="muted">Nothing in the next 7 days.</p>}
        {upcoming.map((g) => {
          const day = formatDay(parseDateKey(g.day), now);
          return (
            <Card key={g.day} role="group" aria-label={day}>
              <b>{day}</b>
              {g.items.map((i) => (
                <div key={i.key} className="muted">{`${i.title} · ${i.detail}`}</div>
              ))}
            </Card>
          );
        })}
      </section>

      <div style={{ marginTop: 12 }}>
        <RemindersButton sources={data} label="📅 Add all reminders to Calendar" now={fixedNow} />
      </div>

      {feeding && (
        <LogFeedingSheet
          open
          pet={feeding.pet}
          lastMealAt={lastMeal(feeding.feedings)?.at}
          currentDue={feeding.due}
          now={now}
          onClose={() => setFeeding(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 6: Replace the whole of `src/features/settings/SettingsScreen.tsx`** (adds the "Reminders & data" card; Task 9 adds backup to it)

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';
import { saveErrorText } from '../../db/ids';
import type { ThemePref } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { loadSampleData } from '../../dev/sampleData';
import { RemindersButton } from '../reminders/RemindersButton';
import { useScheduleSources } from '../schedule/scheduleSources';
import { UnitsCard } from './UnitsCard';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
] as const;

export default function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  const petCount = useLiveQuery(async () => (await listActivePets()).length, []);
  const sources = useScheduleSources();
  const [loading, setLoading] = useState(false);
  const [themeError, setThemeError] = useState<string>();
  if (!settings) return null;

  return (
    <>
      <h1>Settings</h1>
      <Card style={{ marginTop: 12 }}>
        <div className="row">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          <div className="grow">
            <b style={{ fontSize: 17 }}>RepTender</b>
            <div className="muted">{`${petCount ?? 0} pets · version ${__APP_VERSION__}`}</div>
          </div>
        </div>
      </Card>

      <div className="label">Appearance</div>
      <Card>
        {themeError && <div role="alert" className="form-error">{themeError}</div>}
        <Segmented<ThemePref>
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) => {
            setThemeError(undefined);
            updateSettings({ theme }).catch((err: unknown) => setThemeError(saveErrorText(err)));
          }}
        />
        <p className="muted setting-note">Auto follows your iPhone's light/dark setting.</p>
      </Card>

      <UnitsCard settings={settings} />

      <div className="label">Reminders &amp; data</div>
      <Card role="group" aria-label="Reminders & data">
        <div className="data-actions">
          <RemindersButton sources={sources} label="📅 Add reminders to Calendar" />
        </div>
      </Card>

      {import.meta.env.DEV && (
        <>
          <div className="label">Developer</div>
          <button
            type="button"
            className="btn-ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await loadSampleData();
              } finally {
                setLoading(false);
              }
            }}
          >
            Load sample pets
          </button>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Add all reminders to the Schedule tab and Settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App icon badge

Spec §8: `navigator.setAppBadge(count)` with the number of late or due-today items, updated whenever the app runs; skipped without error where unsupported. The count is exactly the Schedule tab's open items: feedings and care tasks that are late or due today and not done yet (archived pets excluded). `AppBadge` renders nothing; it recomputes when the data changes (live query) and when the clock ticks or the app returns to the foreground (`useNow`), and only calls the API when the number changes. At 0 it calls `clearAppBadge()`. Any error (unsupported, permission, a rejected promise) is swallowed.

**Files:**
- Modify: `src/domain/schedule.ts` (`badgeCount`), `src/app/App.tsx` (mounts `AppBadge`)
- Create: `src/lib/badge.ts`, `src/features/schedule/AppBadge.tsx`
- Test: `src/domain/badge.test.ts`, `src/features/schedule/AppBadge.test.tsx`

**Interfaces:**
- Consumes: `todayItems`, `FeedingSource`, `CareSource` (`src/domain/schedule.ts`), `useScheduleSources` (Task 6), `useNow`
- Produces:
  - `badgeCount(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): number`
  - `updateAppBadge(count: number): Promise<void>` (never rejects)
  - `AppBadge` (default export, props `{ now?: Date }`), rendered once in `App`

- [ ] **Step 1: Write the failing tests in `src/domain/badge.test.ts`**

```ts
import { expect, it } from 'vitest';
import type { CareCompletion, CareTask, Feeding, Pet } from './types';
import { badgeCount } from './schedule';

const now = new Date(2026, 10, 8, 9, 0);
const iso = (d: number, h = 18) => new Date(2026, 10, d, h, 0).toISOString();
const base = { createdAt: iso(1, 8), updatedAt: iso(1, 8) };
const pet = (id: string, interval: number): Pet => ({
  ...base, id, name: id, species: 'Reptile', sex: 'unknown', origin: 'unknown', birthDateApprox: false,
  feedingIntervalDays: interval, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {},
});
const ate = (petId: string, d: number, h = 18): Feeding => ({
  ...base, id: `${petId}-${d}`, petId, at: iso(d, h), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
});
const task = (id: string, intervalDays: number): CareTask => ({ ...base, id, name: id, intervalDays });
const done = (taskId: string, d: number, h = 9): CareCompletion => ({ ...base, id: `${taskId}-${d}`, taskId, at: iso(d, h) });

it('counts late and due-today feedings and care tasks that are not done yet', () => {
  const feedings = [
    { pet: pet('late', 2), feedings: [ate('late', 5)] }, // late
    { pet: pet('today', 5), feedings: [ate('today', 3)] }, // due today
    { pet: pet('fed', 3), feedings: [ate('fed', 8, 8)] }, // fed this morning: done
    { pet: pet('soon', 7), feedings: [ate('soon', 7)] }, // next week
    { pet: pet('new', 7), feedings: [] }, // never fed: due now
  ];
  const care = [
    { task: task('water', 2), completions: [done('water', 6)] }, // due today
    { task: task('clean', 1), completions: [done('clean', 8, 7)] }, // done today
    { task: task('uvb', 180), completions: [done('uvb', 1)] }, // months away
  ];
  expect(badgeCount(feedings, care, now)).toBe(4);
  expect(badgeCount([], [], now)).toBe(0);
});
```

- [ ] **Step 2: Write the failing tests in `src/features/schedule/AppBadge.test.tsx`**

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import AppBadge from './AppBadge';
import { updateAppBadge } from '../../lib/badge';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';

const now = new Date(2026, 10, 8, 9, 0);
type BadgeNav = { setAppBadge?: unknown; clearAppBadge?: unknown };

function mockBadge() {
  const set = vi.fn(async (_count?: number) => {});
  const clear = vi.fn(async () => {});
  Object.defineProperty(navigator, 'setAppBadge', { value: set, configurable: true, writable: true });
  Object.defineProperty(navigator, 'clearAppBadge', { value: clear, configurable: true, writable: true });
  return { set, clear };
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  delete (navigator as BadgeNav).setAppBadge;
  delete (navigator as BadgeNav).clearAppBadge;
  vi.restoreAllMocks();
});

it('shows the number of late and due-today items, and follows the data', async () => {
  const { set } = mockBadge();
  const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 3, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 }); // never fed: due now
  render(<AppBadge now={now} />);
  await vi.waitFor(() => expect(set).toHaveBeenLastCalledWith(2));

  await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 8, 8, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await vi.waitFor(() => expect(set).toHaveBeenLastCalledWith(1));
});

it('clears the badge when nothing is due', async () => {
  const { set, clear } = mockBadge();
  render(<AppBadge now={now} />);
  await vi.waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
  expect(set).not.toHaveBeenCalled();
});

it('is skipped silently where the Badging API is missing or fails', async () => {
  await expect(updateAppBadge(3)).resolves.toBeUndefined(); // no API at all
  const { set, clear } = mockBadge();
  set.mockRejectedValueOnce(new DOMException('Not allowed', 'NotAllowedError'));
  await expect(updateAppBadge(3)).resolves.toBeUndefined();
  clear.mockImplementationOnce(() => {
    throw new TypeError('Illegal invocation');
  });
  await expect(updateAppBadge(0)).resolves.toBeUndefined();
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/domain/badge.test.ts src/features/schedule/AppBadge.test.tsx`
Expected: FAIL: `badgeCount is not a function` and `Failed to resolve import "./AppBadge"`.

- [ ] **Step 4: In `src/domain/schedule.ts`, replace**

```ts
export interface DayGroup {
```

with:

```ts
/** Spec §8 app badge: the late or due-today items still open on today's checklist. */
export function badgeCount(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): number {
  return todayItems(feedings, care, now).filter((i) => !i.done).length;
}

export interface DayGroup {
```

- [ ] **Step 5: Create `src/lib/badge.ts`**

```ts
type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Spec §8: the home-screen icon badge (iOS 16.4+ for home-screen web apps).
 * Skipped without error where the Badging API is missing, not allowed, or fails.
 */
export async function updateAppBadge(count: number): Promise<void> {
  const nav = navigator as BadgeNavigator;
  try {
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch {
    // Nice to have, never an error (spec §15).
  }
}
```

- [ ] **Step 6: Create `src/features/schedule/AppBadge.tsx`**

```tsx
import { useEffect } from 'react';
import { badgeCount } from '../../domain/schedule';
import { updateAppBadge } from '../../lib/badge';
import { useNow } from '../../ui/useNow';
import { useScheduleSources } from './scheduleSources';

/** Keeps the app icon badge equal to the open late + due-today items (spec §8). Renders nothing. */
export default function AppBadge({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const sources = useScheduleSources();
  const count = sources ? badgeCount(sources.feedings, sources.care, now) : undefined;

  useEffect(() => {
    if (count !== undefined) void updateAppBadge(count);
  }, [count]);

  return null;
}
```

- [ ] **Step 7: In `src/app/App.tsx`, replace**

```tsx
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
```

with:

```tsx
    <HashRouter>
      <ThemeSync />
      <AppBadge />
      <AppRoutes />
    </HashRouter>
```

- [ ] **Step 8: In `src/app/App.tsx`, replace**

```tsx
import AddScreen from '../features/add/AddScreen';
```

with:

```tsx
import AddScreen from '../features/add/AddScreen';
import AppBadge from '../features/schedule/AppBadge';
```

- [ ] **Step 9: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: keep the app icon badge equal to late and due-today items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Backup export and import (data layer)

Spec §9 and §12 ("export → import round trip (including photos), and rejection of invalid backups"). Decisions:

- **File:** `reptender-backup-YYYY-MM-DD.json` = `{ app: "RepTender", schemaVersion: 2, exportedAt, tables: { <all 14 Dexie tables> } }`. Each photo's `blob` and `thumbBlob` become `data:<type>;base64,…` strings (the data URL keeps the MIME type).
- **Export never produces a file its own import would reject.** A real database can hold harmless dangling links (a deleted pet still named as another pet's sire, a photo id whose photo is gone), and an import that rejects the only backup would be the worst failure. So the export drops rows whose owner is gone and strips dangling optional links before writing; the import then checks every reference strictly.
- **Validation is strict about shape and types, not about app limits:** ids are unique non-empty strings, timestamps parse as ISO, date-only fields are real `yyyy-MM-dd` days, enums are known values, counts are whole numbers ≥ 1, `app` is `"RepTender"`, `schemaVersion` is 1 or 2. It does not apply UI caps such as the 365-day interval (Task 1): data saved before a cap existed must still restore, and Task 1 made every screen survive such values. `null` in an optional field is read as "not set".
- **Schema versions:** 2 is today's. 1 (Plan 1: pets, feedings, regurgitations, photos, foodItems, settings) is migrated the same way the Dexie v1→v2 upgrade does: the eight husbandry tables start empty and every pet gets `habitatTargets: {}`. Anything newer than this app is refused with "update the app first".
- **Nothing is written until the whole file is valid.** `parseBackup` is synchronous and pure (it decodes the photos too); `restoreBackup` then clears and refills every table in **one** Dexie transaction, so a failure part-way leaves the current data exactly as it was. Settings come from the backup, with `lastBackupAt` set to the backup's `exportedAt` (the restored data is exactly that backup).
- **Summary:** "4 pets, 120 entries, 6 photos". Entries are the log records: feedings, regurgitations, sheds, poops, measurements, habitat readings, care completions, vet visits and notes.

**Files:**
- Create: `src/lib/base64.ts`, `src/db/backupSchema.ts`, `src/db/backup.ts`
- Test: `src/lib/base64.test.ts`, `src/db/backup.test.ts`

**Interfaces:**
- Consumes: `db`, `SCHEMA_VERSION`, `DEFAULT_SETTINGS` (`src/db/db.ts`), `updateSettings`, `isDateKey`, `isTimeOfDay`, `dateKey`, every record type in `src/domain/types.ts`, `loadSampleData` (tests)
- Produces:
  - `src/lib/base64.ts`: `blobToDataUrl(blob: Blob): Promise<string>`, `dataUrlToBlob(url: string): Blob | null`
  - `src/db/backupSchema.ts`: `class BackupError extends Error`, `interface BackupTables` (one typed array per table), `type TableName = keyof BackupTables`, `TABLE_NAMES`, `V1_TABLE_NAMES`, `validateTables(raw: Record<string, unknown>, schemaVersion: number): BackupTables` (throws `BackupError`)
  - `src/db/backup.ts`: `BACKUP_APP = 'RepTender'`, `interface BackupJson`, `interface ParsedBackup { schemaVersion: number; exportedAt: string; tables: BackupTables }`, `readAllTables(): Promise<BackupTables>`, `pruneOrphans(t: BackupTables): BackupTables`, `createBackup(now?: Date): Promise<BackupJson>`, `backupFileName(now: Date): string`, `createBackupFile(now?: Date): Promise<File>`, `markBackedUp(at?: Date): Promise<void>`, `parseBackup(text: string): ParsedBackup`, `summarizeBackup(b: ParsedBackup): BackupSummary`, `summaryText(s: BackupSummary): string`, `restoreBackup(b: ParsedBackup): Promise<void>`

- [ ] **Step 1: Write the failing tests in `src/lib/base64.test.ts`**

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { blobToDataUrl, dataUrlToBlob } from './base64';

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob); // a real Blob implementation (jsdom's can't be read back from IndexedDB)
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('encodes a blob as a data URL that keeps its type, and decodes it back', async () => {
  const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256); // larger than one encoding chunk
  const url = await blobToDataUrl(new Blob([bytes], { type: 'image/jpeg' }));
  expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
  const back = dataUrlToBlob(url)!;
  expect(back.type).toBe('image/jpeg');
  expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
  expect(await blobToDataUrl(new Blob(['hi']))).toBe('data:application/octet-stream;base64,aGk=');
});

it('rejects anything that is not a base64 data URL', () => {
  expect(dataUrlToBlob('data:image/jpeg;base64,@@@')).toBeNull();
  expect(dataUrlToBlob('data:image/jpeg;base64,abc')).toBeNull(); // bad length
  expect(dataUrlToBlob('https://example.com/a.jpg')).toBeNull();
  expect(dataUrlToBlob('data:image/jpeg;base64,')).not.toBeNull(); // an empty file is still a file
});
```

- [ ] **Step 2: Write the failing tests in `src/db/backup.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { db, resetDb, SCHEMA_VERSION } from './db';
import { createPet, getPet } from './pets';
import { savePhoto, getPhoto } from './photos';
import { logFeeding } from './feedings';
import { logShed } from './sheds';
import { logMeasurement } from './measurements';
import { completeCareTask, createCareTask } from './care';
import { createVetVisit } from './vetVisits';
import { getSettings } from './settings';
import {
  backupFileName, createBackup, createBackupFile, markBackedUp, parseBackup, readAllTables, restoreBackup,
  summarizeBackup, summaryText, type BackupJson,
} from './backup';
import { BackupError, TABLE_NAMES } from './backupSchema';
import { loadSampleData } from '../dev/sampleData';

const now = new Date(2026, 10, 8, 9, 0);
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];

beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob); // fake-indexeddb only keeps real Blobs
  await resetDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const photo = (bytes = JPEG) =>
  savePhoto({ blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), thumbBlob: new Blob([new Uint8Array([9, 9])], { type: 'image/jpeg' }), width: 4, height: 3 });

/** One record in most tables, two photos. */
async function seed() {
  const photoId = await photo();
  const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, photoId });
  const meal = await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 3, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await logShed({ petId: noodle.id, date: '2026-11-01', quality: 'complete' });
  await logMeasurement({ petId: noodle.id, date: '2026-11-01', weightG: 42 });
  const task = await createCareTask({ petId: noodle.id, name: 'Mist', intervalDays: 2 });
  await completeCareTask(task.id, new Date(2026, 10, 7, 9, 0).toISOString());
  await createVetVisit({ petId: noodle.id, date: '2026-06-14', photoIds: [await photo([1, 2, 3])] });
  return { noodle, meal, photoId };
}

const clone = (b: BackupJson): BackupJson => JSON.parse(JSON.stringify(b));

describe('export (spec §9)', () => {
  it('writes every table, with photos as base64 data URLs', async () => {
    const { photoId } = await seed();
    const backup = await createBackup(now);
    expect(backup).toMatchObject({ app: 'RepTender', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString() });
    expect(Object.keys(backup.tables).sort()).toEqual([...TABLE_NAMES].sort());
    const stored = backup.tables.photos.find((p) => p.id === photoId)!;
    expect(stored.blob).toBe('data:image/jpeg;base64,/9j/4AECAw==');
    expect(stored).toMatchObject({ width: 4, height: 3 });
    expect(backup.tables.feedings).toHaveLength(1);
    expect(backup.tables.settings).toEqual([expect.objectContaining({ id: 'settings', theme: 'auto' })]);
    expect(backupFileName(now)).toBe('reptender-backup-2026-11-08.json');
  });

  it('makes a JSON file and records the backup date', async () => {
    await seed();
    const file = await createBackupFile(now);
    expect(file.name).toBe('reptender-backup-2026-11-08.json');
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await file.text())).toMatchObject({ app: 'RepTender', schemaVersion: SCHEMA_VERSION });
    expect((await getSettings()).lastBackupAt).toBeUndefined(); // only after the file was handed over
    await markBackedUp(now);
    expect((await getSettings()).lastBackupAt).toBe(now.toISOString());
  });

  it('leaves out orphan rows and dangling links, so its own import never fails', async () => {
    const { noodle } = await seed();
    const ts = now.toISOString();
    await db.feedings.add({ id: 'orphan', petId: 'gone', at: ts, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: ts, updatedAt: ts });
    await db.careCompletions.add({ id: 'orphan-done', taskId: 'gone', at: ts, createdAt: ts, updatedAt: ts });
    await db.pets.update(noodle.id, { photoId: 'missing-photo', sire: { name: 'Apollo', petId: 'deleted-pet' } });
    const backup = await createBackup(now);
    expect(backup.tables.feedings.map((f) => f.id)).not.toContain('orphan');
    expect(backup.tables.careCompletions.map((c) => c.id)).not.toContain('orphan-done');
    const pet = backup.tables.pets.find((p) => p.id === noodle.id)!;
    expect(pet.photoId).toBeUndefined();
    expect(pet.sire).toEqual({ name: 'Apollo' });
    expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
  });
});

describe('import (spec §9)', () => {
  it('round-trips the whole database, photos included, replacing what was there', async () => {
    await loadSampleData(now);
    const { photoId } = await seed();
    const before = await readAllTables();
    const text = JSON.stringify(await createBackup(now));

    await resetDb();
    await createPet({ name: 'Intruder', species: 'Gecko', feedingIntervalDays: 3 });
    const parsed = parseBackup(text);
    const summary = summarizeBackup(parsed);
    expect(summary).toEqual({
      pets: 5,
      photos: 2,
      entries: before.feedings.length + before.regurgitations.length + before.sheds.length + before.poops.length +
        before.measurements.length + before.habitatReadings.length + before.careCompletions.length +
        before.vetVisits.length + before.notes.length,
    });
    await restoreBackup(parsed);

    const after = await readAllTables();
    for (const name of TABLE_NAMES) {
      if (name === 'photos' || name === 'settings') continue;
      expect(after[name], name).toEqual(before[name]);
    }
    expect((await db.pets.toArray()).map((p) => p.name)).not.toContain('Intruder');
    const restored = (await getPhoto(photoId))!;
    expect(restored).toMatchObject({ width: 4, height: 3 });
    expect(restored.blob.type).toBe('image/jpeg');
    expect([...new Uint8Array(await restored.blob.arrayBuffer())]).toEqual(JPEG);
    expect((await getSettings()).lastBackupAt).toBe(now.toISOString());
  }, 20000);

  it('migrates a schema 1 backup (Plan 1 tables only)', async () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const v1 = {
      app: 'RepTender', schemaVersion: 1, exportedAt: ts,
      tables: {
        pets: [{
          id: 'p1', name: 'Noodle', species: 'Corn Snake', sex: 'female', origin: 'captive_bred', birthDateApprox: false,
          feedingIntervalDays: 5, usualQuantity: 1, usualFeedTime: '18:00', createdAt: ts, updatedAt: ts,
        }],
        feedings: [{ id: 'f1', petId: 'p1', at: ts, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: ts, updatedAt: ts }],
        regurgitations: [{ id: 'r1', petId: 'p1', feedingId: 'f1', at: ts, pushBackDays: 10, notes: null, createdAt: ts, updatedAt: ts }],
        photos: [],
        foodItems: [{ id: 'fi1', name: 'Pinky mouse', isCustom: false, createdAt: ts, updatedAt: ts }],
        settings: [{ id: 'settings', theme: 'dark', tempUnit: 'C', weightUnit: 'g', lengthUnit: 'cm' }],
      },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(summaryText(summarizeBackup(parsed))).toBe('1 pet, 2 entries, 0 photos');
    await restoreBackup(parsed);
    expect(await getPet('p1')).toMatchObject({ name: 'Noodle', habitatTargets: {} });
    expect((await db.regurgitations.get('r1'))!.notes).toBeUndefined();
    expect(await db.sheds.count()).toBe(0);
    expect(await getSettings()).toMatchObject({ theme: 'dark', tempUnit: 'C', lastBackupAt: ts });
  });

  it('words the summary', () => {
    expect(summaryText({ pets: 4, entries: 120, photos: 6 })).toBe('4 pets, 120 entries, 6 photos');
    expect(summaryText({ pets: 1, entries: 1, photos: 1 })).toBe('1 pet, 1 entry, 1 photo');
  });

  it('keeps the current data when writing the backup fails part-way', async () => {
    await seed();
    const parsed = parseBackup(JSON.stringify(await createBackup(now)));
    await resetDb();
    await createPet({ name: 'Keeper', species: 'Gecko', feedingIntervalDays: 3 });
    // Slip a duplicate key past validation: bulkAdd fails after pets and feedings were already written.
    parsed.tables.vetVisits.push({ ...parsed.tables.vetVisits[0]! });
    await expect(restoreBackup(parsed)).rejects.toThrow();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Keeper']);
    expect(await db.feedings.count()).toBe(0);
  });
});

describe('invalid backups are rejected with a clear message (spec §9)', () => {
  let good: BackupJson;
  beforeEach(async () => {
    await seed();
    good = await createBackup(now);
  });

  const cases: [string, (b: BackupJson) => unknown, string][] = [
    ['another app', (b) => ({ ...b, app: 'SnakeKeeper' }), "isn't a RepTender backup"],
    ['a newer schema', (b) => ({ ...b, schemaVersion: SCHEMA_VERSION + 1 }), 'newer version of RepTender'],
    ['an unknown schema', (b) => ({ ...b, schemaVersion: 0 }), 'unknown schema version'],
    ['a bad export date', (b) => ({ ...b, exportedAt: 'soon' }), 'no valid export date'],
    ['a missing table', (b) => ({ ...b, tables: { ...b.tables, feedings: undefined } }), 'missing the feedings table'],
    ['a wrong type', (b) => { (b.tables.feedings[0] as unknown as Record<string, unknown>).quantity = '2'; return b; }, 'Row 1 of feedings: "quantity" is missing or not valid.'],
    ['a bad date-time', (b) => { b.tables.feedings[0]!.at = 'yesterday'; return b; }, 'Row 1 of feedings: "at" is missing or not valid.'],
    ['a bad day', (b) => { b.tables.sheds[0]!.date = '2026-02-30'; return b; }, 'Row 1 of sheds: "date" is missing or not valid.'],
    ['an unknown outcome', (b) => { (b.tables.feedings[0] as unknown as Record<string, unknown>).outcome = 'maybe'; return b; }, '"outcome" is missing or not valid.'],
    ['a dangling reference', (b) => { b.tables.feedings[0]!.petId = 'nope'; return b; }, 'Row 1 of feedings: "petId" points to a record that isn\'t in the backup.'],
    ['a dangling photo', (b) => { b.tables.vetVisits[0]!.photoIds = ['nope']; return b; }, 'Row 1 of vetVisits: "photoIds" points to a record'],
    ['bad photo data', (b) => { b.tables.photos[0]!.blob = 'data:image/jpeg;base64,@@@'; return b; }, '"blob" is missing or not valid.'],
    ['a duplicate id', (b) => { b.tables.pets.push({ ...b.tables.pets[0]! }); return b; }, 'Row 2 of pets: "id" is used twice.'],
    ['an empty measurement', (b) => { delete b.tables.measurements[0]!.weightG; return b; }, 'Row 1 of measurements needs at least one of weightG, lengthMm.'],
    ['not a list', (b) => ({ ...b, tables: { ...b.tables, notes: {} } }), 'missing the notes table'],
  ];

  it.each(cases)('rejects %s', async (_name, mutate, message) => {
    const text = JSON.stringify(mutate(clone(good)));
    expect(() => parseBackup(text)).toThrow(BackupError);
    expect(() => parseBackup(text)).toThrow(message);
    expect(await db.pets.count()).toBe(1); // nothing was touched
  });

  it('rejects files that are not JSON or not an object', () => {
    expect(() => parseBackup('{oops')).toThrow("That file isn't a RepTender backup (it isn't valid JSON).");
    expect(() => parseBackup('[1, 2]')).toThrow("That file isn't a RepTender backup.");
    expect(() => parseBackup('null')).toThrow("That file isn't a RepTender backup.");
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/lib/base64.test.ts src/db/backup.test.ts`
Expected: FAIL with `Failed to resolve import "./base64"` / `"./backup"`.

- [ ] **Step 4: Create `src/lib/base64.ts`**

```ts
const CHUNK = 0x8000; // String.fromCharCode(...bytes) on a whole photo would overflow the call stack

/** Blob → `data:<type>;base64,…` (spec §9: photos are base64-encoded in the backup). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/;

/** The reverse of blobToDataUrl, or null for anything that isn't a valid base64 data URL. */
export function dataUrlToBlob(url: string): Blob | null {
  const m = DATA_URL.exec(url);
  if (!m || m[2]!.length % 4 !== 0) return null;
  let binary: string;
  try {
    binary = atob(m[2]!);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
```

- [ ] **Step 5: Create `src/db/backupSchema.ts`**

```ts
import { isValid, parseISO } from 'date-fns';
import type {
  CareCompletion, CareTask, Feeding, FoodItem, HabitatReading, Measurement, Note, Pet, Photo, Poop,
  Regurgitation, Settings, Shed, VetVisit,
} from '../domain/types';
import { isDateKey, isTimeOfDay } from '../domain/dates';

/** A backup file that can't be imported. `message` is shown to the user as is. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface BackupTables {
  pets: Pet[];
  feedings: Feeding[];
  regurgitations: Regurgitation[];
  photos: Photo[];
  foodItems: FoodItem[];
  settings: Settings[];
  sheds: Shed[];
  poops: Poop[];
  measurements: Measurement[];
  habitatReadings: HabitatReading[];
  careTasks: CareTask[];
  careCompletions: CareCompletion[];
  vetVisits: VetVisit[];
  notes: Note[];
}

export type TableName = keyof BackupTables;

/** Every Dexie table (schema version 2). */
export const TABLE_NAMES: readonly TableName[] = [
  'pets', 'feedings', 'regurgitations', 'photos', 'foodItems', 'settings', 'sheds', 'poops',
  'measurements', 'habitatReadings', 'careTasks', 'careCompletions', 'vetVisits', 'notes',
];

/** The tables a schema version 1 (Plan 1) backup has. */
export const V1_TABLE_NAMES: readonly TableName[] = ['pets', 'feedings', 'regurgitations', 'photos', 'foodItems', 'settings'];

type Check = (v: unknown) => boolean;
interface Field {
  check: Check;
  optional: boolean;
}
type Fields = Record<string, Field>;

const req = (check: Check): Field => ({ check, optional: false });
const opt = (check: Check): Field => ({ check, optional: true });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str: Check = (v) => typeof v === 'string';
const text: Check = (v) => typeof v === 'string' && v.trim() !== '';
const bool: Check = (v) => typeof v === 'boolean';
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const count: Check = (v) => Number.isInteger(v) && (v as number) >= 1;
const iso: Check = (v) => typeof v === 'string' && isValid(parseISO(v));
const day: Check = (v) => typeof v === 'string' && isDateKey(v);
const time: Check = (v) => typeof v === 'string' && isTimeOfDay(v);
const dataUrl: Check = (v) => typeof v === 'string' && v.startsWith('data:'); // decoded (and checked) in backup.ts
const oneOf = (...values: string[]): Check => (v) => typeof v === 'string' && values.includes(v);
const listOf = (check: Check): Check => (v) => Array.isArray(v) && v.every(check);
const shape = (fields: Fields): Check => (v) => isObject(v) && Object.entries(fields).every(([k, f]) => fieldOk(v[k], f));

function fieldOk(value: unknown, field: Field): boolean {
  if (value === undefined || value === null) return field.optional;
  return field.check(value);
}

const RECORD: Fields = { id: req(text), createdAt: req(iso), updatedAt: req(iso) };
const PARENT = shape({ name: opt(str), morph: opt(str), petId: opt(str) });
const TARGETS = shape({
  warmMinC: opt(num), warmMaxC: opt(num), coolMinC: opt(num), coolMaxC: opt(num), humidityMin: opt(num), humidityMax: opt(num),
});

interface TableSpec {
  fields: Fields;
  /** At least one of these must be set (spec §6.2 measurements and habitat readings). */
  atLeastOne?: string[];
}

const SPECS: Record<TableName, TableSpec> = {
  pets: {
    fields: {
      ...RECORD, name: req(text), photoId: opt(text), species: req(str), morph: opt(str),
      sex: req(oneOf('male', 'female', 'unknown')), birthDate: opt(day), birthDateApprox: req(bool),
      description: opt(str), origin: req(oneOf('captive_bred', 'wild_caught', 'unknown')), acquiredFrom: opt(str),
      acquiredDate: opt(day), pricePaid: opt(num), sire: opt(PARENT), dam: opt(PARENT), feedingIntervalDays: req(count),
      usualFoodItem: opt(str), usualQuantity: req(count), usualFeedTime: opt(time), enclosureLabel: opt(str),
      habitatTargets: req(TARGETS), nextFeedingOverride: opt(iso), inBlueSince: opt(day), archivedAt: opt(iso),
    },
  },
  feedings: {
    fields: {
      ...RECORD, petId: req(text), at: req(iso), foodItem: req(str), quantity: req(count),
      outcome: req(oneOf('ate', 'refused')), notes: opt(str),
    },
  },
  regurgitations: {
    fields: { ...RECORD, petId: req(text), at: req(iso), feedingId: req(text), pushBackDays: opt(count), notes: opt(str) },
  },
  photos: { fields: { ...RECORD, blob: req(dataUrl), thumbBlob: req(dataUrl), width: req(num), height: req(num) } },
  foodItems: { fields: { ...RECORD, name: req(text), isCustom: req(bool) } },
  settings: {
    fields: {
      id: req(oneOf('settings')), theme: req(oneOf('light', 'dark', 'auto')), tempUnit: req(oneOf('F', 'C')),
      weightUnit: req(oneOf('g', 'oz', 'lb')), lengthUnit: req(oneOf('in', 'cm')), lastBackupAt: opt(iso),
    },
  },
  sheds: {
    fields: {
      ...RECORD, petId: req(text), date: req(day), inBlueDate: opt(day),
      quality: req(oneOf('complete', 'partial', 'stuck')), notes: opt(str),
    },
  },
  poops: {
    fields: {
      ...RECORD, petId: req(text), at: req(iso), kind: req(oneOf('normal', 'runny', 'urate_only', 'abnormal')), notes: opt(str),
    },
  },
  measurements: {
    fields: { ...RECORD, petId: req(text), date: req(day), weightG: opt(num), lengthMm: opt(num) },
    atLeastOne: ['weightG', 'lengthMm'],
  },
  habitatReadings: {
    fields: { ...RECORD, petId: req(text), at: req(iso), warmC: opt(num), coolC: opt(num), humidityPct: opt(num) },
    atLeastOne: ['warmC', 'coolC', 'humidityPct'],
  },
  careTasks: {
    fields: {
      ...RECORD, petId: opt(text), name: req(text), intervalDays: req(count), timeOfDay: opt(time), archivedAt: opt(iso),
    },
  },
  careCompletions: { fields: { ...RECORD, taskId: req(text), at: req(iso) } },
  vetVisits: {
    fields: {
      ...RECORD, petId: req(text), date: req(day), clinic: opt(str), vet: opt(str), phone: opt(str), reason: opt(str),
      notes: opt(str), cost: opt(num), photoIds: req(listOf(text)), nextAppointment: opt(iso),
    },
  },
  notes: { fields: { ...RECORD, petId: req(text), at: req(iso), text: req(str) } },
};

const fail = (table: string, row: number, message: string): never => {
  throw new BackupError(`Row ${row + 1} of ${table}${message}`);
};

/** Checks one table's rows and returns them with null optional fields removed. */
function checkRows(name: TableName, rows: unknown[]): Record<string, unknown>[] {
  const spec = SPECS[name];
  const ids = new Set<string>();
  return rows.map((row, i) => {
    if (!isObject(row)) return fail(name, i, ' is not a record.');
    const clean: Record<string, unknown> = { ...row };
    for (const [key, field] of Object.entries(spec.fields)) {
      if (!fieldOk(row[key], field)) fail(name, i, `: "${key}" is missing or not valid.`);
      if (row[key] === null) delete clean[key];
    }
    if (spec.atLeastOne && spec.atLeastOne.every((k) => row[k] === undefined || row[k] === null)) {
      fail(name, i, ` needs at least one of ${spec.atLeastOne.join(', ')}.`);
    }
    const id = String(row.id);
    if (ids.has(id)) fail(name, i, ': "id" is used twice.');
    ids.add(id);
    return clean;
  });
}

/** Spec §9: "references that point to real records". */
function checkReferences(t: BackupTables): void {
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
  const pets = ids(t.pets);
  const photos = ids(t.photos);
  const tasks = ids(t.careTasks);
  const feedings = new Map(t.feedings.map((f) => [f.id, f]));
  const missing = (table: string, row: number, field: string) =>
    fail(table, row, `: "${field}" points to a record that isn't in the backup.`);

  t.pets.forEach((p, i) => {
    if (p.photoId && !photos.has(p.photoId)) missing('pets', i, 'photoId');
    if (p.sire?.petId && !pets.has(p.sire.petId)) missing('pets', i, 'sire');
    if (p.dam?.petId && !pets.has(p.dam.petId)) missing('pets', i, 'dam');
  });
  for (const name of ['feedings', 'regurgitations', 'sheds', 'poops', 'measurements', 'habitatReadings', 'vetVisits', 'notes'] as const) {
    (t[name] as { petId: string }[]).forEach((r, i) => {
      if (!pets.has(r.petId)) missing(name, i, 'petId');
    });
  }
  t.regurgitations.forEach((r, i) => {
    if (feedings.get(r.feedingId)?.petId !== r.petId) missing('regurgitations', i, 'feedingId');
  });
  t.careTasks.forEach((c, i) => {
    if (c.petId && !pets.has(c.petId)) missing('careTasks', i, 'petId');
  });
  t.careCompletions.forEach((c, i) => {
    if (!tasks.has(c.taskId)) missing('careCompletions', i, 'taskId');
  });
  t.vetVisits.forEach((v, i) => {
    if (v.photoIds.some((id) => !photos.has(id))) missing('vetVisits', i, 'photoIds');
  });
  const names = new Set<string>();
  t.foodItems.forEach((f, i) => {
    if (names.has(f.name)) fail('foodItems', i, ': "name" is used twice.');
    names.add(f.name);
  });
  if (t.settings.length > 1) fail('settings', 1, ': there can only be one settings record.');
}

/**
 * Validates the `tables` object of a backup with the given schema version and migrates it to the
 * current shape. Photo blobs are still data URL strings here. Throws BackupError.
 */
export function validateTables(raw: Record<string, unknown>, schemaVersion: number): BackupTables {
  const required = schemaVersion === 1 ? V1_TABLE_NAMES : TABLE_NAMES;
  const out = {} as Record<TableName, Record<string, unknown>[]>;
  for (const name of TABLE_NAMES) {
    const rows = raw[name];
    if (rows === undefined && !required.includes(name)) {
      out[name] = []; // schema 1 → 2: the husbandry tables start empty
      continue;
    }
    if (!Array.isArray(rows)) throw new BackupError(`This backup is missing the ${name} table.`);
    if (schemaVersion === 1 && name === 'pets') {
      // Same as the Dexie v1 → v2 upgrade: every pet gets a habitatTargets object.
      out[name] = checkRows(name, rows.map((p) => (isObject(p) && p.habitatTargets === undefined ? { ...p, habitatTargets: {} } : p)));
    } else {
      out[name] = checkRows(name, rows);
    }
  }
  const tables = out as unknown as BackupTables;
  checkReferences(tables);
  return tables;
}
```

- [ ] **Step 6: Create `src/db/backup.ts`**

```ts
import { isValid, parseISO } from 'date-fns';
import type { Pet, Photo } from '../domain/types';
import { dateKey } from '../domain/dates';
import { blobToDataUrl, dataUrlToBlob } from '../lib/base64';
import { db, DEFAULT_SETTINGS, SCHEMA_VERSION } from './db';
import { updateSettings } from './settings';
import { BackupError, TABLE_NAMES, validateTables, type BackupTables, type TableName } from './backupSchema';

export const BACKUP_APP = 'RepTender';

export type PhotoJson = Omit<Photo, 'blob' | 'thumbBlob'> & { blob: string; thumbBlob: string };

/** The backup file (spec §9). */
export interface BackupJson {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  tables: Omit<BackupTables, 'photos'> & { photos: PhotoJson[] };
}

/** A validated, migrated backup with its photos decoded, ready for restoreBackup(). */
export interface ParsedBackup {
  schemaVersion: number;
  exportedAt: string;
  tables: BackupTables;
}

export interface BackupSummary {
  pets: number;
  entries: number;
  photos: number;
}

/** Every table, read in one transaction so the snapshot is consistent. */
export async function readAllTables(): Promise<BackupTables> {
  return db.transaction('r', db.tables, async () => {
    const out = {} as Record<TableName, unknown[]>;
    for (const name of TABLE_NAMES) out[name] = await db.table(name).toArray();
    return out as unknown as BackupTables;
  });
}

/**
 * Drops rows whose owner is gone and strips dangling optional links (a deleted parent pet, a
 * missing photo), so an export always passes the import's reference checks.
 */
export function pruneOrphans(t: BackupTables): BackupTables {
  const pets = new Set(t.pets.map((p) => p.id));
  const photos = new Set(t.photos.map((p) => p.id));
  const owned = <T extends { petId: string }>(rows: T[]) => rows.filter((r) => pets.has(r.petId));
  const feedings = owned(t.feedings);
  const feedingPet = new Map(feedings.map((f) => [f.id, f.petId]));
  const careTasks = t.careTasks.filter((c) => !c.petId || pets.has(c.petId));
  const taskIds = new Set(careTasks.map((c) => c.id));
  const parent = (p: Pet['sire']) => (p?.petId && !pets.has(p.petId) ? { name: p.name, morph: p.morph } : p);
  return {
    ...t,
    pets: t.pets.map((p) => ({
      ...p,
      photoId: p.photoId && photos.has(p.photoId) ? p.photoId : undefined,
      sire: parent(p.sire),
      dam: parent(p.dam),
    })),
    feedings,
    regurgitations: owned(t.regurgitations).filter((r) => feedingPet.get(r.feedingId) === r.petId),
    sheds: owned(t.sheds),
    poops: owned(t.poops),
    measurements: owned(t.measurements),
    habitatReadings: owned(t.habitatReadings),
    careTasks,
    careCompletions: t.careCompletions.filter((c) => taskIds.has(c.taskId)),
    vetVisits: owned(t.vetVisits).map((v) => ({ ...v, photoIds: v.photoIds.filter((id) => photos.has(id)) })),
    notes: owned(t.notes),
  };
}

export async function createBackup(now: Date = new Date()): Promise<BackupJson> {
  const tables = pruneOrphans(await readAllTables());
  // Encoding is async (Blob reads), so it runs after the read transaction has finished.
  const photos = await Promise.all(
    tables.photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob), thumbBlob: await blobToDataUrl(p.thumbBlob) })),
  );
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables: { ...tables, photos } };
}

export const backupFileName = (now: Date): string => `reptender-backup-${dateKey(now)}.json`;

export async function createBackupFile(now: Date = new Date()): Promise<File> {
  const backup = await createBackup(now);
  return new File([JSON.stringify(backup)], backupFileName(now), { type: 'application/json' });
}

/** Spec §9: record lastBackupAt once the file has been handed to the share sheet or downloaded. */
export async function markBackedUp(at: Date = new Date()): Promise<void> {
  await updateSettings({ lastBackupAt: at.toISOString() });
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses and validates a backup file's text. Throws BackupError; never touches the database. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't a RepTender backup (it isn't valid JSON).");
  }
  if (!isObject(json) || json.app !== BACKUP_APP) throw new BackupError("That file isn't a RepTender backup.");
  const version = json.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupError('This backup has an unknown schema version.');
  }
  if (version > SCHEMA_VERSION) {
    throw new BackupError('This backup comes from a newer version of RepTender. Update the app, then import it again.');
  }
  if (typeof json.exportedAt !== 'string' || !isValid(parseISO(json.exportedAt))) {
    throw new BackupError('This backup has no valid export date.');
  }
  if (!isObject(json.tables)) throw new BackupError('This backup has no tables.');

  const tables = validateTables(json.tables, version);
  const photos = (tables.photos as unknown as PhotoJson[]).map((p, i) => {
    const blob = dataUrlToBlob(p.blob);
    const thumbBlob = dataUrlToBlob(p.thumbBlob);
    if (!blob) throw new BackupError(`Row ${i + 1} of photos: "blob" is missing or not valid.`);
    if (!thumbBlob) throw new BackupError(`Row ${i + 1} of photos: "thumbBlob" is missing or not valid.`);
    return { ...p, blob, thumbBlob };
  });
  return { schemaVersion: version, exportedAt: json.exportedAt, tables: { ...tables, photos } };
}

const ENTRY_TABLES = [
  'feedings', 'regurgitations', 'sheds', 'poops', 'measurements', 'habitatReadings', 'careCompletions', 'vetVisits', 'notes',
] as const;

export function summarizeBackup(b: ParsedBackup): BackupSummary {
  return {
    pets: b.tables.pets.length,
    entries: ENTRY_TABLES.reduce((n, name) => n + b.tables[name].length, 0),
    photos: b.tables.photos.length,
  };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 pets, 120 entries, 6 photos" */
export function summaryText(s: BackupSummary): string {
  return [count(s.pets, 'pet', 'pets'), count(s.entries, 'entry', 'entries'), count(s.photos, 'photo', 'photos')].join(', ');
}

/** Spec §9: replace all data in one transaction. Any failure leaves the current data as it was. */
export async function restoreBackup(b: ParsedBackup): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    for (const name of TABLE_NAMES) {
      if (name === 'settings') continue;
      const rows = b.tables[name];
      if (rows.length > 0) await db.table(name).bulkAdd(rows);
    }
    await db.settings.put({ ...DEFAULT_SETTINGS, ...b.tables.settings[0], id: 'settings', lastBackupAt: b.exportedAt });
  });
}
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add backup export and validated replace-all import

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Backup in Settings: export, last backup, import with summary, storage warning

Spec §5.15 ("Reminders & data: Add reminders to Calendar · Export backup (shows the last export date) · Import backup") and §9 (backup reminder, storage warning). Decisions:

- **Export is two taps:** "Export backup" builds the file (IndexedDB reads and photo encoding take time), then "Save backup file (1.2 MB)" hands it over. The second tap calls `navigator.share` straight away, which iOS requires (a share started after a long `await` is refused for lack of a user gesture). `lastBackupAt` is written only after the file was shared or downloaded; a cancelled share sheet keeps the file ready to try again.
- **Last backup line** under Export: "Never backed up", "Last backup today", "Last backup 1 day ago", "Last backup N days ago". It is amber (`.warn`) when there has never been a backup or the last one is **more than 30 days** old.
- **Import:** pick a `.json` file → `parseBackup` (Task 8) → a sheet "Import backup" shows the summary and export date and warns that it replaces everything → **Replace all data** runs `restoreBackup` (one transaction). A bad file shows the `BackupError` message inline and nothing changes. Replace and Cancel are disabled while restoring (no double tap).
- **Storage warning:** on opening Settings, `navigator.storage.estimate()`; above 80% used, an amber line at the top of the card. Missing API or a failure shows nothing.
- `navigator.storage.persist()` is already called at startup (`src/main.tsx`, Plan 1); Task 10 adds the missing `.catch`.

**Files:**
- Create: `src/domain/backupStatus.ts`, `src/lib/storage.ts`, `src/features/backup/ExportBackupButton.tsx`, `src/features/backup/ImportBackup.tsx`, `src/features/backup/useStorageWarning.ts`
- Modify: `src/features/settings/SettingsScreen.tsx` (backup in the "Reminders & data" card)
- Test: `src/domain/backupStatus.test.ts`, `src/lib/storage.test.ts`, `src/features/backup/BackupSettings.test.tsx`

**Interfaces:**
- Consumes: `createBackupFile`, `markBackedUp`, `parseBackup`, `summarizeBackup`, `summaryText`, `restoreBackup`, `BackupError` (Task 8), `deliverFile` (Task 4), `RemindersButton`, `useScheduleSources` (Task 6), `UnitsCard` (Task 2), `Sheet`, `useNow`, `mockShare`, `unmockShare`, `stubObjectUrls` (Task 4)
- Produces:
  - `src/domain/backupStatus.ts`: `BACKUP_REMINDER_DAYS = 30`, `backupStatus(lastBackupAt: string | undefined, now: Date): { text: string; overdue: boolean }`
  - `src/lib/storage.ts`: `STORAGE_WARN_RATIO = 0.8`, `storageWarning(estimate?: { usage?: number; quota?: number }): string | null`, `readStorageEstimate(): Promise<StorageEstimate | undefined>`, `formatBytes(n: number): string`
  - `ExportBackupButton` (named export, no props): buttons `Export backup`, then `Save backup file (<size>)`; a `status` line after saving
  - `ImportBackup` (named export, no props): a file input labelled `Import backup`; a sheet titled `Import backup` with `Replace all data` / `Cancel`; a `status` line after importing; an `alert` for a rejected file
  - `useStorageWarning(): string | null`

- [ ] **Step 1: Write the failing tests in `src/domain/backupStatus.test.ts`**

```ts
import { expect, it } from 'vitest';
import { BACKUP_REMINDER_DAYS, backupStatus } from './backupStatus';

const now = new Date(2026, 10, 8, 9, 0);
const daysAgo = (n: number, h = 20) => new Date(2026, 10, 8 - n, h, 0).toISOString();

it('says when the last backup was, by calendar day', () => {
  expect(backupStatus(undefined, now)).toEqual({ text: 'Never backed up', overdue: true });
  expect(backupStatus('garbage', now)).toEqual({ text: 'Never backed up', overdue: true });
  expect(backupStatus(new Date(2026, 10, 8, 7, 0).toISOString(), now)).toEqual({ text: 'Last backup today', overdue: false });
  expect(backupStatus(daysAgo(1), now)).toEqual({ text: 'Last backup 1 day ago', overdue: false });
  expect(backupStatus(daysAgo(3), now)).toEqual({ text: 'Last backup 3 days ago', overdue: false });
});

it('turns amber after 30 days', () => {
  expect(BACKUP_REMINDER_DAYS).toBe(30);
  expect(backupStatus(daysAgo(30), now).overdue).toBe(false);
  expect(backupStatus(daysAgo(31), now)).toEqual({ text: 'Last backup 31 days ago', overdue: true });
});
```

- [ ] **Step 2: Write the failing tests in `src/lib/storage.test.ts`**

```ts
import { afterEach, expect, it } from 'vitest';
import { formatBytes, readStorageEstimate, storageWarning } from './storage';

afterEach(() => {
  delete (navigator as { storage?: unknown }).storage;
});

it('warns above 80% of the quota', () => {
  expect(storageWarning({ usage: 85, quota: 100 })).toBe('Storage is 85% full. Export a backup so nothing is lost.');
  expect(storageWarning({ usage: 80, quota: 100 })).toBeNull();
  expect(storageWarning({ usage: 10, quota: 100 })).toBeNull();
  expect(storageWarning({ usage: 10 })).toBeNull();
  expect(storageWarning(undefined)).toBeNull();
});

it('reads the estimate, or nothing when the API is missing or fails', async () => {
  expect(await readStorageEstimate()).toBeUndefined();
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 1, quota: 2 }) }, configurable: true });
  expect(await readStorageEstimate()).toEqual({ usage: 1, quota: 2 });
  Object.defineProperty(navigator, 'storage', { value: { estimate: async () => { throw new Error('nope'); } }, configurable: true });
  expect(await readStorageEstimate()).toBeUndefined();
});

it('formats file sizes', () => {
  expect(formatBytes(300)).toBe('1 KB');
  expect(formatBytes(48_000)).toBe('47 KB');
  expect(formatBytes(2_500_000)).toBe('2.4 MB');
});
```

- [ ] **Step 3: Write the failing tests in `src/features/backup/BackupSettings.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { subDays } from 'date-fns';
import SettingsScreen from '../settings/SettingsScreen';
import { db, resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { getSettings, updateSettings } from '../../db/settings';
import { createBackup } from '../../db/backup';
import { mockShare, stubObjectUrls, unmockShare } from '../../test/share';

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  unmockShare();
  delete (navigator as { storage?: unknown }).storage;
  vi.restoreAllMocks();
});

const renderSettings = () => render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
const card = () => screen.findByRole('group', { name: 'Reminders & data' });

async function backupText(): Promise<string> {
  const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  await logFeeding({ petId: noodle.id, at: new Date(2026, 10, 3, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  return JSON.stringify(await createBackup(new Date(2026, 10, 8, 9, 0)));
}

const pick = (text: string, name = 'reptender-backup-2026-11-08.json') =>
  fireEvent.change(screen.getByLabelText('Import backup'), {
    target: { files: [new File([text], name, { type: 'application/json' })] },
  });

describe('Export backup', () => {
  it('starts at "Never backed up" in amber, then saves a file and records the date', async () => {
    await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    const { share, file } = mockShare();
    renderSettings();
    const data = await card();
    expect(within(data).getByText('Never backed up')).toHaveClass('warn');

    await userEvent.click(within(data).getByRole('button', { name: 'Export backup' }));
    await userEvent.click(await within(data).findByRole('button', { name: /^Save backup file \(\d+ KB\)$/ }));
    await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(file().name).toMatch(/^reptender-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await file().text())).toMatchObject({ app: 'RepTender', schemaVersion: 2 });

    expect(await within(data).findByRole('status')).toHaveTextContent('Backup saved.');
    expect(await within(data).findByText('Last backup today')).not.toHaveClass('warn');
    expect((await getSettings()).lastBackupAt).toBeDefined();
  });

  it('keeps the file ready when the share sheet is cancelled', async () => {
    const { share } = mockShare();
    share.mockRejectedValueOnce(new DOMException('Share canceled', 'AbortError'));
    renderSettings();
    const data = await card();
    await userEvent.click(within(data).getByRole('button', { name: 'Export backup' }));
    await userEvent.click(await within(data).findByRole('button', { name: /^Save backup file/ }));
    expect(await within(data).findByRole('button', { name: /^Save backup file/ })).toBeEnabled();
    expect((await getSettings()).lastBackupAt).toBeUndefined();
  });

  it('downloads when the file cannot be shared', async () => {
    mockShare(false);
    const urls = stubObjectUrls();
    renderSettings();
    const data = await card();
    await userEvent.click(within(data).getByRole('button', { name: 'Export backup' }));
    await userEvent.click(await within(data).findByRole('button', { name: /^Save backup file/ }));
    expect(await within(data).findByRole('status')).toHaveTextContent(/^Downloaded reptender-backup-\d{4}-\d{2}-\d{2}\.json\.$/);
    expect(urls.click).toHaveBeenCalledTimes(1);
  });

  it('shows the last backup in amber after 30 days', async () => {
    await updateSettings({ lastBackupAt: subDays(new Date(), 31).toISOString() });
    renderSettings();
    expect(await within(await card()).findByText('Last backup 31 days ago')).toHaveClass('warn');
  });
});

describe('Import backup', () => {
  it('shows a summary, then replaces all data', async () => {
    const text = await backupText();
    await resetDb();
    await createPet({ name: 'Intruder', species: 'Gecko', feedingIntervalDays: 3 });
    renderSettings();
    await card();
    pick(text);

    const sheet = await screen.findByRole('dialog', { name: 'Import backup' });
    expect(sheet).toHaveTextContent('This backup has 1 pet, 1 entry, 0 photos, exported Nov 8, 2026.');
    expect(sheet).toHaveTextContent('Importing replaces all data on this iPhone.');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Replace all data' }));

    expect(await within(await card()).findByRole('status')).toHaveTextContent('Backup imported: 1 pet, 1 entry, 0 photos.');
    expect(screen.queryByRole('dialog', { name: 'Import backup' })).toBeNull();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Noodle']);
    expect(await db.feedings.count()).toBe(1);
  });

  it('cancel keeps the current data', async () => {
    const text = await backupText();
    await resetDb();
    await createPet({ name: 'Keeper', species: 'Gecko', feedingIntervalDays: 3 });
    renderSettings();
    await card();
    pick(text);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Import backup' })).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Import backup' })).toBeNull();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Keeper']);
  });

  it('rejects an invalid file with a clear message and changes nothing', async () => {
    await createPet({ name: 'Keeper', species: 'Gecko', feedingIntervalDays: 3 });
    renderSettings();
    await card();
    pick('{"app":"SnakeKeeper"}', 'other.json');
    expect(await screen.findByRole('alert')).toHaveTextContent("That file isn't a RepTender backup.");
    expect(screen.queryByRole('dialog', { name: 'Import backup' })).toBeNull();
    expect((await db.pets.toArray()).map((p) => p.name)).toEqual(['Keeper']);
  });
});

describe('Storage warning', () => {
  it('appears above 80% used', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: async () => ({ usage: 900, quota: 1000 }) }, configurable: true,
    });
    renderSettings();
    expect(await within(await card()).findByText('Storage is 90% full. Export a backup so nothing is lost.')).toHaveClass('warn');
  });

  it('stays hidden below that', async () => {
    let resolve!: (e: StorageEstimate) => void;
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: () => new Promise<StorageEstimate>((r) => (resolve = r)) }, configurable: true,
    });
    renderSettings();
    const data = await card();
    resolve({ usage: 100, quota: 1000 });
    await vi.waitFor(() => expect(within(data).queryByText(/^Storage is/)).toBeNull());
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/domain/backupStatus.test.ts src/lib/storage.test.ts src/features/backup`
Expected: FAIL with `Failed to resolve import "./backupStatus"` / `"./storage"`; all 9 BackupSettings tests fail (`Unable to find an element with the text: Never backed up`, `Unable to find a label with the text of: Import backup`, …).

- [ ] **Step 5: Create `src/domain/backupStatus.ts`**

```ts
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';

/** Spec §9: Settings shows the last backup in amber after this many days. */
export const BACKUP_REMINDER_DAYS = 30;

export interface BackupStatus {
  text: string;
  /** Amber: never backed up, or more than BACKUP_REMINDER_DAYS ago. */
  overdue: boolean;
}

export function backupStatus(lastBackupAt: string | undefined, now: Date): BackupStatus {
  const last = lastBackupAt ? parseISO(lastBackupAt) : undefined;
  if (!last || !isValid(last)) return { text: 'Never backed up', overdue: true };
  const days = Math.max(0, differenceInCalendarDays(now, last));
  const text = days === 0 ? 'Last backup today' : `Last backup ${days} day${days === 1 ? '' : 's'} ago`;
  return { text, overdue: days > BACKUP_REMINDER_DAYS };
}
```

- [ ] **Step 6: Create `src/lib/storage.ts`**

```ts
/** Spec §9: warn in Settings when more than this share of the storage quota is used. */
export const STORAGE_WARN_RATIO = 0.8;

export function storageWarning(estimate?: { usage?: number; quota?: number }): string | null {
  if (!estimate?.quota || estimate.usage === undefined) return null;
  const ratio = estimate.usage / estimate.quota;
  if (!(ratio > STORAGE_WARN_RATIO)) return null;
  return `Storage is ${Math.round(ratio * 100)}% full. Export a backup so nothing is lost.`;
}

/** navigator.storage.estimate(), or undefined where it's missing or fails. */
export async function readStorageEstimate(): Promise<StorageEstimate | undefined> {
  try {
    return await navigator.storage?.estimate?.();
  } catch {
    return undefined;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 7: Create `src/features/backup/useStorageWarning.ts`**

```ts
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
```

- [ ] **Step 8: Create `src/features/backup/ExportBackupButton.tsx`**

```tsx
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
  const busy = useRef(false); // double-tap guard (state updates land a render later)

  const prepare = async () => {
    if (busy.current) return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    setNote(undefined);
    try {
      setFile(await createBackupFile());
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
    try {
      const result = await deliverFile(ready); // first thing in the tap
      if (result !== 'cancelled') {
        await markBackedUp();
        setFile(null);
        setNote(result === 'shared' ? 'Backup saved.' : `Downloaded ${ready.name}.`);
      }
    } catch {
      setError("Couldn't save the backup. Please try again.");
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
      {note && <p role="status" className="muted setting-note">{note}</p>}
    </div>
  );
}
```

- [ ] **Step 9: Create `src/features/backup/ImportBackup.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { parseBackup, restoreBackup, summarizeBackup, summaryText, type ParsedBackup } from '../../db/backup';
import { BackupError } from '../../db/backupSchema';
import { Sheet } from '../../ui/Sheet';

interface Pending {
  backup: ParsedBackup;
  summary: string;
}

/** Spec §9 import: validate, show a summary, then replace all data in one transaction. */
export function ImportBackup() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires onChange
    if (!file) return;
    setError(undefined);
    setNote(undefined);
    try {
      const backup = parseBackup(await file.text());
      setPending({ backup, summary: summaryText(summarizeBackup(backup)) });
    } catch (err) {
      setError(err instanceof BackupError ? err.message : "Couldn't read that file.");
    }
  };

  const restore = async () => {
    if (!pending || restoring) return;
    setRestoring(true);
    try {
      await restoreBackup(pending.backup);
      setNote(`Backup imported: ${pending.summary}.`);
    } catch {
      setError('Import failed. Your data was not changed.');
    } finally {
      setPending(null);
      setRestoring(false);
    }
  };

  const cancel = () => {
    if (!restoring) setPending(null);
  };

  return (
    <div>
      {error && <div role="alert" className="form-error">{error}</div>}
      <label className="btn-ghost" style={{ textAlign: 'center' }}>
        Import backup
        <input type="file" accept="application/json,.json" hidden onChange={onFile} />
      </label>
      {note && <p role="status" className="muted setting-note">{note}</p>}

      <Sheet open={pending !== null} onClose={cancel} title="Import backup">
        {pending && (
          <>
            <h2 className="rounded" style={{ marginTop: 0 }}>Import backup?</h2>
            <p>{`This backup has ${pending.summary}, exported ${format(parseISO(pending.backup.exportedAt), 'MMM d, yyyy')}.`}</p>
            <p className="warn">Importing replaces all data on this iPhone. Export a backup first if you might need what's here now.</p>
            <div className="data-actions">
              <button type="button" className="btn-primary" disabled={restoring} onClick={restore}>Replace all data</button>
              <button type="button" className="btn-ghost" disabled={restoring} onClick={cancel}>Cancel</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 10: Replace the whole of `src/features/settings/SettingsScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';
import { saveErrorText } from '../../db/ids';
import type { ThemePref } from '../../domain/types';
import { backupStatus } from '../../domain/backupStatus';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { useNow } from '../../ui/useNow';
import { loadSampleData } from '../../dev/sampleData';
import { ExportBackupButton } from '../backup/ExportBackupButton';
import { ImportBackup } from '../backup/ImportBackup';
import { useStorageWarning } from '../backup/useStorageWarning';
import { RemindersButton } from '../reminders/RemindersButton';
import { useScheduleSources } from '../schedule/scheduleSources';
import { UnitsCard } from './UnitsCard';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
] as const;

export default function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  const petCount = useLiveQuery(async () => (await listActivePets()).length, []);
  const sources = useScheduleSources();
  const storageWarning = useStorageWarning();
  const now = useNow();
  const [loading, setLoading] = useState(false);
  const [themeError, setThemeError] = useState<string>();
  if (!settings) return null;
  const backup = backupStatus(settings.lastBackupAt, now);

  return (
    <>
      <h1>Settings</h1>
      <Card style={{ marginTop: 12 }}>
        <div className="row">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={48} height={48} style={{ borderRadius: 12 }} />
          <div className="grow">
            <b style={{ fontSize: 17 }}>RepTender</b>
            <div className="muted">{`${petCount ?? 0} pets · version ${__APP_VERSION__}`}</div>
          </div>
        </div>
      </Card>

      <div className="label">Appearance</div>
      <Card>
        {themeError && <div role="alert" className="form-error">{themeError}</div>}
        <Segmented<ThemePref>
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) => {
            setThemeError(undefined);
            updateSettings({ theme }).catch((err: unknown) => setThemeError(saveErrorText(err)));
          }}
        />
        <p className="muted setting-note">Auto follows your iPhone's light/dark setting.</p>
      </Card>

      <UnitsCard settings={settings} />

      <div className="label">Reminders &amp; data</div>
      <Card role="group" aria-label="Reminders & data">
        {storageWarning && <p className="warn" style={{ marginTop: 0 }}>{storageWarning}</p>}
        <div className="data-actions">
          <RemindersButton sources={sources} label="📅 Add reminders to Calendar" />
          <ExportBackupButton />
          <p className={`setting-note ${backup.overdue ? 'warn' : 'muted'}`} style={{ marginTop: -4 }}>{backup.text}</p>
          <ImportBackup />
        </div>
      </Card>

      {import.meta.env.DEV && (
        <>
          <div className="label">Developer</div>
          <button
            type="button"
            className="btn-ghost"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await loadSampleData();
              } finally {
                setLoading(false);
              }
            }}
          >
            Load sample pets
          </button>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 11: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add backup export, import with summary, last-backup reminder and storage warning to Settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Top-level error boundary with Reload and Export backup

Spec §11: "a top-level React error boundary shows a friendly screen with **Reload** and **Export backup** buttons, so data can always be saved." The boundary wraps `<App />` in `src/main.tsx`. Its screen uses only the database and the file delivery helper (no router, no live queries of the crashed tree), so the two-tap export from Task 9 works even when every screen is broken. `UpdatePrompt` stays **outside** the boundary: if a deployed fix is waiting, the "Update available" button still shows on top of the crash screen. The Plan 1 ledger's "persist() no catch" is fixed in the same edit of `main.tsx`.

**Files:**
- Create: `src/app/ErrorBoundary.tsx`
- Modify: `src/main.tsx` (wraps App, `persist()` catch), `src/ui/toast.css` (crash screen styles)
- Test: `src/app/ErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `ExportBackupButton` (Task 9), `mockShare`, `unmockShare` (Task 4), `createPet`, `resetDb`
- Produces:
  - `ErrorBoundary` (default export, class component): props `{ children: ReactNode; onReload?: () => void }` (`onReload` defaults to `reloadHome()`; tests pass a spy)
  - `reloadHome(): void`: sets the hash to `#/` and reloads, so a screen that crashes on every load (or `#/crash-test`, Task 11) doesn't simply crash again
  - `CrashScreen({ error, onReload }: { error: Error; onReload: () => void })` (named export): `h1` "Something went wrong", buttons `Reload` and `Export backup`, the error message under a "Details" disclosure

- [ ] **Step 1: Write the failing tests in `src/app/ErrorBoundary.test.tsx`**

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';
import { resetDb } from '../db/db';
import { createPet } from '../db/pets';
import { getSettings } from '../db/settings';
import { mockShare, unmockShare } from '../test/share';

function Boom(): never {
  throw new Error('kaboom');
}

beforeEach(async () => {
  await resetDb();
  await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the caught error
});

afterEach(() => {
  unmockShare();
  vi.restoreAllMocks();
});

it('renders the app when nothing fails', () => {
  render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
  expect(screen.getByText('All good')).toBeInTheDocument();
});

it('shows a friendly screen with Reload instead of a white screen', async () => {
  const reload = vi.fn();
  render(<ErrorBoundary onReload={reload}><Boom /></ErrorBoundary>);
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Your pets and records are still saved on this iPhone.')).toBeInTheDocument();
  expect(screen.getByText('kaboom')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('can still export a backup after the UI crashed', async () => {
  const { share, file } = mockShare();
  render(<ErrorBoundary onReload={vi.fn()}><Boom /></ErrorBoundary>);
  await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  await userEvent.click(await screen.findByRole('button', { name: /^Save backup file/ }));
  await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const backup = JSON.parse(await file().text());
  expect(backup.tables.pets.map((p: { name: string }) => p.name)).toEqual(['Noodle']);
  expect(await screen.findByRole('status')).toHaveTextContent('Backup saved.');
  expect((await getSettings()).lastBackupAt).toBeDefined();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/app/ErrorBoundary.test.tsx`
Expected: FAIL with `Failed to resolve import "./ErrorBoundary"`.

- [ ] **Step 3: Create `src/app/ErrorBoundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ExportBackupButton } from '../features/backup/ExportBackupButton';

interface Props {
  children: ReactNode;
  /** Tests only; defaults to reloadHome(). */
  onReload?: () => void;
}

interface State {
  error: Error | null;
}

/** Spec §11: an unexpected rendering error shows CrashScreen instead of a white screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('RepTender crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashScreen error={this.state.error} onReload={this.props.onReload ?? reloadHome} />;
  }
}

/** Reload on the Pets screen: reloading the screen that crashed could just crash again. */
export function reloadHome(): void {
  window.location.hash = '#/';
  window.location.reload();
}

/** Uses only the database and file delivery, so the backup works even when every screen is broken. */
export function CrashScreen({ error, onReload }: { error: Error; onReload: () => void }) {
  return (
    <div className="shell">
      <main className="screen crash">
        <div className="crash-icon" aria-hidden="true">🦎</div>
        <h1>Something went wrong</h1>
        <p>RepTender hit an unexpected problem.</p>
        <p>Your pets and records are still saved on this iPhone.</p>
        <div className="data-actions">
          <button type="button" className="btn-primary" onClick={onReload}>Reload</button>
          <p className="muted setting-note">If it keeps happening, save a backup first:</p>
          <ExportBackupButton />
        </div>
        <details className="crash-details">
          <summary>Details</summary>
          <pre>{error.message}</pre>
        </details>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: In `src/ui/toast.css`, replace**

```css
.toast-close {
  background: none;
  border: 0;
  color: inherit;
  font-size: 18px;
  min-width: 44px;
  min-height: 44px;
}
```

with:

```css
.toast-close {
  background: none;
  border: 0;
  color: inherit;
  font-size: 18px;
  min-width: 44px;
  min-height: 44px;
}

/* ---------- crash screen (Plan 3, spec §11) ---------- */
.crash {
  text-align: center;
  padding-top: calc(env(safe-area-inset-top) + 48px);
}
.crash-icon {
  font-size: 56px;
}
.crash .data-actions {
  margin-top: 20px;
  text-align: left;
}
.crash-details {
  margin-top: 24px;
  text-align: left;
  color: var(--muted);
}
.crash-details pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
}
```

- [ ] **Step 5: Replace the whole of `src/main.tsx`**

```tsx
import './theme/tokens.css';
import './theme/base.css';
import './ui/ui.css';
import './ui/husbandry.css';
import './ui/settings.css';
import './ui/toast.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import ErrorBoundary from './app/ErrorBoundary';
import UpdatePrompt from './app/UpdatePrompt';

// Spec §9: ask the browser not to evict our IndexedDB data. Refusal is fine; never an unhandled rejection.
void navigator.storage?.persist?.().catch(() => false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* Outside the boundary: a waiting fix can still be installed from the crash screen. */}
    <UpdatePrompt />
  </StrictMode>,
);
```

- [ ] **Step 6: Run everything, then build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; the build has no chunk-size warning and ends with `dist/sw.js`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the top-level error screen with Reload and Export backup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Crash-test route, iPhone checklist, hand-off for deploy

The error screen (Task 10) has to be seen on the phone, but nothing in a healthy build crashes. A tiny route `#/crash-test` throws on purpose so the checklist can open the real crash screen, export from it and reload. It is not linked from anywhere and touches no data. The checklist then gains the Plan 3 checks, including the known iOS risk from spec §8: a home-screen web app may not hand `.ics` files to Calendar. That must be checked on the phone in this first deployed build, with the fallbacks written down.

**Files:**
- Create: `src/app/CrashTest.tsx`
- Modify: `src/app/App.tsx` (route `crash-test`), `docs/iphone-checklist.md`
- Test: `src/app/CrashTest.test.tsx`

**Interfaces:**
- Consumes: `AppRoutes` (`src/app/App.tsx`), `ErrorBoundary` (Task 10)
- Produces: route `/crash-test` → `CrashTest` (throws `Error('Crash test: this screen breaks on purpose.')`)

- [ ] **Step 1: Write the failing tests in `src/app/CrashTest.test.tsx`**

```tsx
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { AppRoutes } from './App';
import { resetDb } from '../db/db';

beforeEach(async () => {
  await resetDb();
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the caught error
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('#/crash-test shows the crash screen (for the iPhone checklist)', async () => {
  render(
    <ErrorBoundary onReload={vi.fn()}>
      <MemoryRouter initialEntries={['/crash-test']}>
        <AppRoutes />
      </MemoryRouter>
    </ErrorBoundary>,
  );
  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Crash test: this screen breaks on purpose.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/app/CrashTest.test.tsx`
Expected: FAIL: `Unable to find role="heading" and name "Something went wrong"` (no such route yet, so nothing crashes).

- [ ] **Step 3: Create `src/app/CrashTest.tsx`**

```tsx
/** `#/crash-test`: breaks on purpose so the iPhone checklist can check the error screen (spec §11). */
export default function CrashTest(): never {
  throw new Error('Crash test: this screen breaks on purpose.');
}
```

- [ ] **Step 4: In `src/app/App.tsx`, replace**

```tsx
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
```

with:

```tsx
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
      <Route path="crash-test" element={<CrashTest />} />
```

- [ ] **Step 5: In `src/app/App.tsx`, replace**

```tsx
import AppBadge from '../features/schedule/AppBadge';
```

with:

```tsx
import AppBadge from '../features/schedule/AppBadge';
import CrashTest from './CrashTest';
```

- [ ] **Step 6: Replace the whole of `docs/iphone-checklist.md`** (adds the Plan 3 checks 17–25)

```markdown
# iPhone release checklist

Run on the iPhone 17 after each deploy. Tick every line before telling the user it's ready.

1. Safari → `https://josephsester.github.io/RepTender/` → Share → **Add to Home Screen** → name shows "RepTender" with the golden-eye icon.
2. Open it from the home screen: full screen, no Safari bars, nothing hidden behind the Dynamic Island or home bar.
3. Settings → Light / Dark / Auto each switch the theme. Auto follows iOS Settings → Display.
4. Add a pet with a photo from **Take Photo** and from **Photo Library**. Both show on the profile and Home.
5. Log a feeding (Ate it, Refused, Regurgitated). The calendar colors and the Next feeding date update.
6. Turn on Airplane Mode, close RepTender fully, reopen it: it still opens and shows all data.
7. Deploy a small change, reopen the app: "Update available — tap to refresh" appears, tapping it loads the new version, and data is unchanged.
8. Tap a text field (a pet's Name, a feeding's Notes): the page must not zoom in, and it is still at normal size after you leave the field.
9. Pet profile → **Quick log**: Fed, Regurg., Poop and Shed each open their sheet and save. The Husbandry tiles update.
10. **Weight & length**: log a weight and a length. The big number, the chart and 6M / 1Y / All all work. Values show in g and in.
11. **Habitat**: Edit enclosure & targets, then log a reading. Each gauge, its target and the 7-day warm-side line show.
12. **Vet visits**: add a visit with a photo from **Take Photo**. The photo opens full size. Tap the clinic phone number: iOS offers to call.
13. **Care tasks**: add Spot clean from the suggestions. On the **Schedule** tab, tick it: it shows ✓ and "N of M done" goes up. Tick a feeding: the Log a Feeding sheet opens.
14. **Add** tab: pick a pet, log a Note. It appears on that pet's Notes screen.
15. Archive a pet (Edit → Archive pet). On Home, **Show archived** → **Unarchive** brings it back with its history.
16. **First database upgrade (Plan 2 update):** after updating from the previous version, open each existing pet: all pets, their feedings, the calendar marks and any push-back are still there, and Sheds, Habitat and Care open without a white screen. (Screenshot each pet's profile and feeding history before updating, as a record.)
17. **Units** (Settings): switch to °C, oz and cm. Weight & length and Habitat show the converted values (42 g → 1.5 oz; 88°F → 31.1°C). Switch back to °F, g and in: the original numbers return exactly.
18. **Remind me → Calendar (known iOS risk, spec §8: check it on this first build):** log a feeding. The "Feeding saved" toast shows **📅 Remind me**. Tap it.
    - **Expected:** the share sheet opens with `reptender-reminder.ics`. Pick **Calendar** (or the calendar preview opens): one event "Feed <name> · <qty> <food>" at the next due date and feed time, with the alert **At time of event**. Tap **Add**. Check it in the Calendar app.
    - **Fallback A, if the share sheet has no Calendar option:** pick **Save to Files**. Open the Files app → the file → **Add All**. Write down "Calendar via Files" in the ledger.
    - **Fallback B, if Files can't open it either:** Safari handles `.ics` downloads reliably, but Safari has its own copy of the site data. In the home-screen app, **Export backup** (item 21). In **Safari**, open `https://josephsester.github.io/RepTender/` → Settings → **Import backup** → **Add reminders to Calendar** → Safari offers to add the events. Write down "Calendar only via Safari". The follow-up is a small change that makes `.ics` files always use the download link in the home-screen app.
19. **Add to Calendar** on a care task (Care tasks → 📅 next to a task that isn't late) and on a vet visit's **Next appointment** card. Each makes one event: the care task at its time (or 9:00 AM when it has none), the vet visit for one hour with the clinic as the location.
20. **Schedule → 📅 Add all reminders to Calendar** (and Settings → **Add reminders to Calendar**): one file with one event per upcoming feeding and care task (late ones are skipped). The line under the button says "Shared N reminders." Add them, then tap the button again and add again: note whether Calendar updates the events (same UID) or makes duplicates.
21. **App icon badge:** with at least one feeding or care task late or due today, go to the home screen: the RepTender icon shows that number. Log or tick the items: the number goes down, and at 0 the badge disappears. If no badge ever appears, note it: on iOS a web app's badge can depend on notification permission, which v1 doesn't ask for (spec §15: nice to have, not a blocker).
22. **Export backup** (Settings → Reminders & data): "Never backed up" (amber) before the first export. **Export backup** → **Save backup file (size)** → **Save to Files** → iCloud Drive or On My iPhone. The file `reptender-backup-YYYY-MM-DD.json` is in Files at about that size, and Settings now says "Last backup today" (not amber).
23. **Import round trip:** after item 22, add a throwaway Note to one pet. Settings → **Import backup** → pick the file in Files → the sheet shows "This backup has N pets, N entries, N photos, exported <date>" matching your data → **Replace all data**. The throwaway note is gone; every pet, photo (profile and vet), feeding, calendar mark and setting is back exactly as before. Pick a non-backup file (any photo or PDF): "That file isn't a RepTender backup…" and nothing changes.
24. **Error screen:** open `https://josephsester.github.io/RepTender/#/crash-test` in the home-screen app (paste it in Safari first if needed, then reopen the app at that page) or in Safari. "Something went wrong" shows with **Reload** and **Export backup**. Export backup → Save backup file works from this screen. **Reload** brings the app back on the Pets screen.
25. **Storage:** Settings shows no storage warning (it only appears above 80% full).
```

- [ ] **Step 7: Run everything, then build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass; the build has no chunk-size warning and ends listing `dist/manifest.webmanifest` and `dist/sw.js`. Run `npm test` two more times: it must pass every time (no flaky tests).

- [ ] **Step 8: Preview the whole app on localhost**

Run `npm run dev` and open `http://localhost:5173/RepTender/`. Settings → **Load sample pets**, then:
1. Settings → **Units**: °C / oz / cm. Noodle's Weight tile reads "1.5 oz · ↑ 0.1 oz" and Habitat "31.1°C · 52% RH". Switch back to °F / g / in.
2. Noodle → **🍽️ Log feeding** → Save. The toast "Feeding saved · Next feeding <date> · 6:00 PM" appears above the tab bar with **📅 Remind me**. Tap it: Chrome on Windows downloads `reptender-reminder.ics` (its share sheet doesn't take calendar files). Open the file in a text editor: one `VEVENT`, `UID:<petId>-<date>@reptender`, `TRIGGER:PT0S`, no `RRULE`.
3. **Schedule** → **📅 Add all reminders to Calendar** → `reptender-reminders.ics` downloads; the line says "Downloaded … (N reminders)".
4. Settings → **Export backup** → **Save backup file** → `reptender-backup-<today>.json` downloads; "Last backup today". Delete Ziggy (Edit → Delete pet), then **Import backup** with that file → the summary sheet → **Replace all data**: Ziggy and all its history are back.
5. Open `http://localhost:5173/RepTender/#/crash-test`: the crash screen shows; **Export backup** offers **Save backup file**; **Reload** returns to the Pets screen.
6. Settings → **Dark**: the toast, the Units card, the backup lines and the crash screen are readable.

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add the crash-test route and the Plan 3 iPhone checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Hand off for deploy (do not push)**

Report the final commit SHA and the `npm test` count. **Do not push and do not merge.** The controller merges the branch to `main` and pushes as **JosephSester** (`GH_TOKEN="$(gh auth token --user JosephSester)" git push`, Git Bash). The GitHub Actions workflow then tests, builds and deploys to `https://josephsester.github.io/RepTender/` (watch it with `GH_TOKEN="$(gh auth token --user JosephSester)" gh run watch --repo JosephSester/RepTender --exit-status`). There is no schema change in Plan 3 (still Dexie version 2), so the phone's data is untouched by the update. After the deploy, the user runs `docs/iphone-checklist.md` on the iPhone 17 (items 17–25 are new). The result of item 18 (which Calendar path works) and item 21 (badge or no badge) goes in the Plan 3 ledger.

---

## Plan 3 done when

- `npm test`, `npm run typecheck` and `npm run build` pass (no chunk-size warning). The GitHub Actions deploy is green.
- On localhost (Task 11 Step 8): Units switch every screen; the toast offers Remind me after any feeding is saved; care tasks, the next vet appointment and both "Add all reminders" buttons produce valid `.ics` files; export → import restores everything; `#/crash-test` shows the crash screen, which can export a backup.
- On the iPhone: checklist items 1–25 pass, or item 18 (Calendar hand-off) and item 21 (badge) have their outcome recorded in the Plan 3 ledger, with the fallback that worked.

**After Plan 3:** RepTender v1 is feature-complete per the spec. Possible follow-ups depend on the iPhone results: force the download link for `.ics` files in the home-screen app if the share sheet can't reach Calendar, and an "Allow badge" opt-in if iOS only shows the badge after notification permission.

## Spec coverage (self-review)

| Spec | Where |
|---|---|
| §5.3 toast with 📅 Remind me after Log a Feeding | Task 4 |
| §5.10 / §8 care tasks "same button" (Add to Calendar) | Task 5 |
| §5.11 next-appointment card with 📅 Add to Calendar | Task 5 |
| §5.13 📅 Add all reminders to Calendar | Task 6 |
| §5.15 Units (°F/°C, g/oz/lb, in/cm) | Task 2 |
| §5.15 Reminders & data: Add reminders to Calendar · Export backup (last export date) · Import backup | Tasks 6, 9 |
| §8 single events, alert at start, stable UIDs `<petId\|taskId>-<dueDate>@reptender`, no repeating events | Task 3 |
| §8 delivery: `navigator.share({ files })`, else a blob download link; iOS standalone risk checked on the device with the Safari fallback | Tasks 4, 11 |
| §8 app badge `setAppBadge(count)` of late + due-today items, skipped where unsupported | Task 7 |
| §9 export `reptender-backup-YYYY-MM-DD.json` `{ app, schemaVersion, exportedAt, tables }`, photos base64, share → download, `lastBackupAt` | Tasks 8, 9 |
| §9 import: parse, validate (shape, `app`, schema version it can migrate, references), summary, replace in one transaction, clear rejection with data untouched, no merge | Tasks 8, 9 |
| §9 "Last backup N days ago" amber after 30 days / "Never backed up" | Task 9 |
| §9 `storage.persist()` on launch (Plan 1) + `.catch` | Task 10 |
| §9 storage warning above 80% | Task 9 |
| §11 top-level error boundary with Reload and Export backup | Task 10 (+ `#/crash-test` in Task 11) |
| §12 `.ics` generation unit tests | Task 3 |
| §12 export → import round trip including photos; rejection of invalid backups | Task 8 |
| §12 component/flow: import replaces data | Task 9 |
| §12 iPhone checklist: Remind me → Calendar, badge, export to Files, import | Task 11 |
| §15 Calendar hand-off and Badging API verified on the device | Task 11 (items 18, 21) |
| Plan 2 ledger carry-overs: pet `feedingIntervalDays` cap, `statusLabel` guard for overflowed dues, 506 kB main chunk | Task 1 |
| Plan 1/2 ledger minors folded in: `updateSettings` promise dropped (Settings), `persist()` no catch, price/cost not 2-decimal | Tasks 2, 10, 1 |

## Spec ambiguities resolved in this plan

- **UID date:** the due date in the UID is the local `yyyy-MM-dd`; vet appointments use the visit id (a pet id would collide with that pet's feeding reminder on the same day).
- **Event times:** written in UTC (no `VTIMEZONE`); care tasks without a time of day are reminded at 09:00; event lengths are 15 min (feeding, care) and 60 min (vet).
- **Past occurrences:** "Add all reminders" and the per-item buttons skip events already in the past (late items), since a past alert never fires; the badge and the Today list cover those.
- **Toast:** shown after every saved feeding (ate, refused or regurgitated), with the next due date read back from the database; Remind me only when that date is in the future; it hides after 10 s.
- **Export gesture:** two taps (build the file, then save it), because iOS refuses `navigator.share` after a long `await`; `lastBackupAt` is recorded only when the file was shared or downloaded.
- **Backup format:** photos as `data:<type>;base64,…` strings; the export prunes orphan rows and dangling optional links so its own import never fails; validation checks types and formats, not UI caps (old data above a later cap still restores); `null` optional fields mean "not set".
- **Schema 1 backups:** accepted and migrated like the Dexie v1 → v2 upgrade (empty husbandry tables, `habitatTargets: {}`).
- **Restored settings:** taken from the backup, with `lastBackupAt` set to the backup's `exportedAt`.
- **Summary "entries":** feedings, regurgitations, sheds, poops, measurements, habitat readings, care completions, vet visits and notes (not pets, photos, food items, care tasks or settings).
- **Amber:** "Never backed up" is amber too; amber starts at 31 days.
- **Badge count:** exactly the Schedule tab's open items (late or due today, not done, archived pets excluded); no notification-permission prompt in v1.
- **Error screen:** Reload returns to the Pets screen; `UpdatePrompt` stays outside the boundary.
- **Code splitting:** vendor chunks via Rolldown `codeSplitting` groups instead of `React.lazy` routes (same result for the 500 kB warning, no Suspense in tests).
