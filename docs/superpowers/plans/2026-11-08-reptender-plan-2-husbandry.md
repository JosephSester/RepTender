# RepTender Plan 2: Husbandry: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add husbandry tracking to RepTender (sheds, poop, the regurgitation sheet, weight & length with a chart, habitat readings against targets, care tasks, vet visits with photos, notes), the Quick log row and Husbandry tiles on the pet profile, the Schedule and Add tabs, and "Show archived" on Home, on top of the live Plan 1 app.

**Architecture:** Same layering as Plan 1. New pure rules go in `src/domain/` (shed prediction, care due dates, units, poop "days after meal", growth, habitat ranges, the schedule) with full unit tests. A Dexie `version(2)` schema adds eight tables with an upgrade that keeps every v1 record. Each table gets a small repository in `src/db/`. Each husbandry area is a folder in `src/features/` with a screen at `/pets/:id/<area>` and a log sheet that the screen, the profile's Quick log row and the Add tab all reuse.

**Tech Stack:** Vite 8, React 19, TypeScript 5.9, React Router 7 (HashRouter), Dexie 4 + dexie-react-hooks, date-fns 4, vite-plugin-pwa 2, Vitest 5 + jsdom + Testing Library + fake-indexeddb. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-11-08-reptender-design.md`. Read §5.1, §5.2, §5.5–§5.14, §6.2, §7 (rules 8–11), §11 and §12 before starting. Also read `docs/superpowers/plans/2026-11-08-reptender-plan-1-ledger.md` (the review rulings this plan folds in) and look at the approved mockup `docs/design/husbandry-and-icons.html`.

**Not in this plan (Plan 3):** `.ics` / Calendar export (the "📅 Remind me", "Add to Calendar" and "Add all reminders" buttons), the app badge, backup export/import, the Settings Units picker, the error boundary and the storage warning. Plan 2 already reads the units from Settings, so the Plan 3 picker only has to write them.

## Global Constraints

- Developer machine: Windows 11, Node v24.13.0, npm 11.6.2. Commands below are shell-agnostic `npm`/`npx`/`git` calls.
- Package versions are the ones Plan 1 installed (`react@19.3.1 react-dom@19.3.1 react-router-dom@7.18.5 dexie@4.4.7 dexie-react-hooks@4.4.0 date-fns@4.4.0`, `vitest@5.1.0 jsdom@31.0.0 @testing-library/react@16.3.3 @testing-library/user-event@14.6.8 fake-indexeddb@6.2.8 typescript@5.9.3`). **Do not install or upgrade anything.**
- Vite `base` and the PWA `scope`/`start_url` stay `/RepTender/`. The site is served at `https://josephsester.github.io/RepTender/`.
- Routing: `HashRouter` only (GitHub Pages has no server rewrites).
- Canonical units in the DB: grams, millimetres, °C. All IDs come from `crypto.randomUUID()`. Timestamps are ISO strings (`new Date().toISOString()`). Date-only fields use `yyyy-MM-dd`.
- Units (spec §7 rule 10): the screens show and accept values in `Settings.tempUnit` / `weightUnit` / `lengthUnit` (defaults °F, g, in) and convert to canonical units before saving. Display rounding: g, °F and % to whole numbers; in, cm, oz and °C to 1 decimal; lb to 2 decimals. A trailing `.0` is dropped (`18 in`, not `18.0 in`).
- All date comparisons use **calendar days in the phone's local time zone** (date-fns `differenceInCalendarDays`, `isSameDay`, `startOfDay`).
- Default feed time is `18:00`. Default regurgitation push-back is **10** days.
- Care task starter suggestions (spec §5.10), exactly: Spot clean every 1 day, Fresh water every 2 days, Mist every 2 days, Deep clean every 30 days, Replace UVB bulb every 180 days.
- App name everywhere is **RepTender**. Tab bar order: **Pets, Schedule, Add, Settings**.
- Colors (spec §4), with one Plan 2 change:
  - light: bg `#F6F1E7`, card `#FFFFFF`, text `#2E2A24`, muted `#8B7E68`, moss `#4E7A3A`, amber `#E9A04B`, late text **`#AB3528`** on `#F8D9D4` (the spec's `#B23A2B` measured 4.49:1 on the refused-day pink; Task 1 nudges it to 4.85:1)
  - dark: bg `#171511`, card `#24211B`, text `#F1EADC`, muted `#A99C84`, moss `#6E9E55`, amber `#E9A04B`, late text `#F09A8A` on `#3B201D`
- Forms must never crash on a cleared or half-typed date or time. Build dates only through `combineDateTime` / `isDateKey` (Task 2). When they return `null`/`false`, disable Save. Never call `format()` or `toISOString()` on an unchecked input date.
- Text inputs stay at 16px (set in `src/theme/base.css`) so iOS never zooms. Do not set a smaller `font-size` on any `input`, `select` or `textarea`.
- Layering: `src/domain/` imports only `date-fns` and other `src/domain/` files. `src/ui/` never imports `src/db/` (except the existing `usePhotoUrl`). Features may import all of them.
- Every failed save shows an inline `role="alert"` message and keeps the sheet open with its values (spec §11). Deletes ask `window.confirm` first.
- Tests pass a fixed `now` to screens and sheets. A test file that spies on `window.confirm` (or stubs anything else) restores it in `afterEach(() => vi.restoreAllMocks())`.
- Commits: small and frequent, conventional style (`feat:`, `fix:`, `test:`, `chore:`). Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `npm test` and `npm run typecheck` before every commit. Both must pass.
- **Do not push.** Implementers commit on their branch only. The controller merges to `main` and pushes as the **JosephSester** account (`GH_TOKEN="$(gh auth token --user JosephSester)" git push`, Git Bash), which deploys to GitHub Pages.

## File Structure (new and changed in Plan 2)

```
src/
  main.tsx                         + imports ui/husbandry.css
  app/App.tsx                      + routes for every husbandry screen, /schedule, /add
  app/TabBar.tsx                   Pets · Schedule · Add · Settings
  domain/types.ts                  + Poop, Shed, Measurement, HabitatReading, CareTask, CareCompletion,
                                     VetVisit, Note, unit types, Pet.inBlueSince
  domain/dates.ts                  + isDateKey, isTimeOfDay, combineDateTime, formatTimeOfDay
  domain/units.ts                  conversions + display rounding (rule 10)
  domain/poop.ts                   daysAfterMeal, typicalGap (rule 11)
  domain/sheds.ts                  predictNextShed (rule 8), shedEtaLabel
  domain/growth.ts                 latest weight/length, 30-day change, chart ranges
  domain/habitat.ts                latest values, target ranges, gauge geometry, week summary
  domain/care.ts                   careNextDue (rule 9), suggestions, completedOn
  domain/schedule.ts               todayItems, comingUp (Schedule tab)
  db/db.ts                         Dexie version(2) + upgrade, SCHEMA_VERSION
  db/ids.ts                        + cleanText, requireDateKey, requireDateTime, saveErrorText
  db/pets.ts                       + listArchivedPets, unarchivePet; deletePet cascades to every table
  db/poops.ts, db/sheds.ts, db/measurements.ts, db/habitat.ts, db/care.ts, db/vetVisits.ts, db/notes.ts
  lib/numbers.ts                   parseOptionalNumber for number fields
  theme/tokens.css                 light late text #AB3528
  ui/Field.tsx                     Field, DateTimeFields
  ui/SheetHeader.tsx               avatar + title row for sheets
  ui/LineChart.tsx                 SVG line chart (weight chart, habitat sparkline)
  ui/PhotoThumb.tsx                PhotoThumb, FullPhoto
  ui/husbandry.css                 styles for everything above
  features/settings/useUnits.ts    the user's units from Settings
  features/pets/PetsHome.tsx       banner contrast fix, Show archived + Unarchive
  features/pets/PetForm.tsx        repeated errors re-focus the alert
  features/pets/petFormModel.ts    keeps sire/dam petId links through an edit
  features/pets/format.ts          + plural, formatDaysAgo
  features/pets/subScreen.tsx      useRoutePet, PetNotFound, SubScreenHeader, confirmDelete
  features/pets/usePetHusbandry.ts all husbandry records for one pet (live)
  features/pets/husbandrySummary.ts tile summary lines
  features/pets/PetProfile.tsx     Quick log row, Husbandry tiles, real Length/Weight
  features/regurgitation/RegurgitationSheet.tsx
  features/poop/LogPoopSheet.tsx, PoopScreen.tsx
  features/sheds/LogShedSheet.tsx, ShedsScreen.tsx
  features/weight/LogMeasurementSheet.tsx, WeightScreen.tsx
  features/habitat/LogHabitatSheet.tsx, HabitatSetupSheet.tsx, HabitatScreen.tsx
  features/care/CareTaskSheet.tsx, CareTasksScreen.tsx
  features/vet/vetModel.ts, VetVisitSheet.tsx, VetScreen.tsx
  features/notes/NoteSheet.tsx, NotesScreen.tsx
  features/schedule/ScheduleScreen.tsx
  features/add/AddScreen.tsx
  dev/sampleData.ts                + husbandry history for the sample pets
docs/iphone-checklist.md           + no-zoom check, husbandry checks
```
Tests sit next to their source as `*.test.ts(x)`.

**Routes added:** `/pets/:id/sheds`, `/pets/:id/poop`, `/pets/:id/weight`, `/pets/:id/habitat`, `/pets/:id/care`, `/pets/:id/vet`, `/pets/:id/notes`, `/schedule`, `/add`.

**Sheet titles** (each `Sheet`'s `title`, which is also its accessible name): `Log regurgitation`, `Log poop`, `Log shed`, `Log weight & length`, `Log habitat reading`, `Habitat setup`, `New care task` / `Edit care task`, `New vet visit` / `Edit vet visit`, `New note` / `Edit note`. The Plan 1 feeding sheet stays `Feed <name>`.

**Every log sheet has the same props:** `{ pet: Pet; open: boolean; onClose: () => void; now?: Date }` (edit sheets add an optional record to edit). Like `LogFeedingSheet`, each one renders `null` while closed and remounts its form on open, so it always starts from fresh defaults.

---

### Task 1: Plan 1 carry-overs and archived pets on Home

The Plan 1 final review left these for Plan 2 (see the ledger): the banner subline's `opacity: 0.9` drops it under 4.5:1; a repeated identical PetForm error doesn't re-focus the alert; a test leaves its `scrollIntoView` stub behind; light-mode refused days measure 4.49:1; the iPhone checklist lacks the no-zoom check; editing a pet drops a sire/dam `petId` link; and an archived pet has no way back. One Plan 1 test (`switches appearance`) also races its live query and fails now and then once the suite grows. Spec §5.1 also asks for archived pets behind a "Show archived" link.

**Files:**
- Modify: `src/db/pets.ts` (add `listArchivedPets`, `unarchivePet`)
- Modify: `src/theme/tokens.css` (light `--late-text`)
- Modify: `src/features/pets/PetsHome.tsx` (banner subline, Show archived)
- Modify: `src/features/pets/PetForm.tsx` (clear and re-raise errors)
- Modify: `src/features/pets/petFormModel.ts` (keep parent `petId`)
- Modify: `docs/iphone-checklist.md`
- Test: `src/db/archive.test.ts`, `src/theme/contrast.test.ts`, `src/features/settings/SettingsScreen.test.tsx` (de-flake), `src/features/pets/PetsHome.test.tsx`, `src/features/pets/PetForm.test.tsx`, `src/features/pets/petFormModel.test.ts`

**Interfaces:**
- Consumes: `createPet`, `archivePet`, `getPet`, `listActivePets` (`src/db/pets.ts`), `usePetSummaries`, `LogFeedingSheet`, `PetAvatar`, `Card`, `Pill` (Plan 1)
- Produces:
  - `listArchivedPets(): Promise<Pet[]>` (archived pets, A–Z)
  - `unarchivePet(id: string): Promise<void>` (removes `archivedAt`; throws if the pet is missing)
  - `FormState` gains `sirePetId?: string` and `damPetId?: string`; `toInput` keeps them in `sire.petId` / `dam.petId`
  - Light `--late-text` is `#ab3528`

- [ ] **Step 1: Write the failing tests in `src/db/archive.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { archivePet, createPet, getPet, listActivePets, listArchivedPets, unarchivePet } from './pets';

beforeEach(async () => {
  await resetDb();
});

it('lists archived pets A–Z and unarchives one', async () => {
  const pebble = await createPet({ name: 'Pebble', species: 'Russian Tortoise', feedingIntervalDays: 2 });
  const basil = await createPet({ name: 'Basil', species: 'Bearded Dragon', feedingIntervalDays: 2 });
  await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  await archivePet(pebble.id);
  await archivePet(basil.id);
  expect((await listArchivedPets()).map((p) => p.name)).toEqual(['Basil', 'Pebble']);

  await unarchivePet(pebble.id);
  expect((await getPet(pebble.id))!.archivedAt).toBeUndefined();
  expect((await listArchivedPets()).map((p) => p.name)).toEqual(['Basil']);
  expect((await listActivePets()).map((p) => p.name)).toEqual(['Noodle', 'Pebble']);
});

it('unarchiving a missing pet fails', async () => {
  await expect(unarchivePet('missing')).rejects.toThrow('not found');
});
```

- [ ] **Step 2: Write the failing tests in `src/theme/contrast.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// npm test runs from the project root.
const css = readFileSync('src/theme/tokens.css', 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const stops = (gradient: string) => gradient.match(/#[0-9a-f]{6}/gi) ?? [];

describe.each([
  ['light', tokens(':root,')],
  ['dark', tokens(":root[data-theme='dark']")],
])('%s theme text contrast (WCAG AA, 4.5:1)', (_name, t) => {
  it('refused calendar days', () => {
    expect(contrast(t['late-text']!, t['late-bg']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('regurgitated calendar days', () => {
    expect(contrast(t['on-late-fill']!, t['late-text']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('next-due calendar days', () => {
    expect(contrast(t['on-amber']!, t['amber']!)).toBeGreaterThanOrEqual(4.5);
  });
  it('hungry banner text on every gradient stop', () => {
    const colors = stops(t['banner']!);
    expect(colors.length).toBeGreaterThan(1);
    for (const c of colors) expect(contrast(t['on-banner']!, c)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 3: Replace the whole of `src/features/pets/PetsHome.test.tsx`** (adds the banner and archive tests)

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PetsHome from './PetsHome';
import { resetDb } from '../../db/db';
import { archivePet, createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';

const now = new Date(2026, 10, 8, 9, 0);
const at = (d: number) => new Date(2026, 10, d, 18, 0).toISOString();

async function addPet(name: string, species: string, interval: number, fedOn: number, food = 'Pinky mouse') {
  const p = await createPet({ name, species, feedingIntervalDays: interval, usualFoodItem: food });
  await logFeeding({ petId: p.id, at: at(fedOn), foodItem: food, quantity: 1, outcome: 'ate' });
  return p;
}

const renderHome = () => render(<MemoryRouter><PetsHome now={now} /></MemoryRouter>);

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PetsHome', () => {
  it('shows an empty state with a link to add a pet', async () => {
    renderHome();
    expect(await screen.findByRole('link', { name: 'Add your first reptile' })).toHaveAttribute('href', '/pets/new');
  });

  it('lists pets by urgency with status pills and a hungry banner', async () => {
    const noodle = await addPet('Noodle', 'Corn Snake', 5, 3);
    await addPet('Ziggy', 'Leopard Gecko', 3, 7, 'Crickets');
    await addPet('Basil', 'Bearded Dragon', 2, 5, 'Dubia roaches');
    renderHome();

    expect(await screen.findByText('Basil is hungry')).toBeInTheDocument();
    expect(screen.getByText('3 pets · 1 due today · 1 late')).toBeInTheDocument();

    const cards = screen.getAllByRole('link', { name: /Noodle|Ziggy|Basil/ });
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Basil', 'Noodle', 'Ziggy']);
    expect(within(cards[0]!).getByText('1 day late')).toHaveClass('pill-late');
    expect(within(cards[1]!).getByText('Today')).toHaveClass('pill-due');
    expect(within(cards[2]!).getByText('In 2 days')).toHaveClass('pill-ok');
    expect(cards[1]).toHaveAttribute('href', `/pets/${noodle.id}`);
  });

  it('draws the banner subline at full strength (no opacity)', async () => {
    await addPet('Noodle', 'Corn Snake', 5, 3);
    renderHome();
    const line = await screen.findByText('Due today · 1 Pinky mouse');
    expect(line.style.opacity).toBe('');
  });

  it('logs a feeding from the hungry banner', async () => {
    await addPet('Noodle', 'Corn Snake', 5, 3);
    renderHome();
    await userEvent.click(await screen.findByRole('button', { name: 'Log' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Feed Noodle' })).getByRole('button', { name: 'Save feeding' }));
    expect(await screen.findByText('In 5 days')).toBeInTheDocument();
  });

  it('hides archived pets behind "Show archived" and can unarchive them', async () => {
    await addPet('Noodle', 'Corn Snake', 5, 3);
    const pebble = await addPet('Pebble', 'Russian Tortoise', 2, 7, 'Greens');
    await archivePet(pebble.id);
    renderHome();

    expect(await screen.findByText('1 pet · 1 due today')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pebble/ })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Show archived (1)' }));
    const card = screen.getByRole('group', { name: 'Pebble (archived)' });
    expect(within(card).getByText(/^Archived /)).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Unarchive' }));
    expect(await screen.findByRole('link', { name: /Pebble/ })).toHaveAttribute('href', `/pets/${pebble.id}`);
    // The archived list is its own live query, so it can update a moment after the pet list.
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /Show archived|Hide archived/ })).toBeNull());
  });
});
```

- [ ] **Step 4: Replace the whole of `src/features/pets/PetForm.test.tsx`** (restores the `scrollIntoView` stub in `finally`, restores spies after each test, adds the repeated-error test)

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import PetForm from './PetForm';
import { db, resetDb } from '../../db/db';
import { createPet, getPet, listActivePets } from '../../db/pets';

function ProfileStub() {
  const { id } = useParams();
  return <div>profile {id}</div>;
}

function renderForm(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/pets/new" element={<PetForm />} />
        <Route path="/pets/:id" element={<ProfileStub />} />
        <Route path="/pets/:id/edit" element={<PetForm />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PetForm', () => {
  it('adds a pet and opens its profile', async () => {
    renderForm('/pets/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Name'), 'Noodle');
    await user.type(screen.getByLabelText('Species'), 'Corn Snake');
    await user.type(screen.getByLabelText('Morph / breed'), 'Amel');
    await user.selectOptions(screen.getByLabelText('Sex'), 'female');
    await user.clear(screen.getByLabelText('Feed every (days)'));
    await user.type(screen.getByLabelText('Feed every (days)'), '5');
    await screen.findByRole('option', { name: 'Pinky mouse' }); // food list loads from the DB
    await user.selectOptions(screen.getByLabelText('Usual food'), 'Pinky mouse');
    await user.type(screen.getByLabelText('Sire name'), 'Apollo');
    await user.type(screen.getByLabelText('Bought from'), 'Scales & Tails Reptiles');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const text = (await screen.findByText(/^profile /)).textContent!;
    const pet = (await getPet(text.replace('profile ', '')))!;
    expect(pet).toMatchObject({
      name: 'Noodle', species: 'Corn Snake', morph: 'Amel', sex: 'female', feedingIntervalDays: 5,
      usualFoodItem: 'Pinky mouse', usualQuantity: 1, usualFeedTime: '18:00',
      sire: { name: 'Apollo' }, acquiredFrom: 'Scales & Tails Reptiles',
    });
    expect(pet.dam).toBeUndefined();
  });

  it('shows validation errors and saves nothing', async () => {
    renderForm('/pets/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Species'), 'Corn Snake');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required');
    expect(await db.pets.count()).toBe(0);
  });

  it('edits a pet and clears emptied fields', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', morph: 'Amel', feedingIntervalDays: 5 });
    renderForm(`/pets/${p.id}/edit`);
    const user = userEvent.setup();
    const morph = await screen.findByLabelText('Morph / breed');
    await screen.findByDisplayValue('Noodle');
    await user.clear(morph);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(`profile ${p.id}`);
    expect((await getPet(p.id))!.morph).toBeUndefined();
  });

  it('keeps a sire link to another pet when the pet is edited', async () => {
    const apollo = await createPet({ name: 'Apollo', species: 'Corn Snake', feedingIntervalDays: 7 });
    const p = await createPet({
      name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, sire: { name: 'Apollo', petId: apollo.id },
    });
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(`profile ${p.id}`);
    expect((await getPet(p.id))!.sire).toMatchObject({ name: 'Apollo', petId: apollo.id });
  });

  it('deletes a pet after confirmation', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Delete pet' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(await getPet(p.id)).toBeUndefined();
  });

  it('archives a pet only after confirmation', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Archive pet' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Archive Noodle\?.*hidden from My Reptiles/));
    expect((await listActivePets()).map((x) => x.id)).toEqual([p.id]);
    expect(screen.queryByText('home')).not.toBeInTheDocument();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Archive pet' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(await listActivePets()).toEqual([]);
    expect(await getPet(p.id)).toBeDefined();
  });

  it('moves focus to the error alert when Save fails', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    try {
      renderForm('/pets/new');
      await userEvent.click(await screen.findByRole('button', { name: 'Save pet' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveFocus();
      expect(scroll).toHaveBeenCalled();
    } finally {
      // @ts-expect-error jsdom has no scrollIntoView: remove the stub so later tests see the real jsdom
      delete Element.prototype.scrollIntoView;
    }
  });

  it('re-focuses the alert when the same error happens twice', async () => {
    renderForm('/pets/new');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Name'), 'Noodle');
    await user.type(screen.getByLabelText('Species'), 'Corn Snake');
    fireEvent.change(screen.getByLabelText('Price paid ($)'), { target: { value: '-5' } });
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(await screen.findByRole('alert')).toHaveFocus();

    await user.click(screen.getByLabelText('Name'));
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent('Price must be a number');
  });
});
```

- [ ] **Step 5: Write the failing tests in `src/features/pets/petFormModel.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Pet } from '../../domain/types';
import { EMPTY_FORM, toForm, toInput } from './petFormModel';

const pet: Pet = {
  id: 'p1', name: 'Noodle', species: 'Corn Snake', sex: 'female', origin: 'captive_bred', birthDateApprox: false,
  feedingIntervalDays: 5, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {},
  sire: { name: 'Apollo', petId: 'p-apollo' }, dam: { petId: 'p-juniper' },
  createdAt: '', updatedAt: '',
};

describe('petFormModel', () => {
  it('keeps sire and dam links to other pets through an edit', () => {
    const input = toInput(toForm(pet));
    expect(input.sire).toEqual({ name: 'Apollo', morph: undefined, petId: 'p-apollo' });
    expect(input.dam).toEqual({ name: undefined, morph: undefined, petId: 'p-juniper' });
  });

  it('drops a parent with no name, morph or link', () => {
    const input = toInput({ ...EMPTY_FORM, name: 'Ziggy', species: 'Leopard Gecko' });
    expect(input.sire).toBeUndefined();
    expect(input.dam).toBeUndefined();
  });
});
```

- [ ] **Step 6: Replace the whole of `src/features/settings/SettingsScreen.test.tsx`** (a Plan 1 race: after the click, `findByRole('radio', { name: 'Dark' })` returns the existing button before the live query re-renders it, so the test fails now and then when the suite runs under load. Wait for the attribute instead.)

```tsx
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { resetDb } from '../../db/db';
import { getSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';

beforeEach(async () => {
  await resetDb();
});

const renderSettings = () => render(<MemoryRouter><SettingsScreen /></MemoryRouter>);

it('switches appearance', async () => {
  renderSettings();
  const auto = await screen.findByRole('radio', { name: 'Auto' });
  expect(auto).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  await vi.waitFor(async () => expect((await getSettings()).theme).toBe('dark'));
  await vi.waitFor(() => expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true'));
});

it('loads sample pets in development builds', async () => {
  renderSettings();
  await userEvent.click(await screen.findByRole('button', { name: 'Load sample pets' }));
  await vi.waitFor(async () => expect(await listActivePets()).toHaveLength(4));
});
```

- [ ] **Step 7: Run the new tests and confirm they fail**

Run: `npm test -- src/db/archive.test.ts src/theme/contrast.test.ts src/features/pets`
Expected: FAIL. `listArchivedPets is not a function` / `unarchivePet is not a function`; `light theme ... refused calendar days` fails (`expected 4.49… to be greater than or equal to 4.5`); the banner opacity test gets `'0.9'`; "Show archived (1)" is not found; the sire-link and petFormModel tests lose `petId`; the repeated-error test times out waiting for focus.

- [ ] **Step 8: Replace the whole of `src/db/pets.ts`**

```ts
import type { Pet } from '../domain/types';
import { DEFAULT_FEED_TIME } from '../domain/dates';
import { db } from './db';
import { newId, nowIso, ValidationError } from './ids';

type Required3 = 'name' | 'species' | 'feedingIntervalDays';
export type PetInput = Pick<Pet, Required3> &
  Partial<Omit<Pet, 'id' | 'createdAt' | 'updatedAt' | Required3>>;

function validate(p: Partial<PetInput>): void {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError('Name is required');
  if (p.species !== undefined && !p.species.trim()) throw new ValidationError('Species is required');
  if (p.feedingIntervalDays !== undefined && !(Number.isInteger(p.feedingIntervalDays) && p.feedingIntervalDays >= 1)) {
    throw new ValidationError('Feed every must be at least 1 day');
  }
  if (p.usualQuantity !== undefined && !(Number.isInteger(p.usualQuantity) && p.usualQuantity >= 1)) {
    throw new ValidationError('Usual quantity must be at least 1');
  }
}

export async function createPet(input: PetInput): Promise<Pet> {
  validate(input);
  const ts = nowIso();
  const pet: Pet = {
    sex: 'unknown',
    origin: 'unknown',
    birthDateApprox: false,
    usualQuantity: 1,
    usualFeedTime: DEFAULT_FEED_TIME,
    habitatTargets: {},
    ...input,
    name: input.name.trim(),
    species: input.species.trim(),
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.pets.add(pet);
  return pet;
}

/** Fields set to `undefined` in `patch` are removed from the record. */
export async function updatePet(id: string, patch: Partial<PetInput>): Promise<void> {
  validate(patch);
  const changed = await db.pets.update(id, { ...patch, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${id} not found`);
}

export const getPet = (id: string) => db.pets.get(id);

const byName = (a: Pet, b: Pet) => a.name.localeCompare(b.name);

export async function listActivePets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => !p.archivedAt).sort(byName);
}

export async function listArchivedPets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => p.archivedAt).sort(byName);
}

export async function archivePet(id: string): Promise<void> {
  const ts = nowIso();
  await db.pets.update(id, { archivedAt: ts, updatedAt: ts });
}

export async function unarchivePet(id: string): Promise<void> {
  const changed = await db.pets.update(id, { archivedAt: undefined, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${id} not found`);
}

export async function deletePet(id: string): Promise<void> {
  await db.transaction('rw', [db.pets, db.feedings, db.regurgitations, db.photos], async () => {
    const pet = await db.pets.get(id);
    await db.feedings.where('petId').equals(id).delete();
    await db.regurgitations.where('petId').equals(id).delete();
    if (pet?.photoId) await db.photos.delete(pet.photoId);
    await db.pets.delete(id);
  });
}
```

- [ ] **Step 9: Replace the whole of `src/theme/tokens.css`** (only the light `--late-text` changes: `#b23a2b` → `#ab3528`)

```css
:root,
:root[data-theme='light'] {
  color-scheme: light;
  --bg: #f6f1e7;
  --card: #ffffff;
  --text: #2e2a24;
  --muted: #8b7e68;
  --line: #f1eadc;
  --chip: #efe6d6;
  --moss: #4e7a3a;
  --on-moss: #ffffff;
  --amber: #e9a04b;
  --amber-deep: #d9783a;
  --ok-bg: #e3eedb;
  --ok-text: #3f6b2c;
  --due-bg: #fce7cf;
  --due-text: #b85e1f;
  --late-bg: #f8d9d4;
  /* Spec #b23a2b was 4.49:1 on --late-bg (refused days); #ab3528 is 4.85:1. */
  --late-text: #ab3528;
  --future: #b3a891;
  --tab-bg: #fffdf8;
  --tab-line: #ebe2d1;
  --shadow: 0 1px 3px rgba(80, 60, 20, 0.08);
  --hero: radial-gradient(circle at 70% 35%, #f2b66b, #c9773c 70%);
  --banner: linear-gradient(135deg, #e9a04b, #d9783a);
  /* Text on filled surfaces (contrast): amber fills take dark text, banner text 4.55-6.51:1. */
  --on-amber: #2e2a24;
  --on-banner: #2e2a24;
  --banner-btn-text: #9a4a12;
  --on-late-fill: #ffffff;
  --planned-text: #a9541c;
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #171511;
  --card: #24211b;
  --text: #f1eadc;
  --muted: #a99c84;
  --line: #302b23;
  --chip: #2e2a22;
  --moss: #6e9e55;
  --on-moss: #101a0b;
  --amber: #e9a04b;
  --amber-deep: #b9772f;
  --ok-bg: #26341f;
  --ok-text: #a9d18e;
  --due-bg: #3b2c18;
  --due-text: #f2b66b;
  --late-bg: #3b201d;
  --late-text: #f09a8a;
  --future: #6b6252;
  --tab-bg: #1d1b16;
  --tab-line: #2e2a23;
  --shadow: 0 0 0 1px #2c2820;
  --hero: radial-gradient(circle at 70% 35%, #b9772f, #5a3416 75%);
  --banner: linear-gradient(135deg, #9f6220, #8a4519);
  --on-amber: #2e2a24;
  --on-banner: #ffffff;
  --banner-btn-text: #9a4a12;
  --on-late-fill: #171511;
  --planned-text: #f2b66b;
}
```

- [ ] **Step 10: Replace the whole of `src/features/pets/PetsHome.tsx`** (no opacity on the banner subline; Show archived with Unarchive)

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { listArchivedPets, unarchivePet } from '../../db/pets';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { PetAvatar } from '../../ui/PetAvatar';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { usePetSummaries, type PetSummary } from './usePetSummaries';

export const TONE: Record<PetSummary['status'], PillTone> = { late: 'late', today: 'due', soon: 'ok' };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function bannerLine(s: PetSummary): string {
  const when = s.status === 'today' && s.due ? 'Due today' : s.label;
  const food = s.pet.usualFoodItem ? ` · ${s.pet.usualQuantity} ${s.pet.usualFoodItem}` : '';
  return `${when}${food}`;
}

export default function PetsHome({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const summaries = usePetSummaries(now);
  const archived = useLiveQuery(() => listArchivedPets(), []);
  const [logFor, setLogFor] = useState<PetSummary | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  if (!summaries) return null;

  const today = summaries.filter((s) => s.status === 'today').length;
  const late = summaries.filter((s) => s.status === 'late').length;
  const subtitle = [
    plural(summaries.length, 'pet'),
    today ? `${today} due today` : '',
    late ? `${late} late` : '',
  ].filter(Boolean).join(' · ');
  const urgent = summaries.find((s) => s.status !== 'soon');

  async function onUnarchive(id: string) {
    try {
      await unarchivePet(id);
    } catch {
      window.alert('Could not unarchive. Please try again.');
    }
  }

  return (
    <>
      <h1>My Reptiles</h1>
      <div className="muted">{subtitle}</div>

      {urgent && (
        <div className="banner">
          <div className="row">
            <div className="grow">
              <div className="rounded" style={{ fontSize: 17 }}>{`${urgent.pet.name} is hungry`}</div>
              <div>{bannerLine(urgent)}</div>
            </div>
            <button type="button" className="btn" onClick={() => setLogFor(urgent)}>Log</button>
          </div>
        </div>
      )}

      {summaries.length === 0 && (
        <Card>
          <h2 style={{ margin: '4px 0' }}>No reptiles yet</h2>
          <p className="muted">Add your first pet to start tracking feedings.</p>
          <Link className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
            Add your first reptile
          </Link>
        </Card>
      )}

      {summaries.map((s) => (
        <Link key={s.pet.id} to={`/pets/${s.pet.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <Card>
            <div className="row">
              <PetAvatar photoId={s.pet.photoId} species={s.pet.species} />
              <div className="grow">
                <h3 style={{ margin: 0, fontSize: 16 }}>{s.pet.name}</h3>
                <div className="muted">{[s.pet.species, s.pet.morph].filter(Boolean).join(' · ')}</div>
                <div className={`bar ${s.status === 'late' ? 'late' : s.status === 'today' ? 'due' : ''}`}>
                  <i style={{ width: `${Math.round(s.progress * 100)}%` }} />
                </div>
              </div>
              <Pill tone={TONE[s.status]}>{s.label}</Pill>
            </div>
          </Card>
        </Link>
      ))}

      {summaries.length > 0 && (
        <Link className="btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
          + Add reptile
        </Link>
      )}

      {archived && archived.length > 0 && (
        <>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginTop: 8 }}
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
          </button>
          {showArchived && (
            <div style={{ marginTop: 8 }}>
              {archived.map((p) => (
                <Card key={p.id} role="group" aria-label={`${p.name} (archived)`}>
                  <div className="row">
                    <PetAvatar photoId={p.photoId} species={p.species} />
                    <div className="grow">
                      <h3 style={{ margin: 0, fontSize: 16 }}>{p.name}</h3>
                      <div className="muted">{`Archived ${format(parseISO(p.archivedAt!), 'MMM d, yyyy')}`}</div>
                    </div>
                    <button type="button" className="btn" onClick={() => onUnarchive(p.id)}>Unarchive</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {logFor && (
        <LogFeedingSheet
          open
          pet={logFor.pet}
          lastMealAt={logFor.meal?.at}
          currentDue={logFor.due}
          now={now}
          onClose={() => setLogFor(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 11: Replace the whole of `src/features/pets/petFormModel.ts`** (adds `sirePetId` / `damPetId`)

```ts
import type { Origin, ParentRef, Pet, Sex } from '../../domain/types';
import type { PetInput } from '../../db/pets';
import { ValidationError } from '../../db/ids';

export interface FormState {
  photoId?: string;
  name: string;
  species: string;
  morph: string;
  sex: Sex;
  birthDate: string;
  birthDateApprox: boolean;
  origin: Origin;
  description: string;
  acquiredFrom: string;
  acquiredDate: string;
  pricePaid: string;
  sireName: string;
  sireMorph: string;
  /** A link to another pet. The form has no picker for it yet, but an edit must keep it. */
  sirePetId?: string;
  damName: string;
  damMorph: string;
  damPetId?: string;
  feedingIntervalDays: string;
  usualFoodItem: string;
  usualQuantity: string;
  usualFeedTime: string;
}

export const EMPTY_FORM: FormState = {
  name: '', species: '', morph: '', sex: 'unknown', birthDate: '', birthDateApprox: false,
  origin: 'unknown', description: '', acquiredFrom: '', acquiredDate: '', pricePaid: '',
  sireName: '', sireMorph: '', damName: '', damMorph: '',
  feedingIntervalDays: '7', usualFoodItem: '', usualQuantity: '1', usualFeedTime: '18:00',
};

export function toForm(pet: Pet): FormState {
  return {
    photoId: pet.photoId,
    name: pet.name,
    species: pet.species,
    morph: pet.morph ?? '',
    sex: pet.sex,
    birthDate: pet.birthDate ?? '',
    birthDateApprox: pet.birthDateApprox,
    origin: pet.origin,
    description: pet.description ?? '',
    acquiredFrom: pet.acquiredFrom ?? '',
    acquiredDate: pet.acquiredDate ?? '',
    pricePaid: pet.pricePaid === undefined ? '' : String(pet.pricePaid),
    sireName: pet.sire?.name ?? '',
    sireMorph: pet.sire?.morph ?? '',
    sirePetId: pet.sire?.petId,
    damName: pet.dam?.name ?? '',
    damMorph: pet.dam?.morph ?? '',
    damPetId: pet.dam?.petId,
    feedingIntervalDays: String(pet.feedingIntervalDays),
    usualFoodItem: pet.usualFoodItem ?? '',
    usualQuantity: String(pet.usualQuantity),
    usualFeedTime: pet.usualFeedTime ?? '18:00',
  };
}

const opt = (s: string) => s.trim() || undefined;

function parent(name: string, morph: string, petId: string | undefined): ParentRef | undefined {
  if (!opt(name) && !opt(morph) && !petId) return undefined;
  return { name: opt(name), morph: opt(morph), petId };
}

/** Every optional key is present (possibly undefined) so updatePet clears emptied fields. */
export function toInput(f: FormState): PetInput {
  let pricePaid: number | undefined;
  if (f.pricePaid.trim()) {
    pricePaid = Number(f.pricePaid);
    if (!Number.isFinite(pricePaid) || pricePaid < 0) throw new ValidationError('Price must be a number');
  }
  return {
    photoId: f.photoId,
    name: f.name,
    species: f.species,
    morph: opt(f.morph),
    sex: f.sex,
    birthDate: opt(f.birthDate),
    birthDateApprox: f.birthDateApprox,
    origin: f.origin,
    description: opt(f.description),
    acquiredFrom: opt(f.acquiredFrom),
    acquiredDate: opt(f.acquiredDate),
    pricePaid,
    sire: parent(f.sireName, f.sireMorph, f.sirePetId),
    dam: parent(f.damName, f.damMorph, f.damPetId),
    feedingIntervalDays: Number(f.feedingIntervalDays),
    usualFoodItem: opt(f.usualFoodItem),
    usualQuantity: Number(f.usualQuantity),
    usualFeedTime: opt(f.usualFeedTime),
  };
}
```

- [ ] **Step 12: Replace the whole of `src/features/pets/PetForm.tsx`** (`onSubmit` clears the error first; a failure counter re-runs the focus effect even when the message is identical, including errors thrown synchronously by `toInput`, where React batches the clear and the new message into one render)

```tsx
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { archivePet, createPet, deletePet, getPet, updatePet } from '../../db/pets';
import { deletePhoto, savePhoto } from '../../db/photos';
import { listFoodItems } from '../../db/foodItems';
import { ValidationError } from '../../db/ids';
import { photoFromFile } from '../../lib/image';
import { usePhotoUrl } from '../../ui/usePhotoUrl';
import { speciesEmoji } from '../../ui/PetAvatar';
import { EMPTY_FORM, toForm, toInput, type FormState } from './petFormModel';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function PetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const foods = useLiveQuery(() => listFoodItems(), []);
  const [form, setForm] = useState<FormState | null>(id ? null : EMPTY_FORM);
  const [originalPhotoId, setOriginalPhotoId] = useState<string>();
  const [error, setError] = useState<string>();
  const [failures, setFailures] = useState(0);
  const [saving, setSaving] = useState(false);
  const photoUrl = usePhotoUrl(form?.photoId, 'full');
  const alertRef = useRef<HTMLDivElement>(null);

  // The alert sits near the top of a long form but Save is at the bottom: bring it into view.
  // `failures` makes a repeated, identical error scroll and focus again.
  useEffect(() => {
    if (!error) return;
    const el = alertRef.current;
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); // missing in jsdom
    el?.focus({ preventScroll: true });
  }, [error, failures]);

  useEffect(() => {
    if (!id) return;
    getPet(id).then((pet) => {
      if (!pet) return navigate('/', { replace: true });
      setForm(toForm(pet));
      setOriginalPhotoId(pet.photoId);
    });
  }, [id, navigate]);

  if (!form) return null;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });
  const text = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const photoId = await savePhoto(await photoFromFile(file));
      setForm((f) => (f ? { ...f, photoId } : f));
      setError(undefined);
    } catch {
      setError("Couldn't read that photo.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(undefined);
    setSaving(true);
    try {
      const input = toInput(form);
      let petId = id;
      if (id) await updatePet(id, input);
      else petId = (await createPet(input)).id;
      if (originalPhotoId && originalPhotoId !== form.photoId) await deletePhoto(originalPhotoId);
      navigate(`/pets/${petId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Could not save. Please try again.');
      setFailures((n) => n + 1);
      setSaving(false);
    }
  }

  async function onArchive() {
    if (!id) return;
    if (!window.confirm(`Archive ${form!.name}? Archived pets are hidden from My Reptiles (their history is kept).`)) return;
    await archivePet(id);
    navigate('/', { replace: true });
  }

  async function onDelete() {
    if (!id || !window.confirm(`Delete ${form!.name} and all of its records? This can't be undone.`)) return;
    await deletePet(id);
    navigate('/', { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="topbar">
        <button type="button" onClick={() => navigate(-1)}>Cancel</button>
        <b>{id ? `Edit ${form.name || 'pet'}` : 'Add reptile'}</b>
        <button type="submit" disabled={saving}>Save</button>
      </div>

      <label className="photo-pick" style={{ display: 'block', textAlign: 'center', margin: '12px 0' }}>
        <div className="pet-avatar" style={{ width: 96, height: 96, fontSize: 52, borderRadius: 28, margin: '0 auto' }}>
          {photoUrl ? <img src={photoUrl} alt="" /> : speciesEmoji(form.species)}
        </div>
        <span style={{ color: 'var(--moss)', fontWeight: 700 }}>{form.photoId ? 'Change photo' : 'Add photo'}</span>
        <input type="file" accept="image/*" aria-label="Choose photo" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>

      {error && <div role="alert" tabIndex={-1} ref={alertRef} className="form-error">{error}</div>}

      <div className="label">Basics</div>
      <Field label="Name"><input {...text('name')} autoComplete="off" /></Field>
      <Field label="Species"><input {...text('species')} placeholder="Corn Snake" /></Field>
      <Field label="Morph / breed"><input {...text('morph')} placeholder="Amel" /></Field>
      <Field label="Sex">
        <select value={form.sex} onChange={(e) => set('sex', e.target.value as FormState['sex'])}>
          <option value="unknown">Unknown</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </Field>
      <Field label="Date of birth"><input type="date" {...text('birthDate')} /></Field>
      <Field label="Birth date is approximate">
        <input type="checkbox" className="switch" checked={form.birthDateApprox} onChange={(e) => set('birthDateApprox', e.target.checked)} />
      </Field>
      <label className="field stack">
        <span>Description</span>
        <textarea rows={3} {...text('description')} />
      </label>

      <div className="label">Feeding</div>
      <Field label="Feed every (days)"><input type="number" inputMode="numeric" min={1} {...text('feedingIntervalDays')} /></Field>
      <Field label="Usual food">
        <select value={form.usualFoodItem} onChange={(e) => set('usualFoodItem', e.target.value)}>
          <option value="">None</option>
          {foods?.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Usual quantity"><input type="number" inputMode="numeric" min={1} {...text('usualQuantity')} /></Field>
      <Field label="Usual feeding time"><input type="time" {...text('usualFeedTime')} /></Field>

      <div className="label">Parents</div>
      <Field label="Sire name"><input {...text('sireName')} /></Field>
      <Field label="Sire morph"><input {...text('sireMorph')} /></Field>
      <Field label="Dam name"><input {...text('damName')} /></Field>
      <Field label="Dam morph"><input {...text('damMorph')} /></Field>

      <div className="label">Where it came from</div>
      <Field label="Origin">
        <select value={form.origin} onChange={(e) => set('origin', e.target.value as FormState['origin'])}>
          <option value="unknown">Unknown</option>
          <option value="captive_bred">Captive bred</option>
          <option value="wild_caught">Wild caught</option>
        </select>
      </Field>
      <Field label="Bought from"><input {...text('acquiredFrom')} /></Field>
      <Field label="Date bought"><input type="date" {...text('acquiredDate')} /></Field>
      <Field label="Price paid ($)"><input type="number" inputMode="decimal" min={0} {...text('pricePaid')} /></Field>

      <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 16 }}>Save pet</button>

      {id && (
        <div style={{ marginTop: 24, display: 'grid', gap: 8 }}>
          <button type="button" className="btn-ghost" onClick={onArchive}>Archive pet</button>
          <button type="button" className="btn-ghost btn-danger" onClick={onDelete}>Delete pet</button>
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 13: Replace the whole of `docs/iphone-checklist.md`** (adds check 8)

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
```

- [ ] **Step 14: Run everything**

Run: `npm test && npm run typecheck`
Expected: all tests pass (including the 5 new test files), exit 0.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "fix: Plan 1 carry-overs (contrast, alert re-focus, parent links) and show archived pets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Husbandry data model: types, schema v2 with upgrade, cascade delete, units

**Files:**
- Modify: `src/domain/types.ts` (new record types, unit types, `Pet.inBlueSince`)
- Modify: `src/domain/dates.ts` (input-safe date helpers)
- Modify: `src/db/ids.ts` (shared validation helpers)
- Modify: `src/db/db.ts` (`version(2)` + upgrade)
- Modify: `src/db/pets.ts` (`deletePet` cascades)
- Create: `src/domain/units.ts`, `src/lib/numbers.ts`, `src/features/settings/useUnits.ts`
- Test: `src/db/schema.test.ts`, `src/domain/dates.test.ts`, `src/domain/units.test.ts`, `src/lib/numbers.test.ts`, `src/features/settings/useUnits.test.tsx`

**Interfaces:**
- Consumes: Plan 1 `db`, `RepTenderDB`, `resetDb`, `createPet`, `savePhoto`, `getSettings`, `updateSettings`, `DEFAULT_SETTINGS`
- Produces (types, `src/domain/types.ts`):
  - `TempUnit = 'F' | 'C'`, `WeightUnit = 'g' | 'oz' | 'lb'`, `LengthUnit = 'in' | 'cm'` (and `Settings` uses them)
  - `Pet.inBlueSince?: string` (yyyy-MM-dd; set by Mark "in blue", cleared when the next shed is logged)
  - `PoopKind = 'normal' | 'runny' | 'urate_only' | 'abnormal'`; `Poop { id, petId, at, kind, notes?, createdAt, updatedAt }`
  - `ShedQuality = 'complete' | 'partial' | 'stuck'`; `Shed { id, petId, date, inBlueDate?, quality, notes?, … }`
  - `Measurement { id, petId, date, weightG?, lengthMm?, … }`
  - `HabitatReading { id, petId, at, warmC?, coolC?, humidityPct?, … }`
  - `CareTask { id, petId?, name, intervalDays, timeOfDay?, archivedAt?, … }`; `CareCompletion { id, taskId, at, … }`
  - `VetVisit { id, petId, date, clinic?, vet?, phone?, reason?, notes?, cost?, photoIds: string[], nextAppointment?, … }` (`nextAppointment` is an ISO datetime)
  - `Note { id, petId, at, text, … }`
- Produces (db): tables `db.sheds`, `db.poops`, `db.measurements`, `db.habitatReadings`, `db.careTasks`, `db.careCompletions`, `db.vetVisits`, `db.notes`; `SCHEMA_VERSION = 2`; `deletePet(id)` removes the pet's rows in every table, its care tasks' completions, its photo and its vet-visit photos (an "All pets" care task is kept)
- Produces (helpers):
  - `isDateKey(s: string): boolean`, `isTimeOfDay(s: string): boolean`, `combineDateTime(date: string, time: string): Date | null`, `formatTimeOfDay(hhmm: string): string` (`'18:00'` → `'6:00 PM'`) in `src/domain/dates.ts`
  - `cleanText(s?: string): string | undefined`, `requireDateKey(date: string, message?: string): void`, `requireDateTime(at: string, message?: string): void`, `saveErrorText(err: unknown): string` in `src/db/ids.ts`
  - `src/domain/units.ts`: `Units { temp: TempUnit; weight: WeightUnit; length: LengthUnit }`, `DEFAULT_UNITS`, `tempFromC`, `tempToC`, `weightFromG`, `weightToG`, `lengthFromMm`, `lengthToMm` (each `(value: number, unit) => number`), `roundTo(n, decimals)`, `displayTemp`, `displayWeight`, `displayLength` (rounded numbers in the user's unit), `formatTemp(c, unit)` → `'88°F'`, `formatWeight(g, unit)` → `'42 g'`, `formatLength(mm, unit)` → `'18 in'`, `formatHumidity(pct)` → `'52%'`
  - `parseOptionalNumber(text: string): number | undefined` in `src/lib/numbers.ts` (`undefined` when blank, `NaN` when not a number; accepts a decimal comma)
  - `useUnits(): Units | undefined` in `src/features/settings/useUnits.ts` (`undefined` until Settings load)

- [ ] **Step 1: Write the failing tests in `src/db/schema.test.ts`**

```ts
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, RepTenderDB, resetDb, SCHEMA_VERSION } from './db';
import { createPet, deletePet } from './pets';
import { savePhoto } from './photos';
import { newId, nowIso } from './ids';

const UPGRADE_DB = 'reptender-upgrade-test';

// Exactly the Plan 1 (version 1) schema.
const V1_STORES = {
  pets: 'id, name, archivedAt',
  feedings: 'id, petId, [petId+at]',
  regurgitations: 'id, petId, feedingId, [petId+at]',
  photos: 'id',
  foodItems: 'id, &name',
  settings: 'id',
};

describe('schema version 2', () => {
  afterEach(async () => {
    await Dexie.delete(UPGRADE_DB);
  });

  it('upgrades a version 1 database with every record intact', async () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const v1 = new Dexie(UPGRADE_DB);
    v1.version(1).stores(V1_STORES);
    // A record shaped like an early Plan 1 pet that never got habitatTargets.
    await v1.table('pets').add({
      id: 'p1', name: 'Noodle', species: 'Corn Snake', sex: 'female', origin: 'captive_bred', birthDateApprox: false,
      feedingIntervalDays: 5, usualQuantity: 1, usualFeedTime: '18:00', nextFeedingOverride: ts, createdAt: ts, updatedAt: ts,
    });
    await v1.table('pets').add({
      id: 'p2', name: 'Ziggy', species: 'Leopard Gecko', sex: 'male', origin: 'unknown', birthDateApprox: false,
      feedingIntervalDays: 3, usualQuantity: 8, habitatTargets: { warmMinC: 30 }, archivedAt: ts, createdAt: ts, updatedAt: ts,
    });
    await v1.table('feedings').add({ id: 'f1', petId: 'p1', at: ts, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: ts, updatedAt: ts });
    await v1.table('regurgitations').add({ id: 'r1', petId: 'p1', feedingId: 'f1', at: ts, pushBackDays: 10, createdAt: ts, updatedAt: ts });
    await v1.table('photos').add({ id: 'ph1', blob: 'jpeg', thumbBlob: 'thumb', width: 4, height: 3, createdAt: ts, updatedAt: ts });
    await v1.table('foodItems').add({ id: 'fi1', name: 'Pinky mouse', isCustom: false, createdAt: ts, updatedAt: ts });
    await v1.table('settings').add({ id: 'settings', theme: 'dark', tempUnit: 'C', weightUnit: 'g', lengthUnit: 'cm' });
    v1.close();

    const v2 = new RepTenderDB(UPGRADE_DB);
    await v2.open();
    expect(v2.verno).toBe(SCHEMA_VERSION);
    expect(await v2.pets.get('p1')).toMatchObject({ name: 'Noodle', nextFeedingOverride: ts, habitatTargets: {} });
    expect(await v2.pets.get('p2')).toMatchObject({ archivedAt: ts, habitatTargets: { warmMinC: 30 } });
    expect(await v2.feedings.get('f1')).toMatchObject({ petId: 'p1', outcome: 'ate' });
    expect(await v2.regurgitations.get('r1')).toMatchObject({ feedingId: 'f1', pushBackDays: 10 });
    expect(await v2.photos.get('ph1')).toMatchObject({ width: 4, height: 3 });
    expect(await v2.foodItems.count()).toBe(1); // the seed only runs for a brand-new database
    expect(await v2.settings.get('settings')).toMatchObject({ theme: 'dark', tempUnit: 'C', lengthUnit: 'cm' });

    await v2.sheds.add({ id: 's1', petId: 'p1', date: '2026-11-02', quality: 'complete', createdAt: ts, updatedAt: ts });
    expect(await v2.sheds.where('[petId+date]').between(['p1', Dexie.minKey], ['p1', Dexie.maxKey]).count()).toBe(1);
    v2.close();
  });

  it('a brand-new database has the husbandry tables and the seed', async () => {
    await resetDb();
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'careCompletions', 'careTasks', 'feedings', 'foodItems', 'habitatReadings', 'measurements',
      'notes', 'pets', 'photos', 'poops', 'regurgitations', 'settings', 'sheds', 'vetVisits',
    ]);
    expect(await db.foodItems.count()).toBe(11);
  });
});

describe('deletePet', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('deletes every record and photo of that pet, and nothing of other pets', async () => {
    const ts = nowIso();
    const row = (petId: string) => ({ id: newId(), petId, createdAt: ts, updatedAt: ts });
    const photo = () => savePhoto({ blob: new Blob(['full']), thumbBlob: new Blob(['thumb']), width: 1, height: 1 });

    const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, photoId: await photo() });
    const ziggy = await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    for (const petId of [noodle.id, ziggy.id]) {
      await db.sheds.add({ ...row(petId), date: '2026-11-01', quality: 'complete' });
      await db.poops.add({ ...row(petId), at: ts, kind: 'normal' });
      await db.measurements.add({ ...row(petId), date: '2026-11-01', weightG: 40 });
      await db.habitatReadings.add({ ...row(petId), at: ts, warmC: 31 });
      await db.notes.add({ ...row(petId), at: ts, text: 'Shed soon' });
      await db.vetVisits.add({ ...row(petId), date: '2026-06-14', photoIds: [await photo()] });
    }
    const ownTask = { id: newId(), petId: noodle.id, name: 'Deep clean', intervalDays: 30, createdAt: ts, updatedAt: ts };
    const allPetsTask = { id: newId(), name: 'Fresh water', intervalDays: 2, createdAt: ts, updatedAt: ts };
    await db.careTasks.bulkAdd([ownTask, allPetsTask]);
    await db.careCompletions.bulkAdd([
      { id: newId(), taskId: ownTask.id, at: ts, createdAt: ts, updatedAt: ts },
      { id: newId(), taskId: allPetsTask.id, at: ts, createdAt: ts, updatedAt: ts },
    ]);
    expect(await db.photos.count()).toBe(3);

    await deletePet(noodle.id);

    const petIds = async (rows: Promise<{ petId: string }[]>) => (await rows).map((r) => r.petId);
    expect(await petIds(db.sheds.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.poops.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.measurements.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.habitatReadings.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.notes.toArray())).toEqual([ziggy.id]);
    expect(await petIds(db.vetVisits.toArray())).toEqual([ziggy.id]);
    expect((await db.careTasks.toArray()).map((t) => t.name)).toEqual(['Fresh water']);
    expect((await db.careCompletions.toArray()).map((c) => c.taskId)).toEqual([allPetsTask.id]);
    const ziggyVisit = (await db.vetVisits.toArray())[0]!;
    expect((await db.photos.toArray()).map((p) => p.id)).toEqual(ziggyVisit.photoIds);
  });
});
```

- [ ] **Step 2: Replace the whole of `src/domain/dates.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { atTime, combineDateTime, dateKey, formatTimeOfDay, isDateKey, isTimeOfDay, parseDateKey } from './dates';

describe('dates', () => {
  it('dateKey formats a local date as yyyy-MM-dd', () => {
    expect(dateKey(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
  });
  it('parseDateKey returns local midnight', () => {
    const d = parseDateKey('2026-03-03');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 3, 0]);
  });
  it('atTime sets the local time of day', () => {
    const d = atTime(new Date(2026, 10, 13, 7, 30), '18:00');
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([13, 18, 0]);
  });
});

describe('input-safe helpers', () => {
  it('isDateKey accepts only real yyyy-MM-dd dates', () => {
    expect(isDateKey('2026-11-08')).toBe(true);
    expect(isDateKey('')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('11/08/2026')).toBe(false);
  });
  it('isTimeOfDay accepts HH:mm only', () => {
    expect(isTimeOfDay('07:30')).toBe(true);
    expect(isTimeOfDay('')).toBe(false);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(isTimeOfDay('7:30')).toBe(false);
  });
  it('combineDateTime builds a local date, or null for a cleared or bad input', () => {
    expect(combineDateTime('2026-11-04', '07:30')!.getTime()).toBe(new Date(2026, 10, 4, 7, 30).getTime());
    expect(combineDateTime('', '07:30')).toBeNull();
    expect(combineDateTime('2026-11-04', '')).toBeNull();
    expect(combineDateTime('2026-13-01', '07:30')).toBeNull();
  });
  it('formatTimeOfDay shows a 12-hour time', () => {
    expect(formatTimeOfDay('18:00')).toBe('6:00 PM');
    expect(formatTimeOfDay('08:15')).toBe('8:15 AM');
  });
});
```

- [ ] **Step 3: Write the failing tests in `src/domain/units.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  displayLength, displayTemp, displayWeight, formatHumidity, formatLength, formatTemp, formatWeight,
  lengthFromMm, lengthToMm, roundTo, tempFromC, tempToC, weightFromG, weightToG,
} from './units';

describe('conversions (spec §7 rule 10)', () => {
  it('temperature both ways', () => {
    expect(tempFromC(30, 'F')).toBeCloseTo(86, 6);
    expect(tempToC(86, 'F')).toBeCloseTo(30, 6);
    expect(tempFromC(30, 'C')).toBe(30);
    expect(tempToC(30, 'C')).toBe(30);
  });
  it('weight both ways', () => {
    expect(weightToG(1, 'oz')).toBeCloseTo(28.3495, 4);
    expect(weightToG(1, 'lb')).toBeCloseTo(453.5924, 4);
    expect(weightFromG(453.59237, 'lb')).toBeCloseTo(1, 6);
    expect(weightFromG(42, 'g')).toBe(42);
  });
  it('length both ways', () => {
    expect(lengthToMm(18, 'in')).toBeCloseTo(457.2, 6);
    expect(lengthToMm(45, 'cm')).toBe(450);
    expect(lengthFromMm(457.2, 'cm')).toBeCloseTo(45.72, 6);
  });
});

describe('display rounding', () => {
  it('rounds to a number of decimals', () => {
    expect(roundTo(17.46, 1)).toBe(17.5);
    expect(roundTo(87.98, 0)).toBe(88);
  });
  it('g and °F to whole numbers, in to 1 decimal place', () => {
    expect(formatWeight(41.6, 'g')).toBe('42 g');
    expect(formatTemp(31.1, 'F')).toBe('88°F');
    expect(formatLength(457.2, 'in')).toBe('18 in');
    expect(formatLength(444.5, 'in')).toBe('17.5 in');
  });
  it('the other units', () => {
    expect(formatWeight(42.52, 'oz')).toBe('1.5 oz');
    expect(formatWeight(1000, 'lb')).toBe('2.2 lb');
    expect(formatTemp(31.14, 'C')).toBe('31.1°C');
    expect(formatLength(457.2, 'cm')).toBe('45.7 cm');
    expect(formatHumidity(52.4)).toBe('52%');
  });
  it('a value typed in the user unit shows back exactly', () => {
    expect(displayTemp(tempToC(88, 'F'), 'F')).toBe(88);
    expect(displayWeight(weightToG(1.5, 'oz'), 'oz')).toBe(1.5);
    expect(displayLength(lengthToMm(17.5, 'in'), 'in')).toBe(17.5);
  });
});
```

- [ ] **Step 4: Write the failing tests in `src/lib/numbers.test.ts`**

```ts
import { expect, it } from 'vitest';
import { parseOptionalNumber } from './numbers';

it('reads a number field: blank is undefined, junk is NaN', () => {
  expect(parseOptionalNumber('42')).toBe(42);
  expect(parseOptionalNumber(' 17.5 ')).toBe(17.5);
  expect(parseOptionalNumber('17,5')).toBe(17.5);
  expect(parseOptionalNumber('')).toBeUndefined();
  expect(parseOptionalNumber('   ')).toBeUndefined();
  expect(parseOptionalNumber('abc')).toBeNaN();
});
```

- [ ] **Step 5: Write the failing tests in `src/features/settings/useUnits.test.tsx`**

```tsx
import { beforeEach, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { resetDb } from '../../db/db';
import { updateSettings } from '../../db/settings';
import { useUnits } from './useUnits';

beforeEach(async () => {
  await resetDb();
});

it('reads the units from Settings: °F, g and in by default', async () => {
  const { result } = renderHook(() => useUnits());
  await waitFor(() => expect(result.current).toEqual({ temp: 'F', weight: 'g', length: 'in' }));
  await updateSettings({ tempUnit: 'C', lengthUnit: 'cm' });
  await waitFor(() => expect(result.current).toEqual({ temp: 'C', weight: 'g', length: 'cm' }));
});
```

- [ ] **Step 6: Run them and confirm they fail**

Run: `npm test -- src/db/schema.test.ts src/domain src/lib/numbers.test.ts src/features/settings/useUnits.test.tsx`
Expected: FAIL. `SCHEMA_VERSION` is undefined / `db.sheds` is undefined, `combineDateTime is not a function`, `Failed to resolve import "./units"`, `"./numbers"` and `"./useUnits"`.

- [ ] **Step 7: Replace the whole of `src/domain/types.ts`**

```ts
export type Sex = 'male' | 'female' | 'unknown';
export type Origin = 'captive_bred' | 'wild_caught' | 'unknown';

export interface ParentRef {
  name?: string;
  morph?: string;
  petId?: string;
}

export interface HabitatTargets {
  warmMinC?: number;
  warmMaxC?: number;
  coolMinC?: number;
  coolMaxC?: number;
  humidityMin?: number;
  humidityMax?: number;
}

interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface Pet extends Timestamps {
  id: string;
  name: string;
  photoId?: string;
  species: string;
  morph?: string;
  sex: Sex;
  birthDate?: string; // yyyy-MM-dd
  birthDateApprox: boolean;
  description?: string;
  origin: Origin;
  acquiredFrom?: string;
  acquiredDate?: string; // yyyy-MM-dd
  pricePaid?: number;
  sire?: ParentRef;
  dam?: ParentRef;
  feedingIntervalDays: number;
  usualFoodItem?: string;
  usualQuantity: number;
  usualFeedTime?: string; // HH:mm
  enclosureLabel?: string;
  habitatTargets: HabitatTargets;
  nextFeedingOverride?: string; // ISO datetime
  /** yyyy-MM-dd. Set by Mark "in blue" (spec §5.7), cleared when the next shed is logged. */
  inBlueSince?: string;
  archivedAt?: string;
}

export type FeedingOutcome = 'ate' | 'refused';

export interface Feeding extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  foodItem: string;
  quantity: number;
  outcome: FeedingOutcome;
  notes?: string;
}

export interface Regurgitation extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime it was found
  feedingId: string;
  pushBackDays?: number;
  notes?: string;
}

export type PoopKind = 'normal' | 'runny' | 'urate_only' | 'abnormal';

export interface Poop extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  kind: PoopKind;
  notes?: string;
}

export type ShedQuality = 'complete' | 'partial' | 'stuck';

export interface Shed extends Timestamps {
  id: string;
  petId: string;
  date: string; // yyyy-MM-dd
  inBlueDate?: string; // yyyy-MM-dd
  quality: ShedQuality;
  notes?: string;
}

/** At least one of weightG / lengthMm is set. Canonical units: grams and millimetres. */
export interface Measurement extends Timestamps {
  id: string;
  petId: string;
  date: string; // yyyy-MM-dd
  weightG?: number;
  lengthMm?: number;
}

/** At least one value is set. Canonical unit: °C. */
export interface HabitatReading extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  warmC?: number;
  coolC?: number;
  humidityPct?: number;
}

export interface CareTask extends Timestamps {
  id: string;
  /** Empty means the task is for all pets. */
  petId?: string;
  name: string;
  intervalDays: number;
  timeOfDay?: string; // HH:mm
  archivedAt?: string;
}

export interface CareCompletion extends Timestamps {
  id: string;
  taskId: string;
  at: string; // ISO datetime
}

export interface VetVisit extends Timestamps {
  id: string;
  petId: string;
  date: string; // yyyy-MM-dd
  clinic?: string;
  vet?: string;
  phone?: string;
  reason?: string;
  notes?: string;
  cost?: number;
  photoIds: string[];
  nextAppointment?: string; // ISO datetime
}

export interface Note extends Timestamps {
  id: string;
  petId: string;
  at: string; // ISO datetime
  text: string;
}

export interface Photo extends Timestamps {
  id: string;
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
}

export interface FoodItem extends Timestamps {
  id: string;
  name: string;
  isCustom: boolean;
}

export type ThemePref = 'light' | 'dark' | 'auto';
export type TempUnit = 'F' | 'C';
export type WeightUnit = 'g' | 'oz' | 'lb';
export type LengthUnit = 'in' | 'cm';

export interface Settings {
  id: 'settings';
  theme: ThemePref;
  tempUnit: TempUnit;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  lastBackupAt?: string;
}
```

- [ ] **Step 8: Replace the whole of `src/domain/dates.ts`**

```ts
import { format, isValid, parse, set, startOfDay } from 'date-fns';

export const DEFAULT_FEED_TIME = '18:00';

export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseDateKey(key: string): Date {
  return parse(key, 'yyyy-MM-dd', new Date());
}

export function atTime(day: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return set(startOfDay(day), { hours, minutes });
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** True for a real calendar date in yyyy-MM-dd form (what <input type="date"> gives). */
export function isDateKey(s: string): boolean {
  return DATE_KEY.test(s) && isValid(parseDateKey(s));
}

/** True for HH:mm (what <input type="time"> gives). */
export function isTimeOfDay(s: string): boolean {
  return TIME_OF_DAY.test(s);
}

/**
 * Date + time inputs → a local Date, or null when either is blank or invalid.
 * Forms disable Save on null instead of calling format()/toISOString() on an Invalid Date.
 */
export function combineDateTime(date: string, time: string): Date | null {
  if (!isDateKey(date) || !isTimeOfDay(time)) return null;
  return atTime(parseDateKey(date), time);
}

/** '18:00' → '6:00 PM'. */
export function formatTimeOfDay(hhmm: string): string {
  return format(atTime(new Date(2000, 0, 1), hhmm), 'h:mm a');
}
```

- [ ] **Step 9: Replace the whole of `src/db/ids.ts`**

```ts
import { isValid, parseISO } from 'date-fns';
import { isDateKey } from '../domain/dates';

export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

/** Bad user input. Screens show `message` next to the form. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Trimmed text, or undefined for blank (so an emptied field is removed from the record). */
export const cleanText = (s?: string): string | undefined => s?.trim() || undefined;

export function requireDateKey(date: string, message = 'Pick a date'): void {
  if (!isDateKey(date)) throw new ValidationError(message);
}

export function requireDateTime(at: string, message = 'Pick a date and time'): void {
  if (!isValid(parseISO(at))) throw new ValidationError(message);
}

/** The inline message a form shows when saving fails (spec §11). */
export function saveErrorText(err: unknown): string {
  return err instanceof ValidationError ? err.message : 'Could not save. Please try again.';
}
```

- [ ] **Step 10: Replace the whole of `src/db/db.ts`**

```ts
import Dexie, { type EntityTable } from 'dexie';
import type {
  CareCompletion, CareTask, Feeding, FoodItem, HabitatReading, Measurement, Note, Pet, Photo, Poop,
  Regurgitation, Settings, Shed, VetVisit,
} from '../domain/types';
import { newId, nowIso } from './ids';

export const SCHEMA_VERSION = 2;

export const DEFAULT_FOOD_ITEMS = [
  'Pinky mouse', 'Fuzzy mouse', 'Hopper mouse', 'Adult mouse', 'Rat pup',
  'Crickets', 'Dubia roaches', 'Mealworms', 'Superworms', 'Greens', 'Pellets',
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings', theme: 'auto', tempUnit: 'F', weightUnit: 'g', lengthUnit: 'in',
};

export class RepTenderDB extends Dexie {
  pets!: EntityTable<Pet, 'id'>;
  feedings!: EntityTable<Feeding, 'id'>;
  regurgitations!: EntityTable<Regurgitation, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  foodItems!: EntityTable<FoodItem, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  sheds!: EntityTable<Shed, 'id'>;
  poops!: EntityTable<Poop, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  habitatReadings!: EntityTable<HabitatReading, 'id'>;
  careTasks!: EntityTable<CareTask, 'id'>;
  careCompletions!: EntityTable<CareCompletion, 'id'>;
  vetVisits!: EntityTable<VetVisit, 'id'>;
  notes!: EntityTable<Note, 'id'>;

  constructor(name = 'reptender') {
    super(name);
    this.version(1).stores({
      pets: 'id, name, archivedAt',
      feedings: 'id, petId, [petId+at]',
      regurgitations: 'id, petId, feedingId, [petId+at]',
      photos: 'id',
      foodItems: 'id, &name',
      settings: 'id',
    });
    // Plan 2: husbandry tables. Spec §6.2: [petId+at] on time-based logs, [petId+date] on date-based ones.
    this.version(2)
      .stores({
        sheds: 'id, petId, [petId+date]',
        poops: 'id, petId, [petId+at]',
        measurements: 'id, petId, [petId+date]',
        habitatReadings: 'id, petId, [petId+at]',
        careTasks: 'id, petId',
        careCompletions: 'id, taskId, [taskId+at]',
        vetVisits: 'id, petId, [petId+date]',
        notes: 'id, petId, [petId+at]',
      })
      .upgrade(async (tx) => {
        // v1 → v2 only adds tables; existing rows are untouched. The Habitat screen edits
        // pet.habitatTargets in place, so make sure every pet has the object.
        await tx.table('pets').toCollection().modify((pet: Partial<Pet>) => {
          if (!pet.habitatTargets) pet.habitatTargets = {};
        });
      });
    this.on('populate', (tx) => {
      const ts = nowIso();
      tx.table('foodItems').bulkAdd(
        DEFAULT_FOOD_ITEMS.map((name) => ({ id: newId(), name, isCustom: false, createdAt: ts, updatedAt: ts })),
      );
      tx.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new RepTenderDB();

/** Tests only: wipe and recreate the database (re-runs the seed). */
export async function resetDb(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
}
```

- [ ] **Step 11: Replace the whole of `src/db/pets.ts`** (`deletePet` now cascades to every Plan 2 table)

```ts
import type { Pet } from '../domain/types';
import { DEFAULT_FEED_TIME } from '../domain/dates';
import { db } from './db';
import { newId, nowIso, ValidationError } from './ids';

type Required3 = 'name' | 'species' | 'feedingIntervalDays';
export type PetInput = Pick<Pet, Required3> &
  Partial<Omit<Pet, 'id' | 'createdAt' | 'updatedAt' | Required3>>;

function validate(p: Partial<PetInput>): void {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError('Name is required');
  if (p.species !== undefined && !p.species.trim()) throw new ValidationError('Species is required');
  if (p.feedingIntervalDays !== undefined && !(Number.isInteger(p.feedingIntervalDays) && p.feedingIntervalDays >= 1)) {
    throw new ValidationError('Feed every must be at least 1 day');
  }
  if (p.usualQuantity !== undefined && !(Number.isInteger(p.usualQuantity) && p.usualQuantity >= 1)) {
    throw new ValidationError('Usual quantity must be at least 1');
  }
}

export async function createPet(input: PetInput): Promise<Pet> {
  validate(input);
  const ts = nowIso();
  const pet: Pet = {
    sex: 'unknown',
    origin: 'unknown',
    birthDateApprox: false,
    usualQuantity: 1,
    usualFeedTime: DEFAULT_FEED_TIME,
    habitatTargets: {},
    ...input,
    name: input.name.trim(),
    species: input.species.trim(),
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.pets.add(pet);
  return pet;
}

/** Fields set to `undefined` in `patch` are removed from the record. */
export async function updatePet(id: string, patch: Partial<PetInput>): Promise<void> {
  validate(patch);
  const changed = await db.pets.update(id, { ...patch, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${id} not found`);
}

export const getPet = (id: string) => db.pets.get(id);

const byName = (a: Pet, b: Pet) => a.name.localeCompare(b.name);

export async function listActivePets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => !p.archivedAt).sort(byName);
}

export async function listArchivedPets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => p.archivedAt).sort(byName);
}

export async function archivePet(id: string): Promise<void> {
  const ts = nowIso();
  await db.pets.update(id, { archivedAt: ts, updatedAt: ts });
}

export async function unarchivePet(id: string): Promise<void> {
  const changed = await db.pets.update(id, { archivedAt: undefined, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${id} not found`);
}

/** Deletes the pet and everything that belongs to it, including photos. "All pets" care tasks stay. */
export async function deletePet(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.pets, db.feedings, db.regurgitations, db.photos, db.sheds, db.poops, db.measurements,
      db.habitatReadings, db.careTasks, db.careCompletions, db.vetVisits, db.notes,
    ],
    async () => {
      const pet = await db.pets.get(id);
      const visits = await db.vetVisits.where('petId').equals(id).toArray();
      const taskIds = await db.careTasks.where('petId').equals(id).primaryKeys();
      await db.feedings.where('petId').equals(id).delete();
      await db.regurgitations.where('petId').equals(id).delete();
      await db.sheds.where('petId').equals(id).delete();
      await db.poops.where('petId').equals(id).delete();
      await db.measurements.where('petId').equals(id).delete();
      await db.habitatReadings.where('petId').equals(id).delete();
      await db.notes.where('petId').equals(id).delete();
      await db.vetVisits.where('petId').equals(id).delete();
      if (taskIds.length > 0) await db.careCompletions.where('taskId').anyOf(taskIds).delete();
      await db.careTasks.bulkDelete(taskIds);
      const photoIds = [pet?.photoId, ...visits.flatMap((v) => v.photoIds)].filter((p): p is string => !!p);
      await db.photos.bulkDelete(photoIds);
      await db.pets.delete(id);
    },
  );
}
```

- [ ] **Step 12: Create `src/domain/units.ts`**

```ts
import type { LengthUnit, TempUnit, WeightUnit } from './types';

export interface Units {
  temp: TempUnit;
  weight: WeightUnit;
  length: LengthUnit;
}

/** Spec §6 / Settings defaults: °F, g, in. */
export const DEFAULT_UNITS: Units = { temp: 'F', weight: 'g', length: 'in' };

const G_PER_OZ = 28.349523125;
const G_PER_LB = 453.59237;
const MM_PER_IN = 25.4;

export const tempFromC = (c: number, unit: TempUnit): number => (unit === 'F' ? (c * 9) / 5 + 32 : c);
export const tempToC = (value: number, unit: TempUnit): number => (unit === 'F' ? ((value - 32) * 5) / 9 : value);

export function weightFromG(g: number, unit: WeightUnit): number {
  if (unit === 'oz') return g / G_PER_OZ;
  if (unit === 'lb') return g / G_PER_LB;
  return g;
}
export function weightToG(value: number, unit: WeightUnit): number {
  if (unit === 'oz') return value * G_PER_OZ;
  if (unit === 'lb') return value * G_PER_LB;
  return value;
}

export const lengthFromMm = (mm: number, unit: LengthUnit): number => (unit === 'in' ? mm / MM_PER_IN : mm / 10);
export const lengthToMm = (value: number, unit: LengthUnit): number => (unit === 'in' ? value * MM_PER_IN : value * 10);

export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r; // no "-0"
}

/** Spec §7 rule 10: g and °F whole, in 1 decimal; the Plan 3 units get sensible precision too. */
const TEMP_DECIMALS: Record<TempUnit, number> = { F: 0, C: 1 };
const WEIGHT_DECIMALS: Record<WeightUnit, number> = { g: 0, oz: 1, lb: 2 };
const LENGTH_DECIMALS: Record<LengthUnit, number> = { in: 1, cm: 1 };

export const displayTemp = (c: number, unit: TempUnit): number => roundTo(tempFromC(c, unit), TEMP_DECIMALS[unit]);
export const displayWeight = (g: number, unit: WeightUnit): number => roundTo(weightFromG(g, unit), WEIGHT_DECIMALS[unit]);
export const displayLength = (mm: number, unit: LengthUnit): number => roundTo(lengthFromMm(mm, unit), LENGTH_DECIMALS[unit]);

export const formatTemp = (c: number, unit: TempUnit): string => `${displayTemp(c, unit)}°${unit}`;
export const formatWeight = (g: number, unit: WeightUnit): string => `${displayWeight(g, unit)} ${unit}`;
export const formatLength = (mm: number, unit: LengthUnit): string => `${displayLength(mm, unit)} ${unit}`;
export const formatHumidity = (pct: number): string => `${Math.round(pct)}%`;
```

- [ ] **Step 13: Create `src/lib/numbers.ts`**

```ts
/** Text from a number field: undefined when blank, NaN when it isn't a number. Accepts a decimal comma. */
export function parseOptionalNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
```

- [ ] **Step 14: Create `src/features/settings/useUnits.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../../db/settings';
import type { Units } from '../../domain/units';

/**
 * The user's display units from Settings (spec §5.15; the picker itself is Plan 3).
 * Undefined until Settings load, so forms never pre-fill values in the wrong unit.
 */
export function useUnits(): Units | undefined {
  const settings = useLiveQuery(() => getSettings(), []);
  if (!settings) return undefined;
  return { temp: settings.tempUnit, weight: settings.weightUnit, length: settings.lengthUnit };
}
```

- [ ] **Step 15: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0. The Plan 1 test "deleting a pet deletes its feedings and regurgitations" still passes with the wider transaction.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: add the husbandry schema (Dexie v2 with upgrade), cascade delete and unit conversions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Regurgitation sheet and the shared form pieces

Spec §5.5: for a regurgitation found after the meal was logged. `logRegurgitation` already exists in `src/db/feedings.ts` and already applies the push-back (spec §7 rule 4). This task adds the sheet, plus the small form pieces and the stylesheet every later screen uses.

**Files:**
- Create: `src/ui/Field.tsx`, `src/ui/SheetHeader.tsx`, `src/ui/husbandry.css`, `src/features/regurgitation/RegurgitationSheet.tsx`
- Modify: `src/main.tsx` (import `husbandry.css`)
- Test: `src/features/regurgitation/RegurgitationSheet.test.tsx`

**Interfaces:**
- Consumes: `logRegurgitation`, `listFeedings`, `listRegurgitations` (`src/db/feedings.ts`); `pushBackOverride`, `nextFeedingDue`, `DEFAULT_PUSH_BACK_DAYS` (`src/domain/feeding.ts`); `formatDay` (`src/features/feedings/logModel.ts`); `foodIcon`; `combineDateTime`, `dateKey` (Task 2); `saveErrorText` (Task 2); `Sheet`, `PetAvatar`
- Produces:
  - `Field({ label: string; stack?: boolean; children: ReactNode })`: a `<label className="field">` with the label text first, so `getByLabelText(label)` finds the control
  - `DateTimeFields({ date, time, onDate, onTime, dateLabel = 'Date', timeLabel = 'Time' })`: two `Field`s with `type="date"` / `type="time"` inputs
  - `SheetHeader({ photoId?: string; species: string; title: string; subtitle?: string })`
  - CSS classes in `src/ui/husbandry.css`: `.pick-list`, `.pick`, `.pick-check`, `.check`, `.entry`, `.big-number`, `.chart*`, `.gauge*`, `.quick-log`, `.tiles`, `.tile`, `.tile.wide`, `.tile-ic`, `.thumbs`, `.thumb*`, `.photo-full`
  - `RegurgitationSheet` (default export) with props `{ pet: Pet; open: boolean; onClose: () => void; now?: Date }`, dialog title `Log regurgitation`. Meal buttons are named `"<MMM d · h:mm a>, <qty> <food>"`, e.g. `Nov 3 · 6:00 PM, 1 Pinky mouse`.

- [ ] **Step 1: Write the failing tests in `src/features/regurgitation/RegurgitationSheet.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegurgitationSheet from './RegurgitationSheet';
import { resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listFeedings, listRegurgitations, logFeeding } from '../../db/feedings';
import type { FeedingOutcome, Pet } from '../../domain/types';

const now = new Date(2026, 10, 8, 9, 0);
const at = (d: number, h = 18, m = 0) => new Date(2026, 10, d, h, m).toISOString();
let pet: Pet;

const meal = (d: number, outcome: FeedingOutcome = 'ate') =>
  logFeeding({ petId: pet.id, at: at(d), foodItem: 'Pinky mouse', quantity: 1, outcome });

function open(onClose = vi.fn()) {
  render(<RegurgitationSheet pet={pet} open onClose={onClose} now={now} />);
  return onClose;
}

beforeEach(async () => {
  await resetDb();
  pet = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse' });
});

describe('RegurgitationSheet', () => {
  it('lists the last 5 eaten meals, newest first and selected', async () => {
    for (const d of [1, 2, 3, 4, 5, 6]) await meal(d);
    await meal(7, 'refused');
    open();
    expect(screen.getByRole('dialog', { name: 'Log regurgitation' })).toBeInTheDocument();
    const picks = await screen.findAllByRole('button', { name: /Pinky mouse$/ });
    expect(picks.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Nov 6 · 6:00 PM, 1 Pinky mouse',
      'Nov 5 · 6:00 PM, 1 Pinky mouse',
      'Nov 4 · 6:00 PM, 1 Pinky mouse',
      'Nov 3 · 6:00 PM, 1 Pinky mouse',
      'Nov 2 · 6:00 PM, 1 Pinky mouse',
    ]);
    expect(picks[0]).toHaveAttribute('aria-pressed', 'true');
    expect(picks[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves against the chosen meal and pushes the next feeding back', async () => {
    await meal(2);
    await meal(5);
    const onClose = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Nov 2 · 6:00 PM, 1 Pinky mouse' }));
    fireEvent.change(screen.getByLabelText('Found date'), { target: { value: '2026-11-03' } });
    fireEvent.change(screen.getByLabelText('Found time'), { target: { value: '07:30' } });
    await userEvent.type(screen.getByLabelText('Notes'), 'Warm side was 80°');
    expect(screen.getByRole('checkbox', { name: 'Push next feeding back?' })).toBeChecked();
    expect(screen.getByLabelText('Push back (days)')).toHaveValue(10);
    expect(screen.getByText('Next feeding → Fri, Nov 13')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save regurgitation' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const [first] = await listFeedings(pet.id);
    const [r] = await listRegurgitations(pet.id);
    expect(r).toMatchObject({
      feedingId: first!.id, at: new Date(2026, 10, 3, 7, 30).toISOString(), pushBackDays: 10, notes: 'Warm side was 80°',
    });
    expect((await getPet(pet.id))!.nextFeedingOverride).toBe(new Date(2026, 10, 13, 18, 0).toISOString());
  });

  it('with push-back off it previews the normal schedule and sets no override', async () => {
    await meal(3);
    const onClose = open();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Push next feeding back?' }));
    expect(screen.queryByLabelText('Push back (days)')).toBeNull();
    expect(screen.getByText('Next feeding → Today')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Save regurgitation' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await listRegurgitations(pet.id)).toHaveLength(1);
    expect((await getPet(pet.id))!.nextFeedingOverride).toBeUndefined();
  });

  it('survives a cleared Found date and blocks saving', async () => {
    await meal(3);
    open();
    await screen.findByRole('button', { name: /Pinky mouse$/ });
    await userEvent.clear(screen.getByLabelText('Found date'));
    expect(screen.getByRole('dialog', { name: 'Log regurgitation' })).toBeInTheDocument();
    expect(screen.getByText('Next feeding → —')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
  });

  it('blocks a found time before the meal, and a bad push-back', async () => {
    await meal(3);
    open();
    await screen.findByRole('button', { name: /Pinky mouse$/ });
    fireEvent.change(screen.getByLabelText('Found date'), { target: { value: '2026-11-03' } });
    fireEvent.change(screen.getByLabelText('Found time'), { target: { value: '07:00' } });
    expect(screen.getByText('Found time is before that meal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Found time'), { target: { value: '20:00' } });
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Push back (days)'), { target: { value: '0' } });
    expect(screen.getByText('Next feeding → —')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
  });

  it('says when there is no eaten meal to pick', async () => {
    await meal(3, 'refused');
    open();
    expect(await screen.findByText(/No eaten meals logged yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save regurgitation' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/features/regurgitation`
Expected: FAIL with `Failed to resolve import "./RegurgitationSheet"`.

- [ ] **Step 3: Create `src/ui/Field.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `src/ui/SheetHeader.tsx`**

```tsx
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
```

- [ ] **Step 5: Create `src/ui/husbandry.css`** (all Plan 2 styles, so later tasks only add markup)

```css
/* ---------- pick lists (which meal came back up) ---------- */
.pick-list {
  display: grid;
  gap: 6px;
}
.pick {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
}
.pick[aria-pressed='true'] { border-color: var(--moss); }
.pick b { display: block; }
.pick-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.pick[aria-pressed='true'] .pick-check {
  background: var(--moss);
  border-color: var(--moss);
  color: var(--on-moss);
}

/* ---------- checklists (care tasks, Schedule) ---------- */
.check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--muted);
  background: transparent;
  color: var(--on-moss);
  font-weight: 800;
  flex-shrink: 0;
  padding: 0;
}
.check[aria-pressed='true'] {
  background: var(--moss);
  border-color: var(--moss);
}
.check:disabled { cursor: default; }
.entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.entry:last-child { border-bottom: 0; }

/* ---------- numbers, charts, gauges ---------- */
.big-number {
  font-family: ui-rounded, 'SF Pro Rounded', system-ui, sans-serif;
  font-weight: 800;
  font-size: 30px;
  line-height: 1.1;
}
.chart {
  display: block;
  width: 100%;
  height: auto;
}
.chart-line {
  stroke: var(--moss);
  stroke-width: 2.5;
  fill: none;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.chart-dot { fill: var(--moss); }
.chart-band { fill: var(--ok-bg); }
.chart-axis {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}
.chart-empty {
  padding: 24px 0;
  text-align: center;
}
.gauge {
  position: relative;
  height: 8px;
  margin: 10px 0 4px;
  border-radius: 6px;
  background: var(--chip);
}
.gauge-band {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 6px;
  background: var(--ok-bg);
  border: 1px solid var(--ok-text);
}
.gauge-mark {
  position: absolute;
  top: -3px;
  width: 4px;
  height: 14px;
  margin-left: -2px;
  border-radius: 3px;
  background: var(--text);
}

/* ---------- pet profile: quick log + husbandry tiles (also the Add tab) ---------- */
.quick-log {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.quick-log button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border: 0;
  border-radius: 14px;
  padding: 10px 4px;
  background: var(--card);
  box-shadow: var(--shadow);
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}
.quick-log button span { font-size: 22px; }
.tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.tile {
  display: block;
  text-align: left;
  border: 0;
  border-radius: 14px;
  padding: 10px 12px;
  background: var(--card);
  box-shadow: var(--shadow);
  color: var(--text);
  text-decoration: none;
  font: inherit;
}
.tile:disabled {
  opacity: 0.5;
  cursor: default;
}
.tile.wide { grid-column: 1 / -1; }
.tile-ic {
  display: block;
  font-size: 20px;
  margin-bottom: 4px;
}
.tile b {
  display: block;
  font-size: 15px;
}
.tile .muted { font-size: 13px; }

/* ---------- photos (vet visits) ---------- */
.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.thumb-wrap { position: relative; }
.thumb {
  display: block;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--chip);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: var(--text);
  color: var(--bg);
  font-size: 11px;
}
.photo-full {
  display: block;
  width: 100%;
  border-radius: 12px;
}
```

- [ ] **Step 6: Replace the whole of `src/main.tsx`**

```tsx
import './theme/tokens.css';
import './theme/base.css';
import './ui/ui.css';
import './ui/husbandry.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import UpdatePrompt from './app/UpdatePrompt';

// Spec §9: ask the browser not to evict our IndexedDB data.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
);
```

- [ ] **Step 7: Create `src/features/regurgitation/RegurgitationSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Pet } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { DEFAULT_PUSH_BACK_DAYS, nextFeedingDue, pushBackOverride } from '../../domain/feeding';
import { listFeedings, listRegurgitations, logRegurgitation } from '../../db/feedings';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { foodIcon } from '../feedings/foodIcon';
import { formatDay } from '../feedings/logModel';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

const mealWhen = (at: string) => format(parseISO(at), 'MMM d · h:mm a');

/** Spec §5.5: a regurgitation found after the meal was already logged. */
export default function RegurgitationSheet(props: Props) {
  // Remount the form each time the sheet opens so it starts from fresh defaults.
  if (!props.open) return null;
  return <RegurgitationForm {...props} />;
}

function RegurgitationForm({ pet, onClose, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const data = useLiveQuery(
    async () => ({ feedings: await listFeedings(pet.id), regurgitations: await listRegurgitations(pet.id) }),
    [pet.id],
  );
  const [picked, setPicked] = useState<string>();
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [notes, setNotes] = useState('');
  const [pushBack, setPushBack] = useState(true);
  const [pushBackDays, setPushBackDays] = useState(String(DEFAULT_PUSH_BACK_DAYS));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const feedings = data?.feedings ?? [];
  const alreadyLogged = new Set(data?.regurgitations.map((r) => r.feedingId));
  // listFeedings is oldest first: the last 5 eaten meals, most recent first.
  const meals = feedings.filter((f) => f.outcome === 'ate').reverse().slice(0, 5);
  const selected = meals.find((m) => m.id === picked) ?? meals[0];
  const foundAt = combineDateTime(date, time);
  const days = Number(pushBackDays);
  const daysValid = !pushBack || (Number.isInteger(days) && days >= 1);
  const beforeMeal = !!foundAt && !!selected && foundAt.getTime() < Date.parse(selected.at);
  const canSave = !!selected && !!foundAt && daysValid && !beforeMeal && !saving;
  let preview: Date | null = null;
  if (foundAt && daysValid) {
    preview = pushBack ? new Date(pushBackOverride(foundAt, pet, days)) : nextFeedingDue(pet, feedings);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave || !selected || !foundAt) return;
    setError(undefined);
    setSaving(true);
    try {
      await logRegurgitation({
        petId: pet.id,
        feedingId: selected.id,
        at: foundAt.toISOString(),
        pushBackDays: pushBack ? days : null,
        notes,
      });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log regurgitation">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Regurgitation" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}

        <div className="label">Which meal came back up?</div>
        {data && meals.length === 0 && (
          <p className="muted">No eaten meals logged yet. Log the feeding first.</p>
        )}
        <div className="pick-list">
          {meals.map((m) => {
            const on = m.id === selected?.id;
            return (
              <button
                key={m.id}
                type="button"
                className="pick"
                aria-pressed={on}
                aria-label={`${mealWhen(m.at)}, ${m.quantity} ${m.foodItem}`}
                onClick={() => setPicked(m.id)}
              >
                <span className="pick-check" aria-hidden="true">{on ? '✓' : ''}</span>
                <span className="grow">
                  <b>{mealWhen(m.at)}</b>
                  <span className="muted">
                    {`${foodIcon(m.foodItem)} ${m.quantity} ${m.foodItem}`}
                    {alreadyLogged.has(m.id) ? ' · already logged' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="label">When was it found?</div>
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} dateLabel="Found date" timeLabel="Found time" />
        {beforeMeal && <div className="form-error">Found time is before that meal.</div>}
        <Field label="Notes" stack>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <Field label="Push next feeding back?">
          <input type="checkbox" className="switch" checked={pushBack} onChange={(e) => setPushBack(e.target.checked)} />
        </Field>
        {pushBack && (
          <Field label="Push back (days)">
            <input type="number" inputMode="numeric" min={1} value={pushBackDays} onChange={(e) => setPushBackDays(e.target.value)} />
          </Field>
        )}
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Keepers usually wait 10–14 days, then offer a smaller meal.
        </div>

        <button type="submit" className="btn-primary" disabled={!canSave}>Save regurgitation</button>
        <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          {`Next feeding → ${formatDay(preview, now)}`}
        </div>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 8: Run the tests and the typecheck**

Run: `npm test -- src/features/regurgitation && npm run typecheck`
Expected: 6 tests pass, typecheck exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add the Regurgitation sheet and shared form pieces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Poop log

Spec §5.6 and §7 rule 11. The screen also introduces the shared pieces every husbandry screen uses (`subScreen.tsx`).

**Files:**
- Create: `src/domain/poop.ts`, `src/db/poops.ts`, `src/features/pets/subScreen.tsx`, `src/features/poop/LogPoopSheet.tsx`, `src/features/poop/PoopScreen.tsx`
- Modify: `src/features/pets/format.ts` (add `plural`, `formatDaysAgo`), `src/app/App.tsx` (route)
- Test: `src/domain/poop.test.ts`, `src/db/poops.test.ts`, `src/features/pets/format.test.ts`, `src/features/poop/PoopScreen.test.tsx`

**Interfaces:**
- Consumes: `listFeedings`, `getPet`, `cleanText`, `requireDateTime`, `saveErrorText`, `combineDateTime`, `dateKey`, `parseDateKey`, `Field`, `DateTimeFields`, `SheetHeader`, `Segmented`, `Sheet`, `Card`, `Pill`, `useNow`, `renderAt`
- Produces:
  - `src/domain/poop.ts`: `POOP_KINDS: readonly { value: PoopKind; label: string }[]` (Normal, Runny, Urate only, Abnormal), `poopKindLabel(kind): string`, `interface MealGap { days: number; mealAt: string }`, `daysAfterMeal(poopAt: string, feedings: readonly Feeding[]): MealGap | null`, `formatMealGap(gap: MealGap): string` (`'3 days after Nov 3 meal'`), `typicalGap(poops: readonly Poop[], feedings: readonly Feeding[]): { min: number; max: number } | null`, `formatTypicalGap(g): string` (`'Usually 3–5 days after a meal'`)
  - `src/db/poops.ts`: `interface PoopInput { petId: string; at: string; kind: PoopKind; notes?: string }`, `logPoop(input): Promise<Poop>`, `deletePoop(id): Promise<void>`, `listPoops(petId): Promise<Poop[]>` (oldest first)
  - `src/features/pets/format.ts`: `plural(n, word): string`, `formatDaysAgo(then: Date, now: Date): string` (`'today'`, `'1 day ago'`, `'2 days ago'`)
  - `src/features/pets/subScreen.tsx`: `useRoutePet(): Pet | null | undefined` (the `:id` route param's pet; `undefined` while loading, `null` if missing), `PetNotFound()`, `SubScreenHeader({ pet, title, subtitle?, addLabel?, onAdd? })` (back link `‹ <name>` to the profile, a `＋` button named `addLabel`, the `h1`), `confirmDelete(what: string, remove: () => Promise<unknown>): Promise<void>`
  - `LogPoopSheet` (default export): props `{ pet, open, onClose, now? }`, title `Log poop`
  - Route `/pets/:id/poop` → `PoopScreen` (`h1` "Poop log")

- [ ] **Step 1: Write the failing tests in `src/domain/poop.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Feeding, FeedingOutcome, Poop } from './types';
import { daysAfterMeal, formatMealGap, formatTypicalGap, poopKindLabel, typicalGap } from './poop';

const t = (m: number, d: number, h = 18) => new Date(2026, m, d, h, 0).toISOString();
const feeding = (at: string, outcome: FeedingOutcome = 'ate'): Feeding => ({
  id: at, petId: 'p1', at, foodItem: 'Pinky mouse', quantity: 1, outcome, createdAt: at, updatedAt: at,
});
const poop = (at: string): Poop => ({ id: at, petId: 'p1', at, kind: 'normal', createdAt: at, updatedAt: at });

describe('daysAfterMeal (spec §7 rule 11)', () => {
  const feedings = [feeding(t(9, 22)), feeding(t(10, 3)), feeding(t(10, 5), 'refused'), feeding(t(10, 7))];

  it('counts calendar days from the latest eaten meal on or before the poop', () => {
    expect(daysAfterMeal(t(10, 6, 8), feedings)).toEqual({ days: 3, mealAt: t(10, 3) });
  });
  it('ignores refusals and meals after the poop', () => {
    expect(daysAfterMeal(t(10, 5, 20), feedings)!.mealAt).toBe(t(10, 3));
  });
  it('a poop the same day as a meal counts 0 days', () => {
    expect(daysAfterMeal(t(10, 7, 21), feedings)).toEqual({ days: 0, mealAt: t(10, 7) });
  });
  it('is null when no meal came before it', () => {
    expect(daysAfterMeal(t(9, 20), feedings)).toBeNull();
  });
  it('formats the gap', () => {
    expect(formatMealGap({ days: 3, mealAt: t(10, 3) })).toBe('3 days after Nov 3 meal');
    expect(formatMealGap({ days: 1, mealAt: t(10, 3) })).toBe('1 day after Nov 3 meal');
    expect(formatMealGap({ days: 0, mealAt: t(10, 3) })).toBe('Same day as Nov 3 meal');
  });
});

describe('typicalGap', () => {
  const feedings = [feeding(t(9, 1)), feeding(t(9, 11)), feeding(t(9, 22)), feeding(t(10, 3))];

  it('is the range over the most recent poops that follow a meal', () => {
    const poops = [poop(t(9, 4, 8)), poop(t(9, 16, 8)), poop(t(9, 26, 8)), poop(t(10, 6, 8))];
    expect(typicalGap(poops, feedings)).toEqual({ min: 3, max: 5 });
  });
  it('needs at least two', () => {
    expect(typicalGap([poop(t(10, 6, 8))], feedings)).toBeNull();
  });
  it('uses only the 5 most recent poops', () => {
    const poops = [poop(t(9, 10, 8)), ...[4, 5, 6, 7, 8].map((d) => poop(t(10, d, 8)))];
    // Oct 10 is 9 days after the Oct 1 meal but is the 6th most recent poop, so it is left out.
    expect(typicalGap(poops, feedings)).toEqual({ min: 1, max: 5 });
  });
  it('formats the range', () => {
    expect(formatTypicalGap({ min: 3, max: 5 })).toBe('Usually 3–5 days after a meal');
    expect(formatTypicalGap({ min: 4, max: 4 })).toBe('Usually 4 days after a meal');
    expect(formatTypicalGap({ min: 1, max: 1 })).toBe('Usually 1 day after a meal');
  });
});

it('labels poop kinds', () => {
  expect(poopKindLabel('urate_only')).toBe('Urate only');
});
```

- [ ] **Step 2: Write the failing tests in `src/db/poops.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet } from './pets';
import { deletePoop, listPoops, logPoop } from './poops';
import { ValidationError } from './ids';

const at = (d: number, h = 8) => new Date(2026, 10, d, h, 0).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs poops, trims notes and lists them oldest first', async () => {
  await logPoop({ petId, at: at(6), kind: 'normal' });
  const runny = await logPoop({ petId, at: at(2), kind: 'runny', notes: '  a bit runny  ' });
  expect(runny.notes).toBe('a bit runny');
  expect((await listPoops(petId)).map((p) => p.at)).toEqual([at(2), at(6)]);
  await deletePoop(runny.id);
  expect(await listPoops(petId)).toHaveLength(1);
});

it('rejects a bad time, a bad kind and a missing pet', async () => {
  await expect(logPoop({ petId, at: '', kind: 'normal' })).rejects.toBeInstanceOf(ValidationError);
  // @ts-expect-error not a PoopKind
  await expect(logPoop({ petId, at: at(6), kind: 'green' })).rejects.toBeInstanceOf(ValidationError);
  await expect(logPoop({ petId: 'missing', at: at(6), kind: 'normal' })).rejects.toThrow('not found');
  expect(await listPoops(petId)).toEqual([]);
});
```

- [ ] **Step 3: Replace the whole of `src/features/pets/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDaysAgo, formatDue, plural } from './format';

const now = new Date(2026, 10, 8, 9, 0);

describe('formatDue', () => {
  it('names today and tomorrow, otherwise shows the date', () => {
    expect(formatDue(new Date(2026, 10, 8, 18, 0), now)).toBe('Today · 6:00 PM');
    expect(formatDue(new Date(2026, 10, 9, 18, 0), now)).toBe('Tomorrow · 6:00 PM');
    expect(formatDue(new Date(2026, 10, 13, 18, 30), now)).toBe('Fri, Nov 13 · 6:30 PM');
    expect(formatDue(null, now)).toBe('No feedings yet');
  });
});

describe('formatDateKey', () => {
  it('formats a stored date or shows a dash', () => {
    expect(formatDateKey('2026-03-03')).toBe('Mar 3, 2026');
    expect(formatDateKey(undefined)).toBe('—');
  });
});

describe('plural / formatDaysAgo', () => {
  it('pluralizes', () => {
    expect(plural(1, 'note')).toBe('1 note');
    expect(plural(3, 'note')).toBe('3 notes');
  });
  it('counts calendar days back', () => {
    expect(formatDaysAgo(new Date(2026, 10, 8, 7, 0), now)).toBe('today');
    expect(formatDaysAgo(new Date(2026, 10, 7, 23, 0), now)).toBe('1 day ago');
    expect(formatDaysAgo(new Date(2026, 10, 6, 8, 0), now)).toBe('2 days ago');
  });
});
```

- [ ] **Step 4: Write the failing tests in `src/features/poop/PoopScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PoopScreen from './PoopScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { listPoops, logPoop } from '../../db/poops';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
const t = (m: number, d: number, h = 18) => new Date(2026, m, d, h, 0).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  await logFeeding({ petId, at: t(9, 22), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await logFeeding({ petId, at: t(10, 3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
  await logPoop({ petId, at: t(9, 26, 9), kind: 'normal' });
  await logPoop({ petId, at: t(10, 6, 8), kind: 'normal', notes: 'Big one' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPoop() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/poop`]}>
      <Routes>
        <Route path="/pets/:id/poop" element={<PoopScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PoopScreen', () => {
  it('shows the last poop, the typical gap and a labelled history', async () => {
    renderPoop();
    expect(await screen.findByRole('heading', { name: 'Poop log' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Noodle' })).toHaveAttribute('href', `/pets/${petId}`);
    expect(screen.getByText('Fri, Nov 6 · 2 days ago')).toBeInTheDocument();
    expect(screen.getByText('Usually 3–4 days after a meal')).toBeInTheDocument();
    const items = await screen.findAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Nov 6 · 3 days after Nov 3 meal');
    expect(items[0]).toHaveTextContent('Big one');
    expect(items[1]).toHaveTextContent('Oct 26 · 4 days after Oct 22 meal');
  });

  it('logs a poop in one tap with the chosen kind', async () => {
    renderPoop();
    await userEvent.click(await screen.findByRole('radio', { name: 'Runny' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log poop now' }));
    await vi.waitFor(async () => expect(await listPoops(petId)).toHaveLength(3));
    expect((await listPoops(petId)).at(-1)).toMatchObject({ kind: 'runny', at: now.toISOString() });
  });

  it('logs an earlier poop from the sheet', async () => {
    renderPoop();
    await userEvent.click(await screen.findByRole('button', { name: 'Log poop' }));
    const sheet = screen.getByRole('dialog', { name: 'Log poop' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Abnormal' }));
    fireEvent.change(within(sheet).getByLabelText('Date'), { target: { value: '2026-11-07' } });
    await userEvent.type(within(sheet).getByLabelText('Notes'), 'Mucus');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save poop' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await listPoops(petId)).at(-1)).toMatchObject({
      kind: 'abnormal', notes: 'Mucus', at: new Date(2026, 10, 7, 9, 0).toISOString(),
    });
  });

  it('a cleared date in the sheet blocks saving without crashing', async () => {
    renderPoop();
    await userEvent.click(await screen.findByRole('button', { name: 'Log poop' }));
    const sheet = screen.getByRole('dialog', { name: 'Log poop' });
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save poop' })).toBeDisabled();
  });

  it('deletes an entry after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPoop();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listPoops(petId)).toHaveLength(1));
  });

  it('is routed at /pets/:id/poop', async () => {
    renderAt(`/pets/${petId}/poop`);
    expect(await screen.findByRole('heading', { name: 'Poop log' })).toBeInTheDocument();
  });

  it('says when the pet does not exist', async () => {
    renderAt('/pets/missing/poop');
    expect(await screen.findByText('Pet not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run them and confirm they fail**

Run: `npm test -- src/domain/poop.test.ts src/db/poops.test.ts src/features/pets/format.test.ts src/features/poop`
Expected: FAIL. `Failed to resolve import "./poop"`, `"./poops"`, `"./PoopScreen"`; `formatDaysAgo is not a function`.

- [ ] **Step 6: Create `src/domain/poop.ts`**

```ts
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Feeding, Poop, PoopKind } from './types';

export const POOP_KINDS: readonly { value: PoopKind; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'runny', label: 'Runny' },
  { value: 'urate_only', label: 'Urate only' },
  { value: 'abnormal', label: 'Abnormal' },
];

export const poopKindLabel = (kind: PoopKind): string => POOP_KINDS.find((k) => k.value === kind)?.label ?? kind;

export interface MealGap {
  days: number;
  mealAt: string;
}

/** Spec §7 rule 11: calendar days from the latest eaten meal on or before the poop. */
export function daysAfterMeal(poopAt: string, feedings: readonly Feeding[]): MealGap | null {
  const poopTime = Date.parse(poopAt);
  let meal: Feeding | undefined;
  for (const f of feedings) {
    if (f.outcome !== 'ate') continue;
    const t = Date.parse(f.at);
    if (t <= poopTime && (!meal || t > Date.parse(meal.at))) meal = f;
  }
  if (!meal) return null;
  return { days: differenceInCalendarDays(parseISO(poopAt), parseISO(meal.at)), mealAt: meal.at };
}

export function formatMealGap(gap: MealGap): string {
  const meal = format(parseISO(gap.mealAt), 'MMM d');
  if (gap.days === 0) return `Same day as ${meal} meal`;
  return `${gap.days} day${gap.days === 1 ? '' : 's'} after ${meal} meal`;
}

/** "Usually 3–5 days after a meal": the range over the 5 most recent poops that follow a meal. Needs 2. */
export function typicalGap(poops: readonly Poop[], feedings: readonly Feeding[]): { min: number; max: number } | null {
  const gaps = [...poops]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 5)
    .map((p) => daysAfterMeal(p.at, feedings))
    .filter((g): g is MealGap => g !== null)
    .map((g) => g.days);
  if (gaps.length < 2) return null;
  return { min: Math.min(...gaps), max: Math.max(...gaps) };
}

export function formatTypicalGap({ min, max }: { min: number; max: number }): string {
  const days = min === max ? `${min} day${min === 1 ? '' : 's'}` : `${min}–${max} days`;
  return `Usually ${days} after a meal`;
}
```

- [ ] **Step 7: Create `src/db/poops.ts`**

```ts
import Dexie from 'dexie';
import type { Poop, PoopKind } from '../domain/types';
import { POOP_KINDS } from '../domain/poop';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface PoopInput {
  petId: string;
  at: string;
  kind: PoopKind;
  notes?: string;
}

export async function logPoop(input: PoopInput): Promise<Poop> {
  requireDateTime(input.at, 'Pick when it happened');
  if (!POOP_KINDS.some((k) => k.value === input.kind)) throw new ValidationError('Pick what it looked like');
  return db.transaction('rw', [db.pets, db.poops], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const poop: Poop = {
      id: newId(), petId: input.petId, at: input.at, kind: input.kind, notes: cleanText(input.notes),
      createdAt: ts, updatedAt: ts,
    };
    await db.poops.add(poop);
    return poop;
  });
}

export async function deletePoop(id: string): Promise<void> {
  await db.poops.delete(id);
}

export const listPoops = (petId: string): Promise<Poop[]> =>
  db.poops.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
```

- [ ] **Step 8: Replace the whole of `src/features/pets/format.ts`**

```ts
import { differenceInCalendarDays, format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';

export function formatDue(due: Date | null, now: Date): string {
  if (!due) return 'No feedings yet';
  const days = differenceInCalendarDays(due, now);
  const time = format(due, 'h:mm a');
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  return `${format(due, 'EEE, MMM d')} · ${time}`;
}

export function formatDateKey(key?: string): string {
  return key ? format(parseDateKey(key), 'MMM d, yyyy') : '—';
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Calendar days back from `now`: "today", "1 day ago", "N days ago". */
export function formatDaysAgo(then: Date, now: Date): string {
  const n = differenceInCalendarDays(now, then);
  if (n <= 0) return 'today';
  return `${plural(n, 'day')} ago`;
}
```

- [ ] **Step 9: Create `src/features/pets/subScreen.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Pet } from '../../domain/types';
import { getPet } from '../../db/pets';
import { Card } from '../../ui/Card';

/** The pet named by the `:id` route param: undefined while loading, null when it doesn't exist. */
export function useRoutePet(): Pet | null | undefined {
  const { id } = useParams();
  return useLiveQuery(async () => (id ? ((await getPet(id)) ?? null) : null), [id]);
}

export function PetNotFound() {
  return (
    <Card>
      <h2>Pet not found</h2>
      <Link to="/">Back to My Reptiles</Link>
    </Card>
  );
}

interface SubScreenHeaderProps {
  pet: Pet;
  title: string;
  subtitle?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
}

/** Top of every husbandry screen: "‹ <pet>" back to the profile, a ＋ button and the title. */
export function SubScreenHeader({ pet, title, subtitle, addLabel, onAdd }: SubScreenHeaderProps) {
  return (
    <>
      <div className="topbar">
        <Link to={`/pets/${pet.id}`}>{`‹ ${pet.name}`}</Link>
        {onAdd && (
          <button type="button" aria-label={addLabel} onClick={onAdd} style={{ fontSize: 22 }}>＋</button>
        )}
      </div>
      <h1>{title}</h1>
      {subtitle && <div className="muted">{subtitle}</div>}
    </>
  );
}

/** Asks first, then deletes; a failed delete shows an alert instead of failing silently (spec §11). */
export async function confirmDelete(what: string, remove: () => Promise<unknown>): Promise<void> {
  if (!window.confirm(`Delete this ${what}? This can’t be undone.`)) return;
  try {
    await remove();
  } catch {
    window.alert('Could not delete. Please try again.');
  }
}
```

- [ ] **Step 10: Create `src/features/poop/LogPoopSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import type { Pet, PoopKind } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { POOP_KINDS } from '../../domain/poop';
import { logPoop } from '../../db/poops';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogPoopSheet(props: Props) {
  if (!props.open) return null;
  return <PoopForm {...props} />;
}

function PoopForm({ pet, onClose, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [kind, setKind] = useState<PoopKind>('normal');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const at = combineDateTime(date, time);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!at) return;
    setError(undefined);
    setSaving(true);
    try {
      await logPoop({ petId: pet.id, at: at.toISOString(), kind, notes });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log poop">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Poop" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <div className="label">What did it look like?</div>
        <Segmented label="Kind" options={POOP_KINDS} value={kind} onChange={setKind} />
        <div className="label">When</div>
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label="Notes" stack>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary" disabled={saving || !at}>Save poop</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 11: Create `src/features/poop/PoopScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { PoopKind } from '../../domain/types';
import { daysAfterMeal, formatMealGap, formatTypicalGap, POOP_KINDS, poopKindLabel, typicalGap } from '../../domain/poop';
import { listFeedings } from '../../db/feedings';
import { deletePoop, listPoops, logPoop } from '../../db/poops';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { Segmented } from '../../ui/Segmented';
import { useNow } from '../../ui/useNow';
import { formatDaysAgo } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import LogPoopSheet from './LogPoopSheet';

const KIND_TONE: Record<PoopKind, PillTone> = { normal: 'ok', runny: 'due', urate_only: 'neutral', abnormal: 'late' };

export default function PoopScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const data = useLiveQuery(
    async () => (petId ? { poops: await listPoops(petId), feedings: await listFeedings(petId) } : undefined),
    [petId],
  );
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<PoopKind>('normal');
  const [error, setError] = useState<string>();

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!data) return null;
  const { poops, feedings } = data;
  const history = [...poops].reverse();
  const last = history[0];
  const gap = typicalGap(poops, feedings);

  const logNow = async () => {
    setError(undefined);
    try {
      await logPoop({ petId: pet.id, at: now.toISOString(), kind });
    } catch (err) {
      setError(saveErrorText(err));
    }
  };

  return (
    <>
      <SubScreenHeader pet={pet} title="Poop log" addLabel="Log poop" onAdd={() => setAdding(true)} />

      <Card style={{ marginTop: 12 }}>
        {last ? (
          <div className="row">
            <div className="grow">
              <div className="label" style={{ margin: 0 }}>Last poop</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {`${format(parseISO(last.at), 'EEE, MMM d')} · ${formatDaysAgo(parseISO(last.at), now)}`}
              </div>
              {gap && <div className="muted">{formatTypicalGap(gap)}</div>}
            </div>
            <Pill tone={KIND_TONE[last.kind]}>{poopKindLabel(last.kind)}</Pill>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No poops logged yet.</p>
        )}
      </Card>

      <div className="label">Log one</div>
      <Card>
        <Segmented label="What did it look like?" options={POOP_KINDS} value={kind} onChange={setKind} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={logNow}>
          <span aria-hidden="true">💩 </span>Log poop now
        </button>
      </Card>

      <div className="label">History</div>
      {history.length === 0 && <p className="muted">Nothing logged yet.</p>}
      {history.map((p) => {
        const mealGap = daysAfterMeal(p.at, feedings);
        return (
          <Card key={p.id} role="article">
            <div className="row">
              <div className="grow">
                <b>{format(parseISO(p.at), 'MMM d')}</b>
                {mealGap && <span className="muted">{` · ${formatMealGap(mealGap)}`}</span>}
                {p.notes && <div style={{ marginTop: 2 }}>{p.notes}</div>}
              </div>
              <Pill tone={KIND_TONE[p.kind]}>{poopKindLabel(p.kind)}</Pill>
              <button type="button" className="btn btn-danger" onClick={() => confirmDelete('poop entry', () => deletePoop(p.id))}>
                Delete
              </button>
            </div>
          </Card>
        );
      })}

      <LogPoopSheet pet={pet} open={adding} onClose={() => setAdding(false)} now={now} />
    </>
  );
}
```

- [ ] **Step 12: Replace the whole of `src/app/App.tsx`** (adds the Poop route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 13: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add the Poop log with days-after-meal and one-tap logging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sheds with prediction and Mark "in blue"

Spec §5.7 and §7 rule 8. Mark "in blue" needs somewhere to keep the date until the shed happens, so it is stored on the pet as `inBlueSince` (added in Task 2). Logging the next shed copies it into the shed's `inBlueDate` (the sheet pre-fills it) and clears it.

**Files:**
- Create: `src/domain/sheds.ts`, `src/db/sheds.ts`, `src/features/sheds/LogShedSheet.tsx`, `src/features/sheds/ShedsScreen.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/domain/sheds.test.ts`, `src/db/sheds.test.ts`, `src/features/sheds/ShedsScreen.test.tsx`

**Interfaces:**
- Consumes: `parseDateKey`, `dateKey`, `isDateKey` (Task 2), `cleanText`, `requireDateKey`, `saveErrorText` (Task 2), `useRoutePet`, `PetNotFound`, `SubScreenHeader`, `confirmDelete` (Task 4), `formatDateKey` (Plan 1), `Field`, `SheetHeader` (Task 3), `Segmented`, `Sheet`, `Card`, `Pill`, `useNow`
- Produces:
  - `src/domain/sheds.ts`: `SHED_QUALITIES: readonly { value: ShedQuality; label: string }[]` (Complete, Partial, Stuck), `shedQualityLabel(q): string`, `interface ShedPrediction { date: Date; averageDays: number }`, `predictNextShed(sheds: readonly Pick<Shed, 'date'>[]): ShedPrediction | null`, `shedEtaLabel(date: Date, now: Date): string` (`'In 15 days'`, `'Tomorrow'`, `'Today'`, `'3 days overdue'`)
  - `src/db/sheds.ts`: `interface ShedInput { petId: string; date: string; quality: ShedQuality; inBlueDate?: string; notes?: string }`, `logShed(input): Promise<Shed>` (clears `pet.inBlueSince` when the shed is on or after it), `markInBlue(petId: string, date: string): Promise<void>`, `clearInBlue(petId: string): Promise<void>`, `deleteShed(id): Promise<void>`, `listSheds(petId): Promise<Shed[]>` (oldest first)
  - `LogShedSheet` (default export): props `{ pet, open, onClose, now? }`, title `Log shed`
  - Route `/pets/:id/sheds` → `ShedsScreen` (`h1` "Sheds")

- [ ] **Step 1: Write the failing tests in `src/domain/sheds.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { dateKey } from './dates';
import { predictNextShed, shedEtaLabel } from './sheds';

const shed = (date: string) => ({ date });

describe('predictNextShed (spec §7 rule 8)', () => {
  it('needs 2 or more sheds', () => {
    expect(predictNextShed([])).toBeNull();
    expect(predictNextShed([shed('2026-10-21')])).toBeNull();
  });

  it('is the last shed + the average gap', () => {
    const p = predictNextShed([shed('2026-10-21'), shed('2026-09-18'), shed('2026-08-16')])!;
    expect(p.averageDays).toBe(33);
    expect(dateKey(p.date)).toBe('2026-11-23');
  });

  it('averages only the most recent 5 gaps', () => {
    // A 100-day gap at the start, then five 30-day gaps (input out of order on purpose).
    const dates = ['2026-06-10', '2026-01-01', '2026-09-08', '2026-04-11', '2026-08-09', '2026-05-11', '2026-07-10'];
    const p = predictNextShed(dates.map(shed))!;
    expect(p.averageDays).toBe(30);
    expect(dateKey(p.date)).toBe('2026-10-08');
  });
});

describe('shedEtaLabel', () => {
  const now = new Date(2026, 10, 8, 9, 0);
  it('counts calendar days', () => {
    expect(shedEtaLabel(new Date(2026, 10, 23), now)).toBe('In 15 days');
    expect(shedEtaLabel(new Date(2026, 10, 9), now)).toBe('Tomorrow');
    expect(shedEtaLabel(new Date(2026, 10, 8), now)).toBe('Today');
    expect(shedEtaLabel(new Date(2026, 10, 7), now)).toBe('1 day overdue');
    expect(shedEtaLabel(new Date(2026, 10, 5), now)).toBe('3 days overdue');
  });
});
```

- [ ] **Step 2: Write the failing tests in `src/db/sheds.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet, getPet } from './pets';
import { clearInBlue, deleteShed, listSheds, logShed, markInBlue } from './sheds';
import { ValidationError } from './ids';

let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs sheds oldest first and deletes them', async () => {
  await logShed({ petId, date: '2026-10-21', quality: 'complete', inBlueDate: '2026-10-14' });
  const stuck = await logShed({ petId, date: '2026-08-16', quality: 'stuck', notes: ' tail tip ' });
  expect(stuck.notes).toBe('tail tip');
  expect((await listSheds(petId)).map((s) => s.date)).toEqual(['2026-08-16', '2026-10-21']);
  await deleteShed(stuck.id);
  expect(await listSheds(petId)).toHaveLength(1);
});

it('logging the shed clears "in blue"; a backfilled older shed does not', async () => {
  await markInBlue(petId, '2026-11-04');
  expect((await getPet(petId))!.inBlueSince).toBe('2026-11-04');
  await logShed({ petId, date: '2026-09-18', quality: 'complete' });
  expect((await getPet(petId))!.inBlueSince).toBe('2026-11-04');
  await logShed({ petId, date: '2026-11-08', quality: 'complete', inBlueDate: '2026-11-04' });
  expect((await getPet(petId))!.inBlueSince).toBeUndefined();
});

it('clearInBlue removes the mark', async () => {
  await markInBlue(petId, '2026-11-04');
  await clearInBlue(petId);
  expect((await getPet(petId))!.inBlueSince).toBeUndefined();
});

it('rejects bad dates and a missing pet', async () => {
  await expect(logShed({ petId, date: '', quality: 'complete' })).rejects.toBeInstanceOf(ValidationError);
  await expect(
    logShed({ petId, date: '2026-11-08', quality: 'complete', inBlueDate: '2026-11-09' }),
  ).rejects.toThrow('on or before the shed date');
  await expect(logShed({ petId: 'missing', date: '2026-11-08', quality: 'complete' })).rejects.toThrow('not found');
  await expect(markInBlue('missing', '2026-11-08')).rejects.toThrow('not found');
  expect(await listSheds(petId)).toEqual([]);
});
```

- [ ] **Step 3: Write the failing tests in `src/features/sheds/ShedsScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShedsScreen from './ShedsScreen';
import { resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listSheds, logShed } from '../../db/sheds';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function threeSheds() {
  await logShed({ petId, date: '2026-08-16', quality: 'partial', notes: 'Stuck on the tail tip, soaked 15 min' });
  await logShed({ petId, date: '2026-09-18', quality: 'complete' });
  await logShed({ petId, date: '2026-10-21', quality: 'complete', inBlueDate: '2026-10-14' });
}

function renderSheds() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/sheds`]}>
      <Routes>
        <Route path="/pets/:id/sheds" element={<ShedsScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ShedsScreen', () => {
  it('predicts the next shed and lists the history newest first', async () => {
    await threeSheds();
    renderSheds();
    expect(await screen.findByText('Around Nov 23')).toBeInTheDocument();
    expect(screen.getByText('Sheds every ~33 days')).toBeInTheDocument();
    expect(screen.getByText('In 15 days')).toHaveClass('pill-ok');
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Oct 21, 2026');
    expect(items[0]).toHaveTextContent('Complete · in blue Oct 14');
    expect(items[2]).toHaveTextContent('Aug 16, 2026');
    expect(within(items[2]!).getByText('Partial', { selector: '.pill' })).toHaveClass('pill-due');
    expect(items[2]).toHaveTextContent('Stuck on the tail tip, soaked 15 min');
  });

  it('shows no prediction before 2 sheds', async () => {
    await logShed({ petId, date: '2026-10-21', quality: 'complete' });
    renderSheds();
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.queryByText('Next shed expected')).toBeNull();
    expect(screen.queryByRole('button', { name: /in blue/ })).toBeNull();
  });

  it('marks "in blue", then the logged shed keeps that date and clears the mark', async () => {
    await threeSheds();
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark "in blue" (eyes cloudy)' }));
    expect(await screen.findByText('In blue since Nov 8')).toBeInTheDocument();
    expect((await getPet(petId))!.inBlueSince).toBe('2026-11-08');

    await userEvent.click(screen.getByRole('button', { name: 'Log shed' }));
    const sheet = screen.getByRole('dialog', { name: 'Log shed' });
    expect(within(sheet).getByLabelText('Went into blue')).toHaveValue('2026-11-08');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save shed' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await listSheds(petId)).at(-1)).toMatchObject({ date: '2026-11-08', inBlueDate: '2026-11-08', quality: 'complete' });
    expect((await getPet(petId))!.inBlueSince).toBeUndefined();
  });

  it('can take the "in blue" mark back', async () => {
    await threeSheds();
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark "in blue" (eyes cloudy)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Not in blue' }));
    expect(await screen.findByRole('button', { name: 'Mark "in blue" (eyes cloudy)' })).toBeInTheDocument();
    expect((await getPet(petId))!.inBlueSince).toBeUndefined();
  });

  it('logs a stuck shed with notes and rejects an in-blue date after the shed', async () => {
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Log shed' }));
    const sheet = screen.getByRole('dialog', { name: 'Log shed' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Stuck' }));
    fireEvent.change(within(sheet).getByLabelText('Went into blue'), { target: { value: '2026-11-09' } });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save shed' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('on or before the shed date');

    fireEvent.change(within(sheet).getByLabelText('Went into blue'), { target: { value: '' } });
    await userEvent.type(within(sheet).getByLabelText('Notes'), 'Eye caps stuck');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save shed' }));
    await vi.waitFor(async () => expect(await listSheds(petId)).toHaveLength(1));
    expect((await listSheds(petId))[0]).toMatchObject({ quality: 'stuck', notes: 'Eye caps stuck', date: '2026-11-08' });
  });

  it('a cleared shed date blocks saving without crashing', async () => {
    renderSheds();
    await userEvent.click(await screen.findByRole('button', { name: 'Log shed' }));
    const sheet = screen.getByRole('dialog', { name: 'Log shed' });
    await userEvent.clear(within(sheet).getByLabelText('Shed date'));
    expect(within(sheet).getByRole('button', { name: 'Save shed' })).toBeDisabled();
  });

  it('deletes a shed after confirmation', async () => {
    await threeSheds();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSheds();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listSheds(petId)).toHaveLength(2));
  });

  it('is routed at /pets/:id/sheds', async () => {
    renderAt(`/pets/${petId}/sheds`);
    expect(await screen.findByRole('heading', { name: 'Sheds' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/domain/sheds.test.ts src/db/sheds.test.ts src/features/sheds`
Expected: FAIL with `Failed to resolve import "./sheds"` / `"./ShedsScreen"`.

- [ ] **Step 5: Create `src/domain/sheds.ts`**

```ts
import { addDays, differenceInCalendarDays } from 'date-fns';
import type { Shed, ShedQuality } from './types';
import { parseDateKey } from './dates';

export const SHED_QUALITIES: readonly { value: ShedQuality; label: string }[] = [
  { value: 'complete', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'stuck', label: 'Stuck' },
];

export const shedQualityLabel = (q: ShedQuality): string => SHED_QUALITIES.find((s) => s.value === q)?.label ?? q;

export interface ShedPrediction {
  date: Date;
  averageDays: number;
}

/** Spec §7 rule 8: needs 2+ sheds; averages the gaps between the most recent sheds (up to 5 gaps). */
export function predictNextShed(sheds: readonly Pick<Shed, 'date'>[]): ShedPrediction | null {
  if (sheds.length < 2) return null;
  const days = sheds
    .map((s) => parseDateKey(s.date))
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(-6);
  const gaps = days.slice(1).map((d, i) => differenceInCalendarDays(d, days[i]!));
  const averageDays = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
  return { date: addDays(days[days.length - 1]!, averageDays), averageDays };
}

export function shedEtaLabel(date: Date, now: Date): string {
  const d = differenceInCalendarDays(date, now);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 1) return `In ${d} days`;
  return `${-d} day${d === -1 ? '' : 's'} overdue`;
}
```

- [ ] **Step 6: Create `src/db/sheds.ts`**

```ts
import Dexie from 'dexie';
import type { Shed, ShedQuality } from '../domain/types';
import { SHED_QUALITIES } from '../domain/sheds';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateKey, ValidationError } from './ids';

export interface ShedInput {
  petId: string;
  date: string;
  quality: ShedQuality;
  inBlueDate?: string;
  notes?: string;
}

export async function logShed(input: ShedInput): Promise<Shed> {
  requireDateKey(input.date, 'Pick the shed date');
  const inBlueDate = cleanText(input.inBlueDate);
  if (inBlueDate !== undefined) {
    requireDateKey(inBlueDate, 'Pick the “in blue” date');
    if (inBlueDate > input.date) throw new ValidationError('“In blue” must be on or before the shed date');
  }
  if (!SHED_QUALITIES.some((q) => q.value === input.quality)) throw new ValidationError('Pick how the shed went');
  return db.transaction('rw', [db.pets, db.sheds], async () => {
    const pet = await db.pets.get(input.petId);
    if (!pet) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const shed: Shed = {
      id: newId(), petId: pet.id, date: input.date, inBlueDate, quality: input.quality,
      notes: cleanText(input.notes), createdAt: ts, updatedAt: ts,
    };
    await db.sheds.add(shed);
    // The shed the pet was "in blue" for has happened. A backfilled older shed leaves the mark alone.
    if (pet.inBlueSince && input.date >= pet.inBlueSince) {
      await db.pets.update(pet.id, { inBlueSince: undefined, updatedAt: ts });
    }
    return shed;
  });
}

/** Spec §5.7 Mark "in blue": remembered on the pet until the next shed is logged. */
export async function markInBlue(petId: string, date: string): Promise<void> {
  requireDateKey(date);
  const changed = await db.pets.update(petId, { inBlueSince: date, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${petId} not found`);
}

export async function clearInBlue(petId: string): Promise<void> {
  const changed = await db.pets.update(petId, { inBlueSince: undefined, updatedAt: nowIso() });
  if (!changed) throw new Error(`Pet ${petId} not found`);
}

export async function deleteShed(id: string): Promise<void> {
  await db.sheds.delete(id);
}

export const listSheds = (petId: string): Promise<Shed[]> =>
  db.sheds.where('[petId+date]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
```

- [ ] **Step 7: Create `src/features/sheds/LogShedSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { Pet, ShedQuality } from '../../domain/types';
import { dateKey, isDateKey } from '../../domain/dates';
import { SHED_QUALITIES } from '../../domain/sheds';
import { logShed } from '../../db/sheds';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogShedSheet(props: Props) {
  if (!props.open) return null;
  return <ShedForm {...props} />;
}

function ShedForm({ pet, onClose, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [quality, setQuality] = useState<ShedQuality>('complete');
  const [inBlue, setInBlue] = useState(pet.inBlueSince ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const valid = isDateKey(date) && (inBlue === '' || isDateKey(inBlue));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(undefined);
    setSaving(true);
    try {
      await logShed({ petId: pet.id, date, quality, inBlueDate: inBlue || undefined, notes });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log shed">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Shed" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Shed date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="label">How did it go?</div>
        <Segmented label="Quality" options={SHED_QUALITIES} value={quality} onChange={setQuality} />
        <Field label="Went into blue">
          <input type="date" value={inBlue} onChange={(e) => setInBlue(e.target.value)} />
        </Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Optional: the day its eyes turned cloudy.</div>
        <Field label="Notes" stack>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary" disabled={saving || !valid}>Save shed</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `src/features/sheds/ShedsScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, format } from 'date-fns';
import type { ShedQuality } from '../../domain/types';
import { dateKey, parseDateKey } from '../../domain/dates';
import { predictNextShed, shedEtaLabel, shedQualityLabel } from '../../domain/sheds';
import { clearInBlue, deleteShed, listSheds, markInBlue } from '../../db/sheds';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import { formatDateKey } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import LogShedSheet from './LogShedSheet';

const QUALITY_TONE: Record<ShedQuality, PillTone> = { complete: 'ok', partial: 'due', stuck: 'late' };

export default function ShedsScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const sheds = useLiveQuery(() => (petId ? listSheds(petId) : undefined), [petId]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!sheds) return null;
  const prediction = predictNextShed(sheds);
  const history = [...sheds].reverse();

  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(saveErrorText(err));
    }
  };

  return (
    <>
      <SubScreenHeader pet={pet} title="Sheds" addLabel="Log shed" onAdd={() => setAdding(true)} />

      {prediction && (
        <Card style={{ marginTop: 12 }}>
          <div className="row">
            <div className="grow">
              <div className="label" style={{ margin: 0 }}>Next shed expected</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{`Around ${format(prediction.date, 'MMM d')}`}</div>
              <div className="muted">{`Sheds every ~${prediction.averageDays} days`}</div>
            </div>
            <Pill tone={differenceInCalendarDays(prediction.date, now) > 0 ? 'ok' : 'due'}>
              {shedEtaLabel(prediction.date, now)}
            </Pill>
          </div>
          {error && <div role="alert" className="form-error">{error}</div>}
          {pet.inBlueSince ? (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="grow">
                <span aria-hidden="true">👁️ </span>
                {`In blue since ${format(parseDateKey(pet.inBlueSince), 'MMM d')}`}
              </span>
              <button type="button" className="btn" onClick={() => run(() => clearInBlue(pet.id))}>Not in blue</button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              style={{ marginTop: 10 }}
              onClick={() => run(() => markInBlue(pet.id, dateKey(now)))}
            >
              <span aria-hidden="true">👁️ </span>Mark "in blue" (eyes cloudy)
            </button>
          )}
        </Card>
      )}

      <div className="label">History</div>
      {history.length === 0 && <p className="muted">No sheds logged yet.</p>}
      {history.map((s) => (
        <Card key={s.id} role="article">
          <div className="row">
            <div className="grow">
              <b>{formatDateKey(s.date)}</b>
              <div className="muted">
                {[shedQualityLabel(s.quality), s.inBlueDate && `in blue ${format(parseDateKey(s.inBlueDate), 'MMM d')}`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {s.notes && <div style={{ marginTop: 2 }}>{s.notes}</div>}
            </div>
            <Pill tone={QUALITY_TONE[s.quality]}>{shedQualityLabel(s.quality)}</Pill>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('shed', () => deleteShed(s.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}

      <LogShedSheet pet={pet} open={adding} onClose={() => setAdding(false)} now={now} />
    </>
  );
}
```

- [ ] **Step 9: Replace the whole of `src/app/App.tsx`** (adds the Sheds route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add Sheds with next-shed prediction and Mark in blue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Weight & length with a line chart

Spec §5.8. Values are stored in g and mm and shown in the user's units (Task 2).

**Files:**
- Create: `src/domain/growth.ts`, `src/db/measurements.ts`, `src/ui/LineChart.tsx`, `src/features/weight/LogMeasurementSheet.tsx`, `src/features/weight/WeightScreen.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/domain/growth.test.ts`, `src/db/measurements.test.ts`, `src/ui/LineChart.test.tsx`, `src/features/weight/WeightScreen.test.tsx`

**Interfaces:**
- Consumes: `useUnits`, `weightToG`, `lengthToMm`, `weightFromG`, `formatWeight`, `formatLength`, `displayWeight`, `parseOptionalNumber`, `dateKey`, `parseDateKey`, `isDateKey`, `requireDateKey`, `saveErrorText` (Task 2), `useRoutePet`, `PetNotFound`, `SubScreenHeader`, `confirmDelete` (Task 4), `formatDateKey`, `Field`, `SheetHeader`, `Segmented`, `Sheet`, `Card`, `useNow`
- Produces:
  - `src/domain/growth.ts`: `type ChartRange = '6M' | '1Y' | 'All'`, `withValue(ms, key: 'weightG' | 'lengthMm'): Measurement[]` (oldest first), `latestWith(ms, key): Measurement | undefined`, `weightChange(ms, now: Date, days = 30): number | null` (grams; latest weight minus the last weight on or before `now − days`, or else the first weight inside the window), `chartSeries(ms, key, range, now): Measurement[]`, `formatChange(deltaG: number, unit: WeightUnit): string` (`'↑ 3 g'`, `'↓ 2 g'`, `'No change'`)
  - `src/db/measurements.ts`: `interface MeasurementInput { petId: string; date: string; weightG?: number; lengthMm?: number }`, `logMeasurement(input): Promise<Measurement>`, `deleteMeasurement(id): Promise<void>`, `listMeasurements(petId): Promise<Measurement[]>` (oldest first)
  - `src/ui/LineChart.tsx`: `interface ChartPoint { x: number; y: number }`, `interface ChartBand { min: number; max: number }`, `chartGeometry(points, height, band?)`, `LineChart({ points, label, height = 120, band?, emptyText = 'No data yet' })` (an `<svg role="img" aria-label={label}>`; `emptyText` when there are no points)
  - `LogMeasurementSheet` (default export): props `{ pet, open, onClose, now? }`, title `Log weight & length`, fields `Date`, `Weight (<unit>)`, `Length (<unit>)`
  - Route `/pets/:id/weight` → `WeightScreen` (`h1` "Weight & length")

- [ ] **Step 1: Write the failing tests in `src/domain/growth.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Measurement } from './types';
import { chartSeries, formatChange, latestWith, weightChange } from './growth';

const now = new Date(2026, 10, 8, 9, 0);
let n = 0;
const m = (date: string, weightG?: number, lengthMm?: number): Measurement => ({
  id: `m${++n}`, petId: 'p1', date, weightG, lengthMm, createdAt: '', updatedAt: '',
});

describe('latest values', () => {
  it('finds the latest entry that has each value', () => {
    const ms = [m('2026-11-01', 42), m('2026-10-01', 39, 431.8), m('2026-09-01', 36)];
    expect(latestWith(ms, 'weightG')!.date).toBe('2026-11-01');
    expect(latestWith(ms, 'lengthMm')!.date).toBe('2026-10-01');
    expect(latestWith([], 'weightG')).toBeUndefined();
  });
});

describe('weightChange', () => {
  it('compares with the last weight from 30 or more days ago', () => {
    expect(weightChange([m('2026-09-01', 36), m('2026-10-01', 39), m('2026-11-01', 42)], now)).toBe(3);
  });
  it('falls back to the first weight inside the window', () => {
    expect(weightChange([m('2026-10-20', 40), m('2026-11-01', 38)], now)).toBe(-2);
  });
  it('is null with one weight, or when the latest weight is older than the window', () => {
    expect(weightChange([m('2026-11-01', 42)], now)).toBeNull();
    expect(weightChange([m('2026-08-01', 30), m('2026-09-01', 36)], now)).toBeNull();
  });
});

describe('chartSeries', () => {
  const ms = [m('2025-01-15', 10), m('2026-02-01', 25), m('2026-06-01', 33), m('2026-11-01', 42), m('2026-10-01', undefined, 431.8)];
  it('limits to the range and to entries with that value, oldest first', () => {
    expect(chartSeries(ms, 'weightG', '6M', now).map((x) => x.date)).toEqual(['2026-06-01', '2026-11-01']);
    expect(chartSeries(ms, 'weightG', '1Y', now).map((x) => x.date)).toEqual(['2026-02-01', '2026-06-01', '2026-11-01']);
    expect(chartSeries(ms, 'weightG', 'All', now)).toHaveLength(4);
    expect(chartSeries(ms, 'lengthMm', 'All', now)).toHaveLength(1);
  });
});

it('formats a weight change in the user unit', () => {
  expect(formatChange(3, 'g')).toBe('↑ 3 g');
  expect(formatChange(-2.4, 'g')).toBe('↓ 2 g');
  expect(formatChange(0.2, 'g')).toBe('No change');
  expect(formatChange(28.35, 'oz')).toBe('↑ 1 oz');
});
```

- [ ] **Step 2: Write the failing tests in `src/db/measurements.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet } from './pets';
import { deleteMeasurement, listMeasurements, logMeasurement } from './measurements';
import { ValidationError } from './ids';

let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs weight and/or length, lists oldest first and deletes', async () => {
  await logMeasurement({ petId, date: '2026-11-01', weightG: 42, lengthMm: 457.2 });
  const first = await logMeasurement({ petId, date: '2026-10-01', lengthMm: 431.8 });
  expect(first.weightG).toBeUndefined();
  expect((await listMeasurements(petId)).map((x) => x.date)).toEqual(['2026-10-01', '2026-11-01']);
  await deleteMeasurement(first.id);
  expect(await listMeasurements(petId)).toHaveLength(1);
});

it('needs at least one value, positive and within sensible limits (spec §11)', async () => {
  const bad = [
    { petId, date: '2026-11-01' },
    { petId, date: '2026-11-01', weightG: 0 },
    { petId, date: '2026-11-01', weightG: 250_000 },
    { petId, date: '2026-11-01', lengthMm: -5 },
    { petId, date: '2026-11-01', lengthMm: Number.NaN },
    { petId, date: '', weightG: 42 },
  ];
  for (const input of bad) await expect(logMeasurement(input)).rejects.toBeInstanceOf(ValidationError);
  await expect(logMeasurement({ petId: 'missing', date: '2026-11-01', weightG: 42 })).rejects.toThrow('not found');
  expect(await listMeasurements(petId)).toEqual([]);
});
```

- [ ] **Step 3: Write the failing tests in `src/ui/LineChart.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { chartGeometry, LineChart } from './LineChart';

describe('chartGeometry', () => {
  it('maps points into the 300-wide viewBox with padding', () => {
    const g = chartGeometry([{ x: 0, y: 10 }, { x: 10, y: 20 }], 120);
    expect(g.coords).toEqual([{ x: 8, y: 112 }, { x: 292, y: 8 }]);
    expect(g.band).toBeUndefined();
  });
  it('includes a target band in the vertical scale', () => {
    const g = chartGeometry([{ x: 0, y: 10 }, { x: 10, y: 20 }], 120, { min: 12, max: 18 });
    expect(g.band).toEqual({ y: 28.8, height: 62.4 });
  });
  it('centres a single point', () => {
    expect(chartGeometry([{ x: 5, y: 7 }], 120).coords).toEqual([{ x: 150, y: 60 }]);
  });
});

describe('LineChart', () => {
  it('draws a labelled line with a dot per point', () => {
    const { container } = render(<LineChart label="Weight chart" points={[{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }]} />);
    expect(screen.getByRole('img', { name: 'Weight chart' })).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(container.querySelector('polyline')).not.toBeNull();
  });
  it('shows the empty text without points', () => {
    render(<LineChart label="Weight chart" points={[]} emptyText="No weights yet" />);
    expect(screen.getByText('No weights yet')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
```

- [ ] **Step 4: Write the failing tests in `src/features/weight/WeightScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WeightScreen from './WeightScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { updateSettings } from '../../db/settings';
import { listMeasurements, logMeasurement } from '../../db/measurements';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  await logMeasurement({ petId, date: '2026-09-01', weightG: 36 });
  await logMeasurement({ petId, date: '2026-10-01', weightG: 39, lengthMm: 431.8 });
  await logMeasurement({ petId, date: '2026-11-01', weightG: 42, lengthMm: 457.2 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWeight() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/weight`]}>
      <Routes>
        <Route path="/pets/:id/weight" element={<WeightScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WeightScreen', () => {
  it('shows the current weight, the 30-day change, the length, the chart and the entries', async () => {
    renderWeight();
    expect(await screen.findByRole('heading', { name: 'Weight & length' })).toBeInTheDocument();
    expect(screen.getByText('42 g')).toBeInTheDocument();
    expect(screen.getByText('Nov 1 · ↑ 3 g in 30 days')).toBeInTheDocument();
    expect(screen.getByText('18 in')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Weight chart, 3 entries' })).toBeInTheDocument();
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Nov 1, 2026');
    expect(items[0]).toHaveTextContent('42 g · 18 in');
    expect(items[2]).toHaveTextContent('36 g');
  });

  it('switches the chart range', async () => {
    await logMeasurement({ petId, date: '2025-01-15', weightG: 10 });
    renderWeight();
    expect(await screen.findByRole('img', { name: 'Weight chart, 3 entries' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByRole('img', { name: 'Weight chart, 4 entries' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '1Y' }));
    expect(screen.getByRole('img', { name: 'Weight chart, 3 entries' })).toBeInTheDocument();
  });

  it('shows and accepts the units from Settings', async () => {
    await updateSettings({ weightUnit: 'oz' });
    renderWeight();
    expect(await screen.findByText('1.5 oz')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log weight or length' }));
    const sheet = screen.getByRole('dialog', { name: 'Log weight & length' });
    await userEvent.type(within(sheet).getByLabelText('Weight (oz)'), '1.6');
    await userEvent.type(within(sheet).getByLabelText('Length (in)'), '18.5');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save entry' }));
    await vi.waitFor(async () => expect(await listMeasurements(petId)).toHaveLength(4));
    const latest = (await listMeasurements(petId)).at(-1)!;
    expect(latest.date).toBe('2026-11-08');
    expect(latest.weightG).toBeCloseTo(45.359, 3);
    expect(latest.lengthMm).toBeCloseTo(469.9, 3);
  });

  it('asks for a weight or a length', async () => {
    renderWeight();
    await userEvent.click(await screen.findByRole('button', { name: 'Log weight or length' }));
    const sheet = screen.getByRole('dialog', { name: 'Log weight & length' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save entry' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Enter a weight or a length');
  });

  it('a cleared date blocks saving without crashing', async () => {
    renderWeight();
    await userEvent.click(await screen.findByRole('button', { name: 'Log weight or length' }));
    const sheet = screen.getByRole('dialog', { name: 'Log weight & length' });
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save entry' })).toBeDisabled();
  });

  it('deletes an entry after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWeight();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listMeasurements(petId)).toHaveLength(2));
  });

  it('is routed at /pets/:id/weight', async () => {
    renderAt(`/pets/${petId}/weight`);
    expect(await screen.findByRole('heading', { name: 'Weight & length' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run them and confirm they fail**

Run: `npm test -- src/domain/growth.test.ts src/db/measurements.test.ts src/ui/LineChart.test.tsx src/features/weight`
Expected: FAIL with `Failed to resolve import "./growth"`, `"./measurements"`, `"./LineChart"`, `"./WeightScreen"`.

- [ ] **Step 6: Create `src/domain/growth.ts`**

```ts
import { subDays, subMonths, subYears } from 'date-fns';
import type { Measurement, WeightUnit } from './types';
import { dateKey } from './dates';
import { displayWeight } from './units';

export type ChartRange = '6M' | '1Y' | 'All';
type Key = 'weightG' | 'lengthMm';

const byDate = (a: Measurement, b: Measurement) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

/** Entries that have `key`, oldest first. */
export function withValue(ms: readonly Measurement[], key: Key): Measurement[] {
  return ms.filter((m) => m[key] !== undefined).sort(byDate);
}

export function latestWith(ms: readonly Measurement[], key: Key): Measurement | undefined {
  return withValue(ms, key).at(-1);
}

/**
 * Spec §5.8 "the change over the last 30 days", in grams: the latest weight minus the last weight
 * on or before (now − days), or else minus the first weight inside the window. Null when there is
 * nothing to compare.
 */
export function weightChange(ms: readonly Measurement[], now: Date, days = 30): number | null {
  const weights = withValue(ms, 'weightG');
  const latest = weights.at(-1);
  if (!latest) return null;
  const cutoff = dateKey(subDays(now, days));
  const base = weights.filter((m) => m.date <= cutoff).at(-1) ?? weights.find((m) => m.date > cutoff);
  if (!base || base === latest) return null;
  return latest.weightG! - base.weightG!;
}

export function chartSeries(ms: readonly Measurement[], key: Key, range: ChartRange, now: Date): Measurement[] {
  const all = withValue(ms, key);
  if (range === 'All') return all;
  const start = dateKey(range === '6M' ? subMonths(now, 6) : subYears(now, 1));
  return all.filter((m) => m.date >= start);
}

export function formatChange(deltaG: number, unit: WeightUnit): string {
  const size = displayWeight(Math.abs(deltaG), unit);
  if (size === 0) return 'No change';
  return `${deltaG > 0 ? '↑' : '↓'} ${size} ${unit}`;
}
```

- [ ] **Step 7: Create `src/db/measurements.ts`**

```ts
import Dexie from 'dexie';
import type { Measurement } from '../domain/types';
import { db } from './db';
import { newId, nowIso, requireDateKey, ValidationError } from './ids';

export interface MeasurementInput {
  petId: string;
  date: string;
  weightG?: number;
  lengthMm?: number;
}

/** Spec §11 "sensible limits": up to 200 kg (a big tortoise) and 10 m (a big python). */
const MAX_WEIGHT_G = 200_000;
const MAX_LENGTH_MM = 10_000;

function validate(m: MeasurementInput): void {
  requireDateKey(m.date);
  if (m.weightG === undefined && m.lengthMm === undefined) throw new ValidationError('Enter a weight or a length');
  if (m.weightG !== undefined && !(Number.isFinite(m.weightG) && m.weightG > 0 && m.weightG <= MAX_WEIGHT_G)) {
    throw new ValidationError('Weight must be more than 0 and less than 200 kg');
  }
  if (m.lengthMm !== undefined && !(Number.isFinite(m.lengthMm) && m.lengthMm > 0 && m.lengthMm <= MAX_LENGTH_MM)) {
    throw new ValidationError('Length must be more than 0 and less than 10 m');
  }
}

export async function logMeasurement(input: MeasurementInput): Promise<Measurement> {
  validate(input);
  return db.transaction('rw', [db.pets, db.measurements], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const m: Measurement = {
      id: newId(), petId: input.petId, date: input.date, weightG: input.weightG, lengthMm: input.lengthMm,
      createdAt: ts, updatedAt: ts,
    };
    await db.measurements.add(m);
    return m;
  });
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.measurements.delete(id);
}

export const listMeasurements = (petId: string): Promise<Measurement[]> =>
  db.measurements.where('[petId+date]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
```

- [ ] **Step 8: Create `src/ui/LineChart.tsx`**

```tsx
export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartBand {
  min: number;
  max: number;
}

const WIDTH = 300;
const PAD = 8;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pure layout: points (any units) → viewBox coordinates. A band widens the vertical scale. */
export function chartGeometry(points: readonly ChartPoint[], height: number, band?: ChartBand) {
  const xs = points.map((p) => p.x);
  const ys = [...points.map((p) => p.y), ...(band ? [band.min, band.max] : [])];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const sx = (x: number) => (x1 === x0 ? WIDTH / 2 : PAD + ((x - x0) / (x1 - x0)) * (WIDTH - 2 * PAD));
  const sy = (y: number) => height - PAD - ((y - y0) / (y1 - y0)) * (height - 2 * PAD);
  return {
    coords: points.map((p) => ({ x: round1(sx(p.x)), y: round1(sy(p.y)) })),
    band: band ? { y: round1(sy(band.max)), height: round1(sy(band.min) - sy(band.max)) } : undefined,
  };
}

interface LineChartProps {
  points: readonly ChartPoint[];
  label: string;
  height?: number;
  band?: ChartBand;
  emptyText?: string;
}

/** Spec §3: a small hand-rolled SVG chart (weight line chart, habitat sparkline). */
export function LineChart({ points, label, height = 120, band, emptyText = 'No data yet' }: LineChartProps) {
  if (points.length === 0) return <div className="chart-empty muted">{emptyText}</div>;
  const g = chartGeometry(points, height, band);
  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={label}>
      {g.band && <rect className="chart-band" x={0} y={g.band.y} width={WIDTH} height={g.band.height} rx={4} />}
      {g.coords.length > 1 && (
        <polyline className="chart-line" points={g.coords.map((c) => `${c.x},${c.y}`).join(' ')} />
      )}
      {g.coords.map((c, i) => (
        <circle key={i} className="chart-dot" cx={c.x} cy={c.y} r={3.5} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 9: Create `src/features/weight/LogMeasurementSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { Pet } from '../../domain/types';
import { dateKey, isDateKey } from '../../domain/dates';
import { lengthToMm, weightToG, type Units } from '../../domain/units';
import { logMeasurement } from '../../db/measurements';
import { saveErrorText } from '../../db/ids';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { useUnits } from '../settings/useUnits';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogMeasurementSheet(props: Props) {
  const units = useUnits();
  if (!props.open || !units) return null;
  return <MeasurementForm {...props} units={units} />;
}

function MeasurementForm({ pet, onClose, now: fixedNow, units }: Props & { units: Units }) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isDateKey(date)) return;
    const w = parseOptionalNumber(weight);
    const l = parseOptionalNumber(length);
    if (Number.isNaN(w)) return setError('Weight must be a number');
    if (Number.isNaN(l)) return setError('Length must be a number');
    setError(undefined);
    setSaving(true);
    try {
      await logMeasurement({
        petId: pet.id,
        date,
        weightG: w === undefined ? undefined : weightToG(w, units.weight),
        lengthMm: l === undefined ? undefined : lengthToMm(l, units.length),
      });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Log weight & length">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Weight & length" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`Weight (${units.weight})`}>
          <input type="number" inputMode="decimal" step="any" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <Field label={`Length (${units.length})`}>
          <input type="number" inputMode="decimal" step="any" min={0} value={length} onChange={(e) => setLength(e.target.value)} />
        </Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Fill in one or both.</div>
        <button type="submit" className="btn-primary" disabled={saving || !isDateKey(date)}>Save entry</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 10: Create `src/features/weight/WeightScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';
import { chartSeries, formatChange, latestWith, weightChange, type ChartRange } from '../../domain/growth';
import { formatLength, formatWeight, weightFromG } from '../../domain/units';
import { deleteMeasurement, listMeasurements } from '../../db/measurements';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { LineChart } from '../../ui/LineChart';
import { useNow } from '../../ui/useNow';
import { formatDateKey } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import { useUnits } from '../settings/useUnits';
import LogMeasurementSheet from './LogMeasurementSheet';

const RANGES = [
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
] as const;

export default function WeightScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const units = useUnits();
  const petId = pet?.id;
  const ms = useLiveQuery(() => (petId ? listMeasurements(petId) : undefined), [petId]);
  const [range, setRange] = useState<ChartRange>('6M');
  const [adding, setAdding] = useState(false);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!ms || !units) return null;

  const weight = latestWith(ms, 'weightG');
  const length = latestWith(ms, 'lengthMm');
  const change = weightChange(ms, now);
  const series = chartSeries(ms, 'weightG', range, now);
  const points = series.map((m) => ({ x: parseDateKey(m.date).getTime(), y: weightFromG(m.weightG!, units.weight) }));
  const history = [...ms].reverse();

  return (
    <>
      <SubScreenHeader pet={pet} title="Weight & length" addLabel="Log weight or length" onAdd={() => setAdding(true)} />

      <Card style={{ marginTop: 12 }}>
        {weight || length ? (
          <div className="row">
            <div className="grow">
              {weight && <div className="big-number">{formatWeight(weight.weightG!, units.weight)}</div>}
              {weight && (
                <div className="muted">
                  {[format(parseDateKey(weight.date), 'MMM d'), change !== null && `${formatChange(change, units.weight)} in 30 days`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
            {length && (
              <div style={{ textAlign: 'right' }}>
                <b>{formatLength(length.lengthMm!, units.length)}</b>
                <div className="muted">length</div>
              </div>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No weight or length logged yet.</p>
        )}
      </Card>

      <Card>
        <LineChart points={points} label={`Weight chart, ${points.length} entries`} emptyText="No weights in this range" />
        {series.length > 0 && (
          <div className="row chart-axis">
            <span className="grow">{format(parseDateKey(series[0]!.date), 'MMM d, yyyy')}</span>
            <span>{format(parseDateKey(series[series.length - 1]!.date), 'MMM d, yyyy')}</span>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} />
        </div>
      </Card>

      <div className="label">Entries</div>
      {history.length === 0 && <p className="muted">Nothing logged yet.</p>}
      {history.map((m) => (
        <Card key={m.id} role="article">
          <div className="row">
            <div className="grow">
              <b>{formatDateKey(m.date)}</b>
              <div className="muted">
                {[
                  m.weightG !== undefined && formatWeight(m.weightG, units.weight),
                  m.lengthMm !== undefined && formatLength(m.lengthMm, units.length),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('entry', () => deleteMeasurement(m.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}

      <LogMeasurementSheet pet={pet} open={adding} onClose={() => setAdding(false)} now={now} />
    </>
  );
}
```

- [ ] **Step 11: Replace the whole of `src/app/App.tsx`** (adds the Weight route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 12: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add Weight & length with an SVG chart and unit-aware entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Habitat readings, targets and the enclosure label

Spec §5.9. Plan 1's pet form has no enclosure label or target ranges (ledger, Task 9 note), so this screen edits them in its own **Habitat setup** sheet. Targets are stored in °C (and % for humidity) on `pet.habitatTargets`.

**Files:**
- Create: `src/domain/habitat.ts`, `src/db/habitat.ts`, `src/features/habitat/LogHabitatSheet.tsx`, `src/features/habitat/HabitatSetupSheet.tsx`, `src/features/habitat/HabitatScreen.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/domain/habitat.test.ts`, `src/db/habitat.test.ts`, `src/features/habitat/HabitatScreen.test.tsx`

**Interfaces:**
- Consumes: `useUnits`, `tempToC`, `tempFromC`, `displayTemp`, `formatTemp`, `formatHumidity`, `parseOptionalNumber`, `combineDateTime`, `dateKey`, `cleanText`, `requireDateTime`, `saveErrorText` (Task 2), `LineChart` (Task 6), `useRoutePet`, `PetNotFound`, `SubScreenHeader`, `confirmDelete` (Task 4), `formatDay` (Plan 1 `logModel.ts`), `Field`, `DateTimeFields`, `SheetHeader`, `Sheet`, `Card`, `Pill`, `useNow`
- Produces:
  - `src/domain/habitat.ts`: `type Metric = 'warm' | 'cool' | 'humidity'`, `interface Range { min?: number; max?: number }`, `metricValue(r, metric): number | undefined`, `latestValue(readings, metric): { value: number; at: string } | undefined`, `targetRange(targets: HabitatTargets, metric): Range`, `type RangeCheck = 'low' | 'ok' | 'high' | 'unset'`, `checkRange(value, range): RangeCheck`, `interface Gauge { band?: { start: number; end: number }; marker: number }` (percentages), `gauge(value, range): Gauge`, `formatTargetRange(metric, range, unit: TempUnit): string` (`'Target 85–90°F'`, `'Target 40–60%'`, `'No target set'`), `lastDays(readings, metric, now, days = 7): HabitatReading[]`, `weekSummary(values: readonly number[], range): string`
  - `src/db/habitat.ts`: `interface HabitatReadingInput { petId: string; at: string; warmC?: number; coolC?: number; humidityPct?: number }`, `logHabitatReading(input): Promise<HabitatReading>`, `deleteHabitatReading(id): Promise<void>`, `listHabitatReadings(petId): Promise<HabitatReading[]>` (oldest first), `interface HabitatSetup { enclosureLabel?: string; habitatTargets: HabitatTargets }`, `updateHabitatSetup(petId: string, setup: HabitatSetup): Promise<void>`
  - `LogHabitatSheet` (default export, title `Log habitat reading`) and `HabitatSetupSheet` (default export, title `Habitat setup`), both with props `{ pet, open, onClose, now? }`
  - Route `/pets/:id/habitat` → `HabitatScreen` (`h1` "Habitat")

- [ ] **Step 1: Write the failing tests in `src/domain/habitat.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { HabitatReading } from './types';
import { tempToC } from './units';
import {
  checkRange, formatTargetRange, gauge, lastDays, latestValue, targetRange, weekSummary,
} from './habitat';

let n = 0;
const reading = (at: Date, values: Partial<HabitatReading>): HabitatReading => ({
  id: `r${++n}`, petId: 'p1', at: at.toISOString(), createdAt: '', updatedAt: '', ...values,
});
const day = (d: number, h = 8, m = 15) => new Date(2026, 10, d, h, m);

describe('latestValue / targetRange', () => {
  it('finds the newest reading that has the value', () => {
    const rs = [reading(day(6), { warmC: 31, humidityPct: 50 }), reading(day(7), { warmC: 32 })];
    expect(latestValue(rs, 'warm')).toEqual({ value: 32, at: day(7).toISOString() });
    expect(latestValue(rs, 'humidity')).toEqual({ value: 50, at: day(6).toISOString() });
    expect(latestValue(rs, 'cool')).toBeUndefined();
  });
  it('reads each metric range from the pet targets', () => {
    const t = { warmMinC: 29, warmMaxC: 32, humidityMin: 40 };
    expect(targetRange(t, 'warm')).toEqual({ min: 29, max: 32 });
    expect(targetRange(t, 'cool')).toEqual({ min: undefined, max: undefined });
    expect(targetRange(t, 'humidity')).toEqual({ min: 40, max: undefined });
  });
});

describe('checkRange / gauge', () => {
  it('says low, ok, high or unset', () => {
    expect(checkRange(25, { min: 20, max: 30 })).toBe('ok');
    expect(checkRange(19, { min: 20, max: 30 })).toBe('low');
    expect(checkRange(31, { min: 20, max: 30 })).toBe('high');
    expect(checkRange(31, { min: 20 })).toBe('ok');
    expect(checkRange(31, {})).toBe('unset');
  });
  it('places the target band and the marker as percentages', () => {
    expect(gauge(25, { min: 20, max: 30 })).toEqual({ band: { start: 33.3, end: 66.7 }, marker: 50 });
    expect(gauge(45, { min: 20, max: 30 })).toEqual({ band: { start: 28.6, end: 57.1 }, marker: 100 });
    expect(gauge(25, {})).toEqual({ marker: 50 });
  });
});

describe('formatTargetRange', () => {
  const warm = { min: tempToC(85, 'F'), max: tempToC(90, 'F') };
  it('shows the range in the user unit', () => {
    expect(formatTargetRange('warm', warm, 'F')).toBe('Target 85–90°F');
    expect(formatTargetRange('warm', warm, 'C')).toBe('Target 29.4–32.2°C');
    expect(formatTargetRange('humidity', { min: 40, max: 60 }, 'F')).toBe('Target 40–60%');
    expect(formatTargetRange('cool', { min: tempToC(72, 'F') }, 'F')).toBe('Target ≥ 72°F');
    expect(formatTargetRange('cool', { max: tempToC(78, 'F') }, 'F')).toBe('Target ≤ 78°F');
    expect(formatTargetRange('cool', {}, 'F')).toBe('No target set');
  });
});

describe('the last 7 days', () => {
  const now = day(8, 9, 0);
  const rs = [
    reading(day(1, 8, 0), { warmC: 31 }), // more than 7 days ago
    reading(day(2), { warmC: 31 }),
    reading(day(5), { humidityPct: 50 }),
    reading(day(8), { warmC: 33 }),
  ];
  it('keeps readings of that metric from the last 7 days', () => {
    expect(lastDays(rs, 'warm', now).map((r) => r.warmC)).toEqual([31, 33]);
  });
  it('summarizes the week against the target', () => {
    expect(weekSummary([30, 31], { min: 29, max: 32 })).toBe('In range all week ✓');
    expect(weekSummary([30, 33, 34], { min: 29, max: 32 })).toBe('2 of 3 readings out of range');
    expect(weekSummary([30], {})).toBe('1 reading this week');
    expect(weekSummary([], { min: 29 })).toBe('No readings this week');
  });
});
```

- [ ] **Step 2: Write the failing tests in `src/db/habitat.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet, getPet } from './pets';
import { deleteHabitatReading, listHabitatReadings, logHabitatReading, updateHabitatSetup } from './habitat';
import { ValidationError } from './ids';

const at = (d: number) => new Date(2026, 10, d, 8, 15).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('logs readings with any one value, oldest first, and deletes them', async () => {
  await logHabitatReading({ petId, at: at(8), warmC: 31.1, coolC: 23.3, humidityPct: 52 });
  const first = await logHabitatReading({ petId, at: at(7), humidityPct: 60 });
  expect((await listHabitatReadings(petId)).map((r) => r.at)).toEqual([at(7), at(8)]);
  await deleteHabitatReading(first.id);
  expect(await listHabitatReadings(petId)).toHaveLength(1);
});

it('validates readings (spec §11)', async () => {
  const bad = [
    { petId, at: at(8) },
    { petId, at: at(8), warmC: 0 },
    { petId, at: at(8), coolC: 75 },
    { petId, at: at(8), humidityPct: 101 },
    { petId, at: at(8), humidityPct: -1 },
    { petId, at: 'not a date', warmC: 30 },
  ];
  for (const input of bad) await expect(logHabitatReading(input)).rejects.toBeInstanceOf(ValidationError);
  await expect(logHabitatReading({ petId: 'missing', at: at(8), warmC: 30 })).rejects.toThrow('not found');
  expect(await listHabitatReadings(petId)).toEqual([]);
});

it('saves the enclosure label and targets, dropping blanks', async () => {
  await updateHabitatSetup(petId, {
    enclosureLabel: '  40-gal tank ',
    habitatTargets: { warmMinC: 29.4, warmMaxC: 32.2, coolMinC: undefined, humidityMin: 40, humidityMax: 60 },
  });
  const pet = (await getPet(petId))!;
  expect(pet.enclosureLabel).toBe('40-gal tank');
  expect(pet.habitatTargets).toEqual({ warmMinC: 29.4, warmMaxC: 32.2, humidityMin: 40, humidityMax: 60 });

  await updateHabitatSetup(petId, { enclosureLabel: '', habitatTargets: {} });
  expect((await getPet(petId))!.enclosureLabel).toBeUndefined();
  expect((await getPet(petId))!.habitatTargets).toEqual({});
});

it('rejects a minimum above its maximum and out-of-range targets', async () => {
  await expect(updateHabitatSetup(petId, { habitatTargets: { warmMinC: 33, warmMaxC: 30 } })).rejects.toThrow(
    'Warm side minimum must not be above the maximum',
  );
  await expect(updateHabitatSetup(petId, { habitatTargets: { humidityMax: 120 } })).rejects.toBeInstanceOf(ValidationError);
  await expect(updateHabitatSetup(petId, { habitatTargets: { coolMinC: -5 } })).rejects.toBeInstanceOf(ValidationError);
  await expect(updateHabitatSetup('missing', { habitatTargets: {} })).rejects.toThrow('not found');
});
```

- [ ] **Step 3: Write the failing tests in `src/features/habitat/HabitatScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HabitatScreen from './HabitatScreen';
import { resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listHabitatReadings, logHabitatReading } from '../../db/habitat';
import { tempToC } from '../../domain/units';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
const f = (deg: number) => tempToC(deg, 'F');
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (
    await createPet({
      name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, enclosureLabel: '40-gal tank',
      habitatTargets: { warmMinC: f(85), warmMaxC: f(90), coolMinC: f(72), coolMaxC: f(78), humidityMin: 40, humidityMax: 60 },
    })
  ).id;
  for (const d of [2, 3, 4, 5, 6, 7]) {
    await logHabitatReading({ petId, at: new Date(2026, 10, d, 8, 15).toISOString(), warmC: f(88) });
  }
  await logHabitatReading({ petId, at: new Date(2026, 10, 8, 8, 15).toISOString(), warmC: f(88), coolC: f(74), humidityPct: 52 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderHabitat(id = petId) {
  return render(
    <MemoryRouter initialEntries={[`/pets/${id}/habitat`]}>
      <Routes>
        <Route path="/pets/:id/habitat" element={<HabitatScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HabitatScreen', () => {
  it('shows the enclosure, each value against its target, and the warm-side week', async () => {
    renderHabitat();
    expect(await screen.findByText('40-gal tank · last reading Today, 8:15 AM')).toBeInTheDocument();
    const warm = screen.getByRole('group', { name: 'Warm side' });
    expect(within(warm).getByText('Target 85–90°F')).toBeInTheDocument();
    expect(within(warm).getByText('88°F')).toBeInTheDocument();
    const cool = screen.getByRole('group', { name: 'Cool side' });
    expect(within(cool).getByText('Target 72–78°F')).toBeInTheDocument();
    expect(within(cool).getByText('74°F')).toBeInTheDocument();
    const humidity = screen.getByRole('group', { name: 'Humidity' });
    expect(within(humidity).getByText('Target 40–60%')).toBeInTheDocument();
    expect(within(humidity).getByText('52%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Warm side, last 7 days, 7 readings' })).toBeInTheDocument();
    expect(screen.getByText('In range all week ✓')).toBeInTheDocument();
  });

  it('flags a value outside its target', async () => {
    await logHabitatReading({ petId, at: new Date(2026, 10, 8, 8, 30).toISOString(), coolC: f(86) });
    renderHabitat();
    const cool = await screen.findByRole('group', { name: 'Cool side' });
    expect(within(cool).getByText('86°F')).toBeInTheDocument();
    expect(within(cool).getByText('Too high')).toHaveClass('pill-late');
  });

  it('logs a reading in °F and stores °C', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Log a reading' }));
    const sheet = screen.getByRole('dialog', { name: 'Log habitat reading' });
    await userEvent.type(within(sheet).getByLabelText('Warm side (°F)'), '86');
    await userEvent.type(within(sheet).getByLabelText('Humidity (%)'), '55');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save reading' }));
    await vi.waitFor(async () => expect(await listHabitatReadings(petId)).toHaveLength(8));
    const latest = (await listHabitatReadings(petId)).at(-1)!;
    expect(latest.at).toBe(now.toISOString());
    expect(latest.warmC).toBeCloseTo(30, 6);
    expect(latest.humidityPct).toBe(55);
    expect(latest.coolC).toBeUndefined();
  });

  it('asks for at least one value', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Log a reading' }));
    const sheet = screen.getByRole('dialog', { name: 'Log habitat reading' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save reading' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Enter at least one reading');
  });

  it('a cleared date blocks saving without crashing', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Log a reading' }));
    const sheet = screen.getByRole('dialog', { name: 'Log habitat reading' });
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save reading' })).toBeDisabled();
  });

  it('edits the enclosure label and targets, keeping untouched targets exact', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit enclosure & targets' }));
    const sheet = screen.getByRole('dialog', { name: 'Habitat setup' });
    const label = within(sheet).getByLabelText('Enclosure label');
    expect(label).toHaveValue('40-gal tank');
    expect(within(sheet).getByLabelText('Warm side min (°F)')).toHaveValue(85);
    await userEvent.clear(label);
    await userEvent.type(label, '36x18x18 PVC');
    await userEvent.clear(within(sheet).getByLabelText('Warm side max (°F)'));
    await userEvent.type(within(sheet).getByLabelText('Warm side max (°F)'), '92');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save setup' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const pet = (await getPet(petId))!;
    expect(pet.enclosureLabel).toBe('36x18x18 PVC');
    expect(pet.habitatTargets.warmMaxC).toBeCloseTo(f(92), 6);
    expect(pet.habitatTargets.warmMinC).toBe(f(85));
    expect(pet.habitatTargets.humidityMin).toBe(40);
    expect(await screen.findByText('Target 85–92°F')).toBeInTheDocument();
  });

  it('rejects a minimum above the maximum', async () => {
    renderHabitat();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit enclosure & targets' }));
    const sheet = screen.getByRole('dialog', { name: 'Habitat setup' });
    await userEvent.clear(within(sheet).getByLabelText('Warm side min (°F)'));
    await userEvent.type(within(sheet).getByLabelText('Warm side min (°F)'), '95');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save setup' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Warm side minimum must not be above the maximum');
  });

  it('handles a pet with no setup and no readings', async () => {
    const bare = await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    renderHabitat(bare.id);
    expect(await screen.findByText('No enclosure label · no readings yet')).toBeInTheDocument();
    expect(screen.getAllByText('No target set')).toHaveLength(3);
    expect(screen.getByText('No warm-side readings this week')).toBeInTheDocument();
  });

  it('is routed at /pets/:id/habitat', async () => {
    renderAt(`/pets/${petId}/habitat`);
    expect(await screen.findByRole('heading', { name: 'Habitat' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/domain/habitat.test.ts src/db/habitat.test.ts src/features/habitat`
Expected: FAIL with `Failed to resolve import "./habitat"` / `"./HabitatScreen"`.

- [ ] **Step 5: Create `src/domain/habitat.ts`**

```ts
import { subDays } from 'date-fns';
import type { HabitatReading, HabitatTargets, TempUnit } from './types';
import { displayTemp } from './units';

export type Metric = 'warm' | 'cool' | 'humidity';

export interface Range {
  min?: number;
  max?: number;
}

const KEY = { warm: 'warmC', cool: 'coolC', humidity: 'humidityPct' } as const;

export const metricValue = (r: HabitatReading, metric: Metric): number | undefined => r[KEY[metric]];

/** The newest reading that has this value. */
export function latestValue(readings: readonly HabitatReading[], metric: Metric): { value: number; at: string } | undefined {
  let best: HabitatReading | undefined;
  for (const r of readings) {
    if (metricValue(r, metric) !== undefined && (!best || Date.parse(r.at) > Date.parse(best.at))) best = r;
  }
  return best ? { value: metricValue(best, metric)!, at: best.at } : undefined;
}

export function targetRange(t: HabitatTargets, metric: Metric): Range {
  if (metric === 'warm') return { min: t.warmMinC, max: t.warmMaxC };
  if (metric === 'cool') return { min: t.coolMinC, max: t.coolMaxC };
  return { min: t.humidityMin, max: t.humidityMax };
}

export type RangeCheck = 'low' | 'ok' | 'high' | 'unset';

export function checkRange(value: number, { min, max }: Range): RangeCheck {
  if (min === undefined && max === undefined) return 'unset';
  if (min !== undefined && value < min) return 'low';
  if (max !== undefined && value > max) return 'high';
  return 'ok';
}

export interface Gauge {
  band?: { start: number; end: number };
  marker: number;
}

/** Gauge layout in percent of the bar: the target band in the middle third, the value as a marker. */
export function gauge(value: number, { min, max }: Range): Gauge {
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo === undefined || hi === undefined) return { marker: 50 };
  const span = Math.max(hi - lo, 1);
  const scaleMin = Math.min(lo - span, value);
  const scaleMax = Math.max(hi + span, value);
  const pct = (v: number) => Math.round(((v - scaleMin) / (scaleMax - scaleMin)) * 1000) / 10;
  return { band: { start: pct(lo), end: pct(hi) }, marker: pct(value) };
}

export function formatTargetRange(metric: Metric, { min, max }: Range, unit: TempUnit): string {
  const n = (v: number) => (metric === 'humidity' ? Math.round(v) : displayTemp(v, unit));
  const suffix = metric === 'humidity' ? '%' : `°${unit}`;
  if (min !== undefined && max !== undefined) return `Target ${n(min)}–${n(max)}${suffix}`;
  if (min !== undefined) return `Target ≥ ${n(min)}${suffix}`;
  if (max !== undefined) return `Target ≤ ${n(max)}${suffix}`;
  return 'No target set';
}

/** Readings with this metric from the last `days` days (oldest first), for the sparkline. */
export function lastDays(readings: readonly HabitatReading[], metric: Metric, now: Date, days = 7): HabitatReading[] {
  const from = subDays(now, days).getTime();
  const to = now.getTime();
  return readings
    .filter((r) => {
      const t = Date.parse(r.at);
      return metricValue(r, metric) !== undefined && t > from && t <= to;
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function weekSummary(values: readonly number[], range: Range): string {
  if (values.length === 0) return 'No readings this week';
  if (range.min === undefined && range.max === undefined) {
    return `${values.length} reading${values.length === 1 ? '' : 's'} this week`;
  }
  const out = values.filter((v) => checkRange(v, range) !== 'ok').length;
  return out === 0 ? 'In range all week ✓' : `${out} of ${values.length} readings out of range`;
}
```

- [ ] **Step 6: Create `src/db/habitat.ts`**

```ts
import Dexie from 'dexie';
import type { HabitatReading, HabitatTargets } from '../domain/types';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface HabitatReadingInput {
  petId: string;
  at: string;
  warmC?: number;
  coolC?: number;
  humidityPct?: number;
}

export interface HabitatSetup {
  enclosureLabel?: string;
  habitatTargets: HabitatTargets;
}

/** Spec §11: temperatures positive and sensible (up to 60 °C / 140 °F); humidity 0–100. */
const MAX_TEMP_C = 60;

function checkTemp(v: number | undefined, side: string): void {
  if (v !== undefined && !(Number.isFinite(v) && v > 0 && v <= MAX_TEMP_C)) {
    throw new ValidationError(`${side} temperature is out of range`);
  }
}

function checkHumidity(v: number | undefined): void {
  if (v !== undefined && !(Number.isFinite(v) && v >= 0 && v <= 100)) throw new ValidationError('Humidity must be 0–100%');
}

export async function logHabitatReading(input: HabitatReadingInput): Promise<HabitatReading> {
  requireDateTime(input.at);
  if (input.warmC === undefined && input.coolC === undefined && input.humidityPct === undefined) {
    throw new ValidationError('Enter at least one reading');
  }
  checkTemp(input.warmC, 'Warm side');
  checkTemp(input.coolC, 'Cool side');
  checkHumidity(input.humidityPct);
  return db.transaction('rw', [db.pets, db.habitatReadings], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const r: HabitatReading = {
      id: newId(), petId: input.petId, at: input.at, warmC: input.warmC, coolC: input.coolC,
      humidityPct: input.humidityPct, createdAt: ts, updatedAt: ts,
    };
    await db.habitatReadings.add(r);
    return r;
  });
}

export async function deleteHabitatReading(id: string): Promise<void> {
  await db.habitatReadings.delete(id);
}

export const listHabitatReadings = (petId: string): Promise<HabitatReading[]> =>
  db.habitatReadings.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();

function checkPair(min: number | undefined, max: number | undefined, name: string, check: (v: number | undefined) => void): void {
  check(min);
  check(max);
  if (min !== undefined && max !== undefined && min > max) {
    throw new ValidationError(`${name} minimum must not be above the maximum`);
  }
}

/** Spec §5.9: the enclosure label and the target ranges (°C and %), stored on the pet. */
export async function updateHabitatSetup(petId: string, setup: HabitatSetup): Promise<void> {
  const t = setup.habitatTargets;
  checkPair(t.warmMinC, t.warmMaxC, 'Warm side', (v) => checkTemp(v, 'Warm side'));
  checkPair(t.coolMinC, t.coolMaxC, 'Cool side', (v) => checkTemp(v, 'Cool side'));
  checkPair(t.humidityMin, t.humidityMax, 'Humidity', checkHumidity);
  const habitatTargets = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as HabitatTargets;
  const changed = await db.pets.update(petId, {
    enclosureLabel: cleanText(setup.enclosureLabel),
    habitatTargets,
    updatedAt: nowIso(),
  });
  if (!changed) throw new Error(`Pet ${petId} not found`);
}
```

- [ ] **Step 7: Create `src/features/habitat/LogHabitatSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import type { Pet } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { tempToC, type Units } from '../../domain/units';
import { logHabitatReading } from '../../db/habitat';
import { saveErrorText } from '../../db/ids';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { useUnits } from '../settings/useUnits';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

export default function LogHabitatSheet(props: Props) {
  const units = useUnits();
  if (!props.open || !units) return null;
  return <HabitatForm {...props} units={units} />;
}

function HabitatForm({ pet, onClose, now: fixedNow, units }: Props & { units: Units }) {
  const [now] = useState(() => fixedNow ?? new Date());
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [warm, setWarm] = useState('');
  const [cool, setCool] = useState('');
  const [humidity, setHumidity] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const at = combineDateTime(date, time);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!at) return;
    const [w, c, h] = [warm, cool, humidity].map(parseOptionalNumber);
    if ([w, c, h].some((v) => Number.isNaN(v))) return setError('Readings must be numbers');
    const toC = (v: number | undefined) => (v === undefined ? undefined : tempToC(v, units.temp));
    setError(undefined);
    setSaving(true);
    try {
      await logHabitatReading({ petId: pet.id, at: at.toISOString(), warmC: toC(w), coolC: toC(c), humidityPct: h });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  const number = (value: string, set: (v: string) => void) => (
    <input type="number" inputMode="decimal" step="any" value={value} onChange={(e) => set(e.target.value)} />
  );

  return (
    <Sheet open onClose={onClose} title="Log habitat reading">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Habitat reading" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label={`Warm side (°${units.temp})`}>{number(warm, setWarm)}</Field>
        <Field label={`Cool side (°${units.temp})`}>{number(cool, setCool)}</Field>
        <Field label="Humidity (%)">{number(humidity, setHumidity)}</Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Fill in any of the three.</div>
        <button type="submit" className="btn-primary" disabled={saving || !at}>Save reading</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `src/features/habitat/HabitatSetupSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { HabitatTargets, Pet } from '../../domain/types';
import { displayTemp, tempToC, type Units } from '../../domain/units';
import { updateHabitatSetup } from '../../db/habitat';
import { saveErrorText } from '../../db/ids';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { useUnits } from '../settings/useUnits';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  now?: Date;
}

type Key = keyof Required<HabitatTargets>;
const FIELDS: { key: Key; name: string; temp: boolean }[] = [
  { key: 'warmMinC', name: 'Warm side min', temp: true },
  { key: 'warmMaxC', name: 'Warm side max', temp: true },
  { key: 'coolMinC', name: 'Cool side min', temp: true },
  { key: 'coolMaxC', name: 'Cool side max', temp: true },
  { key: 'humidityMin', name: 'Humidity min', temp: false },
  { key: 'humidityMax', name: 'Humidity max', temp: false },
];

export default function HabitatSetupSheet(props: Props) {
  const units = useUnits();
  if (!props.open || !units) return null;
  return <SetupForm {...props} units={units} />;
}

function SetupForm({ pet, onClose, units }: Props & { units: Units }) {
  const stored: HabitatTargets = pet.habitatTargets ?? {};
  const [initial] = useState(() => {
    const text = {} as Record<Key, string>;
    for (const { key, temp } of FIELDS) {
      const v = stored[key];
      text[key] = v === undefined ? '' : String(temp ? displayTemp(v, units.temp) : v);
    }
    return text;
  });
  const [values, setValues] = useState(initial);
  const [label, setLabel] = useState(pet.enclosureLabel ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const habitatTargets: HabitatTargets = {};
    for (const { key, temp } of FIELDS) {
      // An untouched field keeps its stored value exactly (no °F → °C rounding drift).
      if (values[key] === initial[key]) {
        habitatTargets[key] = stored[key];
        continue;
      }
      const v = parseOptionalNumber(values[key]);
      if (Number.isNaN(v)) return setError('Targets must be numbers');
      habitatTargets[key] = v === undefined ? undefined : temp ? tempToC(v, units.temp) : v;
    }
    setError(undefined);
    setSaving(true);
    try {
      await updateHabitatSetup(pet.id, { enclosureLabel: label, habitatTargets });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Habitat setup">
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title="Habitat setup" subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Enclosure label">
          <input value={label} placeholder="40-gal tank" onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div className="label">Target ranges</div>
        {FIELDS.map(({ key, name, temp }) => (
          <Field key={key} label={`${name} (${temp ? `°${units.temp}` : '%'})`}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </Field>
        ))}
        <button type="submit" className="btn-primary" disabled={saving}>Save setup</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 9: Create `src/features/habitat/HabitatScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import {
  checkRange, formatTargetRange, gauge, lastDays, latestValue, targetRange, weekSummary, type Metric,
} from '../../domain/habitat';
import { formatHumidity, formatTemp, tempFromC } from '../../domain/units';
import { listHabitatReadings } from '../../db/habitat';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { LineChart } from '../../ui/LineChart';
import { useNow } from '../../ui/useNow';
import { formatDay } from '../feedings/logModel';
import { PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import { useUnits } from '../settings/useUnits';
import LogHabitatSheet from './LogHabitatSheet';
import HabitatSetupSheet from './HabitatSetupSheet';

const METRICS: { metric: Metric; icon: string; name: string }[] = [
  { metric: 'warm', icon: '🔥', name: 'Warm side' },
  { metric: 'cool', icon: '❄️', name: 'Cool side' },
  { metric: 'humidity', icon: '💧', name: 'Humidity' },
];

export default function HabitatScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const units = useUnits();
  const petId = pet?.id;
  const readings = useLiveQuery(() => (petId ? listHabitatReadings(petId) : undefined), [petId]);
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState(false);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!readings || !units) return null;

  const targets = pet.habitatTargets ?? {};
  const last = readings[readings.length - 1];
  const show = (metric: Metric, v: number) => (metric === 'humidity' ? formatHumidity(v) : formatTemp(v, units.temp));
  const subtitle = [
    pet.enclosureLabel ?? 'No enclosure label',
    last ? `last reading ${formatDay(parseISO(last.at), now)}, ${format(parseISO(last.at), 'h:mm a')}` : 'no readings yet',
  ].join(' · ');
  const warmRange = targetRange(targets, 'warm');
  const week = lastDays(readings, 'warm', now);
  const band =
    warmRange.min !== undefined && warmRange.max !== undefined
      ? { min: tempFromC(warmRange.min, units.temp), max: tempFromC(warmRange.max, units.temp) }
      : undefined;

  return (
    <>
      <SubScreenHeader pet={pet} title="Habitat" subtitle={subtitle} addLabel="Log a reading" onAdd={() => setLogging(true)} />
      <button type="button" className="btn" style={{ margin: '8px 0' }} onClick={() => setEditing(true)}>
        Edit enclosure & targets
      </button>

      {METRICS.map(({ metric, icon, name }) => {
        const latest = latestValue(readings, metric);
        const range = targetRange(targets, metric);
        const check = latest ? checkRange(latest.value, range) : 'unset';
        const g = latest ? gauge(latest.value, range) : undefined;
        return (
          <Card key={metric} role="group" aria-label={name}>
            <div className="row">
              <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>
              <div className="grow">
                <b>{name}</b>
                <div className="muted">{formatTargetRange(metric, range, units.temp)}</div>
              </div>
              {check === 'low' && <Pill tone="late">Too low</Pill>}
              {check === 'high' && <Pill tone="late">Too high</Pill>}
              <div className="big-number" style={{ fontSize: 22 }}>{latest ? show(metric, latest.value) : '—'}</div>
            </div>
            {g && (
              <div className="gauge" aria-hidden="true">
                {g.band && <i className="gauge-band" style={{ left: `${g.band.start}%`, width: `${g.band.end - g.band.start}%` }} />}
                <i className="gauge-mark" style={{ left: `${g.marker}%` }} />
              </div>
            )}
          </Card>
        );
      })}

      <div className="label">Last 7 days · warm side</div>
      <Card>
        <LineChart
          points={week.map((r) => ({ x: Date.parse(r.at), y: tempFromC(r.warmC!, units.temp) }))}
          label={`Warm side, last 7 days, ${week.length} readings`}
          band={band}
          emptyText="No warm-side readings this week"
        />
        {week.length > 0 && <div className="muted" style={{ marginTop: 6 }}>{weekSummary(week.map((r) => r.warmC!), warmRange)}</div>}
      </Card>

      <button type="button" className="btn-primary" onClick={() => setLogging(true)}>
        <span aria-hidden="true">＋ </span>Log a new reading
      </button>

      <LogHabitatSheet pet={pet} open={logging} onClose={() => setLogging(false)} now={now} />
      <HabitatSetupSheet pet={pet} open={editing} onClose={() => setEditing(false)} now={now} />
    </>
  );
}
```

- [ ] **Step 10: Replace the whole of `src/app/App.tsx`** (adds the Habitat route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 11: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add Habitat readings with target gauges, a 7-day sparkline and enclosure setup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Care tasks

Spec §5.10 and §7 rule 9. A task with no `petId` is an "All pets" task: it shows on every pet's Care tasks screen and one completion covers it. Removing a task archives it (spec §6.2 `archivedAt`), so its history is kept.

**Files:**
- Create: `src/domain/care.ts`, `src/db/care.ts`, `src/features/care/CareTaskSheet.tsx`, `src/features/care/CareTasksScreen.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/domain/care.test.ts`, `src/db/care.test.ts`, `src/features/care/CareTasksScreen.test.tsx`

**Interfaces:**
- Consumes: `atTime`, `isTimeOfDay`, `formatTimeOfDay`, `requireDateTime`, `saveErrorText` (Task 2), `dueStatus`, `statusLabel` (Plan 1 `domain/feeding.ts`), `TONE` (`PetsHome.tsx`), `useRoutePet`, `PetNotFound`, `SubScreenHeader` (Task 4), `Field`, `SheetHeader`, `Segmented`, `Sheet`, `Card`, `Pill`, `useNow`
- Produces:
  - `src/domain/care.ts`: `CARE_SUGGESTIONS: readonly { name: string; intervalDays: number }[]`, `lastCompletionAt(completions): string | undefined`, `careNextDue(task: Pick<CareTask, 'createdAt' | 'intervalDays' | 'timeOfDay'>, completions: readonly Pick<CareCompletion, 'at'>[]): Date` (last completion, or creation, + `intervalDays`; at `timeOfDay` if set, else the start of that day), `completedOn(completions, day: Date): boolean`, `everyLabel(intervalDays): string` (`'Daily'`, `'Every 2 days'`)
  - `src/db/care.ts`: `interface CareTaskInput { petId?: string; name: string; intervalDays: number; timeOfDay?: string }`, `createCareTask(input): Promise<CareTask>`, `updateCareTask(id, patch: Partial<CareTaskInput>): Promise<void>` (a key set to `undefined` is removed, so `petId: undefined` makes it an All-pets task), `archiveCareTask(id): Promise<void>`, `completeCareTask(taskId, at = nowIso()): Promise<CareCompletion>`, `deleteCareCompletion(id): Promise<void>`, `toggleCareToday(taskId: string, now: Date): Promise<void>` (deletes today's completions if any, else completes now), `listCareTasks(petId?: string): Promise<CareTask[]>` (active, A–Z; with `petId`, that pet's tasks plus All-pets tasks), `listCompletions(taskId): Promise<CareCompletion[]>` (oldest first), `listAllCompletions(): Promise<CareCompletion[]>`
  - `CareTaskSheet` (default export): props `{ pet, open, onClose, task?: CareTask }`, title `New care task` / `Edit care task`
  - Route `/pets/:id/care` → `CareTasksScreen` (`h1` "Care tasks"); each task is an `article` named after the task, with a check button named `"<task> done today"`

- [ ] **Step 1: Write the failing tests in `src/domain/care.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { dueStatus, statusLabel } from './feeding';
import { CARE_SUGGESTIONS, careNextDue, completedOn, everyLabel, lastCompletionAt } from './care';

const iso = (d: number, h = 9, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const task = { createdAt: iso(1, 10), intervalDays: 2, timeOfDay: undefined as string | undefined };
const done = (...days: number[]) => days.map((d) => ({ at: iso(d) }));

describe('careNextDue (spec §7 rule 9)', () => {
  it('counts from the creation date when never done', () => {
    expect(careNextDue(task, []).getTime()).toBe(new Date(2026, 10, 3).getTime());
  });
  it('counts from the last completion', () => {
    expect(careNextDue({ ...task, intervalDays: 1 }, done(7, 5)).getTime()).toBe(new Date(2026, 10, 8).getTime());
    expect(lastCompletionAt(done(5, 7, 6))).toBe(iso(7));
  });
  it('uses the time of day when set', () => {
    expect(careNextDue({ ...task, intervalDays: 1, timeOfDay: '08:00' }, done(7)).getTime()).toBe(
      new Date(2026, 10, 8, 8, 0).getTime(),
    );
  });
  it('has the same statuses as feeding', () => {
    const now = new Date(2026, 10, 8, 9, 0);
    const due = careNextDue({ ...task, intervalDays: 1 }, done(6));
    expect(dueStatus(due, now)).toBe('late');
    expect(statusLabel(due, now)).toBe('1 day late');
  });
});

describe('helpers', () => {
  it('completedOn checks the calendar day', () => {
    expect(completedOn(done(8), new Date(2026, 10, 8, 23, 0))).toBe(true);
    expect(completedOn(done(7), new Date(2026, 10, 8, 0, 30))).toBe(false);
  });
  it('labels the interval', () => {
    expect(everyLabel(1)).toBe('Daily');
    expect(everyLabel(30)).toBe('Every 30 days');
  });
  it('has the starter suggestions from the spec', () => {
    expect(CARE_SUGGESTIONS).toEqual([
      { name: 'Spot clean', intervalDays: 1 },
      { name: 'Fresh water', intervalDays: 2 },
      { name: 'Mist', intervalDays: 2 },
      { name: 'Deep clean', intervalDays: 30 },
      { name: 'Replace UVB bulb', intervalDays: 180 },
    ]);
  });
});
```

- [ ] **Step 2: Write the failing tests in `src/db/care.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { createPet } from './pets';
import {
  archiveCareTask, completeCareTask, createCareTask, deleteCareCompletion, listAllCompletions, listCareTasks,
  listCompletions, toggleCareToday, updateCareTask,
} from './care';
import { ValidationError } from './ids';

const iso = (d: number, h = 9) => new Date(2026, 10, d, h, 0).toISOString();
let noodle: string;
let ziggy: string;

beforeEach(async () => {
  await resetDb();
  noodle = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  ziggy = (await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 })).id;
});

it('lists a pet’s tasks plus All-pets tasks, A–Z, without archived ones', async () => {
  await createCareTask({ petId: noodle, name: 'Deep clean', intervalDays: 30 });
  await createCareTask({ name: '  Fresh water ', intervalDays: 2 });
  await createCareTask({ petId: ziggy, name: 'Mist', intervalDays: 2 });
  const old = await createCareTask({ petId: noodle, name: 'Check heat mat', intervalDays: 7 });
  await archiveCareTask(old.id);
  expect((await listCareTasks(noodle)).map((t) => t.name)).toEqual(['Deep clean', 'Fresh water']);
  expect((await listCareTasks()).map((t) => t.name)).toEqual(['Deep clean', 'Fresh water', 'Mist']);
  expect((await listCareTasks(noodle))[1]!.petId).toBeUndefined();
});

it('validates tasks', async () => {
  await expect(createCareTask({ petId: noodle, name: ' ', intervalDays: 1 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 0 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 1.5 })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: noodle, name: 'Mist', intervalDays: 1, timeOfDay: '8am' })).rejects.toBeInstanceOf(ValidationError);
  await expect(createCareTask({ petId: 'missing', name: 'Mist', intervalDays: 1 })).rejects.toThrow('not found');
});

it('updates a task and can clear its time and pet', async () => {
  const t = await createCareTask({ petId: noodle, name: 'Mist', intervalDays: 2, timeOfDay: '08:00' });
  await updateCareTask(t.id, { name: 'Mist humid hide', intervalDays: 3, timeOfDay: undefined, petId: undefined });
  const after = (await db.careTasks.get(t.id))!;
  expect(after).toMatchObject({ name: 'Mist humid hide', intervalDays: 3 });
  expect(after.timeOfDay).toBeUndefined();
  expect(after.petId).toBeUndefined();
  await expect(updateCareTask(t.id, { name: '' })).rejects.toBeInstanceOf(ValidationError);
});

it('records completions oldest first and deletes one', async () => {
  const t = await createCareTask({ petId: noodle, name: 'Spot clean', intervalDays: 1 });
  await completeCareTask(t.id, iso(8));
  const c = await completeCareTask(t.id, iso(6));
  expect((await listCompletions(t.id)).map((x) => x.at)).toEqual([iso(6), iso(8)]);
  await deleteCareCompletion(c.id);
  expect(await listAllCompletions()).toHaveLength(1);
  await expect(completeCareTask('missing', iso(8))).rejects.toThrow('not found');
});

it('toggleCareToday completes now, then undoes today', async () => {
  const t = await createCareTask({ petId: noodle, name: 'Spot clean', intervalDays: 1 });
  await completeCareTask(t.id, iso(7));
  const now = new Date(2026, 10, 8, 9, 30);
  await toggleCareToday(t.id, now);
  expect((await listCompletions(t.id)).map((x) => x.at)).toEqual([iso(7), now.toISOString()]);
  await toggleCareToday(t.id, now);
  expect((await listCompletions(t.id)).map((x) => x.at)).toEqual([iso(7)]);
});
```

- [ ] **Step 3: Write the failing tests in `src/features/care/CareTasksScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareTasksScreen from './CareTasksScreen';
import { db, resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { createCareTask, listCareTasks, listCompletions, type CareTaskInput } from '../../db/care';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let noodle: string;

beforeEach(async () => {
  await resetDb();
  noodle = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A task "created" on a fixed day, so its due date doesn't depend on the real clock. */
async function taskCreatedOn(input: CareTaskInput, day: number) {
  const t = await createCareTask(input);
  await db.careTasks.update(t.id, { createdAt: new Date(2026, 10, day, 9, 0).toISOString() });
  return t;
}

function renderCare() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${noodle}/care`]}>
      <Routes>
        <Route path="/pets/:id/care" element={<CareTasksScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CareTasksScreen', () => {
  it('offers the starter suggestions and adds one with a tap', async () => {
    renderCare();
    expect(await screen.findByRole('heading', { name: 'Care tasks' })).toBeInTheDocument();
    for (const chip of ['+ Spot clean (daily)', '+ Fresh water (every 2 days)', '+ Mist (every 2 days)', '+ Deep clean (every 30 days)', '+ Replace UVB bulb (every 180 days)']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: '+ Spot clean (daily)' }));
    expect(await screen.findByRole('article', { name: 'Spot clean' })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: '+ Spot clean (daily)' })).toBeNull());
    expect(await listCareTasks(noodle)).toMatchObject([{ name: 'Spot clean', intervalDays: 1, petId: noodle }]);
  });

  it('checks a task off for today and can undo it', async () => {
    const t = await taskCreatedOn({ petId: noodle, name: 'Spot clean', intervalDays: 1 }, 6);
    renderCare();
    const card = await screen.findByRole('article', { name: 'Spot clean' });
    expect(within(card).getByText('1 day late')).toHaveClass('pill-late');

    await userEvent.click(within(card).getByRole('button', { name: 'Spot clean done today' }));
    expect(await within(card).findByText('Tomorrow')).toHaveClass('pill-ok');
    expect(within(card).getByRole('button', { name: 'Spot clean done today' })).toHaveAttribute('aria-pressed', 'true');
    expect((await listCompletions(t.id)).map((c) => c.at)).toEqual([now.toISOString()]);

    await userEvent.click(within(card).getByRole('button', { name: 'Spot clean done today' }));
    expect(await within(card).findByText('1 day late')).toBeInTheDocument();
    expect(await listCompletions(t.id)).toEqual([]);
  });

  it('adds a custom task for all pets with a time of day', async () => {
    renderCare();
    await userEvent.click(await screen.findByRole('button', { name: 'New care task' }));
    const sheet = screen.getByRole('dialog', { name: 'New care task' });
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Check temps');
    fireEvent.change(within(sheet).getByLabelText('Time of day'), { target: { value: '08:00' } });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'All pets' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    const card = await screen.findByRole('article', { name: 'Check temps' });
    expect(card).toHaveTextContent('Daily · 8:00 AM · All pets');
    const [saved] = await listCareTasks();
    expect(saved).toMatchObject({ name: 'Check temps', intervalDays: 1, timeOfDay: '08:00' });
    expect(saved!.petId).toBeUndefined();
  });

  it('shows All-pets tasks on every pet', async () => {
    await createCareTask({ name: 'Fresh water', intervalDays: 2 });
    renderCare();
    expect(await screen.findByRole('article', { name: 'Fresh water' })).toHaveTextContent('Every 2 days · All pets');
  });

  it('edits a task, then removes it', async () => {
    const t = await createCareTask({ petId: noodle, name: 'Mist', intervalDays: 2 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCare();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Mist' })).getByRole('button', { name: 'Edit' }));
    let sheet = screen.getByRole('dialog', { name: 'Edit care task' });
    await userEvent.clear(within(sheet).getByLabelText('Name'));
    await userEvent.type(within(sheet).getByLabelText('Name'), 'Mist humid hide');
    await userEvent.clear(within(sheet).getByLabelText('Repeat every (days)'));
    await userEvent.type(within(sheet).getByLabelText('Repeat every (days)'), '3');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    const card = await screen.findByRole('article', { name: 'Mist humid hide' });
    expect(card).toHaveTextContent('Every 3 days');

    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    sheet = screen.getByRole('dialog', { name: 'Edit care task' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove task' }));
    await vi.waitFor(() => expect(screen.queryByRole('article', { name: 'Mist humid hide' })).toBeNull());
    expect((await db.careTasks.get(t.id))!.archivedAt).toBeDefined();
  });

  it('needs a name', async () => {
    renderCare();
    await userEvent.click(await screen.findByRole('button', { name: 'New care task' }));
    const sheet = screen.getByRole('dialog', { name: 'New care task' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save task' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Name the task');
  });

  it('is routed at /pets/:id/care', async () => {
    renderAt(`/pets/${noodle}/care`);
    expect(await screen.findByRole('heading', { name: 'Care tasks' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/domain/care.test.ts src/db/care.test.ts src/features/care`
Expected: FAIL with `Failed to resolve import "./care"` / `"./CareTasksScreen"`.

- [ ] **Step 5: Create `src/domain/care.ts`**

```ts
import { addDays, isSameDay, parseISO, startOfDay } from 'date-fns';
import type { CareCompletion, CareTask } from './types';
import { atTime } from './dates';

/** Spec §5.10 starter suggestions (one tap to add). */
export const CARE_SUGGESTIONS: readonly { name: string; intervalDays: number }[] = [
  { name: 'Spot clean', intervalDays: 1 },
  { name: 'Fresh water', intervalDays: 2 },
  { name: 'Mist', intervalDays: 2 },
  { name: 'Deep clean', intervalDays: 30 },
  { name: 'Replace UVB bulb', intervalDays: 180 },
];

export function lastCompletionAt(completions: readonly Pick<CareCompletion, 'at'>[]): string | undefined {
  let best: string | undefined;
  for (const c of completions) if (!best || Date.parse(c.at) > Date.parse(best)) best = c.at;
  return best;
}

/**
 * Spec §7 rule 9: last completion (or the task's creation date) + intervalDays, on that calendar day,
 * at timeOfDay when set. Statuses come from dueStatus()/statusLabel(), the same as feedings.
 */
export function careNextDue(
  task: Pick<CareTask, 'createdAt' | 'intervalDays' | 'timeOfDay'>,
  completions: readonly Pick<CareCompletion, 'at'>[],
): Date {
  const base = parseISO(lastCompletionAt(completions) ?? task.createdAt);
  const day = addDays(startOfDay(base), task.intervalDays);
  return task.timeOfDay ? atTime(day, task.timeOfDay) : day;
}

export function completedOn(completions: readonly Pick<CareCompletion, 'at'>[], day: Date): boolean {
  return completions.some((c) => isSameDay(parseISO(c.at), day));
}

export function everyLabel(intervalDays: number): string {
  return intervalDays === 1 ? 'Daily' : `Every ${intervalDays} days`;
}
```

- [ ] **Step 6: Create `src/db/care.ts`**

```ts
import Dexie from 'dexie';
import { isSameDay, parseISO } from 'date-fns';
import type { CareCompletion, CareTask } from '../domain/types';
import { isTimeOfDay } from '../domain/dates';
import { db } from './db';
import { newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface CareTaskInput {
  /** Empty means all pets. */
  petId?: string;
  name: string;
  intervalDays: number;
  timeOfDay?: string;
}

function validate(p: Partial<CareTaskInput>): void {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError('Name the task');
  if (p.intervalDays !== undefined && !(Number.isInteger(p.intervalDays) && p.intervalDays >= 1)) {
    throw new ValidationError('Repeat every must be at least 1 day');
  }
  if (p.timeOfDay && !isTimeOfDay(p.timeOfDay)) throw new ValidationError('Pick a time of day');
}

export async function createCareTask(input: CareTaskInput): Promise<CareTask> {
  validate(input);
  if (input.petId && !(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
  const ts = nowIso();
  const task: CareTask = {
    id: newId(), petId: input.petId || undefined, name: input.name.trim(), intervalDays: input.intervalDays,
    timeOfDay: input.timeOfDay || undefined, createdAt: ts, updatedAt: ts,
  };
  await db.careTasks.add(task);
  return task;
}

/** Keys present with `undefined` are removed (no time of day; an All-pets task). */
export async function updateCareTask(id: string, patch: Partial<CareTaskInput>): Promise<void> {
  validate(patch);
  const next: Partial<CareTask> = { ...patch, updatedAt: nowIso() };
  if (patch.name !== undefined) next.name = patch.name.trim();
  if ('timeOfDay' in patch) next.timeOfDay = patch.timeOfDay || undefined;
  if ('petId' in patch) next.petId = patch.petId || undefined;
  const changed = await db.careTasks.update(id, next);
  if (!changed) throw new Error(`Care task ${id} not found`);
}

export async function archiveCareTask(id: string): Promise<void> {
  const ts = nowIso();
  const changed = await db.careTasks.update(id, { archivedAt: ts, updatedAt: ts });
  if (!changed) throw new Error(`Care task ${id} not found`);
}

export async function completeCareTask(taskId: string, at: string = nowIso()): Promise<CareCompletion> {
  requireDateTime(at);
  if (!(await db.careTasks.get(taskId))) throw new Error(`Care task ${taskId} not found`);
  const ts = nowIso();
  const c: CareCompletion = { id: newId(), taskId, at, createdAt: ts, updatedAt: ts };
  await db.careCompletions.add(c);
  return c;
}

export async function deleteCareCompletion(id: string): Promise<void> {
  await db.careCompletions.delete(id);
}

/** The checklist tick: undo today's completion if there is one, otherwise complete it now. */
export async function toggleCareToday(taskId: string, now: Date): Promise<void> {
  await db.transaction('rw', [db.careTasks, db.careCompletions], async () => {
    const all = await db.careCompletions.where('taskId').equals(taskId).toArray();
    const today = all.filter((c) => isSameDay(parseISO(c.at), now));
    if (today.length > 0) await db.careCompletions.bulkDelete(today.map((c) => c.id));
    else await completeCareTask(taskId, now.toISOString());
  });
}

/** Active tasks A–Z. With `petId`: that pet's tasks plus the All-pets tasks. */
export async function listCareTasks(petId?: string): Promise<CareTask[]> {
  const all = await db.careTasks.toArray();
  return all
    .filter((t) => !t.archivedAt && (petId === undefined || !t.petId || t.petId === petId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const listCompletions = (taskId: string): Promise<CareCompletion[]> =>
  db.careCompletions.where('[taskId+at]').between([taskId, Dexie.minKey], [taskId, Dexie.maxKey]).toArray();

export const listAllCompletions = (): Promise<CareCompletion[]> => db.careCompletions.toArray();
```

- [ ] **Step 7: Create `src/features/care/CareTaskSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { CareTask, Pet } from '../../domain/types';
import { archiveCareTask, createCareTask, updateCareTask } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Segmented } from '../../ui/Segmented';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  task?: CareTask;
}

type Scope = 'pet' | 'all';

export default function CareTaskSheet(props: Props) {
  if (!props.open) return null;
  return <CareTaskForm {...props} />;
}

function CareTaskForm({ pet, onClose, task }: Props) {
  const [name, setName] = useState(task?.name ?? '');
  const [intervalDays, setIntervalDays] = useState(String(task?.intervalDays ?? 1));
  const [time, setTime] = useState(task?.timeOfDay ?? '');
  const [scope, setScope] = useState<Scope>(task && !task.petId ? 'all' : 'pet');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const title = task ? 'Edit care task' : 'New care task';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSaving(true);
    const input = {
      petId: scope === 'pet' ? pet.id : undefined,
      name,
      intervalDays: Number(intervalDays),
      timeOfDay: time || undefined,
    };
    try {
      if (task) await updateCareTask(task.id, input);
      else await createCareTask(input);
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!task || !window.confirm(`Remove ${task.name}? Its history is kept.`)) return;
    try {
      await archiveCareTask(task.id);
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
    }
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title={title} subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Name">
          <input value={name} placeholder="Spot clean" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Repeat every (days)">
          <input type="number" inputMode="numeric" min={1} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
        </Field>
        <Field label="Time of day">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Optional. Leave it empty for any time.</div>
        <div className="label">For</div>
        <Segmented<Scope>
          label="For"
          options={[{ value: 'pet', label: pet.name }, { value: 'all', label: 'All pets' }]}
          value={scope}
          onChange={setScope}
        />
        <button type="submit" className="btn-primary" style={{ marginTop: 12 }} disabled={saving}>Save task</button>
        {task && (
          <button type="button" className="btn-ghost btn-danger" style={{ marginTop: 8 }} onClick={onRemove}>Remove task</button>
        )}
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `src/features/care/CareTasksScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CareTask } from '../../domain/types';
import { formatTimeOfDay } from '../../domain/dates';
import { dueStatus, statusLabel } from '../../domain/feeding';
import { CARE_SUGGESTIONS, careNextDue, completedOn, everyLabel } from '../../domain/care';
import { createCareTask, listCareTasks, listCompletions, toggleCareToday } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import { TONE } from '../pets/PetsHome';
import { PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import CareTaskSheet from './CareTaskSheet';

export default function CareTasksScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const rows = useLiveQuery(async () => {
    if (!petId) return undefined;
    const tasks = await listCareTasks(petId);
    return Promise.all(tasks.map(async (task) => ({ task, completions: await listCompletions(task.id) })));
  }, [petId]);
  const [editing, setEditing] = useState<CareTask | 'new' | null>(null);
  const [error, setError] = useState<string>();

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!rows) return null;

  const run = async (action: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(saveErrorText(err));
    }
  };
  const names = new Set(rows.map(({ task }) => task.name.toLowerCase()));
  const suggestions = CARE_SUGGESTIONS.filter((s) => !names.has(s.name.toLowerCase()));

  return (
    <>
      <SubScreenHeader pet={pet} title="Care tasks" addLabel="New care task" onAdd={() => setEditing('new')} />
      {error && <div role="alert" className="form-error">{error}</div>}
      <div style={{ marginTop: 12 }} />
      {rows.length === 0 && <p className="muted">No care tasks yet. Add one, or start from a suggestion below.</p>}

      {rows.map(({ task, completions }) => {
        const due = careNextDue(task, completions);
        const done = completedOn(completions, now);
        return (
          <Card key={task.id} role="article" aria-label={task.name}>
            <div className="row">
              <button
                type="button"
                className="check"
                aria-pressed={done}
                aria-label={`${task.name} done today`}
                onClick={() => run(() => toggleCareToday(task.id, now))}
              >
                {done ? '✓' : ''}
              </button>
              <div className="grow">
                <b>{task.name}</b>
                <div className="muted">
                  {[everyLabel(task.intervalDays), task.timeOfDay && formatTimeOfDay(task.timeOfDay), !task.petId && 'All pets']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <Pill tone={TONE[dueStatus(due, now)]}>{statusLabel(due, now)}</Pill>
              <button type="button" className="btn" onClick={() => setEditing(task)}>Edit</button>
            </div>
          </Card>
        );
      })}

      {suggestions.length > 0 && (
        <>
          <div className="label">Starter suggestions</div>
          <div className="chips">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                className="chip"
                onClick={() => run(() => createCareTask({ petId: pet.id, name: s.name, intervalDays: s.intervalDays }))}
              >
                {`+ ${s.name} (${everyLabel(s.intervalDays).toLowerCase()})`}
              </button>
            ))}
          </div>
        </>
      )}

      <CareTaskSheet
        pet={pet}
        open={editing !== null}
        task={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
```

- [ ] **Step 9: Replace the whole of `src/app/App.tsx`** (adds the Care tasks route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';
import CareTasksScreen from '../features/care/CareTasksScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="pets/:id/care" element={<CareTasksScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add care tasks with due dates, check-off and starter suggestions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vet visits with clinic, photos and the next appointment

Spec §5.11. The clinic card shows the details of the most recent visit that has any. A new visit starts with those details filled in. Photos use the Plan 1 pipeline (`photoFromFile` → `savePhoto`). Photos added in a sheet that is then cancelled are deleted, and so are photos removed from a saved visit. The **📅 Add to Calendar** button is Plan 3; this task only stores and shows `nextAppointment`.

**Files:**
- Create: `src/db/vetVisits.ts`, `src/ui/PhotoThumb.tsx`, `src/features/vet/vetModel.ts`, `src/features/vet/VetVisitSheet.tsx`, `src/features/vet/VetScreen.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/db/vetVisits.test.ts`, `src/features/vet/vetModel.test.ts`, `src/features/vet/VetScreen.test.tsx`

**Interfaces:**
- Consumes: `savePhoto`, `deletePhoto` (Plan 1 `db/photos.ts`), `photoFromFile` (Plan 1 `lib/image.ts`), `usePhotoUrl`, `cleanText`, `requireDateKey`, `requireDateTime`, `saveErrorText`, `combineDateTime`, `dateKey`, `isDateKey`, `parseOptionalNumber` (Task 2), `useRoutePet`, `PetNotFound`, `SubScreenHeader`, `confirmDelete`, `plural`, `formatDateKey` (Task 4 / Plan 1), `Field`, `SheetHeader`, `Sheet`, `Card`, `useNow`
- Produces:
  - `src/db/vetVisits.ts`: `interface VetVisitInput { petId: string; date: string; clinic?: string; vet?: string; phone?: string; reason?: string; notes?: string; cost?: number; photoIds?: string[]; nextAppointment?: string }`, `createVetVisit(input): Promise<VetVisit>`, `updateVetVisit(id, patch: Partial<Omit<VetVisitInput, 'petId'>>): Promise<void>` (deletes photos dropped from `photoIds`; blank text and `undefined` remove a field), `deleteVetVisit(id): Promise<void>` (and its photos), `listVetVisits(petId): Promise<VetVisit[]>` (oldest first)
  - `src/ui/PhotoThumb.tsx`: `PhotoThumb({ photoId, onOpen?, onRemove? })` (buttons named `Open photo` / `Remove photo`), `FullPhoto({ photoId })` (`<img alt="Visit photo">`)
  - `src/features/vet/vetModel.ts`: `interface ClinicInfo { clinic?: string; vet?: string; phone?: string }`, `clinicInfo(visits): ClinicInfo | undefined`, `upcomingAppointment(visits, now): { at: Date; visit: VetVisit } | undefined` (the earliest `nextAppointment` from today on), `telHref(phone: string): string`
  - `VetVisitSheet` (default export): props `{ pet, open, onClose, visit?: VetVisit, now? }`, title `New vet visit` / `Edit vet visit`
  - Route `/pets/:id/vet` → `VetScreen` (`h1` "Vet visits")

- [ ] **Step 1: Write the failing tests in `src/db/vetVisits.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { createPet } from './pets';
import { savePhoto } from './photos';
import { createVetVisit, deleteVetVisit, listVetVisits, updateVetVisit } from './vetVisits';
import { ValidationError } from './ids';

let petId: string;
const photo = () => savePhoto({ blob: new Blob(['full']), thumbBlob: new Blob(['thumb']), width: 4, height: 3 });

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('creates visits with trimmed text and no photos by default, oldest first', async () => {
  await createVetVisit({ petId, date: '2026-06-14', clinic: ' Exotic Animal Clinic ', reason: 'Wellness exam', cost: 85 });
  const first = await createVetVisit({ petId, date: '2026-04-20', vet: '', notes: 'No mites' });
  expect(first.photoIds).toEqual([]);
  expect(first.vet).toBeUndefined();
  const visits = await listVetVisits(petId);
  expect(visits.map((v) => v.date)).toEqual(['2026-04-20', '2026-06-14']);
  expect(visits[1]).toMatchObject({ clinic: 'Exotic Animal Clinic', reason: 'Wellness exam', cost: 85 });
});

it('validates the date, the cost and the next appointment', async () => {
  await expect(createVetVisit({ petId, date: '' })).rejects.toBeInstanceOf(ValidationError);
  await expect(createVetVisit({ petId, date: '2026-06-14', cost: -1 })).rejects.toThrow('Cost must be a number');
  await expect(createVetVisit({ petId, date: '2026-06-14', nextAppointment: 'soon' })).rejects.toBeInstanceOf(ValidationError);
  await expect(createVetVisit({ petId: 'missing', date: '2026-06-14' })).rejects.toThrow('not found');
});

it('updating deletes the photos taken off the visit and clears emptied fields', async () => {
  const keep = await photo();
  const drop = await photo();
  const v = await createVetVisit({
    petId, date: '2026-06-14', reason: 'Wellness exam', cost: 85, photoIds: [keep, drop],
    nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(),
  });
  await updateVetVisit(v.id, { reason: '', cost: undefined, photoIds: [keep], nextAppointment: undefined });
  const after = (await db.vetVisits.get(v.id))!;
  expect(after.photoIds).toEqual([keep]);
  expect(after.reason).toBeUndefined();
  expect(after.cost).toBeUndefined();
  expect(after.nextAppointment).toBeUndefined();
  expect((await db.photos.toArray()).map((p) => p.id)).toEqual([keep]);
  await expect(updateVetVisit('missing', { reason: 'x' })).rejects.toThrow('not found');
});

it('deleting a visit deletes its photos', async () => {
  const v = await createVetVisit({ petId, date: '2026-06-14', photoIds: [await photo()] });
  await deleteVetVisit(v.id);
  expect(await listVetVisits(petId)).toEqual([]);
  expect(await db.photos.count()).toBe(0);
});
```

- [ ] **Step 2: Write the failing tests in `src/features/vet/vetModel.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { VetVisit } from '../../domain/types';
import { clinicInfo, telHref, upcomingAppointment } from './vetModel';

let n = 0;
const visit = (date: string, extra: Partial<VetVisit> = {}): VetVisit => ({
  id: `v${++n}`, petId: 'p1', date, photoIds: [], createdAt: '', updatedAt: '', ...extra,
});

describe('vetModel', () => {
  it('takes the clinic card from the latest visit that has details', () => {
    const visits = [
      visit('2026-04-20', { clinic: 'Old Clinic' }),
      visit('2026-06-14', { clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel', phone: '(555) 201-4470' }),
      visit('2026-07-01'),
    ];
    expect(clinicInfo(visits)).toEqual({ clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel', phone: '(555) 201-4470' });
    expect(clinicInfo([visit('2026-07-01')])).toBeUndefined();
  });

  it('finds the earliest appointment from today on', () => {
    const now = new Date(2026, 10, 8, 15, 0);
    const later = visit('2026-06-14', { nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString() });
    const soon = visit('2026-10-01', { nextAppointment: new Date(2026, 10, 20, 9, 0).toISOString() });
    const past = visit('2026-01-01', { nextAppointment: new Date(2026, 10, 1, 9, 0).toISOString() });
    const earlierToday = visit('2026-02-01', { nextAppointment: new Date(2026, 10, 8, 9, 0).toISOString() });
    expect(upcomingAppointment([later, soon, past], now)!.visit).toBe(soon);
    expect(upcomingAppointment([later, earlierToday], now)!.visit).toBe(earlierToday);
    expect(upcomingAppointment([past], now)).toBeUndefined();
  });

  it('builds a tap-to-call link', () => {
    expect(telHref('(555) 201-4470')).toBe('tel:5552014470');
    expect(telHref('+44 20 7946 0958')).toBe('tel:+442079460958');
  });
});
```

- [ ] **Step 3: Write the failing tests in `src/features/vet/VetScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VetScreen from './VetScreen';
import { db, resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { savePhoto } from '../../db/photos';
import { createVetVisit, listVetVisits } from '../../db/vetVisits';
import { renderAt } from '../../test/render';

// jsdom can't decode images: the photo pipeline returns fixed blobs.
vi.mock('../../lib/image', () => ({
  photoFromFile: vi.fn(async () => ({ blob: new Blob(['full']), thumbBlob: new Blob(['thumb']), width: 4, height: 3 })),
}));

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  // Stored blobs aren't real Blobs under fake-indexeddb, so stub the object-URL calls usePhotoUrl makes.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  const photoId = await savePhoto({ blob: new Blob(['x']), thumbBlob: new Blob(['y']), width: 4, height: 3 });
  await createVetVisit({
    petId, date: '2026-04-20', reason: 'New-pet check', notes: 'No mites, good body condition.', clinic: 'Exotic Animal Clinic',
  });
  await createVetVisit({
    petId, date: '2026-06-14', reason: 'Wellness exam', clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel',
    phone: '(555) 201-4470', cost: 85, notes: 'Healthy. Weight 28 g.', photoIds: [photoId],
    nextAppointment: new Date(2027, 5, 14, 10, 0).toISOString(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderVet() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/vet`]}>
      <Routes>
        <Route path="/pets/:id/vet" element={<VetScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const photoFile = () => new File(['jpeg'], 'visit.jpg', { type: 'image/jpeg' });

describe('VetScreen', () => {
  it('shows the next appointment, the clinic and the history', async () => {
    renderVet();
    const next = await screen.findByRole('group', { name: 'Next appointment' });
    expect(within(next).getByText('Mon, Jun 14, 2027 · 10:00 AM')).toBeInTheDocument();
    expect(within(next).getByText('Exotic Animal Clinic')).toBeInTheDocument();
    expect(screen.getByText('Dr. Patel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '(555) 201-4470' })).toHaveAttribute('href', 'tel:5552014470');

    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Jun 14, 2026 · Wellness exam');
    expect(items[0]).toHaveTextContent('Healthy. Weight 28 g.');
    expect(items[0]).toHaveTextContent('$85 · 1 photo');
    expect(items[1]).toHaveTextContent('Apr 20, 2026 · New-pet check');

    await userEvent.click(within(items[0]!).getByRole('button', { name: 'Open photo' }));
    expect(await within(screen.getByRole('dialog', { name: 'Photo' })).findByRole('img', { name: 'Visit photo' })).toBeInTheDocument();
  });

  it('adds a visit with a photo, starting from the last clinic details', async () => {
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    await vi.waitFor(() => expect(within(sheet).getByLabelText('Clinic')).toHaveValue('Exotic Animal Clinic'));
    expect(within(sheet).getByLabelText('Vet')).toHaveValue('Dr. Patel');
    await userEvent.type(within(sheet).getByLabelText('Reason'), 'Mites check');
    await userEvent.type(within(sheet).getByLabelText('Cost ($)'), '40');
    fireEvent.change(within(sheet).getByLabelText('Add photos'), { target: { files: [photoFile()] } });
    expect(await within(sheet).findByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save visit' }));
    await vi.waitFor(async () => expect(await listVetVisits(petId)).toHaveLength(3));
    const saved = (await listVetVisits(petId)).at(-1)!;
    expect(saved).toMatchObject({ date: '2026-11-08', reason: 'Mites check', cost: 40, clinic: 'Exotic Animal Clinic', phone: '(555) 201-4470' });
    expect(saved.photoIds).toHaveLength(1);
    expect(await db.photos.count()).toBe(2);
  });

  it('cancelling a new visit deletes the photos added to it', async () => {
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    fireEvent.change(within(sheet).getByLabelText('Add photos'), { target: { files: [photoFile()] } });
    await within(sheet).findByRole('button', { name: 'Remove photo' });
    expect(await db.photos.count()).toBe(2);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await vi.waitFor(async () => expect(await db.photos.count()).toBe(1));
  });

  it('edits a visit: removes its photo and its next appointment', async () => {
    renderVet();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit vet visit' });
    expect(within(sheet).getByLabelText('Reason')).toHaveValue('Wellness exam');
    expect(within(sheet).getByLabelText('Next appointment')).toHaveValue('2027-06-14');
    expect(within(sheet).getByLabelText('Appointment time')).toHaveValue('10:00');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Remove photo' }));
    fireEvent.change(within(sheet).getByLabelText('Next appointment'), { target: { value: '' } });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save visit' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const edited = (await listVetVisits(petId)).at(-1)!;
    expect(edited.photoIds).toEqual([]);
    expect(edited.nextAppointment).toBeUndefined();
    expect(await db.photos.count()).toBe(0);
    await vi.waitFor(() => expect(screen.queryByRole('group', { name: 'Next appointment' })).toBeNull());
  });

  it('deletes a visit and its photos after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderVet();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listVetVisits(petId)).toHaveLength(1));
    expect(await db.photos.count()).toBe(0);
  });

  it('a cleared visit date blocks saving without crashing', async () => {
    renderVet();
    await userEvent.click(await screen.findByRole('button', { name: 'New vet visit' }));
    const sheet = screen.getByRole('dialog', { name: 'New vet visit' });
    await userEvent.clear(within(sheet).getByLabelText('Visit date'));
    expect(within(sheet).getByRole('button', { name: 'Save visit' })).toBeDisabled();
  });

  it('is routed at /pets/:id/vet', async () => {
    renderAt(`/pets/${petId}/vet`);
    expect(await screen.findByRole('heading', { name: 'Vet visits' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/db/vetVisits.test.ts src/features/vet`
Expected: FAIL with `Failed to resolve import "./vetVisits"`, `"./vetModel"`, `"./VetScreen"`.

- [ ] **Step 5: Create `src/db/vetVisits.ts`**

```ts
import Dexie from 'dexie';
import type { VetVisit } from '../domain/types';
import { db } from './db';
import { cleanText, newId, nowIso, requireDateKey, requireDateTime, ValidationError } from './ids';

export interface VetVisitInput {
  petId: string;
  date: string;
  clinic?: string;
  vet?: string;
  phone?: string;
  reason?: string;
  notes?: string;
  cost?: number;
  photoIds?: string[];
  nextAppointment?: string;
}

type VetVisitPatch = Partial<Omit<VetVisitInput, 'petId'>>;

const TEXT_FIELDS = ['clinic', 'vet', 'phone', 'reason', 'notes'] as const;

function validate(p: VetVisitPatch): void {
  if (p.date !== undefined) requireDateKey(p.date, 'Pick the visit date');
  if (p.cost !== undefined && !(Number.isFinite(p.cost) && p.cost >= 0)) throw new ValidationError('Cost must be a number');
  if (p.nextAppointment !== undefined) requireDateTime(p.nextAppointment, 'Pick the appointment date and time');
}

/** Trims the text fields; a blank one becomes undefined (removed on update). */
function withCleanText(p: VetVisitPatch): Partial<VetVisit> {
  const out: Partial<VetVisit> = { ...p };
  for (const key of TEXT_FIELDS) if (key in p) out[key] = cleanText(p[key]);
  return out;
}

export async function createVetVisit(input: VetVisitInput): Promise<VetVisit> {
  requireDateKey(input.date, 'Pick the visit date');
  validate(input);
  return db.transaction('rw', [db.pets, db.vetVisits], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const visit: VetVisit = {
      ...withCleanText(input),
      id: newId(),
      petId: input.petId,
      date: input.date,
      photoIds: input.photoIds ?? [],
      createdAt: ts,
      updatedAt: ts,
    };
    await db.vetVisits.add(visit);
    return visit;
  });
}

export async function updateVetVisit(id: string, patch: VetVisitPatch): Promise<void> {
  validate(patch);
  await db.transaction('rw', [db.vetVisits, db.photos], async () => {
    const visit = await db.vetVisits.get(id);
    if (!visit) throw new Error(`Vet visit ${id} not found`);
    if (patch.photoIds) {
      const kept = new Set(patch.photoIds);
      await db.photos.bulkDelete(visit.photoIds.filter((p) => !kept.has(p)));
    }
    await db.vetVisits.update(id, { ...withCleanText(patch), updatedAt: nowIso() });
  });
}

export async function deleteVetVisit(id: string): Promise<void> {
  await db.transaction('rw', [db.vetVisits, db.photos], async () => {
    const visit = await db.vetVisits.get(id);
    if (!visit) return;
    await db.photos.bulkDelete(visit.photoIds);
    await db.vetVisits.delete(id);
  });
}

export const listVetVisits = (petId: string): Promise<VetVisit[]> =>
  db.vetVisits.where('[petId+date]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
```

- [ ] **Step 6: Create `src/ui/PhotoThumb.tsx`**

```tsx
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
```

- [ ] **Step 7: Create `src/features/vet/vetModel.ts`**

```ts
import { parseISO, startOfDay } from 'date-fns';
import type { VetVisit } from '../../domain/types';

export interface ClinicInfo {
  clinic?: string;
  vet?: string;
  phone?: string;
}

/** Spec §5.11 clinic card: the most recent visit that has a clinic, vet or phone. */
export function clinicInfo(visits: readonly VetVisit[]): ClinicInfo | undefined {
  const v = [...visits]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .find((x) => x.clinic || x.vet || x.phone);
  return v ? { clinic: v.clinic, vet: v.vet, phone: v.phone } : undefined;
}

/** The earliest next appointment from the start of today on. */
export function upcomingAppointment(visits: readonly VetVisit[], now: Date): { at: Date; visit: VetVisit } | undefined {
  const from = startOfDay(now).getTime();
  let best: { at: Date; visit: VetVisit } | undefined;
  for (const visit of visits) {
    if (!visit.nextAppointment) continue;
    const at = parseISO(visit.nextAppointment);
    if (at.getTime() >= from && (!best || at.getTime() < best.at.getTime())) best = { at, visit };
  }
  return best;
}

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
```

- [ ] **Step 8: Create `src/features/vet/VetVisitSheet.tsx`**

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Pet, VetVisit } from '../../domain/types';
import { combineDateTime, dateKey, isDateKey } from '../../domain/dates';
import { createVetVisit, listVetVisits, updateVetVisit } from '../../db/vetVisits';
import { deletePhoto, savePhoto } from '../../db/photos';
import { saveErrorText } from '../../db/ids';
import { photoFromFile } from '../../lib/image';
import { parseOptionalNumber } from '../../lib/numbers';
import { Sheet } from '../../ui/Sheet';
import { Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';
import { PhotoThumb } from '../../ui/PhotoThumb';
import { clinicInfo } from './vetModel';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  visit?: VetVisit;
  now?: Date;
}

export default function VetVisitSheet(props: Props) {
  if (!props.open) return null;
  return <VetVisitForm {...props} />;
}

function VetVisitForm({ pet, onClose, visit, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const previous = useLiveQuery(() => listVetVisits(pet.id), [pet.id]);
  const nextAt0 = visit?.nextAppointment ? parseISO(visit.nextAppointment) : undefined;
  const [date, setDate] = useState(visit?.date ?? dateKey(now));
  const [reason, setReason] = useState(visit?.reason ?? '');
  const [clinic, setClinic] = useState(visit?.clinic ?? '');
  const [vet, setVet] = useState(visit?.vet ?? '');
  const [phone, setPhone] = useState(visit?.phone ?? '');
  const [cost, setCost] = useState(visit?.cost === undefined ? '' : String(visit.cost));
  const [notes, setNotes] = useState(visit?.notes ?? '');
  const [photoIds, setPhotoIds] = useState<string[]>(visit?.photoIds ?? []);
  const [added, setAdded] = useState<string[]>([]);
  const [nextDate, setNextDate] = useState(nextAt0 ? dateKey(nextAt0) : '');
  const [nextTime, setNextTime] = useState(nextAt0 ? format(nextAt0, 'HH:mm') : '09:00');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const prefilled = useRef(!!visit);

  // A new visit starts with the clinic details from the last visit.
  useEffect(() => {
    if (prefilled.current || !previous) return;
    prefilled.current = true;
    const c = clinicInfo(previous);
    if (!c) return;
    setClinic((v) => v || c.clinic || '');
    setVet((v) => v || c.vet || '');
    setPhone((v) => v || c.phone || '');
  }, [previous]);

  const nextAt = nextDate === '' ? undefined : combineDateTime(nextDate, nextTime);
  const valid = isDateKey(date) && nextAt !== null;
  const title = visit ? 'Edit vet visit' : 'New vet visit';

  async function onPhotos(files: File[]) {
    setError(undefined);
    for (const file of files) {
      try {
        const id = await savePhoto(await photoFromFile(file));
        setPhotoIds((ids) => [...ids, id]);
        setAdded((ids) => [...ids, id]);
      } catch {
        setError("Couldn't read that photo.");
      }
    }
  }

  function removePhoto(id: string) {
    setPhotoIds((ids) => ids.filter((x) => x !== id));
    // A photo added in this sheet is deleted now; one already saved on the visit is deleted on Save.
    if (added.includes(id)) {
      setAdded((ids) => ids.filter((x) => x !== id));
      deletePhoto(id).catch(() => {});
    }
  }

  function cancel() {
    for (const id of added) deletePhoto(id).catch(() => {});
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const c = parseOptionalNumber(cost);
    if (Number.isNaN(c)) return setError('Cost must be a number');
    setError(undefined);
    setSaving(true);
    const input = {
      date, reason, clinic, vet, phone, notes, cost: c, photoIds,
      nextAppointment: nextAt ? nextAt.toISOString() : undefined,
    };
    try {
      if (visit) await updateVetVisit(visit.id, input);
      else await createVetVisit({ petId: pet.id, ...input });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={cancel} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title={title} subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <Field label="Visit date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reason">
          <input value={reason} placeholder="Wellness exam" onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Clinic">
          <input value={clinic} onChange={(e) => setClinic(e.target.value)} />
        </Field>
        <Field label="Vet">
          <input value={vet} onChange={(e) => setVet(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Cost ($)">
          <input type="number" inputMode="decimal" step="any" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Notes" stack>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="label">Photos</div>
        {photoIds.length > 0 && (
          <div className="thumbs">
            {photoIds.map((id) => <PhotoThumb key={id} photoId={id} onRemove={() => removePhoto(id)} />)}
          </div>
        )}
        <label className="btn-ghost" style={{ textAlign: 'center', marginTop: 8, marginBottom: 8 }}>
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = ''; // so picking the same photo again still fires
              void onPhotos(files);
            }}
          />
        </label>

        <Field label="Next appointment">
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
        {nextDate !== '' && (
          <Field label="Appointment time">
            <input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
          </Field>
        )}

        <button type="submit" className="btn-primary" disabled={saving || !valid}>Save visit</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 9: Create `src/features/vet/VetScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import type { VetVisit } from '../../domain/types';
import { deleteVetVisit, listVetVisits } from '../../db/vetVisits';
import { Card } from '../../ui/Card';
import { Sheet } from '../../ui/Sheet';
import { FullPhoto, PhotoThumb } from '../../ui/PhotoThumb';
import { useNow } from '../../ui/useNow';
import { formatDateKey, plural } from '../pets/format';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import { clinicInfo, telHref, upcomingAppointment } from './vetModel';
import VetVisitSheet from './VetVisitSheet';

export default function VetScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const visits = useLiveQuery(() => (petId ? listVetVisits(petId) : undefined), [petId]);
  const [editing, setEditing] = useState<VetVisit | 'new' | null>(null);
  const [viewing, setViewing] = useState<string>();

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!visits) return null;

  const clinic = clinicInfo(visits);
  const next = upcomingAppointment(visits, now);
  const history = [...visits].reverse();

  return (
    <>
      <SubScreenHeader pet={pet} title="Vet visits" addLabel="New vet visit" onAdd={() => setEditing('new')} />

      {next && (
        <Card role="group" aria-label="Next appointment" style={{ marginTop: 12 }}>
          <div className="label" style={{ margin: 0 }}>Next appointment</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{format(next.at, 'EEE, MMM d, yyyy · h:mm a')}</div>
          {(next.visit.clinic ?? clinic?.clinic) && <div className="muted">{next.visit.clinic ?? clinic?.clinic}</div>}
        </Card>
      )}

      {clinic && (
        <>
          <div className="label">Clinic</div>
          <Card>
            {clinic.clinic && <b>{clinic.clinic}</b>}
            <div className="muted">
              {clinic.vet && <span>{clinic.vet}</span>}
              {clinic.vet && clinic.phone && <span> · </span>}
              {clinic.phone && <a href={telHref(clinic.phone)}>{clinic.phone}</a>}
            </div>
          </Card>
        </>
      )}

      <div className="label">History</div>
      {history.length === 0 && <p className="muted">No vet visits logged yet.</p>}
      {history.map((v) => (
        <Card key={v.id} role="article">
          <b>{[formatDateKey(v.date), v.reason].filter(Boolean).join(' · ')}</b>
          {v.notes && <div style={{ marginTop: 2 }}>{v.notes}</div>}
          {(v.cost !== undefined || v.photoIds.length > 0) && (
            <div className="muted">
              {[v.cost !== undefined && `$${v.cost}`, v.photoIds.length > 0 && plural(v.photoIds.length, 'photo')]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {v.photoIds.length > 0 && (
            <div className="thumbs">
              {v.photoIds.map((id) => <PhotoThumb key={id} photoId={id} onOpen={() => setViewing(id)} />)}
            </div>
          )}
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEditing(v)}>Edit</button>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('vet visit', () => deleteVetVisit(v.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}

      <VetVisitSheet
        pet={pet}
        open={editing !== null}
        visit={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
        now={now}
      />
      <Sheet open={viewing !== undefined} onClose={() => setViewing(undefined)} title="Photo">
        {viewing && <FullPhoto photoId={viewing} />}
      </Sheet>
    </>
  );
}
```

- [ ] **Step 10: Replace the whole of `src/app/App.tsx`** (adds the Vet visits route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';
import CareTasksScreen from '../features/care/CareTasksScreen';
import VetScreen from '../features/vet/VetScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="pets/:id/care" element={<CareTasksScreen />} />
        <Route path="pets/:id/vet" element={<VetScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 11: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add vet visits with clinic card, photos and next appointment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Notes

Spec §5.12: dated free-text notes for each pet, with edit and delete.

**Files:**
- Create: `src/db/notes.ts`, `src/features/notes/NoteSheet.tsx`, `src/features/notes/NotesScreen.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/db/notes.test.ts`, `src/features/notes/NotesScreen.test.tsx`

**Interfaces:**
- Consumes: `requireDateTime`, `saveErrorText`, `combineDateTime`, `dateKey`, `ValidationError` (Task 2), `useRoutePet`, `PetNotFound`, `SubScreenHeader`, `confirmDelete` (Task 4), `Field`, `DateTimeFields`, `SheetHeader`, `Sheet`, `Card`, `useNow`
- Produces:
  - `src/db/notes.ts`: `interface NoteInput { petId: string; at: string; text: string }`, `addNote(input): Promise<Note>`, `updateNote(id, patch: Partial<Pick<Note, 'at' | 'text'>>): Promise<void>`, `deleteNote(id): Promise<void>`, `listNotes(petId): Promise<Note[]>` (oldest first)
  - `NoteSheet` (default export): props `{ pet, open, onClose, note?: Note, now? }`, title `New note` / `Edit note`
  - Route `/pets/:id/notes` → `NotesScreen` (`h1` "Notes")

- [ ] **Step 1: Write the failing tests in `src/db/notes.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from './db';
import { createPet } from './pets';
import { addNote, deleteNote, listNotes, updateNote } from './notes';
import { ValidationError } from './ids';

const at = (d: number) => new Date(2026, 10, d, 19, 0).toISOString();
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
});

it('adds, lists oldest first, edits and deletes notes', async () => {
  await addNote({ petId, at: at(7), text: 'Moved to the 40-gal tank.' });
  const first = await addNote({ petId, at: at(2), text: '  Eyes going blue.\nSkipped a meal.  ' });
  expect(first.text).toBe('Eyes going blue.\nSkipped a meal.');
  expect((await listNotes(petId)).map((n) => n.at)).toEqual([at(2), at(7)]);
  await updateNote(first.id, { text: 'Eyes blue', at: at(3) });
  expect((await listNotes(petId))[0]).toMatchObject({ text: 'Eyes blue', at: at(3) });
  await deleteNote(first.id);
  expect(await listNotes(petId)).toHaveLength(1);
});

it('rejects an empty note, a bad time and a missing pet', async () => {
  await expect(addNote({ petId, at: at(2), text: '   ' })).rejects.toBeInstanceOf(ValidationError);
  await expect(addNote({ petId, at: '', text: 'Hi' })).rejects.toBeInstanceOf(ValidationError);
  await expect(addNote({ petId: 'missing', at: at(2), text: 'Hi' })).rejects.toThrow('not found');
  await expect(updateNote('missing', { text: 'Hi' })).rejects.toThrow('not found');
});
```

- [ ] **Step 2: Write the failing tests in `src/features/notes/NotesScreen.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotesScreen from './NotesScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { addNote, listNotes } from '../../db/notes';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  petId = (await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 })).id;
  await addNote({ petId, at: new Date(2026, 10, 2, 19, 0).toISOString(), text: 'Eyes going blue.' });
  await addNote({ petId, at: new Date(2026, 10, 7, 20, 30).toISOString(), text: 'Moved to the 40-gal tank.' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderNotes() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/notes`]}>
      <Routes>
        <Route path="/pets/:id/notes" element={<NotesScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotesScreen', () => {
  it('lists notes newest first with their dates', async () => {
    renderNotes();
    const items = await screen.findAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Sat, Nov 7, 2026 · 8:30 PM');
    expect(items[0]).toHaveTextContent('Moved to the 40-gal tank.');
    expect(items[1]).toHaveTextContent('Eyes going blue.');
  });

  it('adds a note', async () => {
    renderNotes();
    await userEvent.click(await screen.findByRole('button', { name: 'New note' }));
    const sheet = screen.getByRole('dialog', { name: 'New note' });
    await userEvent.type(within(sheet).getByLabelText('Note'), 'Ate a bit slower than usual.');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save note' }));
    await vi.waitFor(async () => expect(await listNotes(petId)).toHaveLength(3));
    expect((await listNotes(petId)).at(-1)).toMatchObject({ text: 'Ate a bit slower than usual.', at: now.toISOString() });
  });

  it('edits a note', async () => {
    renderNotes();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit note' });
    const text = within(sheet).getByLabelText('Note');
    expect(text).toHaveValue('Moved to the 40-gal tank.');
    await userEvent.type(text, ' Settled in fine.');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save note' }));
    await vi.waitFor(async () => expect((await listNotes(petId)).at(-1)!.text).toBe('Moved to the 40-gal tank. Settled in fine.'));
    // The list re-renders from its live query after the save, so wait for the settled DOM.
    await vi.waitFor(() => expect(screen.getByText('Moved to the 40-gal tank. Settled in fine.')).toBeInTheDocument());
  });

  it('needs some text, and a cleared date blocks saving', async () => {
    renderNotes();
    await userEvent.click(await screen.findByRole('button', { name: 'New note' }));
    const sheet = screen.getByRole('dialog', { name: 'New note' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save note' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Write something first');
    await userEvent.clear(within(sheet).getByLabelText('Date'));
    expect(within(sheet).getByRole('button', { name: 'Save note' })).toBeDisabled();
  });

  it('deletes a note after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderNotes();
    const [first] = await screen.findAllByRole('article');
    await userEvent.click(within(first!).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listNotes(petId)).toHaveLength(1));
  });

  it('is routed at /pets/:id/notes', async () => {
    renderAt(`/pets/${petId}/notes`);
    expect(await screen.findByRole('heading', { name: 'Notes' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/db/notes.test.ts src/features/notes`
Expected: FAIL with `Failed to resolve import "./notes"` / `"./NotesScreen"`.

- [ ] **Step 4: Create `src/db/notes.ts`**

```ts
import Dexie from 'dexie';
import type { Note } from '../domain/types';
import { db } from './db';
import { newId, nowIso, requireDateTime, ValidationError } from './ids';

export interface NoteInput {
  petId: string;
  at: string;
  text: string;
}

function checkText(text: string): void {
  if (!text.trim()) throw new ValidationError('Write something first');
}

export async function addNote(input: NoteInput): Promise<Note> {
  requireDateTime(input.at);
  checkText(input.text);
  return db.transaction('rw', [db.pets, db.notes], async () => {
    if (!(await db.pets.get(input.petId))) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const note: Note = { id: newId(), petId: input.petId, at: input.at, text: input.text.trim(), createdAt: ts, updatedAt: ts };
    await db.notes.add(note);
    return note;
  });
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'at' | 'text'>>): Promise<void> {
  if (patch.at !== undefined) requireDateTime(patch.at);
  if (patch.text !== undefined) checkText(patch.text);
  const next: Partial<Note> = { ...patch, updatedAt: nowIso() };
  if (patch.text !== undefined) next.text = patch.text.trim();
  const changed = await db.notes.update(id, next);
  if (!changed) throw new Error(`Note ${id} not found`);
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export const listNotes = (petId: string): Promise<Note[]> =>
  db.notes.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();
```

- [ ] **Step 5: Create `src/features/notes/NoteSheet.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import type { Note, Pet } from '../../domain/types';
import { combineDateTime, dateKey } from '../../domain/dates';
import { addNote, updateNote } from '../../db/notes';
import { saveErrorText } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { DateTimeFields, Field } from '../../ui/Field';
import { SheetHeader } from '../../ui/SheetHeader';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  note?: Note;
  now?: Date;
}

export default function NoteSheet(props: Props) {
  if (!props.open) return null;
  return <NoteForm {...props} />;
}

function NoteForm({ pet, onClose, note, now: fixedNow }: Props) {
  const [start] = useState(() => (note ? parseISO(note.at) : (fixedNow ?? new Date())));
  const [date, setDate] = useState(dateKey(start));
  const [time, setTime] = useState(format(start, 'HH:mm'));
  const [text, setText] = useState(note?.text ?? '');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const at = combineDateTime(date, time);
  const title = note ? 'Edit note' : 'New note';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!at) return;
    setError(undefined);
    setSaving(true);
    try {
      if (note) await updateNote(note.id, { at: at.toISOString(), text });
      else await addNote({ petId: pet.id, at: at.toISOString(), text });
      onClose();
    } catch (err) {
      setError(saveErrorText(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} noValidate>
        <SheetHeader photoId={pet.photoId} species={pet.species} title={title} subtitle={pet.name} />
        {error && <div role="alert" className="form-error">{error}</div>}
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label="Note" stack>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <button type="submit" className="btn-primary" disabled={saving || !at}>Save note</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 6: Create `src/features/notes/NotesScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Note } from '../../domain/types';
import { deleteNote, listNotes } from '../../db/notes';
import { Card } from '../../ui/Card';
import { useNow } from '../../ui/useNow';
import { confirmDelete, PetNotFound, SubScreenHeader, useRoutePet } from '../pets/subScreen';
import NoteSheet from './NoteSheet';

export default function NotesScreen({ now: fixedNow }: { now?: Date }) {
  const pet = useRoutePet();
  const now = useNow(fixedNow);
  const petId = pet?.id;
  const notes = useLiveQuery(() => (petId ? listNotes(petId) : undefined), [petId]);
  const [editing, setEditing] = useState<Note | 'new' | null>(null);

  if (pet === undefined) return null;
  if (pet === null) return <PetNotFound />;
  if (!notes) return null;
  const newestFirst = [...notes].reverse();

  return (
    <>
      <SubScreenHeader pet={pet} title="Notes" addLabel="New note" onAdd={() => setEditing('new')} />
      <div style={{ marginTop: 12 }} />
      {newestFirst.length === 0 && <p className="muted">No notes yet.</p>}
      {newestFirst.map((n) => (
        <Card key={n.id} role="article">
          <b>{format(parseISO(n.at), 'EEE, MMM d, yyyy · h:mm a')}</b>
          <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.text}</div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEditing(n)}>Edit</button>
            <button type="button" className="btn btn-danger" onClick={() => confirmDelete('note', () => deleteNote(n.id))}>
              Delete
            </button>
          </div>
        </Card>
      ))}
      <NoteSheet
        pet={pet}
        open={editing !== null}
        note={editing === 'new' || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
        now={now}
      />
    </>
  );
}
```

- [ ] **Step 7: Replace the whole of `src/app/App.tsx`** (adds the Notes route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';
import CareTasksScreen from '../features/care/CareTasksScreen';
import VetScreen from '../features/vet/VetScreen';
import NotesScreen from '../features/notes/NotesScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="pets/:id/care" element={<CareTasksScreen />} />
        <Route path="pets/:id/vet" element={<VetScreen />} />
        <Route path="pets/:id/notes" element={<NotesScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add dated notes per pet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Pet profile: Quick log row, Husbandry tiles and real Length / Weight

Spec §5.2 items 5–7. The Quick log row opens the Fed / Regurg. / Poop / Shed sheets in place. Each Husbandry tile links to its screen with a one-line summary (mockup ①). The stats grid shows the latest length and weight in the user's units.

**Files:**
- Create: `src/features/pets/usePetHusbandry.ts`, `src/features/pets/husbandrySummary.ts`
- Modify: `src/features/pets/PetProfile.tsx`
- Test: `src/features/pets/husbandrySummary.test.ts`, `src/features/pets/PetProfile.test.tsx`

**Interfaces:**
- Consumes: `listSheds` (Task 5), `listPoops` (Task 4), `listMeasurements` (Task 6), `listHabitatReadings` (Task 7), `listCareTasks`, `listCompletions`, `careNextDue` (Task 8), `listVetVisits` (Task 9), `listNotes` (Task 10), `latestWith`, `weightChange`, `formatChange` (Task 6), `latestValue` (Task 7), `poopKindLabel` (Task 4), `shedQualityLabel` (Task 5), `formatTemp`, `formatHumidity`, `formatWeight`, `formatLength`, `useUnits` (Task 2), `plural` (Task 4), `RegurgitationSheet` (Task 3), `LogPoopSheet` (Task 4), `LogShedSheet` (Task 5), Plan 1 `PetProfile` pieces
- Produces:
  - `interface HusbandryData { sheds: Shed[]; poops: Poop[]; measurements: Measurement[]; readings: HabitatReading[]; tasks: CareTask[]; completions: CareCompletion[]; visits: VetVisit[]; notes: Note[] }`
  - `usePetHusbandry(petId: string | undefined): HusbandryData | undefined` (live)
  - `type TileKey = 'sheds' | 'poop' | 'weight' | 'habitat' | 'care' | 'vet' | 'notes'`, `husbandryTiles(d: HusbandryData, units: Units, now: Date): Record<TileKey, string>`, `sizeStats(ms: readonly Measurement[], units: Units): { length: string; weight: string }`
  - The profile shows buttons `Fed`, `Regurg.`, `Poop`, `Shed` and tile links to `/pets/:id/{sheds,poop,weight,habitat,care,vet,notes}`

- [ ] **Step 1: Write the failing tests in `src/features/pets/husbandrySummary.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { CareTask } from '../../domain/types';
import { tempToC } from '../../domain/units';
import { husbandryTiles, sizeStats, type HusbandryData } from './husbandrySummary';

const now = new Date(2026, 10, 8, 9, 0);
const units = { temp: 'F', weight: 'g', length: 'in' } as const;
const base = { petId: 'p1', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '' };
const iso = (m: number, d: number, h = 9) => new Date(2026, m, d, h, 0).toISOString();
const empty: HusbandryData = { sheds: [], poops: [], measurements: [], readings: [], tasks: [], completions: [], visits: [], notes: [] };
const task = (id: string, name: string, intervalDays: number): CareTask => ({ ...base, id, name, intervalDays });

describe('husbandryTiles', () => {
  it('summarizes each area', () => {
    const tiles = husbandryTiles(
      {
        sheds: [
          { ...base, id: 's1', date: '2026-09-18', quality: 'complete' },
          { ...base, id: 's2', date: '2026-10-21', quality: 'complete' },
        ],
        poops: [{ ...base, id: 'p1', at: iso(10, 6, 8), kind: 'normal' }],
        measurements: [
          { ...base, id: 'm1', date: '2026-10-01', weightG: 39 },
          { ...base, id: 'm2', date: '2026-11-01', weightG: 42, lengthMm: 457.2 },
        ],
        readings: [{ ...base, id: 'r1', at: iso(10, 8, 8), warmC: tempToC(88, 'F'), humidityPct: 52 }],
        tasks: [task('t1', 'Spot clean', 1), task('t2', 'Mist', 2), task('t3', 'Deep clean', 30)],
        completions: [
          { ...base, id: 'c1', taskId: 't1', at: iso(10, 7) }, // due today
          { ...base, id: 'c2', taskId: 't2', at: iso(10, 5) }, // due Nov 7: late
          { ...base, id: 'c3', taskId: 't3', at: iso(10, 1) },
        ],
        visits: [{ ...base, id: 'v1', date: '2026-06-14', reason: 'Wellness exam', photoIds: [] }],
        notes: [1, 2, 3].map((n) => ({ ...base, id: `n${n}`, at: iso(10, n), text: 'x' })),
      },
      units,
      now,
    );
    expect(tiles).toEqual({
      sheds: 'Last: Oct 21 · complete',
      poop: 'Last: Nov 6 · normal',
      weight: '42 g · ↑ 3 g',
      habitat: '88°F · 52% RH',
      care: '1 late · 1 due today',
      vet: 'Jun 14 · Wellness exam',
      notes: '3 notes',
    });
  });

  it('has friendly empty lines', () => {
    expect(husbandryTiles(empty, units, now)).toEqual({
      sheds: 'No sheds yet',
      poop: 'None logged',
      weight: 'No entries yet',
      habitat: 'No readings yet',
      care: 'No tasks yet',
      vet: 'No visits yet',
      notes: 'No notes yet',
    });
  });

  it('says when every care task is done', () => {
    const tiles = husbandryTiles(
      { ...empty, tasks: [task('t1', 'Spot clean', 1)], completions: [{ ...base, id: 'c1', taskId: 't1', at: iso(10, 8, 7) }] },
      units,
      now,
    );
    expect(tiles.care).toBe('All caught up');
  });
});

describe('sizeStats', () => {
  it('shows the latest length and weight, or a dash', () => {
    expect(sizeStats([{ ...base, id: 'm1', date: '2026-11-01', weightG: 42, lengthMm: 457.2 }], units)).toEqual({
      length: '18 in', weight: '42 g',
    });
    expect(sizeStats([], units)).toEqual({ length: '—', weight: '—' });
  });
});
```

- [ ] **Step 2: Replace the whole of `src/features/pets/PetProfile.test.tsx`** (keeps the Plan 1 tests, adds Quick log, tiles and stats)

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetProfile from './PetProfile';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { logShed } from '../../db/sheds';
import { logPoop } from '../../db/poops';
import { logMeasurement } from '../../db/measurements';
import { logHabitatReading } from '../../db/habitat';
import { completeCareTask, createCareTask } from '../../db/care';
import { createVetVisit } from '../../db/vetVisits';
import { addNote } from '../../db/notes';
import { tempToC } from '../../domain/units';

const now = new Date(2026, 10, 8, 9, 0);
const at = (d: number) => new Date(2026, 10, d, 18, 0).toISOString();

function renderProfile(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/pets/${id}`]}>
      <Routes>
        <Route path="/pets/:id" element={<PetProfile now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

describe('PetProfile', () => {
  it('shows the pet, next feeding, calendar and details', async () => {
    const p = await createPet({
      name: 'Noodle', species: 'Corn Snake', morph: 'Amel', sex: 'female', origin: 'captive_bred',
      birthDate: '2026-03-03', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse',
      sire: { name: 'Apollo', morph: 'Amel' }, dam: { name: 'Juniper', morph: 'Anery' },
      acquiredFrom: 'Scales & Tails Reptiles', acquiredDate: '2026-04-12', pricePaid: 65,
      description: 'Calm, great eater.',
    });
    await logFeeding({ petId: p.id, at: at(2), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
    await logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    renderProfile(p.id);

    expect(await screen.findByRole('heading', { name: 'Noodle' })).toBeInTheDocument();
    expect(screen.getByText('Corn Snake · Amel')).toBeInTheDocument();
    expect(screen.getByText('♀ Female')).toBeInTheDocument();
    expect(screen.getAllByText('8 mo')).toHaveLength(2); // age chip + Age stat
    expect(screen.getByText('Captive bred')).toBeInTheDocument();

    expect(screen.getByText('Today · 6:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Every 5 days · 1 Pinky mouse')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'November 3: ate' })).toHaveClass('is-ate');
    expect(screen.getByRole('button', { name: 'November 2: refused' })).toHaveClass('is-refused');
    expect(screen.getByRole('button', { name: 'November 8: next feeding due, today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'November 13: planned feeding' })).toHaveClass('is-planned');
    expect(screen.getByText('1 meal · 1 refusal this month')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all ›' })).toHaveAttribute('href', `/pets/${p.id}/feedings`);
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/pets/${p.id}/edit`);

    expect(screen.getByText('Apollo · Amel')).toBeInTheDocument();
    expect(screen.getByText('Juniper · Anery')).toBeInTheDocument();
    expect(screen.getByText('Scales & Tails Reptiles')).toBeInTheDocument();
    expect(screen.getByText('Bought Apr 12, 2026 · $65')).toBeInTheDocument();
    expect(screen.getByText('Calm, great eater.')).toBeInTheDocument();
  });

  it('moves between months', async () => {
    const p = await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    renderProfile(p.id);
    await screen.findByText('November 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('October 2026')).toBeInTheDocument();
  });

  it('says when a pet does not exist', async () => {
    renderProfile('missing');
    expect(await screen.findByText('Pet not found')).toBeInTheDocument();
  });

  it('the Quick log row opens the Fed, Regurg., Poop and Shed sheets', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    renderProfile(p.id);
    const pairs: [string, string][] = [
      ['Fed', 'Feed Noodle'],
      ['Regurg.', 'Log regurgitation'],
      ['Poop', 'Log poop'],
      ['Shed', 'Log shed'],
    ];
    for (const [button, dialog] of pairs) {
      await userEvent.click(await screen.findByRole('button', { name: button }));
      expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });

  it('shows husbandry tiles with summaries, and the latest length and weight', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    await logShed({ petId: p.id, date: '2026-10-21', quality: 'complete' });
    await logPoop({ petId: p.id, at: new Date(2026, 10, 6, 8, 0).toISOString(), kind: 'normal' });
    await logMeasurement({ petId: p.id, date: '2026-10-01', weightG: 39 });
    await logMeasurement({ petId: p.id, date: '2026-11-01', weightG: 42, lengthMm: 457.2 });
    await logHabitatReading({ petId: p.id, at: new Date(2026, 10, 8, 8, 15).toISOString(), warmC: tempToC(88, 'F'), humidityPct: 52 });
    const task = await createCareTask({ petId: p.id, name: 'Spot clean', intervalDays: 1 });
    await completeCareTask(task.id, new Date(2026, 10, 7, 9, 0).toISOString());
    await createVetVisit({ petId: p.id, date: '2026-06-14', reason: 'Wellness exam' });
    for (const d of [1, 2, 3]) await addNote({ petId: p.id, at: at(d), text: `Note ${d}` });
    renderProfile(p.id);

    const tiles: [RegExp, string, string][] = [
      [/^Sheds/, 'sheds', 'Last: Oct 21 · complete'],
      [/^Poop/, 'poop', 'Last: Nov 6 · normal'],
      [/^Weight/, 'weight', '42 g · ↑ 3 g'],
      [/^Habitat/, 'habitat', '88°F · 52% RH'],
      [/^Care tasks/, 'care', '1 due today'],
      [/^Vet visits/, 'vet', 'Jun 14 · Wellness exam'],
      [/^Notes/, 'notes', '3 notes'],
    ];
    for (const [name, path, summary] of tiles) {
      const link = await screen.findByRole('link', { name });
      expect(link).toHaveAttribute('href', `/pets/${p.id}/${path}`);
      expect(within(link).getByText(summary)).toBeInTheDocument();
    }
    expect(screen.getByText('18 in')).toBeInTheDocument();
    expect(screen.getByText('42 g')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/pets/husbandrySummary.test.ts src/features/pets/PetProfile.test.tsx`
Expected: FAIL. `Failed to resolve import "./husbandrySummary"`; the profile has no `Fed` button and no tile links.

- [ ] **Step 4: Create `src/features/pets/husbandrySummary.ts`**

```ts
import { format, parseISO } from 'date-fns';
import type {
  CareCompletion, CareTask, HabitatReading, Measurement, Note, Poop, Shed, VetVisit,
} from '../../domain/types';
import { parseDateKey } from '../../domain/dates';
import { dueStatus } from '../../domain/feeding';
import { careNextDue } from '../../domain/care';
import { formatChange, latestWith, weightChange } from '../../domain/growth';
import { latestValue } from '../../domain/habitat';
import { poopKindLabel } from '../../domain/poop';
import { shedQualityLabel } from '../../domain/sheds';
import { formatHumidity, formatLength, formatTemp, formatWeight, type Units } from '../../domain/units';
import { plural } from './format';

export interface HusbandryData {
  sheds: Shed[];
  poops: Poop[];
  measurements: Measurement[];
  readings: HabitatReading[];
  tasks: CareTask[];
  completions: CareCompletion[];
  visits: VetVisit[];
  notes: Note[];
}

export type TileKey = 'sheds' | 'poop' | 'weight' | 'habitat' | 'care' | 'vet' | 'notes';

function latestBy<T>(items: readonly T[], key: (item: T) => string): T | undefined {
  return [...items].sort((a, b) => key(a).localeCompare(key(b))).at(-1);
}

const shortDay = (key: string) => format(parseDateKey(key), 'MMM d');

/** The summary line under each Husbandry tile on the profile (mockup ①). */
export function husbandryTiles(d: HusbandryData, units: Units, now: Date): Record<TileKey, string> {
  const shed = latestBy(d.sheds, (s) => s.date);
  const poop = latestBy(d.poops, (p) => p.at);
  const weight = latestWith(d.measurements, 'weightG');
  const length = latestWith(d.measurements, 'lengthMm');
  const change = weightChange(d.measurements, now);
  const warm = latestValue(d.readings, 'warm');
  const humidity = latestValue(d.readings, 'humidity');
  const visit = latestBy(d.visits, (v) => v.date);

  let late = 0;
  let dueToday = 0;
  for (const t of d.tasks) {
    const status = dueStatus(careNextDue(t, d.completions.filter((c) => c.taskId === t.id)), now);
    if (status === 'late') late++;
    else if (status === 'today') dueToday++;
  }

  let weightLine = 'No entries yet';
  if (weight) {
    weightLine = [formatWeight(weight.weightG!, units.weight), change !== null && formatChange(change, units.weight)]
      .filter(Boolean)
      .join(' · ');
  } else if (length) {
    weightLine = formatLength(length.lengthMm!, units.length);
  }
  const habitat = [warm && formatTemp(warm.value, units.temp), humidity && `${formatHumidity(humidity.value)} RH`].filter(Boolean);
  let care = 'No tasks yet';
  if (d.tasks.length > 0) {
    care = late || dueToday
      ? [late && `${late} late`, dueToday && `${dueToday} due today`].filter(Boolean).join(' · ')
      : 'All caught up';
  }

  return {
    sheds: shed ? `Last: ${shortDay(shed.date)} · ${shedQualityLabel(shed.quality).toLowerCase()}` : 'No sheds yet',
    poop: poop ? `Last: ${format(parseISO(poop.at), 'MMM d')} · ${poopKindLabel(poop.kind).toLowerCase()}` : 'None logged',
    weight: weightLine,
    habitat: habitat.length > 0 ? habitat.join(' · ') : 'No readings yet',
    care,
    vet: visit ? [shortDay(visit.date), visit.reason].filter(Boolean).join(' · ') : 'No visits yet',
    notes: d.notes.length > 0 ? plural(d.notes.length, 'note') : 'No notes yet',
  };
}

/** Spec §5.2 item 7: length and weight in the stats grid come from the latest measurement. */
export function sizeStats(ms: readonly Measurement[], units: Units): { length: string; weight: string } {
  const weight = latestWith(ms, 'weightG');
  const length = latestWith(ms, 'lengthMm');
  return {
    length: length ? formatLength(length.lengthMm!, units.length) : '—',
    weight: weight ? formatWeight(weight.weightG!, units.weight) : '—',
  };
}
```

- [ ] **Step 5: Create `src/features/pets/usePetHusbandry.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { listSheds } from '../../db/sheds';
import { listPoops } from '../../db/poops';
import { listMeasurements } from '../../db/measurements';
import { listHabitatReadings } from '../../db/habitat';
import { listCareTasks, listCompletions } from '../../db/care';
import { listVetVisits } from '../../db/vetVisits';
import { listNotes } from '../../db/notes';
import type { HusbandryData } from './husbandrySummary';

const EMPTY: HusbandryData = { sheds: [], poops: [], measurements: [], readings: [], tasks: [], completions: [], visits: [], notes: [] };

/** Every husbandry record for one pet (care tasks include the All-pets ones), kept live. */
export function usePetHusbandry(petId: string | undefined): HusbandryData | undefined {
  return useLiveQuery(async () => {
    if (!petId) return EMPTY;
    const [sheds, poops, measurements, readings, tasks, visits, notes] = await Promise.all([
      listSheds(petId),
      listPoops(petId),
      listMeasurements(petId),
      listHabitatReadings(petId),
      listCareTasks(petId),
      listVetVisits(petId),
      listNotes(petId),
    ]);
    const completions = (await Promise.all(tasks.map((t) => listCompletions(t.id)))).flat();
    return { sheds, poops, measurements, readings, tasks, completions, visits, notes };
  }, [petId]);
}
```

- [ ] **Step 6: Replace the whole of `src/features/pets/PetProfile.tsx`**

```tsx
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
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 8: Preview on localhost**

Run `npm run dev`, open `http://localhost:5173/RepTender/`, add a pet and open its profile. Below the calendar: a "Quick log" row of four buttons and a 2-column grid of Husbandry tiles with Notes full width, then Length / Weight / Born / Age. Tap each tile: it opens its screen and "‹ <name>" comes back. Switch Settings → Dark and check the tiles and quick-log buttons are readable. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Quick log, Husbandry tiles and real length and weight to the profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Schedule tab

Spec §5.13. "Today" lists, across all active pets, the feedings and care tasks that are due or late, plus the ones already done today (ticked). Checking a feeding opens the Log a Feeding sheet; checking a care task completes it (and un-checking undoes today's completion). "Coming up" shows the next occurrence of each item in the next 7 days, grouped by day. The **📅 Add all reminders to Calendar** button is Plan 3.

**Files:**
- Create: `src/domain/schedule.ts`, `src/features/schedule/ScheduleScreen.tsx`
- Modify: `src/app/TabBar.tsx` (Schedule tab), `src/app/App.tsx` (route)
- Test: `src/domain/schedule.test.ts`, `src/features/schedule/ScheduleScreen.test.tsx`

**Interfaces:**
- Consumes: `nextFeedingDue`, `dueStatus`, `statusLabel`, `lastMeal`, `DueStatus` (Plan 1), `careNextDue`, `completedOn`, `everyLabel`, `listCareTasks`, `listAllCompletions`, `toggleCareToday` (Task 8), `listActivePets`, `listFeedings`, `LogFeedingSheet`, `formatDay`, `TONE`, `dateKey`, `parseDateKey`, `saveErrorText`, `renderAt`
- Produces:
  - `src/domain/schedule.ts`: `interface FeedingSource { pet: Pet; feedings: readonly Feeding[] }`, `interface CareSource { task: CareTask; pet?: Pet; completions: readonly CareCompletion[] }`, `type ScheduleItem` (common fields `key`, `title`, `detail`, `due: Date | null`, `status: DueStatus`, `done: boolean`; `kind: 'feeding'` adds `pet`, `feedings`; `kind: 'care'` adds `task`, `pet?`, `completions`), `todayItems(feedings, care, now): ScheduleItem[]` (not done first, then late → today → by due time → title), `interface DayGroup { day: string; items: ScheduleItem[] }`, `comingUp(feedings, care, now, days = 7): DayGroup[]`
  - Route `/schedule` → `ScheduleScreen` (`h1` "Today"). `TABS` becomes Pets, Schedule, Settings (Task 13 inserts Add).

- [ ] **Step 1: Write the failing tests in `src/domain/schedule.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { CareCompletion, CareTask, Feeding, Pet } from './types';
import { comingUp, todayItems, type CareSource, type FeedingSource } from './schedule';

const now = new Date(2026, 10, 8, 9, 0);
const pet = (name: string, feedingIntervalDays: number, usualFoodItem: string, usualQuantity = 1): Pet => ({
  id: name, name, species: 'Reptile', sex: 'unknown', origin: 'unknown', birthDateApprox: false, feedingIntervalDays,
  usualFoodItem, usualQuantity, usualFeedTime: '18:00', habitatTargets: {}, createdAt: '', updatedAt: '',
});
const ate = (petId: string, m: number, d: number, h = 18): Feeding => ({
  id: `${petId}-${d}`, petId, at: new Date(2026, m, d, h, 0).toISOString(), foodItem: 'x', quantity: 1, outcome: 'ate',
  createdAt: '', updatedAt: '',
});
const task = (id: string, name: string, intervalDays: number, petId?: string): CareTask => ({
  id, petId, name, intervalDays, createdAt: new Date(2026, 9, 1).toISOString(), updatedAt: '',
});
const done = (taskId: string, m: number, d: number, h = 9): CareCompletion => ({
  id: `${taskId}-${d}`, taskId, at: new Date(2026, m, d, h, 0).toISOString(), createdAt: '', updatedAt: '',
});

const basil = pet('Basil', 2, 'Dubia roaches', 12);
const noodle = pet('Noodle', 5, 'Pinky mouse');
const ziggy = pet('Ziggy', 3, 'Crickets', 8);
const pebble = pet('Pebble', 2, 'Greens');
const feedings: FeedingSource[] = [
  { pet: basil, feedings: [ate('Basil', 10, 5)] }, // due Nov 7: late
  { pet: noodle, feedings: [ate('Noodle', 10, 3)] }, // due today 6 PM
  { pet: ziggy, feedings: [ate('Ziggy', 10, 8, 8)] }, // fed this morning: done, next Nov 11
  { pet: pebble, feedings: [] }, // never fed: due now
];
const spot = task('spot', 'Spot clean', 1, 'Basil');
const water = task('water', 'Fresh water', 2);
const deep = task('deep', 'Deep clean', 30, 'Noodle');
const uvb = task('uvb', 'Replace UVB bulb', 180, 'Basil');
const care: CareSource[] = [
  { task: spot, pet: basil, completions: [done('spot', 10, 8, 7)] }, // done today, next Nov 9
  { task: water, completions: [done('water', 10, 6)] }, // due today (midnight)
  { task: deep, pet: noodle, completions: [done('deep', 9, 16)] }, // due Nov 15
  { task: uvb, pet: basil, completions: [done('uvb', 9, 1)] }, // due in 2027
];

describe('todayItems', () => {
  it('lists what is due, late or done today, most urgent first and done last', () => {
    const items = todayItems(feedings, care, now);
    expect(items.map((i) => [i.title, i.status, i.done])).toEqual([
      ['Feed Basil', 'late', false],
      ['Feed Pebble', 'today', false],
      ['Fresh water', 'today', false],
      ['Feed Noodle', 'today', false],
      ['Spot clean', 'soon', true],
      ['Feed Ziggy', 'soon', true],
    ]);
  });
  it('describes each item', () => {
    const items = todayItems(feedings, care, now);
    expect(items.find((i) => i.title === 'Feed Basil')!.detail).toBe('12 Dubia roaches');
    expect(items.find((i) => i.title === 'Fresh water')!.detail).toBe('All pets · every 2 days');
    expect(items.find((i) => i.title === 'Spot clean')!.detail).toBe('Basil · daily');
  });
  it('a refusal today does not count as done', () => {
    const refused: Feeding = { ...ate('Noodle', 10, 8, 8), id: 'r', outcome: 'refused' };
    const items = todayItems([{ pet: noodle, feedings: [ate('Noodle', 10, 3), refused] }], [], now);
    expect(items[0]).toMatchObject({ title: 'Feed Noodle', done: false, status: 'today' });
  });
});

describe('comingUp', () => {
  it('groups the next occurrence of each item over the next 7 days', () => {
    expect(comingUp(feedings, care, now).map((g) => [g.day, g.items.map((i) => i.title)])).toEqual([
      ['2026-11-09', ['Spot clean']],
      ['2026-11-11', ['Feed Ziggy']],
      ['2026-11-15', ['Deep clean']],
    ]);
  });
});
```

- [ ] **Step 2: Write the failing tests in `src/features/schedule/ScheduleScreen.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScheduleScreen from './ScheduleScreen';
import { resetDb } from '../../db/db';
import { archivePet, createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';
import { completeCareTask, createCareTask } from '../../db/care';
import { renderAt } from '../../test/render';

const now = new Date(2026, 10, 8, 9, 0);
const t = (m: number, d: number, h: number) => new Date(2026, m, d, h, 0).toISOString();

async function pet(name: string, interval: number, food: string, qty: number, fedAt: string) {
  const p = await createPet({ name, species: 'Reptile', feedingIntervalDays: interval, usualFoodItem: food, usualQuantity: qty });
  await logFeeding({ petId: p.id, at: fedAt, foodItem: food, quantity: qty, outcome: 'ate' });
  return p;
}
async function task(name: string, intervalDays: number, petId: string | undefined, doneAt: string) {
  const tk = await createCareTask({ petId, name, intervalDays });
  await completeCareTask(tk.id, doneAt);
  return tk;
}

beforeEach(async () => {
  await resetDb();
  const basil = await pet('Basil', 2, 'Dubia roaches', 12, t(10, 5, 18)); // late
  const noodle = await pet('Noodle', 5, 'Pinky mouse', 1, t(10, 3, 18)); // due today
  await pet('Ziggy', 3, 'Crickets', 8, t(10, 8, 8)); // fed this morning
  const pebble = await pet('Pebble', 2, 'Greens', 1, t(10, 1, 18)); // late, but archived
  await archivePet(pebble.id);
  await task('Spot clean', 1, basil.id, t(10, 8, 7)); // done today
  await task('Fresh water', 2, undefined, t(10, 6, 9)); // due today
  await task('Deep clean', 30, noodle.id, t(9, 16, 9)); // Nov 15
  await task('Soak', 1, pebble.id, t(10, 1, 9)); // archived pet: hidden
});

const renderSchedule = () => render(<MemoryRouter><ScheduleScreen now={now} /></MemoryRouter>);
const todayTitles = () =>
  within(screen.getByRole('region', { name: "Today's checklist" }))
    .getAllByRole('group')
    .map((g) => g.getAttribute('aria-label'));

describe('ScheduleScreen', () => {
  it("lists today's feedings and care tasks across active pets, and what's coming up", async () => {
    renderSchedule();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Sunday, Nov 8 · 2 of 5 done')).toBeInTheDocument();
    expect(todayTitles()).toEqual(['Feed Basil', 'Fresh water', 'Feed Noodle', 'Spot clean', 'Feed Ziggy']);
    const basil = screen.getByRole('group', { name: 'Feed Basil' });
    expect(within(basil).getByText('12 Dubia roaches')).toBeInTheDocument();
    expect(within(basil).getByText('1 day late')).toHaveClass('pill-late');
    expect(screen.getByRole('button', { name: 'Spot clean done today' })).toHaveAttribute('aria-pressed', 'true');

    const coming = screen.getByRole('region', { name: 'Coming up' });
    expect(within(coming).getByRole('group', { name: 'Tomorrow' })).toHaveTextContent('Spot clean · Basil · daily');
    expect(within(coming).getByRole('group', { name: 'Wed, Nov 11' })).toHaveTextContent('Feed Ziggy · 8 Crickets');
    expect(within(coming).getByRole('group', { name: 'Sun, Nov 15' })).toHaveTextContent('Deep clean · Noodle · every 30 days');
  });

  it('checking a care task completes it', async () => {
    renderSchedule();
    await userEvent.click(await screen.findByRole('button', { name: 'Fresh water done today' }));
    expect(await screen.findByText('Sunday, Nov 8 · 3 of 5 done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fresh water done today' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('checking a feeding opens the Log a Feeding sheet', async () => {
    renderSchedule();
    await userEvent.click(await screen.findByRole('button', { name: 'Log feeding for Noodle' }));
    const sheet = screen.getByRole('dialog', { name: 'Feed Noodle' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save feeding' }));
    expect(await screen.findByText('Sunday, Nov 8 · 3 of 5 done')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Fed Noodle today' })).toBeDisabled());
  });

  it('is the Schedule tab at /schedule', async () => {
    renderAt('/schedule');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Schedule' })).toHaveClass('active');
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/domain/schedule.test.ts src/features/schedule`
Expected: FAIL with `Failed to resolve import "./schedule"` / `"./ScheduleScreen"`.

- [ ] **Step 4: Create `src/domain/schedule.ts`**

```ts
import { differenceInCalendarDays, isSameDay, parseISO } from 'date-fns';
import type { CareCompletion, CareTask, Feeding, Pet } from './types';
import { dateKey } from './dates';
import { dueStatus, nextFeedingDue, type DueStatus } from './feeding';
import { careNextDue, completedOn, everyLabel } from './care';

export interface FeedingSource {
  pet: Pet;
  feedings: readonly Feeding[];
}

export interface CareSource {
  task: CareTask;
  /** Undefined for an All-pets task. */
  pet?: Pet;
  completions: readonly CareCompletion[];
}

interface ItemBase {
  key: string;
  title: string;
  detail: string;
  due: Date | null;
  status: DueStatus;
  /** Fed (ate) today, or the care task was completed today. */
  done: boolean;
}

export type ScheduleItem =
  | (ItemBase & { kind: 'feeding'; pet: Pet; feedings: readonly Feeding[] })
  | (ItemBase & { kind: 'care'; task: CareTask; pet?: Pet; completions: readonly CareCompletion[] });

function feedingItem({ pet, feedings }: FeedingSource, now: Date): ScheduleItem {
  const due = nextFeedingDue(pet, feedings);
  return {
    kind: 'feeding', key: `feed-${pet.id}`, pet, feedings,
    title: `Feed ${pet.name}`,
    detail: pet.usualFoodItem ? `${pet.usualQuantity} ${pet.usualFoodItem}` : 'Feeding',
    due, status: dueStatus(due, now),
    done: feedings.some((f) => f.outcome === 'ate' && isSameDay(parseISO(f.at), now)),
  };
}

function careItem({ task, pet, completions }: CareSource, now: Date): ScheduleItem {
  const due = careNextDue(task, completions);
  return {
    kind: 'care', key: `care-${task.id}`, task, pet, completions,
    title: task.name,
    detail: `${pet?.name ?? 'All pets'} · ${everyLabel(task.intervalDays).toLowerCase()}`,
    due, status: dueStatus(due, now),
    done: completedOn(completions, now),
  };
}

const RANK: Record<DueStatus, number> = { late: 0, today: 1, soon: 2 };

function byUrgency(a: ScheduleItem, b: ScheduleItem): number {
  return (
    Number(a.done) - Number(b.done) ||
    RANK[a.status] - RANK[b.status] ||
    (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0) ||
    a.title.localeCompare(b.title)
  );
}

function allItems(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): ScheduleItem[] {
  return [...feedings.map((f) => feedingItem(f, now)), ...care.map((c) => careItem(c, now))];
}

/** Spec §5.13 "Today": due or late (not done yet), plus whatever was done today. */
export function todayItems(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date): ScheduleItem[] {
  return allItems(feedings, care, now)
    .filter((i) => i.done || i.status !== 'soon')
    .sort(byUrgency);
}

export interface DayGroup {
  day: string; // yyyy-MM-dd
  items: ScheduleItem[];
}

/** Spec §5.13 "Coming up": each item's next occurrence in the next `days` days, grouped by day. */
export function comingUp(feedings: readonly FeedingSource[], care: readonly CareSource[], now: Date, days = 7): DayGroup[] {
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of allItems(feedings, care, now)) {
    if (!item.due) continue;
    const inDays = differenceInCalendarDays(item.due, now);
    if (inDays < 1 || inDays > days) continue;
    const key = dateKey(item.due);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items: items.sort(byUrgency) }));
}
```

- [ ] **Step 5: Create `src/features/schedule/ScheduleScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { parseDateKey } from '../../domain/dates';
import { lastMeal, statusLabel } from '../../domain/feeding';
import { comingUp, todayItems, type ScheduleItem } from '../../domain/schedule';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { listAllCompletions, listCareTasks, toggleCareToday } from '../../db/care';
import { saveErrorText } from '../../db/ids';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { formatDay } from '../feedings/logModel';
import { TONE } from '../pets/PetsHome';

type FeedingItem = Extract<ScheduleItem, { kind: 'feeding' }>;

function checkLabel(item: ScheduleItem): string {
  if (item.kind === 'care') return `${item.title} done today`;
  return item.done ? `Fed ${item.pet.name} today` : `Log feeding for ${item.pet.name}`;
}

export default function ScheduleScreen({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const data = useLiveQuery(async () => {
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
  }, []);
  const [feeding, setFeeding] = useState<FeedingItem | null>(null);
  const [error, setError] = useState<string>();

  if (!data) return null;
  const today = todayItems(data.feedings, data.care, now);
  const upcoming = comingUp(data.feedings, data.care, now);
  const doneCount = today.filter((i) => i.done).length;

  const onCheck = async (item: ScheduleItem) => {
    if (item.kind === 'feeding') {
      if (!item.done) setFeeding(item);
      return;
    }
    setError(undefined);
    try {
      await toggleCareToday(item.task.id, now);
    } catch (err) {
      setError(saveErrorText(err));
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
              disabled={item.kind === 'feeding' && item.done}
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

- [ ] **Step 6: Replace the whole of `src/app/TabBar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';

export const TABS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'Pets', icon: '🦎', end: true },
  { to: '/schedule', label: 'Schedule', icon: '📅' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 7: Replace the whole of `src/app/App.tsx`** (adds the Schedule route)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';
import CareTasksScreen from '../features/care/CareTasksScreen';
import VetScreen from '../features/vet/VetScreen';
import NotesScreen from '../features/notes/NotesScreen';
import ScheduleScreen from '../features/schedule/ScheduleScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="pets/:id/care" element={<CareTasksScreen />} />
        <Route path="pets/:id/vet" element={<VetScreen />} />
        <Route path="pets/:id/notes" element={<NotesScreen />} />
        <Route path="schedule" element={<ScheduleScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add the Schedule tab with today's checklist and coming up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Add tab

Spec §5.14. A tab that picks a pet (skipped when there is only one), then an entry type, and opens that entry's sheet right there: Feeding, Regurgitation, Poop, Shed, Weight, Habitat reading, Vet visit, Note. It also links to adding a new pet. The tab itself is a screen (so it has a route and a tab highlight); every entry opens as the same bottom sheet the rest of the app uses.

**Files:**
- Create: `src/features/add/AddScreen.tsx`
- Modify: `src/app/TabBar.tsx` (Add tab), `src/app/App.tsx` (route)
- Test: `src/features/add/AddScreen.test.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `listActivePets`, `listFeedings`, `lastMeal`, `nextFeedingDue`, `LogFeedingSheet` (Plan 1), `RegurgitationSheet` (Task 3), `LogPoopSheet` (Task 4), `LogShedSheet` (Task 5), `LogMeasurementSheet` (Task 6), `LogHabitatSheet` (Task 7), `VetVisitSheet` (Task 9), `NoteSheet` (Task 10), `Card`, `useNow`
- Produces: route `/add` → `AddScreen` (`h1` "Add"); `TABS` is now Pets, Schedule, Add, Settings

- [ ] **Step 1: Write the failing tests in `src/features/add/AddScreen.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AddScreen from './AddScreen';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { listPoops } from '../../db/poops';

const now = new Date(2026, 10, 8, 9, 0);
const renderAdd = () => render(<MemoryRouter><AddScreen now={now} /></MemoryRouter>);

beforeEach(async () => {
  await resetDb();
});

describe('AddScreen', () => {
  it('with no pets it offers to add one', async () => {
    renderAdd();
    expect(await screen.findByText('No reptiles yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a reptile' })).toHaveAttribute('href', '/pets/new');
  });

  it('with one pet it skips the pet picker', async () => {
    const noodle = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    renderAdd();
    expect(await screen.findByText('Log for Noodle')).toBeInTheDocument();
    expect(screen.queryByText('Which pet?')).toBeNull();
    expect(screen.getByRole('link', { name: '+ Add a new pet' })).toHaveAttribute('href', '/pets/new');
    await userEvent.click(screen.getByRole('button', { name: 'Poop' }));
    const sheet = screen.getByRole('dialog', { name: 'Log poop' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save poop' }));
    await vi.waitFor(async () => expect(await listPoops(noodle.id)).toHaveLength(1));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('with several pets you pick one, then any entry type opens its sheet', async () => {
    await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    renderAdd();
    expect(await screen.findByText('Which pet?')).toBeInTheDocument();
    expect(screen.getByText('Pick a pet first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Note' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Ziggy' }));
    expect(screen.getByRole('button', { name: 'Ziggy' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Log for Ziggy')).toBeInTheDocument();
    const pairs: [string, string][] = [
      ['Feeding', 'Feed Ziggy'],
      ['Regurgitation', 'Log regurgitation'],
      ['Poop', 'Log poop'],
      ['Shed', 'Log shed'],
      ['Weight', 'Log weight & length'],
      ['Habitat reading', 'Log habitat reading'],
      ['Vet visit', 'New vet visit'],
      ['Note', 'New note'],
    ];
    for (const [entry, dialog] of pairs) {
      await userEvent.click(screen.getByRole('button', { name: entry }));
      expect(await screen.findByRole('dialog', { name: dialog })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Replace the whole of `src/app/App.test.tsx`**

```tsx
import { beforeEach, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../test/render';
import { resetDb } from '../db/db';

beforeEach(async () => {
  await resetDb();
});

it('opens on the Pets home screen with a tab bar', async () => {
  renderAt('/');
  expect(await screen.findByRole('heading', { name: 'My Reptiles' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
});

it('has the tabs Pets, Schedule, Add, Settings in that order (spec §4)', async () => {
  renderAt('/');
  const nav = await screen.findByRole('navigation', { name: 'Main' });
  expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/schedule', '/add', '/settings']);
});

it('opens the Add tab', async () => {
  renderAt('/add');
  expect(await screen.findByRole('heading', { name: 'Add' })).toBeInTheDocument();
  expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Add' })).toHaveClass('active');
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/add src/app/App.test.tsx`
Expected: FAIL with `Failed to resolve import "./AddScreen"`; the tab order test gets `['/', '/schedule', '/settings']`.

- [ ] **Step 4: Create `src/features/add/AddScreen.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { lastMeal, nextFeedingDue } from '../../domain/feeding';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';
import { Card } from '../../ui/Card';
import { useNow } from '../../ui/useNow';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import RegurgitationSheet from '../regurgitation/RegurgitationSheet';
import LogPoopSheet from '../poop/LogPoopSheet';
import LogShedSheet from '../sheds/LogShedSheet';
import LogMeasurementSheet from '../weight/LogMeasurementSheet';
import LogHabitatSheet from '../habitat/LogHabitatSheet';
import VetVisitSheet from '../vet/VetVisitSheet';
import NoteSheet from '../notes/NoteSheet';

/** Spec §5.14 entry types, in order. */
const ENTRIES = [
  { type: 'feeding', icon: '🍽️', label: 'Feeding' },
  { type: 'regurgitation', icon: '🤢', label: 'Regurgitation' },
  { type: 'poop', icon: '💩', label: 'Poop' },
  { type: 'shed', icon: '🐍', label: 'Shed' },
  { type: 'weight', icon: '⚖️', label: 'Weight' },
  { type: 'habitat', icon: '🌡️', label: 'Habitat reading' },
  { type: 'vet', icon: '🩺', label: 'Vet visit' },
  { type: 'note', icon: '📝', label: 'Note' },
] as const;

type EntryType = (typeof ENTRIES)[number]['type'];

export default function AddScreen({ now: fixedNow }: { now?: Date }) {
  const now = useNow(fixedNow);
  const pets = useLiveQuery(() => listActivePets(), []);
  const [picked, setPicked] = useState<string>();
  const [open, setOpen] = useState<EntryType | null>(null);
  // With a single pet the picker is skipped.
  const pet = pets?.length === 1 ? pets[0] : pets?.find((p) => p.id === picked);
  const petId = pet?.id;
  const feedings = useLiveQuery(() => (petId ? listFeedings(petId) : []), [petId]);

  if (!pets) return null;
  const close = () => setOpen(null);

  return (
    <>
      <h1>Add</h1>

      {pets.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <h2 style={{ margin: '4px 0' }}>No reptiles yet</h2>
          <p className="muted">Add a pet first, then log anything for it here.</p>
          <Link className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
            Add a reptile
          </Link>
        </Card>
      ) : (
        <>
          {pets.length > 1 && (
            <>
              <div className="label">Which pet?</div>
              <div className="chips">
                {pets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip ${p.id === pet?.id ? 'on' : ''}`}
                    aria-pressed={p.id === pet?.id}
                    onClick={() => setPicked(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="label">{pet ? `Log for ${pet.name}` : 'Pick a pet first'}</div>
          <div className="tiles">
            {ENTRIES.map((e) => (
              <button key={e.type} type="button" className="tile" disabled={!pet} onClick={() => setOpen(e.type)}>
                <span className="tile-ic" aria-hidden="true">{e.icon}</span>
                <b>{e.label}</b>
              </button>
            ))}
          </div>
          <Link className="btn-ghost" style={{ textAlign: 'center', textDecoration: 'none' }} to="/pets/new">
            + Add a new pet
          </Link>
        </>
      )}

      {pet && feedings && (
        <>
          <LogFeedingSheet
            open={open === 'feeding'}
            pet={pet}
            lastMealAt={lastMeal(feedings)?.at}
            currentDue={nextFeedingDue(pet, feedings)}
            now={now}
            onClose={close}
          />
          <RegurgitationSheet open={open === 'regurgitation'} pet={pet} now={now} onClose={close} />
          <LogPoopSheet open={open === 'poop'} pet={pet} now={now} onClose={close} />
          <LogShedSheet open={open === 'shed'} pet={pet} now={now} onClose={close} />
          <LogMeasurementSheet open={open === 'weight'} pet={pet} now={now} onClose={close} />
          <LogHabitatSheet open={open === 'habitat'} pet={pet} now={now} onClose={close} />
          <VetVisitSheet open={open === 'vet'} pet={pet} now={now} onClose={close} />
          <NoteSheet open={open === 'note'} pet={pet} now={now} onClose={close} />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 5: Replace the whole of `src/app/TabBar.tsx`** (spec §4 order: Pets, Schedule, Add, Settings)

```tsx
import { NavLink } from 'react-router-dom';

export const TABS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'Pets', icon: '🦎', end: true },
  { to: '/schedule', label: 'Schedule', icon: '📅' },
  { to: '/add', label: 'Add', icon: '➕' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: Replace the whole of `src/app/App.tsx`** (adds the Add route; this is the final route list)

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';
import PetProfile from '../features/pets/PetProfile';
import PetForm from '../features/pets/PetForm';
import FeedingHistory from '../features/feedings/FeedingHistory';
import SettingsScreen from '../features/settings/SettingsScreen';
import PoopScreen from '../features/poop/PoopScreen';
import ShedsScreen from '../features/sheds/ShedsScreen';
import WeightScreen from '../features/weight/WeightScreen';
import HabitatScreen from '../features/habitat/HabitatScreen';
import CareTasksScreen from '../features/care/CareTasksScreen';
import VetScreen from '../features/vet/VetScreen';
import NotesScreen from '../features/notes/NotesScreen';
import ScheduleScreen from '../features/schedule/ScheduleScreen';
import AddScreen from '../features/add/AddScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
        <Route path="pets/:id" element={<PetProfile />} />
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
        <Route path="pets/:id/poop" element={<PoopScreen />} />
        <Route path="pets/:id/sheds" element={<ShedsScreen />} />
        <Route path="pets/:id/weight" element={<WeightScreen />} />
        <Route path="pets/:id/habitat" element={<HabitatScreen />} />
        <Route path="pets/:id/care" element={<CareTasksScreen />} />
        <Route path="pets/:id/vet" element={<VetScreen />} />
        <Route path="pets/:id/notes" element={<NotesScreen />} />
        <Route path="schedule" element={<ScheduleScreen />} />
        <Route path="add" element={<AddScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeSync />
      <AppRoutes />
    </HashRouter>
  );
}
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: all pass, exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add the Add tab for quick-logging any entry for any pet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Sample husbandry history, iPhone checklist, hand-off for deploy

Spec §14: "Load sample pets" (dev builds only) should make every Plan 2 screen realistic on `localhost`. The release checklist gains the Plan 2 checks. Then the branch is handed to the controller for the merge and deploy.

**Files:**
- Modify: `src/dev/sampleData.ts`, `docs/iphone-checklist.md`
- Test: `src/dev/sampleData.test.ts`

**Interfaces:**
- Consumes: every Plan 2 repository (`logShed`, `logPoop`, `logMeasurement`, `updateHabitatSetup`, `logHabitatReading`, `createCareTask`, `completeCareTask`, `createVetVisit`, `addNote`), `predictNextShed`, `shedEtaLabel`, `tempToC`
- Produces: `loadSampleData(now?: Date): Promise<void>` (same signature) now also writes, relative to `now`: Noodle's 4 sheds 33 days apart (next shed "In 15 days"), 2 poops, 4 weight/length entries (42 g, ↑ 3 g, 18 in), the 40-gal tank setup with 7 daily readings, 2 vet visits with a next appointment, 3 notes; a runny poop for Basil; 5 care tasks (Spot clean and Fresh water due today, Mist tomorrow, Deep clean in 7 days, Replace UVB bulb later)

- [ ] **Step 1: Replace the whole of `src/dev/sampleData.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from '../db/db';
import { listActivePets } from '../db/pets';
import { listFeedings } from '../db/feedings';
import { listSheds } from '../db/sheds';
import { listPoops } from '../db/poops';
import { listMeasurements } from '../db/measurements';
import { listHabitatReadings } from '../db/habitat';
import { listCareTasks } from '../db/care';
import { listVetVisits } from '../db/vetVisits';
import { listNotes } from '../db/notes';
import { predictNextShed, shedEtaLabel } from '../domain/sheds';
import { sortSummaries, summarize } from '../features/pets/usePetSummaries';
import { loadSampleData } from './sampleData';

const now = new Date(2026, 10, 8, 9, 0);

beforeEach(async () => {
  await resetDb();
});

it('creates four pets in every feeding state', async () => {
  await loadSampleData(now);
  const pets = await listActivePets();
  const summaries = sortSummaries(await Promise.all(pets.map(async (p) => summarize(p, await listFeedings(p.id), now))));
  expect(summaries.map((s) => [s.pet.name, s.label])).toEqual([
    ['Basil', '1 day late'],
    ['Noodle', 'Today'],
    ['Pebble', 'Tomorrow'],
    ['Ziggy', 'In 2 days'],
  ]);
});

it('adds husbandry history so every Plan 2 screen has something to show', async () => {
  await loadSampleData(now);
  const pets = await listActivePets();
  const noodle = pets.find((p) => p.name === 'Noodle')!;
  const basil = pets.find((p) => p.name === 'Basil')!;

  const prediction = predictNextShed(await listSheds(noodle.id))!;
  expect(prediction.averageDays).toBe(33);
  expect(shedEtaLabel(prediction.date, now)).toBe('In 15 days');
  expect(noodle.enclosureLabel).toBe('40-gal tank');
  expect(await listPoops(noodle.id)).toHaveLength(2);
  expect((await listPoops(basil.id))[0]).toMatchObject({ kind: 'runny' });
  expect((await listMeasurements(noodle.id)).at(-1)).toMatchObject({ weightG: 42, lengthMm: 457.2 });
  expect(await listHabitatReadings(noodle.id)).toHaveLength(7);
  expect(await listVetVisits(noodle.id)).toHaveLength(2);
  expect(await listNotes(noodle.id)).toHaveLength(3);
  expect((await listCareTasks()).map((t) => t.name)).toEqual(['Deep clean', 'Fresh water', 'Mist', 'Replace UVB bulb', 'Spot clean']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/dev`
Expected: the first test passes; the second fails (`Cannot read properties of null (reading 'averageDays')`: no sheds yet).

- [ ] **Step 3: Replace the whole of `src/dev/sampleData.ts`**

```ts
import { addDays, startOfDay, subMonths } from 'date-fns';
import { createPet } from '../db/pets';
import { logFeeding } from '../db/feedings';
import { logShed } from '../db/sheds';
import { logPoop } from '../db/poops';
import { logMeasurement } from '../db/measurements';
import { logHabitatReading, updateHabitatSetup } from '../db/habitat';
import { completeCareTask, createCareTask } from '../db/care';
import { createVetVisit } from '../db/vetVisits';
import { addNote } from '../db/notes';
import { dateKey } from '../domain/dates';
import { tempToC } from '../domain/units';
import type { FeedingOutcome, ShedQuality } from '../domain/types';

/** Dev builds only: the four pets from the approved mockups, with history relative to `now`. */
export async function loadSampleData(now: Date = new Date()): Promise<void> {
  const at = (offsetDays: number, hour = 18, minute = 0) => {
    const d = addDays(startOfDay(now), offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const day = (offsetDays: number) => dateKey(addDays(now, offsetDays));
  const f = (deg: number) => tempToC(deg, 'F');
  const meals = async (
    petId: string, foodItem: string, quantity: number, entries: [number, FeedingOutcome?][],
  ) => {
    for (const [offset, outcome = 'ate'] of entries) {
      await logFeeding({ petId, at: at(offset), foodItem, quantity, outcome });
    }
  };

  const noodle = await createPet({
    name: 'Noodle', species: 'Corn Snake', morph: 'Amel', sex: 'female', origin: 'captive_bred',
    birthDate: dateKey(subMonths(now, 8)), feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse',
    sire: { name: 'Apollo', morph: 'Amel' }, dam: { name: 'Juniper', morph: 'Anery' },
    acquiredFrom: 'Scales & Tails Reptiles', acquiredDate: dateKey(subMonths(now, 7)), pricePaid: 65,
    description: 'Calm, great eater. Likes the cork bark hide on the warm side.',
  });
  await meals(noodle.id, 'Pinky mouse', 1, [[-15], [-10], [-6, 'refused'], [-5]]); // due today

  const ziggy = await createPet({
    name: 'Ziggy', species: 'Leopard Gecko', morph: 'Tangerine', sex: 'male',
    feedingIntervalDays: 3, usualFoodItem: 'Crickets', usualQuantity: 8,
  });
  await meals(ziggy.id, 'Crickets', 8, [[-7], [-4], [-1]]); // due in 2 days

  const basil = await createPet({
    name: 'Basil', species: 'Bearded Dragon', feedingIntervalDays: 2,
    usualFoodItem: 'Dubia roaches', usualQuantity: 12,
  });
  await meals(basil.id, 'Dubia roaches', 12, [[-7], [-5], [-3]]); // 1 day late

  const pebble = await createPet({
    name: 'Pebble', species: 'Russian Tortoise', feedingIntervalDays: 2, usualFoodItem: 'Greens',
  });
  await meals(pebble.id, 'Greens', 1, [[-5], [-3], [-1]]); // due tomorrow

  // ---- Plan 2 husbandry history (mockup ①–⑧ values) ----

  // Sheds every 33 days → next one "In 15 days".
  const sheds: { offset: number; quality: ShedQuality; notes?: string; inBlue?: number }[] = [
    { offset: -117, quality: 'complete' },
    { offset: -84, quality: 'partial', notes: 'Stuck shed on the tail tip, soaked 15 min' },
    { offset: -51, quality: 'complete' },
    { offset: -18, quality: 'complete', inBlue: -25 },
  ];
  for (const s of sheds) {
    await logShed({
      petId: noodle.id, date: day(s.offset), quality: s.quality, notes: s.notes,
      inBlueDate: s.inBlue === undefined ? undefined : day(s.inBlue),
    });
  }

  await logPoop({ petId: noodle.id, at: at(-12, 9), kind: 'normal' }); // 3 days after the -15 meal
  await logPoop({ petId: noodle.id, at: at(-2, 8), kind: 'normal' }); // 3 days after the -5 meal
  await logPoop({ petId: basil.id, at: at(-1, 10), kind: 'runny', notes: 'A bit runny' });

  await logMeasurement({ petId: noodle.id, date: day(-97), weightG: 30, lengthMm: 406.4 });
  await logMeasurement({ petId: noodle.id, date: day(-67), weightG: 33 });
  await logMeasurement({ petId: noodle.id, date: day(-37), weightG: 39, lengthMm: 431.8 });
  await logMeasurement({ petId: noodle.id, date: day(-7), weightG: 42, lengthMm: 457.2 });

  await updateHabitatSetup(noodle.id, {
    enclosureLabel: '40-gal tank',
    habitatTargets: { warmMinC: f(85), warmMaxC: f(90), coolMinC: f(72), coolMaxC: f(78), humidityMin: 40, humidityMax: 60 },
  });
  for (let offset = -6; offset <= 0; offset++) {
    await logHabitatReading({ petId: noodle.id, at: at(offset, 8, 15), warmC: f(88), coolC: f(74), humidityPct: 52 });
  }

  const tasks: { petId?: string; name: string; intervalDays: number; doneAt: string }[] = [
    { petId: basil.id, name: 'Spot clean', intervalDays: 1, doneAt: at(-1, 9) }, // due today
    { name: 'Fresh water', intervalDays: 2, doneAt: at(-2, 9) }, // due today, all pets
    { petId: ziggy.id, name: 'Mist', intervalDays: 2, doneAt: at(-1, 20) }, // tomorrow
    { petId: noodle.id, name: 'Deep clean', intervalDays: 30, doneAt: at(-23, 10) }, // in 7 days
    { petId: basil.id, name: 'Replace UVB bulb', intervalDays: 180, doneAt: at(-150, 10) },
  ];
  for (const t of tasks) {
    const task = await createCareTask({ petId: t.petId, name: t.name, intervalDays: t.intervalDays });
    await completeCareTask(task.id, t.doneAt);
  }

  await createVetVisit({
    petId: noodle.id, date: day(-202), reason: 'New-pet check', clinic: 'Exotic Animal Clinic',
    notes: 'No mites, good body condition.',
  });
  await createVetVisit({
    petId: noodle.id, date: day(-147), reason: 'Wellness exam', clinic: 'Exotic Animal Clinic', vet: 'Dr. Patel',
    phone: '(555) 201-4470', cost: 85, notes: 'Healthy. Weight 28 g. Fecal test negative.',
    nextAppointment: at(218, 10),
  });

  await addNote({ petId: noodle.id, at: at(-20, 19), text: 'Eyes going blue, skipped handling.' });
  await addNote({ petId: noodle.id, at: at(-9, 20), text: 'Moved the cork bark hide to the warm side.' });
  await addNote({ petId: noodle.id, at: at(-1, 19), text: 'Very active tonight.' });
}
```

- [ ] **Step 4: Replace the whole of `docs/iphone-checklist.md`** (adds the Plan 2 checks 9–15)

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
```

- [ ] **Step 5: Run everything, then build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass; the build ends listing `dist/manifest.webmanifest` and `dist/sw.js`.

- [ ] **Step 6: Preview the whole app on localhost**

Run `npm run dev` and open `http://localhost:5173/RepTender/`. Settings → **Load sample pets**, then:
1. **Schedule** tab: "Today" lists Feed Basil (1 day late), Feed Noodle (Today), Fresh water and Spot clean (due today); "Coming up" lists Mist tomorrow, Feed Pebble, Feed Ziggy and Deep clean.
2. Pets → **Noodle**: tiles read "Last: <date> · complete", "Last: <date> · normal", "42 g · ↑ 3 g", "88°F · 52% RH", "1 due today" (Fresh water, an All-pets task), "<date> · Wellness exam", "3 notes". Stats show 18 in and 42 g.
3. Open each tile: Sheds shows "Next shed expected … In 15 days"; Weight shows the chart; Habitat shows "40-gal tank" with three in-range gauges and "In range all week ✓"; Vet visits shows the next appointment and the tap-to-call phone.
4. **Add** tab: pick Ziggy → Poop → Save. Ziggy's Poop tile now shows today.
5. Settings → **Dark**: repeat a quick look at the tiles, a gauge and the chart; everything is readable.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add husbandry history to the sample pets and Plan 2 iPhone checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Hand off for deploy (do not push)**

Report the final commit SHA and the `npm test` count. **Do not push and do not merge.** The controller merges the branch to `main` and pushes as **JosephSester** (`GH_TOKEN="$(gh auth token --user JosephSester)" git push`, Git Bash). The GitHub Actions workflow then tests, builds and deploys to `https://josephsester.github.io/RepTender/` (watch it with `GH_TOKEN="$(gh auth token --user JosephSester)" gh run watch --repo JosephSester/RepTender --exit-status`). After the deploy, the user runs `docs/iphone-checklist.md` on the iPhone 17. The Dexie v2 upgrade runs automatically on the phone's existing Plan 1 data the first time the new version opens; checklist item 6 (offline, all data still there) confirms it.

---

## Plan 2 done when

- `npm test` and `npm run typecheck` pass. The GitHub Actions deploy is green.
- An existing Plan 1 database upgrades to schema version 2 with every pet, feeding, regurgitation, photo, food item and setting intact (`src/db/schema.test.ts`).
- On localhost: the Regurgitation, Poop, Shed, Weight & length, Habitat reading, Habitat setup, Care task, Vet visit and Note sheets save and survive a cleared date; every husbandry screen lists, deletes and (vet visits, notes, care tasks) edits its entries; the profile has the Quick log row, the Husbandry tiles and real Length / Weight; the Schedule tab shows today's checklist and the next 7 days; the Add tab logs any entry for any pet; Home shows "Show archived" with Unarchive; deleting a pet removes all of its husbandry records and photos.
- On the iPhone: the checklist passes.

**Next:** Plan 3 (Calendar `.ics` reminders including "Remind me", vet "Add to Calendar" and "Add all reminders"; the app icon badge; backup export/import with the schema version; the Settings Units picker; the error boundary; the storage warning).

## Spec coverage (self-review)

| Spec | Where |
|---|---|
| §5.1 Show archived (+ unarchive) | Task 1 |
| §5.2 items 5–7 (Quick log, Husbandry tiles, Length/Weight) | Task 11 |
| §5.5 Regurgitation sheet (last 5 eaten meals, found at, notes, push-back 10 days, red on calendar via the existing marks) | Task 3 |
| §5.6 Poop (last poop card, typical gap, one-tap kinds, "N days after <meal> meal") | Task 4 |
| §5.7 Sheds (prediction card after 2+ sheds, Mark "in blue", quality, in-blue date, notes) | Task 5 |
| §5.8 Weight & length (current weight, 30-day change, length, SVG chart 6M/1Y/All, entries; one value required) | Task 6 |
| §5.9 Habitat (enclosure label, last reading, three values with targets and gauges, 7-day warm sparkline with band, log a reading; one value required) | Task 7 |
| §5.10 Care tasks (per-pet and All pets, every N days, optional time, completions, starter suggestions) | Task 8 |
| §5.11 Vet visits (clinic card with tap to call, history with cost and photos, next appointment; Add to Calendar → Plan 3) | Task 9 |
| §5.12 Notes | Task 10 |
| §5.13 Schedule (Today, N of M done, checklist, Coming up; Add all reminders → Plan 3) | Task 12 |
| §5.14 Add tab | Task 13 |
| §4 tab order | Tasks 12–13 |
| §6.2 tables, indexes, schema versioning with upgrade | Task 2 |
| §7 rules 8, 9, 10, 11 | Tasks 5, 8, 2, 4 |
| §11 validation (positive, sensible limits, humidity 0–100, at least one value), inline save errors | Tasks 2–10 |
| §12 repository CRUD, cascading delete, schema upgrade | Tasks 2–10 |
| §14 sample data | Task 14 |
| Plan 1 ledger carry-overs | Task 1 |
