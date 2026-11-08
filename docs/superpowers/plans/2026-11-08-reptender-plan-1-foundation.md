# RepTender Plan 1: Foundation + Feeding Core: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working RepTender home-screen web app with pets, feeding logging (Ate / Refused / Regurgitated), next-feeding status, a per-pet feeding calendar, light/dark/auto theme, offline install, and automatic deploys to GitHub Pages.

**Architecture:** React + TypeScript SPA built with Vite, using hash routing. Pure business rules live in `src/domain/` (no React, no DB) and are fully unit-tested. Persistence is IndexedDB through Dexie, behind small repository modules in `src/db/`. Screens in `src/features/` read data with `useLiveQuery`, so the UI updates when the database changes. A PWA service worker makes the app work offline.

**Tech Stack:** Vite 8, React 19, TypeScript 5.9, React Router 7 (HashRouter), Dexie 4 + dexie-react-hooks, date-fns 4, vite-plugin-pwa 2, Vitest 5 + jsdom + Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-08-reptender-design.md`. Read §3–§7, §10 and §13 before starting.

**Later plans (not this one):** Plan 2 covers husbandry (sheds, poop, the regurgitation sheet, weight, habitat, care tasks, vet, notes, and the Schedule and Add tabs). Plan 3 covers reminders (.ics, badge), backup export/import, units, the error boundary and the storage warning.

## Global Constraints

- Developer machine: Windows 11, Node v24.13.0, npm 11.6.2. Commands below are shell-agnostic `npm`/`npx`/`git` calls.
- Package versions (checked 2026-11-08). Install exactly these:
  - runtime: `react@19.3.1 react-dom@19.3.1 react-router-dom@7.18.5 dexie@4.4.7 dexie-react-hooks@4.4.0 date-fns@4.4.0 workbox-window@7.4.1`
  - dev: `vite@8.3.6 @vitejs/plugin-react@6.2.1 typescript@5.9.3 vitest@5.1.0 jsdom@31.0.0 @testing-library/react@16.3.3 @testing-library/dom@10 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.8 fake-indexeddb@6.2.8 @types/react@19 @types/react-dom@19 vite-plugin-pwa@2.0.0`
  - Use TypeScript **5.9.3**, not 7.x (the TS 7 native compiler is too new for this toolchain).
- Vite `base` and the PWA `scope`/`start_url` are `/RepTender/`. The site is served at `https://josephsester.github.io/RepTender/`.
- Routing: `HashRouter` only (GitHub Pages has no server rewrites).
- Canonical units in the DB: grams, millimetres, °C. All IDs come from `crypto.randomUUID()`. Timestamps are ISO strings (`new Date().toISOString()`). Date-only fields use `yyyy-MM-dd`.
- All date comparisons use **calendar days in the phone's local time zone** (date-fns `differenceInCalendarDays`, `startOfDay`).
- Default feed time is `18:00`. Default regurgitation push-back is **10** days.
- App name everywhere is **RepTender**. The home-screen label is `RepTender`.
- Colors (spec §4):
  - light: bg `#F6F1E7`, card `#FFFFFF`, text `#2E2A24`, muted `#8B7E68`, moss `#4E7A3A`, amber `#E9A04B`, late text `#B23A2B` on `#F8D9D4`
  - dark: bg `#171511`, card `#24211B`, text `#F1EADC`, muted `#A99C84`, moss `#6E9E55`, amber `#E9A04B`, late text `#F09A8A` on `#3B201D`
- Commits: small and frequent, conventional style (`feat:`, `test:`, `chore:`). Every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Push to GitHub as the **JosephSester** account, never buildaloyd: `GH_TOKEN="$(gh auth token --user JosephSester)" git push` (Git Bash).
- Run `npm test` and `npm run typecheck` before every commit. Both must pass.

## File Structure (end of Plan 1)

```
.gitattributes                 LF line endings
.claude/launch.json            dev-server entry for Claude's preview pane
.github/workflows/deploy.yml   test → build → GitHub Pages
index.html                     iOS meta tags, pre-paint theme script
package.json, tsconfig.json, vite.config.ts
public/icons/                  icon.svg, apple-touch-icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png
scripts/make-icons.mjs         renders the PNG icons from icon.svg (run once, outputs committed)
docs/iphone-checklist.md       manual release checklist
src/
  main.tsx                     mounts <App/> + <UpdatePrompt/>, requests persistent storage
  env.d.ts                     __APP_VERSION__ global
  app/App.tsx                  HashRouter + AppRoutes + ThemeSync
  app/AppShell.tsx             phone-width frame, safe areas, bottom TabBar
  app/TabBar.tsx               TABS list + bottom navigation
  app/UpdatePrompt.tsx         "Update available — tap to refresh"
  domain/types.ts              all record types
  domain/dates.ts              dateKey, atTime, calendar-day helpers
  domain/feeding.ts            lastMeal, nextFeedingDue, dueStatus, statusLabel, intervalProgress, pushBackOverride
  domain/calendar.ts           monthCells, buildMonthMarks
  domain/age.ts                formatAge
  db/db.ts                     Dexie schema v1, seed, resetDb (tests)
  db/ids.ts                    newId, nowIso, ValidationError
  db/pets.ts                   pet CRUD (cascade delete)
  db/feedings.ts               logFeeding, logRegurgitation, update/delete/list
  db/photos.ts                 savePhoto, getPhotoUrl helpers
  db/settings.ts               getSettings, updateSettings
  db/foodItems.ts              listFoodItems, addFoodItem
  lib/image.ts                 fitWithin (pure) + resizeToJpeg (browser)
  theme/tokens.css             CSS variables, light + dark
  theme/base.css               element defaults
  theme/theme.ts               resolveTheme, applyTheme, THEME_STORAGE_KEY
  theme/ThemeSync.tsx          keeps <html data-theme> in sync with settings + system
  ui/Card.tsx, ui/Pill.tsx, ui/Sheet.tsx, ui/Stepper.tsx, ui/Segmented.tsx, ui/PetAvatar.tsx, ui/ui.css
  ui/MonthCalendar.tsx         compact + large calendar, legend
  ui/usePhotoUrl.ts            object URL for a stored photo
  ui/useNow.ts                 clock that refreshes each minute / on foreground
  features/pets/PetsHome.tsx           Home screen (exports TONE, bannerLine)
  features/pets/usePetSummaries.ts     summarize, sortSummaries, usePetSummaries
  features/pets/usePetDetail.ts        pet + feedings + regurgitations (live)
  features/pets/format.ts              formatDue, formatDateKey
  features/pets/petFormModel.ts        FormState <-> PetInput
  features/pets/PetForm.tsx            add/edit pet
  features/pets/PetProfile.tsx         profile page (+ profile.css)
  features/feedings/logModel.ts        previewNextDue, formatDay
  features/feedings/LogFeedingSheet.tsx
  features/feedings/EditFeedingSheet.tsx
  features/feedings/foodIcon.ts
  features/feedings/FeedingHistory.tsx
  features/settings/SettingsScreen.tsx
  dev/sampleData.ts            "Load sample pets" (dev builds only)
  test/setup.ts                fake-indexeddb, jest-dom, matchMedia stub
  test/render.tsx              renderAt(path) helper
```
Tests sit next to their source as `*.test.ts(x)`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitattributes`, `.claude/launch.json`, `src/main.tsx`, `src/app/App.tsx`, `src/test/setup.ts`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `npm run dev | build | test | typecheck` scripts. `src/test/setup.ts` is loaded for every test. `App` is the default export of `src/app/App.tsx`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "reptender",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react@19.3.1 react-dom@19.3.1 react-router-dom@7.18.5 dexie@4.4.7 dexie-react-hooks@4.4.0 date-fns@4.4.0 workbox-window@7.4.1
```
```bash
npm install -D vite@8.3.6 @vitejs/plugin-react@6.2.1 typescript@5.9.3 vitest@5.1.0 jsdom@31.0.0 @testing-library/react@16.3.3 @testing-library/dom@10 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.8 fake-indexeddb@6.2.8 @types/react@19 @types/react-dom@19 vite-plugin-pwa@2.0.0
```
Expected: both finish without `ERESOLVE` errors. Peer-dependency *warnings* are OK.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`** (the PWA plugin is added in Task 13)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/RepTender/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

- [ ] **Step 5: Create `src/test/setup.ts`**

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom has no matchMedia; ThemeSync and the theme helpers need it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 6: Write the failing smoke test `src/app/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import App from './App';

it('renders the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'RepTender' })).toBeInTheDocument();
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL. `Failed to resolve import "./App"`.

- [ ] **Step 8: Create `src/app/App.tsx` (temporary; replaced in Task 6)**

```tsx
export default function App() {
  return <h1>RepTender</h1>;
}
```

- [ ] **Step 9: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Create `index.html`.** The inline script applies the saved theme before first paint (spec §5.15). The storage key must match `THEME_STORAGE_KEY` in Task 5.

```html
<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="RepTender" />
    <meta name="theme-color" content="#F6F1E7" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#171511" media="(prefers-color-scheme: dark)" />
    <link rel="apple-touch-icon" href="/RepTender/icons/apple-touch-icon-180.png" />
    <link rel="icon" type="image/svg+xml" href="/RepTender/icons/icon.svg" />
    <title>RepTender</title>
    <script>
      (function () {
        try {
          var pref = localStorage.getItem('reptender-theme') || 'auto';
          var dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Create `.gitattributes`**

```
* text=auto eol=lf
*.png binary
```

- [ ] **Step 12: Create `.claude/launch.json`** (lets Claude open the dev server in its preview pane)

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "reptender-dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

- [ ] **Step 13: Run tests, typecheck and the dev server**

Run: `npm test` → Expected: 1 passed.
Run: `npm run typecheck` → Expected: no output, exit 0.
Run: `npm run dev`, then open `http://localhost:5173/RepTender/` → Expected: the heading "RepTender". Stop the server.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS app with Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Domain types, date helpers, feeding rules

**Files:**
- Create: `src/domain/types.ts`, `src/domain/dates.ts`, `src/domain/feeding.ts`
- Test: `src/domain/dates.test.ts`, `src/domain/feeding.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `types.ts`: `Sex`, `Origin`, `ParentRef`, `HabitatTargets`, `Pet`, `FeedingOutcome`, `Feeding`, `Regurgitation`, `Photo`, `FoodItem`, `ThemePref`, `Settings`
  - `dates.ts`: `DEFAULT_FEED_TIME = '18:00'`, `dateKey(d: Date): string`, `parseDateKey(key: string): Date`, `atTime(day: Date, hhmm: string): Date`
  - `feeding.ts`: `DueStatus`, `DEFAULT_PUSH_BACK_DAYS = 10`, `lastMeal(feedings)`, `nextFeedingDue(pet, feedings): Date | null`, `dueStatus(due, now): DueStatus`, `statusLabel(due, now): string`, `intervalProgress(meal, due, now): number`, `pushBackOverride(regurgitatedAt: Date, pet, days?): string`

- [ ] **Step 1: Create `src/domain/types.ts`** (types only, nothing to test)

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

export interface Settings {
  id: 'settings';
  theme: ThemePref;
  tempUnit: 'F' | 'C';
  weightUnit: 'g' | 'oz' | 'lb';
  lengthUnit: 'in' | 'cm';
  lastBackupAt?: string;
}
```

- [ ] **Step 2: Write failing tests `src/domain/dates.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { atTime, dateKey, parseDateKey } from './dates';

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
```

- [ ] **Step 3: Write failing tests `src/domain/feeding.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { Feeding, FeedingOutcome } from './types';
import {
  dueStatus,
  intervalProgress,
  lastMeal,
  nextFeedingDue,
  pushBackOverride,
  statusLabel,
} from './feeding';

const local = (m: number, d: number, h = 18, min = 0) => new Date(2026, m, d, h, min);
let n = 0;
const feeding = (at: Date, outcome: FeedingOutcome = 'ate'): Feeding => ({
  id: `f${++n}`,
  petId: 'p1',
  at: at.toISOString(),
  foodItem: 'Pinky mouse',
  quantity: 1,
  outcome,
  createdAt: at.toISOString(),
  updatedAt: at.toISOString(),
});
const pet = {
  feedingIntervalDays: 5,
  usualFeedTime: '18:00' as string | undefined,
  nextFeedingOverride: undefined as string | undefined,
};

describe('lastMeal', () => {
  it('returns the latest meal that was eaten, ignoring refusals', () => {
    const a = feeding(local(10, 3));
    const r = feeding(local(10, 5), 'refused');
    expect(lastMeal([r, a])).toBe(a);
  });
  it('returns undefined when nothing was eaten', () => {
    expect(lastMeal([feeding(local(10, 5), 'refused')])).toBeUndefined();
  });
});

describe('nextFeedingDue', () => {
  it('is null with no meals', () => {
    expect(nextFeedingDue(pet, [])).toBeNull();
  });
  it('is last meal + interval at the usual feed time', () => {
    const due = nextFeedingDue(pet, [feeding(local(10, 3, 18, 5))])!;
    expect(due.getTime()).toBe(local(10, 8, 18, 0).getTime());
  });
  it('defaults the feed time to 18:00', () => {
    const due = nextFeedingDue({ ...pet, usualFeedTime: undefined }, [feeding(local(10, 3, 9, 0))])!;
    expect(due.getTime()).toBe(local(10, 8, 18, 0).getTime());
  });
  it('a refusal does not reset the clock', () => {
    const due = nextFeedingDue(pet, [feeding(local(10, 3)), feeding(local(10, 8), 'refused')])!;
    expect(due.getTime()).toBe(local(10, 8).getTime());
  });
  it('an override later than the last meal wins', () => {
    const override = local(10, 14).toISOString();
    const due = nextFeedingDue({ ...pet, nextFeedingOverride: override }, [feeding(local(10, 3))])!;
    expect(due.toISOString()).toBe(override);
  });
  it('an override older than the last meal is ignored', () => {
    const override = local(10, 4).toISOString();
    const due = nextFeedingDue({ ...pet, nextFeedingOverride: override }, [feeding(local(10, 6))])!;
    expect(due.getTime()).toBe(local(10, 11).getTime());
  });
});

describe('dueStatus / statusLabel', () => {
  const due = local(10, 8, 18, 0);
  it('today when due later the same calendar day', () => {
    expect(dueStatus(due, local(10, 8, 7, 0))).toBe('today');
    expect(statusLabel(due, local(10, 8, 7, 0))).toBe('Today');
  });
  it('late from the next calendar day', () => {
    expect(dueStatus(due, local(10, 9, 0, 30))).toBe('late');
    expect(statusLabel(due, local(10, 9, 0, 30))).toBe('1 day late');
    expect(statusLabel(due, local(10, 11))).toBe('3 days late');
  });
  it('soon before the due day', () => {
    expect(dueStatus(due, local(10, 6))).toBe('soon');
    expect(statusLabel(due, local(10, 7))).toBe('Tomorrow');
    expect(statusLabel(due, local(10, 4))).toBe('In 4 days');
  });
  it('no meals yet counts as due today', () => {
    expect(dueStatus(null, local(10, 8))).toBe('today');
    expect(statusLabel(null, local(10, 8))).toBe('No feedings yet');
  });
});

describe('intervalProgress', () => {
  const meal = feeding(local(10, 3, 18, 0));
  const due = local(10, 8, 18, 0);
  it('is the fraction of the interval elapsed', () => {
    expect(intervalProgress(meal, due, new Date(2026, 10, 5, 18, 0))).toBeCloseTo(0.4, 5);
  });
  it('caps at 1 when late and is 1 without a meal', () => {
    expect(intervalProgress(meal, due, local(10, 10))).toBe(1);
    expect(intervalProgress(undefined, null, local(10, 10))).toBe(1);
  });
});

describe('pushBackOverride', () => {
  it('is regurgitation date + 10 days at the usual feed time', () => {
    const iso = pushBackOverride(local(10, 4, 7, 30), { usualFeedTime: '18:00' });
    expect(iso).toBe(local(10, 14, 18, 0).toISOString());
  });
  it('accepts a custom number of days', () => {
    const iso = pushBackOverride(local(10, 4, 7, 30), { usualFeedTime: undefined }, 14);
    expect(iso).toBe(local(10, 18, 18, 0).toISOString());
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/domain`
Expected: FAIL. `Failed to resolve import "./dates"` / `"./feeding"`.

- [ ] **Step 5: Implement `src/domain/dates.ts`**

```ts
import { format, parse, set, startOfDay } from 'date-fns';

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
```

- [ ] **Step 6: Implement `src/domain/feeding.ts`**

```ts
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Feeding, Pet } from './types';
import { atTime, DEFAULT_FEED_TIME } from './dates';

export type DueStatus = 'late' | 'today' | 'soon';
export const DEFAULT_PUSH_BACK_DAYS = 10;

type SchedulePet = Pick<Pet, 'feedingIntervalDays' | 'usualFeedTime' | 'nextFeedingOverride'>;

/** Most recent feeding the pet actually ate. Refusals never count. */
export function lastMeal(feedings: readonly Feeding[]): Feeding | undefined {
  let best: Feeding | undefined;
  for (const f of feedings) {
    if (f.outcome === 'ate' && (!best || Date.parse(f.at) > Date.parse(best.at))) best = f;
  }
  return best;
}

/** Spec §7 rules 2–4. Null means no meals yet ("due now"). */
export function nextFeedingDue(pet: SchedulePet, feedings: readonly Feeding[]): Date | null {
  const meal = lastMeal(feedings);
  const override = pet.nextFeedingOverride ? parseISO(pet.nextFeedingOverride) : undefined;
  if (override && (!meal || override.getTime() > Date.parse(meal.at))) return override;
  if (!meal) return null;
  return atTime(addDays(parseISO(meal.at), pet.feedingIntervalDays), pet.usualFeedTime ?? DEFAULT_FEED_TIME);
}

export function dueStatus(due: Date | null, now: Date): DueStatus {
  if (!due) return 'today';
  const days = differenceInCalendarDays(due, now);
  if (days < 0) return 'late';
  return days === 0 ? 'today' : 'soon';
}

export function statusLabel(due: Date | null, now: Date): string {
  if (!due) return 'No feedings yet';
  const days = differenceInCalendarDays(due, now);
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} late`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** 0..1 share of the current feeding interval that has passed (drives the card's progress bar). */
export function intervalProgress(meal: Feeding | undefined, due: Date | null, now: Date): number {
  if (!meal || !due) return 1;
  const start = Date.parse(meal.at);
  const end = due.getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export function pushBackOverride(
  regurgitatedAt: Date,
  pet: Pick<Pet, 'usualFeedTime'>,
  days: number = DEFAULT_PUSH_BACK_DAYS,
): string {
  return atTime(addDays(regurgitatedAt, days), pet.usualFeedTime ?? DEFAULT_FEED_TIME).toISOString();
}
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npm test -- src/domain` → Expected: all pass.
Run: `npm run typecheck` → Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/domain
git commit -m "feat: add domain types and feeding schedule rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Calendar marks and age

**Files:**
- Create: `src/domain/calendar.ts`, `src/domain/age.ts`
- Test: `src/domain/calendar.test.ts`, `src/domain/age.test.ts`

**Interfaces:**
- Consumes: `Feeding`, `Regurgitation`, `dateKey`, `parseDateKey` (Task 2)
- Produces:
  - `DayMark = 'ate' | 'refused' | 'regurgitated' | 'nextDue' | 'planned' | 'today'`
  - `monthCells(year: number, month: number): (Date | null)[]`. `month` is 0-based. Leading `null`s pad to Sunday.
  - `MonthMarkInput = { year; month; feedings; regurgitations; nextDue: Date | null; intervalDays: number; now: Date; plannedCount?: number }`
  - `buildMonthMarks(input: MonthMarkInput): Map<string, Set<DayMark>>`. Keys are `dateKey`s.
  - `formatAge(birthDate: string, now: Date, approx?: boolean): string`

- [ ] **Step 1: Write failing tests `src/domain/calendar.test.ts`.** The fixture matches the approved mockup: refused Nov 2, ate Nov 3, due today Nov 8, every 5 days.

```ts
import { describe, it, expect } from 'vitest';
import type { Feeding, FeedingOutcome, Regurgitation } from './types';
import { buildMonthMarks, monthCells } from './calendar';

const feeding = (id: string, at: Date, outcome: FeedingOutcome = 'ate'): Feeding => ({
  id, petId: 'p1', at: at.toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome,
  createdAt: at.toISOString(), updatedAt: at.toISOString(),
});

describe('monthCells', () => {
  it('November 2026 starts on Sunday and has 30 days', () => {
    const cells = monthCells(2026, 10);
    expect(cells).toHaveLength(30);
    expect(cells[0]!.getDate()).toBe(1);
  });
  it('October 2026 is padded with 4 leading blanks (starts Thursday)', () => {
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells).toHaveLength(35);
  });
});

describe('buildMonthMarks', () => {
  const base = {
    year: 2026,
    month: 10,
    regurgitations: [] as Regurgitation[],
    nextDue: new Date(2026, 10, 8, 18, 0) as Date | null,
    intervalDays: 5,
    now: new Date(2026, 10, 8, 9, 0),
  };

  it('marks ate, refused, next due, planned and today', () => {
    const marks = buildMonthMarks({
      ...base,
      feedings: [
        feeding('a', new Date(2026, 10, 3, 18, 5)),
        feeding('r', new Date(2026, 10, 2, 18, 0), 'refused'),
      ],
    });
    expect([...marks.get('2026-11-02')!]).toEqual(['refused']);
    expect([...marks.get('2026-11-03')!]).toEqual(['ate']);
    expect(marks.get('2026-11-08')).toEqual(new Set(['nextDue', 'today']));
    expect(marks.get('2026-11-13')).toEqual(new Set(['planned']));
    expect(marks.get('2026-11-18')).toEqual(new Set(['planned']));
    expect(marks.get('2026-11-23')).toEqual(new Set(['planned']));
    expect(marks.has('2026-11-28')).toBe(false); // only 3 planned by default
  });

  it('shows a regurgitated meal as regurgitated instead of ate', () => {
    const meal = feeding('a', new Date(2026, 10, 3, 18, 5));
    const regurg: Regurgitation = {
      id: 'g', petId: 'p1', feedingId: 'a', at: new Date(2026, 10, 4, 7, 30).toISOString(),
      createdAt: '', updatedAt: '',
    };
    const marks = buildMonthMarks({ ...base, feedings: [meal], regurgitations: [regurg] });
    expect([...marks.get('2026-11-03')!]).toEqual(['regurgitated']);
  });

  it('ignores days outside the month', () => {
    const marks = buildMonthMarks({
      ...base,
      feedings: [feeding('o', new Date(2026, 9, 29, 18, 0))],
      nextDue: new Date(2026, 10, 28, 18, 0),
    });
    expect([...marks.keys()].every((k) => k.startsWith('2026-11'))).toBe(true);
    expect(marks.get('2026-11-28')).toEqual(new Set(['nextDue']));
  });

  it('handles no next due date', () => {
    const marks = buildMonthMarks({ ...base, feedings: [], nextDue: null });
    expect([...marks.entries()]).toEqual([['2026-11-08', new Set(['today'])]]);
  });
});
```

- [ ] **Step 2: Write failing tests `src/domain/age.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatAge } from './age';

const now = new Date(2026, 10, 8, 12, 0);

describe('formatAge', () => {
  it('uses days under one month', () => {
    expect(formatAge('2026-10-20', now)).toBe('19 days');
    expect(formatAge('2026-11-07', now)).toBe('1 day');
  });
  it('uses months under two years', () => {
    expect(formatAge('2026-03-03', now)).toBe('8 mo');
  });
  it('uses years and months from two years', () => {
    expect(formatAge('2023-06-01', now)).toBe('3 yr 5 mo');
  });
  it('prefixes ~ when the birth date is approximate', () => {
    expect(formatAge('2026-03-03', now, true)).toBe('~8 mo');
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/domain`
Expected: FAIL. `Failed to resolve import "./calendar"` / `"./age"`.

- [ ] **Step 4: Implement `src/domain/calendar.ts`**

```ts
import { addDays, getDay, getDaysInMonth, parseISO } from 'date-fns';
import type { Feeding, Regurgitation } from './types';
import { dateKey } from './dates';

export type DayMark = 'ate' | 'refused' | 'regurgitated' | 'nextDue' | 'planned' | 'today';

/** Days of the month, padded at the start with nulls so index 0 is a Sunday. */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const cells: (Date | null)[] = Array.from({ length: getDay(first) }, () => null);
  for (let day = 1; day <= getDaysInMonth(first); day++) cells.push(new Date(year, month, day));
  return cells;
}

export interface MonthMarkInput {
  year: number;
  month: number;
  feedings: readonly Feeding[];
  regurgitations: readonly Regurgitation[];
  nextDue: Date | null;
  intervalDays: number;
  now: Date;
  plannedCount?: number;
}

/** Spec §7 rule 6. */
export function buildMonthMarks(input: MonthMarkInput): Map<string, Set<DayMark>> {
  const { year, month, feedings, regurgitations, nextDue, intervalDays, now, plannedCount = 3 } = input;
  const marks = new Map<string, Set<DayMark>>();
  const add = (d: Date, mark: DayMark) => {
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = dateKey(d);
    let set = marks.get(key);
    if (!set) marks.set(key, (set = new Set()));
    set.add(mark);
  };

  const regurgitated = new Set(regurgitations.map((r) => r.feedingId));
  for (const f of feedings) {
    const mark: DayMark =
      f.outcome === 'refused' ? 'refused' : regurgitated.has(f.id) ? 'regurgitated' : 'ate';
    add(parseISO(f.at), mark);
  }
  if (nextDue) {
    add(nextDue, 'nextDue');
    for (let k = 1; k <= plannedCount; k++) add(addDays(nextDue, k * intervalDays), 'planned');
  }
  add(now, 'today');
  return marks;
}
```

- [ ] **Step 5: Implement `src/domain/age.ts`**

```ts
import { differenceInDays, differenceInMonths } from 'date-fns';
import { parseDateKey } from './dates';

/** Spec §7 rule 7. */
export function formatAge(birthDate: string, now: Date, approx = false): string {
  const born = parseDateKey(birthDate);
  const months = differenceInMonths(now, born);
  let text: string;
  if (months < 1) {
    const days = differenceInDays(now, born);
    text = `${days} day${days === 1 ? '' : 's'}`;
  } else if (months < 24) {
    text = `${months} mo`;
  } else {
    text = `${Math.floor(months / 12)} yr ${months % 12} mo`;
  }
  return approx ? `~${text}` : text;
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/domain` → Expected: all pass.
Run: `npm run typecheck` → Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/domain
git commit -m "feat: add calendar marks and age formatting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Database and repositories

**Files:**
- Create: `src/db/ids.ts`, `src/db/db.ts`, `src/db/pets.ts`, `src/db/feedings.ts`, `src/db/photos.ts`, `src/db/settings.ts`, `src/db/foodItems.ts`
- Test: `src/db/repos.test.ts`

**Interfaces:**
- Consumes: the types from `src/domain/types.ts`, `DEFAULT_FEED_TIME` and `pushBackOverride` (Task 2)
- Produces:
  - `ids.ts`: `newId(): string`, `nowIso(): string`, `class ValidationError extends Error`
  - `db.ts`: `db` (singleton `RepTenderDB`), `resetDb(): Promise<void>` (tests only), `DEFAULT_FOOD_ITEMS: string[]`, `DEFAULT_SETTINGS: Settings`
  - `pets.ts`: `type PetInput`, `createPet(input): Promise<Pet>`, `updatePet(id, patch): Promise<void>`, `getPet(id)`, `listActivePets(): Promise<Pet[]>`, `archivePet(id)`, `deletePet(id)`
  - `feedings.ts`: `type LogFeedingInput`, `type LogRegurgitationInput`, `logFeeding(input): Promise<Feeding>`, `logRegurgitation(input): Promise<Regurgitation>`, `updateFeeding(id, patch)`, `deleteFeeding(id)`, `listFeedings(petId): Promise<Feeding[]>` (oldest first), `listRegurgitations(petId)`
  - `photos.ts`: `savePhoto({ blob, thumbBlob, width, height }): Promise<string>`, `getPhoto(id)`, `deletePhoto(id)`
  - `settings.ts`: `getSettings(): Promise<Settings>`, `updateSettings(patch): Promise<void>`
  - `foodItems.ts`: `listFoodItems(): Promise<FoodItem[]>` (seeded order, then custom A–Z), `addFoodItem(name): Promise<FoodItem>`

- [ ] **Step 1: Write failing tests `src/db/repos.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from './db';
import { archivePet, createPet, deletePet, getPet, listActivePets, updatePet } from './pets';
import {
  deleteFeeding, listFeedings, listRegurgitations, logFeeding, logRegurgitation,
} from './feedings';
import { getSettings, updateSettings } from './settings';
import { addFoodItem, listFoodItems } from './foodItems';
import { ValidationError } from './ids';
import { pushBackOverride } from '../domain/feeding';

const at = (d: number, h = 18, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const noodle = () => createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });

beforeEach(async () => {
  await resetDb();
});

describe('seed data', () => {
  it('seeds food items in a sensible order and default settings', async () => {
    const foods = await listFoodItems();
    expect(foods).toHaveLength(11);
    expect(foods[0]!.name).toBe('Pinky mouse');
    expect((await getSettings()).theme).toBe('auto');
  });
});

describe('pets', () => {
  it('creates a pet with defaults', async () => {
    const p = await noodle();
    expect(p).toMatchObject({
      name: 'Noodle', sex: 'unknown', origin: 'unknown', usualQuantity: 1,
      usualFeedTime: '18:00', birthDateApprox: false, habitatTargets: {},
    });
    expect(await getPet(p.id)).toEqual(p);
  });

  it('rejects a blank name and a zero interval', async () => {
    await expect(createPet({ name: ' ', species: 'Gecko', feedingIntervalDays: 3 })).rejects.toBeInstanceOf(ValidationError);
    await expect(createPet({ name: 'Ziggy', species: 'Gecko', feedingIntervalDays: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates fields and clears optional ones', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, morph: 'Amel' });
    await updatePet(p.id, { morph: undefined, feedingIntervalDays: 7 });
    const after = (await getPet(p.id))!;
    expect(after.morph).toBeUndefined();
    expect(after.feedingIntervalDays).toBe(7);
  });

  it('lists active pets A–Z and hides archived ones', async () => {
    await createPet({ name: 'Ziggy', species: 'Leopard Gecko', feedingIntervalDays: 3 });
    const basil = await createPet({ name: 'Basil', species: 'Bearded Dragon', feedingIntervalDays: 2 });
    const pebble = await createPet({ name: 'Pebble', species: 'Russian Tortoise', feedingIntervalDays: 2 });
    await archivePet(pebble.id);
    expect((await listActivePets()).map((p) => p.name)).toEqual(['Basil', 'Ziggy']);
    expect(basil.id).toBeTruthy();
  });

  it('deleting a pet deletes its feedings and regurgitations', async () => {
    const p = await noodle();
    await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(4, 7, 30), pushBackDays: 10 },
    });
    await deletePet(p.id);
    expect(await db.feedings.count()).toBe(0);
    expect(await db.regurgitations.count()).toBe(0);
    expect(await getPet(p.id)).toBeUndefined();
  });
});

describe('feedings', () => {
  it('lists feedings oldest first', async () => {
    const p = await noodle();
    await logFeeding({ petId: p.id, at: at(8), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    await logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    expect((await listFeedings(p.id)).map((f) => f.at)).toEqual([at(3), at(8)]);
  });

  it('an eaten meal clears a push-back override; a refusal keeps it', async () => {
    const p = await noodle();
    await updatePet(p.id, { nextFeedingOverride: at(20) });
    await logFeeding({ petId: p.id, at: at(9), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
    expect((await getPet(p.id))!.nextFeedingOverride).toBe(at(20));
    await logFeeding({ petId: p.id, at: at(10), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    expect((await getPet(p.id))!.nextFeedingOverride).toBeUndefined();
  });

  it('Regurgitated creates both records and pushes the next feeding back', async () => {
    const p = await noodle();
    const meal = await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(4, 7, 30), pushBackDays: 10, notes: 'check heat mat' },
    });
    const [r] = await listRegurgitations(p.id);
    expect(r).toMatchObject({ feedingId: meal.id, at: at(4, 7, 30), pushBackDays: 10, notes: 'check heat mat' });
    expect((await getPet(p.id))!.nextFeedingOverride).toBe(pushBackOverride(new Date(at(4, 7, 30)), p, 10));
  });

  it('Regurgitated with push-back off sets no override', async () => {
    const p = await noodle();
    await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(3, 20), pushBackDays: null },
    });
    expect((await getPet(p.id))!.nextFeedingOverride).toBeUndefined();
    expect(await db.regurgitations.count()).toBe(1);
  });

  it('rejects bad input and saves nothing', async () => {
    const p = await noodle();
    await expect(
      logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 0, outcome: 'ate' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logFeeding({
        petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused',
        regurgitated: { foundAt: at(3), pushBackDays: 10 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      logFeeding({
        petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
        regurgitated: { foundAt: at(3), pushBackDays: 0 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await db.feedings.count()).toBe(0);
  });

  it('logRegurgitation links to an earlier meal and rejects a refusal', async () => {
    const p = await noodle();
    const meal = await logFeeding({ petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
    const refused = await logFeeding({ petId: p.id, at: at(5), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
    await logRegurgitation({ petId: p.id, feedingId: meal.id, at: at(4, 7, 30), pushBackDays: 10 });
    expect((await getPet(p.id))!.nextFeedingOverride).toBe(pushBackOverride(new Date(at(4, 7, 30)), p, 10));
    await expect(
      logRegurgitation({ petId: p.id, feedingId: refused.id, at: at(5, 20), pushBackDays: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('deleting a feeding deletes its regurgitation', async () => {
    const p = await noodle();
    const meal = await logFeeding({
      petId: p.id, at: at(3), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate',
      regurgitated: { foundAt: at(4), pushBackDays: null },
    });
    await deleteFeeding(meal.id);
    expect(await db.feedings.count()).toBe(0);
    expect(await db.regurgitations.count()).toBe(0);
  });
});

describe('settings and food items', () => {
  it('merges settings updates', async () => {
    await updateSettings({ theme: 'dark' });
    expect(await getSettings()).toMatchObject({ theme: 'dark', tempUnit: 'F', weightUnit: 'g' });
  });
  it('adds a custom food once, case-insensitively, after the seeded ones', async () => {
    const a = await addFoodItem('Black soldier fly larvae');
    const b = await addFoodItem('black soldier fly larvae');
    expect(b.id).toBe(a.id);
    const foods = await listFoodItems();
    expect(foods.at(-1)!.name).toBe('Black soldier fly larvae');
    await expect(addFoodItem('  ')).rejects.toBeInstanceOf(ValidationError);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/db`
Expected: FAIL. `Failed to resolve import "./db"`.

- [ ] **Step 3: Create `src/db/ids.ts`**

```ts
export const newId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

/** Bad user input. Screens show `message` next to the form. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

- [ ] **Step 4: Create `src/db/db.ts`.** This is schema version 1. Plan 2 adds tables in `version(2)`.

```ts
import Dexie, { type EntityTable } from 'dexie';
import type { Feeding, FoodItem, Pet, Photo, Regurgitation, Settings } from '../domain/types';
import { newId, nowIso } from './ids';

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

- [ ] **Step 5: Create `src/db/pets.ts`**

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

export async function listActivePets(): Promise<Pet[]> {
  const all = await db.pets.toArray();
  return all.filter((p) => !p.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
}

export async function archivePet(id: string): Promise<void> {
  const ts = nowIso();
  await db.pets.update(id, { archivedAt: ts, updatedAt: ts });
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

- [ ] **Step 6: Create `src/db/feedings.ts`**

```ts
import Dexie from 'dexie';
import { parseISO } from 'date-fns';
import type { Feeding, FeedingOutcome, Pet, Regurgitation } from '../domain/types';
import { pushBackOverride } from '../domain/feeding';
import { db } from './db';
import { newId, nowIso, ValidationError } from './ids';

export interface LogFeedingInput {
  petId: string;
  at: string;
  foodItem: string;
  quantity: number;
  outcome: FeedingOutcome;
  notes?: string;
  /** Set when the Log a Feeding sheet's "Regurgitated" button was chosen (spec §5.3). */
  regurgitated?: { foundAt: string; pushBackDays: number | null; notes?: string };
}

export interface LogRegurgitationInput {
  petId: string;
  feedingId: string;
  at: string;
  pushBackDays: number | null;
  notes?: string;
}

const clean = (s?: string) => s?.trim() || undefined;

function validateQuantity(q: number): void {
  if (!Number.isInteger(q) || q < 1) throw new ValidationError('Quantity must be at least 1');
}

async function addRegurgitation(
  pet: Pet,
  r: { feedingId: string; at: string; pushBackDays: number | null; notes?: string },
): Promise<Regurgitation> {
  if (r.pushBackDays !== null && !(Number.isInteger(r.pushBackDays) && r.pushBackDays >= 1)) {
    throw new ValidationError('Push back must be at least 1 day');
  }
  const ts = nowIso();
  const rec: Regurgitation = {
    id: newId(), petId: pet.id, feedingId: r.feedingId, at: r.at,
    pushBackDays: r.pushBackDays ?? undefined, notes: clean(r.notes), createdAt: ts, updatedAt: ts,
  };
  await db.regurgitations.add(rec);
  if (r.pushBackDays !== null) {
    await db.pets.update(pet.id, {
      nextFeedingOverride: pushBackOverride(parseISO(r.at), pet, r.pushBackDays),
      updatedAt: ts,
    });
  }
  return rec;
}

export async function logFeeding(input: LogFeedingInput): Promise<Feeding> {
  if (!input.foodItem.trim()) throw new ValidationError('Pick what it ate');
  validateQuantity(input.quantity);
  if (input.regurgitated && input.outcome !== 'ate') {
    throw new ValidationError('Only a meal it ate can be regurgitated');
  }
  return db.transaction('rw', [db.pets, db.feedings, db.regurgitations], async () => {
    const pet = await db.pets.get(input.petId);
    if (!pet) throw new Error(`Pet ${input.petId} not found`);
    const ts = nowIso();
    const feeding: Feeding = {
      id: newId(), petId: pet.id, at: input.at, foodItem: input.foodItem.trim(),
      quantity: input.quantity, outcome: input.outcome, notes: clean(input.notes),
      createdAt: ts, updatedAt: ts,
    };
    await db.feedings.add(feeding);
    if (input.outcome === 'ate') {
      await db.pets.update(pet.id, { nextFeedingOverride: undefined, updatedAt: ts }); // spec §7 rule 4
    }
    if (input.regurgitated) {
      await addRegurgitation(pet, {
        feedingId: feeding.id,
        at: input.regurgitated.foundAt,
        pushBackDays: input.regurgitated.pushBackDays,
        notes: input.regurgitated.notes,
      });
    }
    return feeding;
  });
}

export async function logRegurgitation(input: LogRegurgitationInput): Promise<Regurgitation> {
  return db.transaction('rw', [db.pets, db.feedings, db.regurgitations], async () => {
    const pet = await db.pets.get(input.petId);
    if (!pet) throw new Error(`Pet ${input.petId} not found`);
    const meal = await db.feedings.get(input.feedingId);
    if (!meal || meal.petId !== pet.id || meal.outcome !== 'ate') {
      throw new ValidationError('Pick the meal that came back up');
    }
    return addRegurgitation(pet, input);
  });
}

export async function updateFeeding(
  id: string,
  patch: Partial<Pick<Feeding, 'at' | 'foodItem' | 'quantity' | 'outcome' | 'notes'>>,
): Promise<void> {
  if (patch.quantity !== undefined) validateQuantity(patch.quantity);
  if (patch.foodItem !== undefined && !patch.foodItem.trim()) throw new ValidationError('Pick what it ate');
  const next: Partial<Feeding> = { ...patch, updatedAt: nowIso() };
  if ('notes' in patch) next.notes = clean(patch.notes); // an empty note removes it
  await db.feedings.update(id, next);
}

export async function deleteFeeding(id: string): Promise<void> {
  await db.transaction('rw', [db.feedings, db.regurgitations], async () => {
    await db.regurgitations.where('feedingId').equals(id).delete();
    await db.feedings.delete(id);
  });
}

export const listFeedings = (petId: string): Promise<Feeding[]> =>
  db.feedings.where('[petId+at]').between([petId, Dexie.minKey], [petId, Dexie.maxKey]).toArray();

export const listRegurgitations = (petId: string): Promise<Regurgitation[]> =>
  db.regurgitations.where('petId').equals(petId).toArray();
```

- [ ] **Step 7: Create `src/db/photos.ts`.** Blobs can't round-trip through fake-indexeddb in jsdom, so this is checked by hand in Task 8.

```ts
import { db } from './db';
import { newId, nowIso } from './ids';

export async function savePhoto(p: { blob: Blob; thumbBlob: Blob; width: number; height: number }): Promise<string> {
  const ts = nowIso();
  const id = newId();
  await db.photos.add({ id, ...p, createdAt: ts, updatedAt: ts });
  return id;
}

export const getPhoto = (id: string) => db.photos.get(id);
export const deletePhoto = (id: string) => db.photos.delete(id);
```

- [ ] **Step 8: Create `src/db/settings.ts`**

```ts
import type { Settings } from '../domain/types';
import { db, DEFAULT_SETTINGS } from './db';

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}
```

- [ ] **Step 9: Create `src/db/foodItems.ts`**

```ts
import type { FoodItem } from '../domain/types';
import { db, DEFAULT_FOOD_ITEMS } from './db';
import { newId, nowIso, ValidationError } from './ids';

const rank = (f: FoodItem) => (f.isCustom ? DEFAULT_FOOD_ITEMS.length : DEFAULT_FOOD_ITEMS.indexOf(f.name));

export async function listFoodItems(): Promise<FoodItem[]> {
  const all = await db.foodItems.toArray();
  return all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export async function addFoodItem(name: string): Promise<FoodItem> {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError('Enter a food name');
  const existing = await db.foodItems.where('name').equalsIgnoreCase(trimmed).first();
  if (existing) return existing;
  const ts = nowIso();
  const item: FoodItem = { id: newId(), name: trimmed, isCustom: true, createdAt: ts, updatedAt: ts };
  await db.foodItems.add(item);
  return item;
}
```

- [ ] **Step 10: Run the tests and confirm they pass**

Run: `npm test -- src/db` → Expected: all pass.
Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.
If `db.pets.update(...)` gives a type error on the spread `patch`, cast the second argument as `Partial<Pet>`. Dexie's `UpdateSpec` type is stricter than `Partial`.

- [ ] **Step 11: Commit**

```bash
git add src/db
git commit -m "feat: add Dexie database and repositories for pets, feedings, settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Theme: tokens, light/dark/auto, ThemeSync

**Files:**
- Create: `src/theme/tokens.css`, `src/theme/base.css`, `src/theme/theme.ts`, `src/theme/ThemeSync.tsx`
- Modify: `src/main.tsx` (import the CSS)
- Test: `src/theme/theme.test.tsx`

**Interfaces:**
- Consumes: `ThemePref` (Task 2), `getSettings`, `updateSettings`, `resetDb` (Task 4)
- Produces:
  - `THEME_STORAGE_KEY = 'reptender-theme'` (must match the inline script in `index.html`)
  - `resolveTheme(pref, systemDark): 'light' | 'dark'`
  - `applyTheme(pref, systemDark, root?): 'light' | 'dark'`. Sets `<html data-theme>` and mirrors `pref` to localStorage.
  - `<ThemeSync />` renders nothing and keeps the theme in sync with settings and the system.
  - CSS variables used by every screen: `--bg --card --text --muted --line --chip --moss --on-moss --amber --amber-deep --ok-bg --ok-text --due-bg --due-text --late-bg --late-text --future --tab-bg --tab-line --shadow --hero --banner`

- [ ] **Step 1: Write failing tests `src/theme/theme.test.tsx`**

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { applyTheme, resolveTheme, THEME_STORAGE_KEY } from './theme';
import ThemeSync from './ThemeSync';
import { resetDb } from '../db/db';
import { updateSettings } from '../db/settings';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

describe('resolveTheme', () => {
  it('follows the system only for auto', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and remembers the preference', () => {
    expect(applyTheme('dark', false)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});

describe('ThemeSync', () => {
  it('applies the saved setting', async () => {
    await updateSettings({ theme: 'dark' });
    render(<ThemeSync />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/theme`
Expected: FAIL. `Failed to resolve import "./theme"`.

- [ ] **Step 3: Implement `src/theme/theme.ts`**

```ts
import type { ThemePref } from '../domain/types';

export const THEME_STORAGE_KEY = 'reptender-theme';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'auto') return systemDark ? 'dark' : 'light';
  return pref;
}

export function applyTheme(
  pref: ThemePref,
  systemDark: boolean,
  root: HTMLElement = document.documentElement,
): ResolvedTheme {
  const theme = resolveTheme(pref, systemDark);
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref); // read by the pre-paint script in index.html
  } catch {
    // storage can be unavailable (private mode); the theme still applies for this session
  }
  return theme;
}
```

- [ ] **Step 4: Implement `src/theme/ThemeSync.tsx`**

```tsx
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../db/settings';
import { applyTheme } from './theme';

export default function ThemeSync() {
  const pref = useLiveQuery(async () => (await getSettings()).theme, []);
  useEffect(() => {
    if (!pref) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(pref, mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [pref]);
  return null;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test -- src/theme` → Expected: all pass.

- [ ] **Step 6: Create `src/theme/tokens.css`** (colors from spec §4 and the approved mockups)

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
  --late-text: #b23a2b;
  --future: #b3a891;
  --tab-bg: #fffdf8;
  --tab-line: #ebe2d1;
  --shadow: 0 1px 3px rgba(80, 60, 20, 0.08);
  --hero: radial-gradient(circle at 70% 35%, #f2b66b, #c9773c 70%);
  --banner: linear-gradient(135deg, #e9a04b, #d9783a);
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
  --banner: linear-gradient(135deg, #b9772f, #94501f);
}
```

- [ ] **Step 7: Create `src/theme/base.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.35 -apple-system, 'SF Pro Text', system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
}

h1,
h2,
.rounded {
  font-family: ui-rounded, 'SF Pro Rounded', system-ui, sans-serif;
  font-weight: 800;
}

h1 {
  font-size: 28px;
  line-height: 1.1;
  margin: 8px 0 2px;
}

.muted {
  color: var(--muted);
}

.label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: var(--muted);
  margin: 16px 0 6px;
}
```

- [ ] **Step 8: Import the CSS in `src/main.tsx`.** Add these two lines at the top, above the other imports:

```tsx
import './theme/tokens.css';
import './theme/base.css';
```

- [ ] **Step 9: Run everything**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/theme src/main.tsx
git commit -m "feat: add Terrarium light/dark theme and ThemeSync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Shared UI components and the month calendar

**Files:**
- Create: `src/ui/Card.tsx`, `src/ui/Pill.tsx`, `src/ui/Sheet.tsx`, `src/ui/Stepper.tsx`, `src/ui/Segmented.tsx`, `src/ui/PetAvatar.tsx`, `src/ui/usePhotoUrl.ts`, `src/ui/MonthCalendar.tsx`, `src/ui/ui.css`
- Modify: `src/main.tsx` (import `ui.css`)
- Test: `src/ui/ui.test.tsx`

**Interfaces:**
- Consumes: `monthCells`, `DayMark` (Task 3), `dateKey` (Task 2), `getPhoto` (Task 4)
- Produces:
  - `Card(props: HTMLAttributes<HTMLDivElement>)`
  - `Pill({ tone?: 'ok' | 'due' | 'late' | 'neutral', children })`, `type PillTone`
  - `Sheet({ open, onClose, title, children })`. Renders `role="dialog"` with `aria-label={title}`. Escape or a backdrop tap closes it.
  - `Stepper({ label, value, min?, max?, onChange })`. Buttons are labelled `Decrease {label}` and `Increase {label}`.
  - `Segmented<T extends string>({ label, options: { value: T; label: string }[], value, onChange })`. `role="radiogroup"` with `role="radio"` buttons.
  - `speciesEmoji(species: string): string`, `PetAvatar({ photoId?, species, size?, round? })`
  - `usePhotoUrl(photoId?, variant?: 'thumb' | 'full'): string | undefined`
  - `MonthCalendar({ year, month, marks, size?: 'compact' | 'large', onPrev, onNext, onSelectDay?, selectedKey?, dayIcon? })`, `CalendarLegend()`
  - CSS classes for later tasks: `.screen .card .pill .btn .btn-primary .btn-ghost .field .chips .chip .banner .tabbar .shell`

- [ ] **Step 1: Write failing tests `src/ui/ui.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DayMark } from '../domain/calendar';
import { Pill } from './Pill';
import { Stepper } from './Stepper';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { speciesEmoji } from './PetAvatar';
import { MonthCalendar } from './MonthCalendar';

describe('Pill', () => {
  it('renders its tone as a class', () => {
    render(<Pill tone="late">1 day late</Pill>);
    expect(screen.getByText('1 day late')).toHaveClass('pill', 'pill-late');
  });
});

describe('Stepper', () => {
  it('steps up and down and stops at the minimum', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper label="quantity" value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
    rerender(<Stepper label="quantity" value={1} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });
});

describe('Segmented', () => {
  it('marks the current option and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Outcome"
        value="ate"
        onChange={onChange}
        options={[{ value: 'ate', label: 'Ate it' }, { value: 'refused', label: 'Refused' }]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Ate it' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Refused' }));
    expect(onChange).toHaveBeenCalledWith('refused');
  });
});

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Feed Noodle">x</Sheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Feed Noodle">body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Feed Noodle' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('speciesEmoji', () => {
  it('maps common species', () => {
    expect(speciesEmoji('Corn Snake')).toBe('🐍');
    expect(speciesEmoji('Ball Python')).toBe('🐍');
    expect(speciesEmoji('Russian Tortoise')).toBe('🐢');
    expect(speciesEmoji('Bearded Dragon')).toBe('🐉');
    expect(speciesEmoji('Leopard Gecko')).toBe('🦎');
  });
});

describe('MonthCalendar', () => {
  const marks = new Map<string, Set<DayMark>>([
    ['2026-11-03', new Set<DayMark>(['ate'])],
    ['2026-11-08', new Set<DayMark>(['nextDue', 'today'])],
  ]);

  it('shows every day with an accessible label and mark classes', () => {
    render(<MonthCalendar year={2026} month={10} marks={marks} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    const ate = screen.getByRole('button', { name: 'November 3: ate' });
    expect(ate).toHaveClass('is-ate');
    expect(screen.getByRole('button', { name: 'November 8: next feeding due, today' })).toHaveClass('is-nextDue', 'is-today');
    expect(screen.getAllByRole('button', { name: /^November \d+/ })).toHaveLength(30);
  });

  it('changes month and selects days', async () => {
    const onPrev = vi.fn();
    const onSelectDay = vi.fn();
    render(
      <MonthCalendar year={2026} month={10} marks={marks} onPrev={onPrev} onNext={() => {}} onSelectDay={onSelectDay} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onPrev).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'November 3: ate' }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-11-03');
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/ui`
Expected: FAIL. `Failed to resolve import "./Pill"`.

- [ ] **Step 3: Create the small components**

`src/ui/Card.tsx`
```tsx
import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...rest} />;
}
```

`src/ui/Pill.tsx`
```tsx
import type { ReactNode } from 'react';

export type PillTone = 'ok' | 'due' | 'late' | 'neutral';

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
```

`src/ui/Sheet.tsx`
```tsx
import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
```

`src/ui/Stepper.tsx`
```tsx
interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min = 1, max = 999, onChange }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
```

`src/ui/Segmented.tsx`
```tsx
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

`src/ui/usePhotoUrl.ts`
```ts
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
```

`src/ui/PetAvatar.tsx`
```tsx
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
```

- [ ] **Step 4: Create `src/ui/MonthCalendar.tsx`.** Fill precedence: regurgitated > ate > refused > next due.

```tsx
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test -- src/ui` → Expected: all pass.

- [ ] **Step 6: Create `src/ui/ui.css`**

```css
/* ---------- layout ---------- */
.shell {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100dvh;
  position: relative;
  background: var(--bg);
}
.screen {
  padding: calc(env(safe-area-inset-top) + 8px) 16px calc(env(safe-area-inset-bottom) + 84px);
}
.tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  display: flex;
  justify-content: space-around;
  padding: 8px 0 calc(env(safe-area-inset-bottom) + 8px);
  background: var(--tab-bg);
  border-top: 1px solid var(--tab-line);
  z-index: 10;
}
.tabbar a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: var(--moss);
  text-decoration: none;
  opacity: 0.55;
}
.tabbar a.active {
  opacity: 1;
}
.tabbar a span {
  font-size: 20px;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 36px;
}
.topbar a,
.topbar button {
  color: var(--moss);
  font-weight: 600;
  text-decoration: none;
  background: none;
  border: 0;
  padding: 6px 0;
}

/* ---------- cards & pills ---------- */
.card {
  background: var(--card);
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: var(--shadow);
}
.pill {
  font-weight: 700;
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 99px;
  white-space: nowrap;
}
.pill-ok { background: var(--ok-bg); color: var(--ok-text); }
.pill-due { background: var(--due-bg); color: var(--due-text); }
.pill-late { background: var(--late-bg); color: var(--late-text); }
.pill-neutral { background: var(--chip); color: var(--muted); }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.grow {
  flex: 1;
  min-width: 0;
}
.bar {
  height: 5px;
  background: var(--chip);
  border-radius: 5px;
  margin-top: 6px;
  overflow: hidden;
}
.bar > i {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: var(--moss);
}
.bar.due > i { background: var(--amber); }
.bar.late > i { background: var(--late-text); }
.banner {
  background: var(--banner);
  color: #fff;
  border-radius: 18px;
  padding: 14px;
  margin: 12px 0;
}
.banner .btn {
  background: #fff;
  color: #b8601f;
}

/* ---------- buttons & forms ---------- */
.btn {
  border: 0;
  border-radius: 99px;
  padding: 8px 14px;
  font-weight: 800;
  background: var(--chip);
}
.btn-primary {
  display: block;
  width: 100%;
  border-radius: 14px;
  padding: 14px;
  background: var(--moss);
  color: var(--on-moss);
  font-size: 16px;
}
.btn-primary:disabled { opacity: 0.5; }
.btn-ghost {
  display: block;
  width: 100%;
  border-radius: 12px;
  padding: 11px;
  background: var(--card);
  color: var(--moss);
  border: 1.5px solid var(--line);
  font-weight: 800;
}
.btn-danger { color: var(--late-text); }
.field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  box-shadow: var(--shadow);
}
.field input,
.field select,
.field textarea {
  border: 0;
  background: transparent;
  text-align: right;
  min-width: 0;
  flex: 1;
  outline: none;
}
.field textarea { text-align: left; resize: vertical; }
.field.stack { flex-direction: column; align-items: stretch; }
.form-error {
  color: var(--late-text);
  font-weight: 600;
  margin: 8px 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  border: 1.5px solid var(--line);
  background: var(--card);
  border-radius: 99px;
  padding: 7px 12px;
  font-weight: 600;
  font-size: 14px;
}
.chip.on {
  background: var(--moss);
  border-color: var(--moss);
  color: var(--on-moss);
}
.segmented {
  display: flex;
  background: var(--chip);
  border-radius: 99px;
  padding: 3px;
}
.segmented button {
  flex: 1;
  border: 0;
  background: transparent;
  border-radius: 99px;
  padding: 8px 4px;
  font-weight: 700;
  font-size: 13px;
  color: var(--muted);
}
.segmented button.on {
  background: var(--card);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.stepper {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stepper button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: var(--chip);
  font-size: 18px;
  font-weight: 700;
}
.stepper output {
  min-width: 24px;
  text-align: center;
  font-weight: 800;
  font-size: 18px;
}
.switch {
  width: 46px;
  height: 28px;
  appearance: none;
  border-radius: 99px;
  background: var(--chip);
  position: relative;
  transition: background 0.15s;
  flex-shrink: 0;
}
.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.15s;
}
.switch:checked { background: var(--moss); }
.switch:checked::after { left: 21px; }

/* ---------- sheet ---------- */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 50;
}
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 92dvh;
  overflow-y: auto;
  background: var(--bg);
  border-radius: 20px 20px 0 0;
  padding: 8px 16px calc(env(safe-area-inset-bottom) + 16px);
}
.sheet-grab {
  width: 38px;
  height: 5px;
  border-radius: 5px;
  background: var(--line);
  margin: 4px auto 12px;
}

/* ---------- avatar ---------- */
.pet-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--due-bg);
}
.pet-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------- calendar ---------- */
.cal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.cal-head b {
  font-family: ui-rounded, system-ui;
  font-weight: 800;
}
.cal-head button {
  border: 0;
  background: none;
  color: var(--moss);
  font-size: 20px;
  font-weight: 800;
  padding: 0 10px;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}
.cal-dow {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
.cal-day {
  position: relative;
  margin: 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.cal-day:disabled { cursor: default; }
.cal-large .cal-day {
  width: 100%;
  height: 46px;
  border-radius: 10px;
  background: var(--card);
}
.cal-day small { font-size: 12px; line-height: 1; }
.cal-day.is-ate { background: var(--moss); color: var(--on-moss); }
.cal-day.is-refused { background: var(--late-bg); color: var(--late-text); }
.cal-day.is-regurgitated { background: var(--late-text); color: #fff; }
.cal-day.is-nextDue { background: var(--amber); color: #fff; box-shadow: 0 0 0 3px rgba(233, 160, 75, 0.35); }
.cal-day.is-planned { border: 1.5px dashed var(--amber); color: var(--amber-deep); }
.cal-day.is-today { box-shadow: inset 0 0 0 2px var(--text); }
.cal-day.is-nextDue.is-today { box-shadow: inset 0 0 0 2px var(--text), 0 0 0 3px rgba(233, 160, 75, 0.4); }
.cal-day.is-selected { outline: 2px solid var(--text); outline-offset: 1px; }
.cal-x {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--late-text);
  color: #fff;
  font-size: 8px;
  line-height: 13px;
}
.cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 10px;
  font-size: 11px;
  color: var(--muted);
}
.cal-legend span { display: inline-flex; align-items: center; gap: 4px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.is-ate { background: var(--moss); }
.dot.is-refused { background: var(--late-bg); border: 1px solid var(--late-text); }
.dot.is-regurgitated { background: var(--late-text); }
.dot.is-nextDue { background: var(--amber); }
.dot.is-planned { border: 1.5px dashed var(--amber); }
```

- [ ] **Step 7: Import `ui.css` in `src/main.tsx`** (below the theme imports):

```tsx
import './ui/ui.css';
```

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/ui src/main.tsx
git commit -m "feat: add shared UI components and month calendar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App shell, routing and the Pets home screen

**Files:**
- Create: `src/app/AppShell.tsx`, `src/app/TabBar.tsx`, `src/ui/useNow.ts`, `src/features/pets/usePetSummaries.ts`, `src/features/pets/PetsHome.tsx`, `src/test/render.tsx`
- Modify: `src/app/App.tsx` (replace), `src/app/App.test.tsx` (replace)
- Test: `src/features/pets/usePetSummaries.test.ts`, `src/features/pets/PetsHome.test.tsx`

**Interfaces:**
- Consumes: `listActivePets`, `listFeedings`, `logFeeding`, `createPet`, `resetDb` (Task 4), the feeding rules (Task 2), `Card`, `Pill`, `PetAvatar` (Task 6), `ThemeSync` (Task 5)
- Produces:
  - `AppRoutes()`, the `<Routes>` tree. Later tasks add `<Route>`s inside the `AppShell` route. `App` = `HashRouter` + `ThemeSync` + `AppRoutes`.
  - `TABS: { to: string; label: string; icon: string; end?: boolean }[]` in `TabBar.tsx`. Task 12 adds Settings.
  - `useNow(fixed?: Date): Date` re-reads the clock every minute and when the app comes back to the foreground.
  - `PetSummary = { pet; meal?: Feeding; due: Date | null; status: DueStatus; label: string; progress: number }`
  - `summarize(pet, feedings, now): PetSummary`, `sortSummaries(list): PetSummary[]`, `usePetSummaries(now): PetSummary[] | undefined`
  - `PetsHome({ now?: Date })`. `now` is for tests.
  - `renderAt(path: string)` test helper. It renders `AppRoutes` in a `MemoryRouter`.
- Deferred to Plan 2: "Show archived" on Home (spec §5.1) and the Schedule and Add tabs.

- [ ] **Step 1: Write failing tests `src/features/pets/usePetSummaries.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Feeding, Pet } from '../../domain/types';
import { sortSummaries, summarize } from './usePetSummaries';

const now = new Date(2026, 10, 8, 9, 0);
const pet = (name: string, feedingIntervalDays: number): Pet => ({
  id: name, name, species: 'Corn Snake', sex: 'unknown', origin: 'unknown', birthDateApprox: false,
  feedingIntervalDays, usualQuantity: 1, usualFeedTime: '18:00', habitatTargets: {},
  createdAt: '', updatedAt: '',
});
const ate = (petId: string, day: number): Feeding => ({
  id: `${petId}-${day}`, petId, at: new Date(2026, 10, day, 18, 0).toISOString(),
  foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', createdAt: '', updatedAt: '',
});

describe('summarize', () => {
  it('computes due date, status, label and progress', () => {
    const s = summarize(pet('Noodle', 5), [ate('Noodle', 3)], now);
    expect(s.status).toBe('today');
    expect(s.label).toBe('Today');
    expect(s.due!.getDate()).toBe(8);
    expect(s.progress).toBeGreaterThan(0.85);
  });
});

describe('sortSummaries', () => {
  it('puts late first, then today, then soonest', () => {
    const list = [
      summarize(pet('Ziggy', 3), [ate('Ziggy', 7)], now), // due Nov 10
      summarize(pet('Noodle', 5), [ate('Noodle', 3)], now), // due today
      summarize(pet('Basil', 2), [ate('Basil', 5)], now), // due Nov 7: late
      summarize(pet('Pebble', 2), [ate('Pebble', 7)], now), // due Nov 9
    ];
    expect(sortSummaries(list).map((s) => s.pet.name)).toEqual(['Basil', 'Noodle', 'Pebble', 'Ziggy']);
  });
});
```

- [ ] **Step 2: Write failing tests `src/features/pets/PetsHome.test.tsx`**

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PetsHome from './PetsHome';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
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
});
```

- [ ] **Step 3: Replace `src/app/App.test.tsx`**

```tsx
import { beforeEach, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `npm test -- src/features src/app`
Expected: FAIL. Imports such as `./usePetSummaries` and `../test/render` don't resolve.

- [ ] **Step 5: Create `src/ui/useNow.ts`**

```ts
import { useEffect, useState } from 'react';

/** Current time, refreshed every minute and whenever the app returns to the foreground. */
export function useNow(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed) return;
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fixed]);
  return now;
}
```

- [ ] **Step 6: Create `src/features/pets/usePetSummaries.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import type { Feeding, Pet } from '../../domain/types';
import {
  dueStatus, intervalProgress, lastMeal, nextFeedingDue, statusLabel, type DueStatus,
} from '../../domain/feeding';
import { listActivePets } from '../../db/pets';
import { listFeedings } from '../../db/feedings';

export interface PetSummary {
  pet: Pet;
  meal?: Feeding;
  due: Date | null;
  status: DueStatus;
  label: string;
  progress: number;
}

export function summarize(pet: Pet, feedings: Feeding[], now: Date): PetSummary {
  const meal = lastMeal(feedings);
  const due = nextFeedingDue(pet, feedings);
  return {
    pet,
    meal,
    due,
    status: dueStatus(due, now),
    label: statusLabel(due, now),
    progress: intervalProgress(meal, due, now),
  };
}

const RANK: Record<DueStatus, number> = { late: 0, today: 1, soon: 2 };

export function sortSummaries(list: PetSummary[]): PetSummary[] {
  return [...list].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0) ||
      a.pet.name.localeCompare(b.pet.name),
  );
}

export function usePetSummaries(now: Date): PetSummary[] | undefined {
  return useLiveQuery(async () => {
    const pets = await listActivePets();
    const all = await Promise.all(pets.map(async (p) => summarize(p, await listFeedings(p.id), now)));
    return sortSummaries(all);
  }, [now.getTime()]);
}
```

- [ ] **Step 7: Create `src/features/pets/PetsHome.tsx`.** The banner's **Log** button is added in Task 9.

```tsx
import { Link } from 'react-router-dom';
import { Card } from '../../ui/Card';
import { Pill, type PillTone } from '../../ui/Pill';
import { PetAvatar } from '../../ui/PetAvatar';
import { useNow } from '../../ui/useNow';
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
  if (!summaries) return null;

  const today = summaries.filter((s) => s.status === 'today').length;
  const late = summaries.filter((s) => s.status === 'late').length;
  const subtitle = [
    plural(summaries.length, 'pet'),
    today ? `${today} due today` : '',
    late ? `${late} late` : '',
  ].filter(Boolean).join(' · ');
  const urgent = summaries.find((s) => s.status !== 'soon');

  return (
    <>
      <h1>My Reptiles</h1>
      <div className="muted">{subtitle}</div>

      {urgent && (
        <div className="banner">
          <div className="row">
            <div className="grow">
              <div className="rounded" style={{ fontSize: 17 }}>{`${urgent.pet.name} is hungry`}</div>
              <div style={{ opacity: 0.9 }}>{bannerLine(urgent)}</div>
            </div>
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
    </>
  );
}
```

- [ ] **Step 8: Create `src/app/TabBar.tsx` and `src/app/AppShell.tsx`**

`src/app/TabBar.tsx`
```tsx
import { NavLink } from 'react-router-dom';

export const TABS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'Pets', icon: '🦎', end: true },
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

`src/app/AppShell.tsx`
```tsx
import { Outlet } from 'react-router-dom';
import { TabBar } from './TabBar';

export default function AppShell() {
  return (
    <div className="shell">
      <main className="screen">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 9: Replace `src/app/App.tsx`**

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';
import ThemeSync from '../theme/ThemeSync';
import PetsHome from '../features/pets/PetsHome';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<PetsHome />} />
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

- [ ] **Step 10: Create `src/test/render.tsx`**

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../app/App';

/** Render the real route tree at `path`. */
export function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}
```

- [ ] **Step 11: Run the tests and confirm they pass**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 12: Look at it in the browser**

Run `npm run dev` and open `http://localhost:5173/RepTender/`.
Expected: "My Reptiles" with the empty-state card on the sand background, and a bottom tab bar with "Pets". Stop the server.

- [ ] **Step 13: Commit**

```bash
git add src
git commit -m "feat: add app shell, routing and Pets home screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pet profile page with the feeding calendar

**Files:**
- Create: `src/features/pets/usePetDetail.ts`, `src/features/pets/format.ts`, `src/features/pets/PetProfile.tsx`, `src/features/pets/profile.css`
- Modify: `src/app/App.tsx` (add the route)
- Test: `src/features/pets/format.test.ts`, `src/features/pets/PetProfile.test.tsx`

**Interfaces:**
- Consumes: `getPet` (Task 4), `listFeedings`, `listRegurgitations` (Task 4), `nextFeedingDue`, `dueStatus`, `statusLabel` (Task 2), `buildMonthMarks` (Task 3), `formatAge` (Task 3), `MonthCalendar`, `CalendarLegend`, `Card`, `Pill`, `usePhotoUrl`, `speciesEmoji` (Task 6), `useNow` (Task 7), `TONE` (exported from `PetsHome.tsx`, Task 7)
- Produces:
  - `usePetDetail(id): { pet: Pet | null; feedings: Feeding[]; regurgitations: Regurgitation[] } | undefined`. `pet: null` means not found.
  - `formatDue(due: Date | null, now: Date): string`, e.g. `Today · 6:00 PM`, `Tomorrow · 6:00 PM`, `Fri, Nov 13 · 6:00 PM`, `No feedings yet`
  - `formatDateKey(key?: string): string`, e.g. `Mar 3, 2026`, or `—` when empty
  - Route `/pets/:id` → `PetProfile({ now?: Date })`. The page has an **Edit** link to `/pets/:id/edit` (route added in Task 9) and a **See all ›** link to `/pets/:id/feedings` (Task 11). Task 10 adds a **Log feeding** button.
- Deferred to Plan 2: the Quick log row, the Husbandry tiles, and real length/weight values. The stats grid shows `—` until measurements exist.

- [ ] **Step 1: Write failing tests `src/features/pets/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatDateKey, formatDue } from './format';

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
```

- [ ] **Step 2: Write failing tests `src/features/pets/PetProfile.test.tsx`**

```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetProfile from './PetProfile';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { logFeeding } from '../../db/feedings';

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
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/pets`
Expected: FAIL. `Failed to resolve import "./format"` / `"./PetProfile"`.

- [ ] **Step 4: Create `src/features/pets/format.ts`**

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
```

- [ ] **Step 5: Create `src/features/pets/usePetDetail.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import type { Feeding, Pet, Regurgitation } from '../../domain/types';
import { getPet } from '../../db/pets';
import { listFeedings, listRegurgitations } from '../../db/feedings';

export interface PetDetail {
  pet: Pet | null;
  feedings: Feeding[];
  regurgitations: Regurgitation[];
}

export function usePetDetail(id: string | undefined): PetDetail | undefined {
  return useLiveQuery(async () => {
    if (!id) return { pet: null, feedings: [], regurgitations: [] };
    const [pet, feedings, regurgitations] = await Promise.all([
      getPet(id),
      listFeedings(id),
      listRegurgitations(id),
    ]);
    return { pet: pet ?? null, feedings, regurgitations };
  }, [id]);
}
```

- [ ] **Step 6: Create `src/features/pets/PetProfile.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';
import { speciesEmoji } from '../../ui/PetAvatar';
import { usePhotoUrl } from '../../ui/usePhotoUrl';
import { useNow } from '../../ui/useNow';
import { buildMonthMarks } from '../../domain/calendar';
import { dueStatus, nextFeedingDue, statusLabel } from '../../domain/feeding';
import { formatAge } from '../../domain/age';
import type { ParentRef, Pet } from '../../domain/types';
import { usePetDetail } from './usePetDetail';
import { formatDateKey, formatDue } from './format';
import { TONE } from './PetsHome';
import './profile.css';

const SEX = { female: '♀ Female', male: '♂ Male', unknown: '' } as const;
const ORIGIN = { captive_bred: 'Captive bred', wild_caught: 'Wild caught', unknown: '' } as const;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const parentText = (p?: ParentRef) => [p?.name, p?.morph].filter(Boolean).join(' · ');

export default function PetProfile({ now: fixedNow, children }: { now?: Date; children?: ReactNode }) {
  const { id } = useParams();
  const now = useNow(fixedNow);
  const detail = usePetDetail(id);
  const [month, setMonth] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
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
        {children}
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

> The "Every N days" text reads `Every 5 days`, or `Every day` when the interval is 1. The `children` prop lets Task 10 put the **Log feeding** button inside the Next feeding card without restructuring this page.

- [ ] **Step 7: Create `src/features/pets/profile.css`**

```css
.hero {
  margin: calc(-8px - env(safe-area-inset-top)) -16px 0;
  padding: calc(env(safe-area-inset-top) + 8px) 16px 14px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  color: #fff;
  background: var(--hero);
  background-size: cover;
  background-position: center;
}
.hero-top a { color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); }
.hero-emoji {
  position: absolute;
  right: 24px;
  top: calc(env(safe-area-inset-top) + 48px);
  font-size: 72px;
}
.hero-name { text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35); }
.hero-name h1 { margin: 0; color: #fff; }
.chip { cursor: default; }
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.stat {
  background: var(--card);
  border-radius: 12px;
  padding: 9px 12px;
  box-shadow: var(--shadow);
}
.stat b { display: block; font-size: 16px; }
.cal-foot {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
.cal-foot a { color: var(--moss); font-weight: 700; text-decoration: none; }
```

- [ ] **Step 8: Add the route in `src/app/App.tsx`.** Add this import:

```tsx
import PetProfile from '../features/pets/PetProfile';
```
and this line inside the `AppShell` route, below `<Route index ... />`:
```tsx
        <Route path="pets/:id" element={<PetProfile />} />
```

- [ ] **Step 9: Run the tests and confirm they pass**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: add pet profile with feeding calendar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Add / edit pet form with photo

**Files:**
- Create: `src/lib/image.ts`, `src/features/pets/petFormModel.ts`, `src/features/pets/PetForm.tsx`
- Modify: `src/app/App.tsx` (two routes)
- Test: `src/lib/image.test.ts`, `src/features/pets/PetForm.test.tsx`

**Interfaces:**
- Consumes: `createPet`, `updatePet`, `getPet`, `archivePet`, `deletePet`, `type PetInput` (Task 4), `savePhoto`, `deletePhoto` (Task 4), `listFoodItems` (Task 4), `ValidationError` (Task 4), `usePhotoUrl`, `speciesEmoji` (Task 6)
- Produces:
  - `fitWithin(width, height, max): { width; height }`, `resizeToJpeg(file, max, quality?)`, `photoFromFile(file): Promise<{ blob; thumbBlob; width; height }>` (1024px full, 256px thumb, JPEG 0.8, per spec §5.16)
  - `FormState`, `EMPTY_FORM`, `toForm(pet): FormState`, `toInput(form): PetInput`. `toInput` throws `ValidationError` for a non-numeric price.
  - Routes `/pets/new` and `/pets/:id/edit` → `PetForm`. After saving it navigates to `/pets/:id`. Archive or delete navigates to `/`.

- [ ] **Step 1: Write failing tests `src/lib/image.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { fitWithin } from './image';

describe('fitWithin', () => {
  it('scales the long edge down to the max', () => {
    expect(fitWithin(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032, 256)).toEqual({ width: 192, height: 256 });
  });
  it('never scales up', () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });
});
```

- [ ] **Step 2: Write failing tests `src/features/pets/PetForm.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import PetForm from './PetForm';
import { db, resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';

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

  it('deletes a pet after confirmation', async () => {
    const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm(`/pets/${p.id}/edit`);
    await screen.findByDisplayValue('Noodle');
    await userEvent.click(screen.getByRole('button', { name: 'Delete pet' }));
    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(await getPet(p.id)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/lib src/features/pets/PetForm`
Expected: FAIL. `Failed to resolve import "./image"` / `"./PetForm"`.

- [ ] **Step 4: Create `src/lib/image.ts`**

```ts
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Browser-only: decode, downscale and re-encode an image as JPEG. */
export async function resizeToJpeg(
  file: Blob,
  max: number,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', quality),
  );
  return { blob, ...size };
}

/** Spec §5.16: 1024px full image + 256px thumbnail, JPEG quality 0.8. */
export async function photoFromFile(file: Blob) {
  const full = await resizeToJpeg(file, 1024, 0.8);
  const thumb = await resizeToJpeg(file, 256, 0.8);
  return { blob: full.blob, thumbBlob: thumb.blob, width: full.width, height: full.height };
}
```

- [ ] **Step 5: Create `src/features/pets/petFormModel.ts`**

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
  damName: string;
  damMorph: string;
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
    damName: pet.dam?.name ?? '',
    damMorph: pet.dam?.morph ?? '',
    feedingIntervalDays: String(pet.feedingIntervalDays),
    usualFoodItem: pet.usualFoodItem ?? '',
    usualQuantity: String(pet.usualQuantity),
    usualFeedTime: pet.usualFeedTime ?? '18:00',
  };
}

const opt = (s: string) => s.trim() || undefined;

function parent(name: string, morph: string): ParentRef | undefined {
  return opt(name) || opt(morph) ? { name: opt(name), morph: opt(morph) } : undefined;
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
    sire: parent(f.sireName, f.sireMorph),
    dam: parent(f.damName, f.damMorph),
    feedingIntervalDays: Number(f.feedingIntervalDays),
    usualFoodItem: opt(f.usualFoodItem),
    usualQuantity: Number(f.usualQuantity),
    usualFeedTime: opt(f.usualFeedTime),
  };
}
```

- [ ] **Step 6: Create `src/features/pets/PetForm.tsx`**

```tsx
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
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
  const [saving, setSaving] = useState(false);
  const photoUrl = usePhotoUrl(form?.photoId, 'full');

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
      setSaving(false);
    }
  }

  async function onArchive() {
    if (!id) return;
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

      {error && <div role="alert" className="form-error">{error}</div>}

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

> The bottom button is labelled **Save pet** so its name differs from the top-bar **Save**. That keeps `getByRole('button', { name: 'Save' })` in the tests unambiguous.

- [ ] **Step 7: Add the routes in `src/app/App.tsx`.** Add the import:

```tsx
import PetForm from '../features/pets/PetForm';
```
and inside the `AppShell` route, **above** `pets/:id`:
```tsx
        <Route path="pets/new" element={<PetForm />} />
        <Route path="pets/:id/edit" element={<PetForm />} />
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 9: Check photos by hand.** Photo storage can't be unit-tested in jsdom.

Run `npm run dev`, open `http://localhost:5173/RepTender/`, tap **Add your first reptile**, choose a photo from your PC, fill Name/Species, and Save.
Expected: the profile shows the photo in the header. Back on Home, the card shows the thumbnail. Edit the pet, change the photo, and Save. The new photo shows. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: add pet add/edit form with on-device photo resizing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Log a Feeding sheet (Ate / Refused / Regurgitated)

**Files:**
- Create: `src/features/feedings/logModel.ts`, `src/features/feedings/LogFeedingSheet.tsx`
- Modify: `src/features/pets/PetsHome.tsx` (banner **Log** button), `src/features/pets/PetProfile.tsx` (**Log feeding** button)
- Test: `src/features/feedings/logModel.test.ts`, `src/features/feedings/LogFeedingSheet.test.tsx`

**Interfaces:**
- Consumes: `logFeeding`, `listFoodItems`, `addFoodItem`, `ValidationError` (Task 4), `atTime`, `dateKey`, `parseDateKey` (Task 2), `pushBackOverride`, `DEFAULT_PUSH_BACK_DAYS` (Task 2), `Sheet`, `Stepper`, `Segmented`, `PetAvatar` (Task 6), `PetSummary` (Task 7), `usePetDetail` (Task 8)
- Produces:
  - `type LogOutcome = 'ate' | 'refused' | 'regurgitated'`
  - `previewNextDue(args: { pet; outcome: LogOutcome; at: Date; foundAt: Date; pushBack: boolean; pushBackDays: number; currentDue: Date | null }): Date | null`
  - `formatDay(d: Date | null, now: Date): string`. Returns `Today`, `Tomorrow`, `Fri, Nov 13`, or `—`.
  - `LogFeedingSheet({ pet, open, onClose, lastMealAt?, currentDue, now? })`
- Spec §5.3: the sheet's "📅 Remind me" toast belongs to Plan 3. Here, saving just closes the sheet.

- [ ] **Step 1: Write failing tests `src/features/feedings/logModel.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { Pet } from '../../domain/types';
import { formatDay, previewNextDue } from './logModel';

const pet = { feedingIntervalDays: 5, usualFeedTime: '18:00' } as Pet;
const now = new Date(2026, 10, 8, 18, 12);
const currentDue = new Date(2026, 10, 8, 18, 0);
const base = { pet, at: now, foundAt: now, pushBack: true, pushBackDays: 10, currentDue };

describe('previewNextDue', () => {
  it('ate: meal day + interval', () => {
    expect(previewNextDue({ ...base, outcome: 'ate' })!.getTime()).toBe(new Date(2026, 10, 13, 18, 0).getTime());
  });
  it('refused: unchanged', () => {
    expect(previewNextDue({ ...base, outcome: 'refused' })).toBe(currentDue);
  });
  it('regurgitated with push-back: found + days', () => {
    expect(previewNextDue({ ...base, outcome: 'regurgitated' })!.getTime()).toBe(new Date(2026, 10, 18, 18, 0).getTime());
  });
  it('regurgitated without push-back: same as ate', () => {
    expect(previewNextDue({ ...base, outcome: 'regurgitated', pushBack: false })!.getTime()).toBe(
      new Date(2026, 10, 13, 18, 0).getTime(),
    );
  });
});

describe('formatDay', () => {
  it('names nearby days', () => {
    expect(formatDay(new Date(2026, 10, 8, 18), now)).toBe('Today');
    expect(formatDay(new Date(2026, 10, 9, 18), now)).toBe('Tomorrow');
    expect(formatDay(new Date(2026, 10, 13, 18), now)).toBe('Fri, Nov 13');
    expect(formatDay(null, now)).toBe('—');
  });
});
```

- [ ] **Step 2: Write failing tests `src/features/feedings/LogFeedingSheet.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogFeedingSheet from './LogFeedingSheet';
import { db, resetDb } from '../../db/db';
import { createPet, getPet } from '../../db/pets';
import { listFeedings, listRegurgitations, logFeeding } from '../../db/feedings';
import type { Pet } from '../../domain/types';

const now = new Date(2026, 10, 8, 18, 12);
const lastMealAt = new Date(2026, 10, 3, 18, 0).toISOString();
let pet: Pet;

beforeEach(async () => {
  await resetDb();
  pet = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5, usualFoodItem: 'Pinky mouse' });
  await logFeeding({ petId: pet.id, at: lastMealAt, foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate' });
});

function open(onClose = vi.fn()) {
  render(
    <LogFeedingSheet
      pet={pet}
      open
      onClose={onClose}
      lastMealAt={lastMealAt}
      currentDue={new Date(2026, 10, 8, 18, 0)}
      now={now}
    />,
  );
  return onClose;
}

describe('LogFeedingSheet', () => {
  it('starts from the pet usual meal and previews the next feeding', async () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Feed Noodle' })).toBeInTheDocument();
    expect(screen.getByText('Last fed Nov 3 · 5 days ago')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pinky mouse' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-08');
    expect(screen.getByLabelText('Time')).toHaveValue('18:12');
    expect(screen.getByText('Next feeding → Fri, Nov 13')).toBeInTheDocument();
  });

  it('saves an eaten meal', async () => {
    const onClose = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const latest = (await listFeedings(pet.id)).at(-1)!;
    expect(latest).toMatchObject({ outcome: 'ate', quantity: 2, foodItem: 'Pinky mouse', at: now.toISOString() });
  });

  it('a refusal keeps the current due date', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Refused' }));
    expect(screen.getByText('Next feeding → Today')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(async () => expect((await listFeedings(pet.id)).at(-1)!.outcome).toBe('refused'));
  });

  it('Regurgitated saves the meal, the regurgitation and the push-back', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Regurgitated' }));
    expect(screen.getByRole('checkbox', { name: 'Push next feeding back?' })).toBeChecked();
    expect(screen.getByLabelText('Push back (days)')).toHaveValue(10);
    expect(screen.getByText('Next feeding → Wed, Nov 18')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(async () => expect(await listRegurgitations(pet.id)).toHaveLength(1));
    const meal = (await listFeedings(pet.id)).at(-1)!;
    expect(meal.outcome).toBe('ate');
    expect((await listRegurgitations(pet.id))[0]!.feedingId).toBe(meal.id);
    expect((await getPet(pet.id))!.nextFeedingOverride).toBe(new Date(2026, 10, 18, 18, 0).toISOString());
  });

  it('turning push-back off previews the normal interval', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Regurgitated' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Push next feeding back?' }));
    expect(screen.getByText('Next feeding → Fri, Nov 13')).toBeInTheDocument();
  });

  it('adds a custom food with "+ Other"', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: '+ Other' }));
    await userEvent.type(screen.getByLabelText('Other food'), 'Black soldier fly larvae');
    await userEvent.click(screen.getByRole('button', { name: 'Save feeding' }));
    await vi.waitFor(async () => expect((await listFeedings(pet.id)).at(-1)!.foodItem).toBe('Black soldier fly larvae'));
    expect(await db.foodItems.where('name').equals('Black soldier fly larvae').count()).toBe(1);
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/feedings`
Expected: FAIL. `Failed to resolve import "./logModel"` / `"./LogFeedingSheet"`.

- [ ] **Step 4: Create `src/features/feedings/logModel.ts`**

```ts
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import type { Pet } from '../../domain/types';
import { atTime, DEFAULT_FEED_TIME } from '../../domain/dates';
import { pushBackOverride } from '../../domain/feeding';

export type LogOutcome = 'ate' | 'refused' | 'regurgitated';

/** What the next feeding will be after saving this entry (spec §5.3 footer). */
export function previewNextDue(args: {
  pet: Pick<Pet, 'feedingIntervalDays' | 'usualFeedTime'>;
  outcome: LogOutcome;
  at: Date;
  foundAt: Date;
  pushBack: boolean;
  pushBackDays: number;
  currentDue: Date | null;
}): Date | null {
  const { pet, outcome, at, foundAt, pushBack, pushBackDays, currentDue } = args;
  if (outcome === 'refused') return currentDue;
  if (outcome === 'regurgitated' && pushBack && pushBackDays >= 1) {
    return new Date(pushBackOverride(foundAt, pet, pushBackDays));
  }
  return atTime(addDays(at, pet.feedingIntervalDays), pet.usualFeedTime ?? DEFAULT_FEED_TIME);
}

export function formatDay(d: Date | null, now: Date): string {
  if (!d) return '—';
  const days = differenceInCalendarDays(d, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}
```

- [ ] **Step 5: Create `src/features/feedings/LogFeedingSheet.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Pet } from '../../domain/types';
import { atTime, dateKey, parseDateKey } from '../../domain/dates';
import { DEFAULT_PUSH_BACK_DAYS } from '../../domain/feeding';
import { logFeeding } from '../../db/feedings';
import { addFoodItem, listFoodItems } from '../../db/foodItems';
import { ValidationError } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { Segmented } from '../../ui/Segmented';
import { PetAvatar } from '../../ui/PetAvatar';
import { formatDay, previewNextDue, type LogOutcome } from './logModel';

interface Props {
  pet: Pet;
  open: boolean;
  onClose: () => void;
  lastMealAt?: string;
  currentDue: Date | null;
  now?: Date;
}

function daysAgo(now: Date, then: Date): string {
  const n = differenceInCalendarDays(now, then);
  if (n === 0) return 'today';
  return `${n} day${n === 1 ? '' : 's'} ago`;
}

const OUTCOMES = [
  { value: 'ate', label: 'Ate it' },
  { value: 'refused', label: 'Refused' },
  { value: 'regurgitated', label: 'Regurgitated' },
] as const;

export default function LogFeedingSheet(props: Props) {
  // Remount the form each time the sheet opens so it starts from fresh defaults.
  if (!props.open) return null;
  return <LogFeedingForm {...props} />;
}

function LogFeedingForm({ pet, open, onClose, lastMealAt, currentDue, now: fixedNow }: Props) {
  const [now] = useState(() => fixedNow ?? new Date());
  const foods = useLiveQuery(() => listFoodItems(), []);
  const [date, setDate] = useState(dateKey(now));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [foodItem, setFoodItem] = useState(pet.usualFoodItem ?? '');
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherFood, setOtherFood] = useState('');
  const [quantity, setQuantity] = useState(pet.usualQuantity);
  const [outcome, setOutcome] = useState<LogOutcome>('ate');
  const [foundDate, setFoundDate] = useState(dateKey(now));
  const [foundTime, setFoundTime] = useState(format(now, 'HH:mm'));
  const [pushBack, setPushBack] = useState(true);
  const [pushBackDays, setPushBackDays] = useState(String(DEFAULT_PUSH_BACK_DAYS));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!foodItem && foods?.length) setFoodItem(foods[0]!.name);
  }, [foods, foodItem]);

  const at = atTime(parseDateKey(date), time);
  const foundAt = atTime(parseDateKey(foundDate), foundTime);
  const preview = previewNextDue({
    pet, outcome, at, foundAt, pushBack, pushBackDays: Number(pushBackDays), currentDue,
  });
  const lastMeal = lastMealAt ? parseISO(lastMealAt) : undefined;
  const ordered = foods
    ? [...foods].sort((a, b) => Number(b.name === pet.usualFoodItem) - Number(a.name === pet.usualFoodItem))
    : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const food = otherOpen ? (await addFoodItem(otherFood)).name : foodItem;
      await logFeeding({
        petId: pet.id,
        at: at.toISOString(),
        foodItem: food,
        quantity,
        outcome: outcome === 'refused' ? 'refused' : 'ate',
        notes,
        regurgitated:
          outcome === 'regurgitated'
            ? { foundAt: foundAt.toISOString(), pushBackDays: pushBack ? Number(pushBackDays) : null }
            : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Feed ${pet.name}`}>
      <form onSubmit={onSubmit} noValidate>
        <div className="row">
          <PetAvatar photoId={pet.photoId} species={pet.species} size={40} />
          <div>
            <div className="rounded" style={{ fontSize: 18 }}>{`Feed ${pet.name}`}</div>
            <div className="muted">
              {lastMeal ? `Last fed ${format(lastMeal, 'MMM d')} · ${daysAgo(now, lastMeal)}` : 'No meals logged yet'}
            </div>
          </div>
        </div>

        {error && <div role="alert" className="form-error">{error}</div>}

        <div className="label">When</div>
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>

        <div className="label">What did it eat?</div>
        <div className="chips">
          {ordered.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${!otherOpen && foodItem === f.name ? 'on' : ''}`}
              aria-pressed={!otherOpen && foodItem === f.name}
              onClick={() => { setFoodItem(f.name); setOtherOpen(false); }}
            >
              {f.name}
            </button>
          ))}
          <button type="button" className={`chip ${otherOpen ? 'on' : ''}`} aria-pressed={otherOpen} onClick={() => setOtherOpen(true)}>
            + Other
          </button>
        </div>
        {otherOpen && (
          <label className="field" style={{ marginTop: 8 }}>
            <span>Other food</span>
            <input value={otherFood} onChange={(e) => setOtherFood(e.target.value)} autoFocus />
          </label>
        )}

        <div className="label">How many?</div>
        <div className="field"><span>Quantity</span><Stepper label="quantity" value={quantity} onChange={setQuantity} /></div>

        <div className="label">How did it go?</div>
        <Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />

        {outcome === 'regurgitated' && (
          <div style={{ marginTop: 10 }}>
            <label className="field"><span>Found date</span><input type="date" value={foundDate} onChange={(e) => setFoundDate(e.target.value)} /></label>
            <label className="field"><span>Found time</span><input type="time" value={foundTime} onChange={(e) => setFoundTime(e.target.value)} /></label>
            <label className="field">
              <span>Push next feeding back?</span>
              <input type="checkbox" className="switch" checked={pushBack} onChange={(e) => setPushBack(e.target.checked)} />
            </label>
            {pushBack && (
              <label className="field">
                <span>Push back (days)</span>
                <input type="number" inputMode="numeric" min={1} value={pushBackDays} onChange={(e) => setPushBackDays(e.target.value)} />
              </label>
            )}
            <div className="muted" style={{ fontSize: 13 }}>Keepers usually wait 10–14 days, then offer a smaller meal.</div>
          </div>
        )}

        <label className="field stack" style={{ marginTop: 10 }}>
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button type="submit" className="btn-primary" disabled={saving}>Save feeding</button>
        <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          {`Next feeding → ${formatDay(preview, now)}`}
        </div>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 6: Run the sheet tests and confirm they pass**

Run: `npm test -- src/features/feedings` → Expected: all pass.

- [ ] **Step 7: Wire the banner on Home.** In `src/features/pets/PetsHome.tsx`:

Add these imports:
```tsx
import { useState } from 'react';
import LogFeedingSheet from '../feedings/LogFeedingSheet';
```
Add this state at the top of `PetsHome`, below `const summaries = ...`:
```tsx
  const [logFor, setLogFor] = useState<PetSummary | null>(null);
```
Inside the banner's `<div className="row">`, after the `<div className="grow">…</div>` block, add:
```tsx
            <button type="button" className="btn" onClick={() => setLogFor(urgent)}>Log</button>
```
Just before the final `</>`, add:
```tsx
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
```
**Hook-order check:** `useState` must run before the `if (!summaries) return null;` line. Place it directly after `const summaries = usePetSummaries(now);`.

- [ ] **Step 8: Add the Log button on the profile.** In `src/features/pets/PetProfile.tsx`:

Add these imports:
```tsx
import LogFeedingSheet from '../feedings/LogFeedingSheet';
import { lastMeal } from '../../domain/feeding';
```
Change the signature to drop `children`:
```tsx
export default function PetProfile({ now: fixedNow }: { now?: Date }) {
```
Add this state below `const [month, setMonth] = ...`:
```tsx
  const [logOpen, setLogOpen] = useState(false);
```
Replace `{children}` inside the Next feeding card with:
```tsx
        <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={() => setLogOpen(true)}>
          🍽️ Log feeding
        </button>
```
Just before the final closing `</div>` of `.profile`, add:
```tsx
      <LogFeedingSheet
        open={logOpen}
        pet={pet}
        lastMealAt={lastMeal(feedings)?.at}
        currentDue={due}
        now={now}
        onClose={() => setLogOpen(false)}
      />
```
Remove the now-unused `type ReactNode` import and the "`children` prop" note.

- [ ] **Step 9: Add one integration test to `src/features/pets/PetsHome.test.tsx`** (inside the `describe`):

```tsx
  it('logs a feeding from the hungry banner', async () => {
    await addPet('Noodle', 'Corn Snake', 5, 3);
    renderHome();
    await userEvent.click(await screen.findByRole('button', { name: 'Log' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Feed Noodle' })).getByRole('button', { name: 'Save feeding' }));
    expect(await screen.findByText('In 5 days')).toBeInTheDocument();
  });
```
Add `import userEvent from '@testing-library/user-event';` to that file's imports.

> Home uses `now` = Nov 8 09:00, so the new meal is logged at Nov 8 09:00. Next due is then Nov 13, which is "In 5 days".

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 11: Try it in the browser**

Run `npm run dev`. Add a pet, open its profile, tap **🍽️ Log feeding**, and save **Ate it**.
Expected: today's date turns moss green on the calendar and Next feeding moves forward.
Log another meal as **Regurgitated**. Expected: that day turns red and Next feeding jumps 10 days out. Stop the server.

- [ ] **Step 12: Commit**

```bash
git add src
git commit -m "feat: add Log a Feeding sheet with Ate / Refused / Regurgitated

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Feeding history (large calendar, edit, delete)

**Files:**
- Create: `src/features/feedings/foodIcon.ts`, `src/features/feedings/EditFeedingSheet.tsx`, `src/features/feedings/FeedingHistory.tsx`
- Modify: `src/app/App.tsx` (route)
- Test: `src/features/feedings/foodIcon.test.ts`, `src/features/feedings/FeedingHistory.test.tsx`

**Interfaces:**
- Consumes: `usePetDetail` (Task 8), `updateFeeding`, `deleteFeeding`, `listFoodItems`, `ValidationError` (Task 4), `buildMonthMarks` (Task 3), `nextFeedingDue` (Task 2), `atTime`, `dateKey`, `parseDateKey` (Task 2), `MonthCalendar`, `Card`, `Pill`, `Sheet`, `Stepper`, `Segmented` (Task 6), `useNow` (Task 7)
- Produces:
  - `foodIcon(foodItem: string): string`
  - `EditFeedingSheet({ feeding, onClose })`
  - Route `/pets/:id/feedings` → `FeedingHistory({ now?: Date })`

- [ ] **Step 1: Write failing tests `src/features/feedings/foodIcon.test.ts`**

```ts
import { expect, it } from 'vitest';
import { foodIcon } from './foodIcon';

it('picks an icon by food name', () => {
  expect(foodIcon('Pinky mouse')).toBe('🐭');
  expect(foodIcon('Rat pup')).toBe('🐭');
  expect(foodIcon('Crickets')).toBe('🦗');
  expect(foodIcon('Dubia roaches')).toBe('🪳');
  expect(foodIcon('Mealworms')).toBe('🪱');
  expect(foodIcon('Greens')).toBe('🥬');
  expect(foodIcon('Pellets')).toBe('🍽️');
});
```

- [ ] **Step 2: Write failing tests `src/features/feedings/FeedingHistory.test.tsx`**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FeedingHistory from './FeedingHistory';
import { resetDb } from '../../db/db';
import { createPet } from '../../db/pets';
import { listFeedings, logFeeding } from '../../db/feedings';

const now = new Date(2026, 10, 8, 9, 0);
let petId: string;

beforeEach(async () => {
  await resetDb();
  const p = await createPet({ name: 'Noodle', species: 'Corn Snake', feedingIntervalDays: 5 });
  petId = p.id;
  await logFeeding({ petId, at: new Date(2026, 10, 2, 18, 0).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'refused' });
  await logFeeding({ petId, at: new Date(2026, 10, 3, 18, 5).toISOString(), foodItem: 'Pinky mouse', quantity: 1, outcome: 'ate', notes: 'Struck right away' });
});

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={[`/pets/${petId}/feedings`]}>
      <Routes>
        <Route path="/pets/:id/feedings" element={<FeedingHistory now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FeedingHistory', () => {
  it('shows the month with food icons and lists entries newest first', async () => {
    renderHistory();
    expect(await screen.findByRole('heading', { name: 'Feedings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'November 3: ate' })).toHaveTextContent('3🐭');
    const items = screen.getAllByRole('article');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Tue, Nov 3 · 6:05 PM');
    expect(items[0]).toHaveTextContent('1 Pinky mouse · Ate it');
    expect(items[0]).toHaveTextContent('Struck right away');
    expect(items[1]).toHaveTextContent('Refused');
  });

  it('filters to a tapped day', async () => {
    renderHistory();
    await userEvent.click(await screen.findByRole('button', { name: 'November 2: refused' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Mon, Nov 2')).toBeInTheDocument();
  });

  it('edits a feeding', async () => {
    renderHistory();
    const first = (await screen.findAllByRole('article'))[0]!;
    await userEvent.click(within(first).getByRole('button', { name: 'Edit' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit feeding' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    await vi.waitFor(async () => expect((await listFeedings(petId)).at(-1)!.quantity).toBe(2));
  });

  it('deletes a feeding after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHistory();
    const second = (await screen.findAllByRole('article'))[1]!;
    await userEvent.click(within(second).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await listFeedings(petId)).toHaveLength(1));
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/features/feedings`
Expected: FAIL. `Failed to resolve import "./foodIcon"` / `"./FeedingHistory"`.

- [ ] **Step 4: Create `src/features/feedings/foodIcon.ts`**

```ts
export function foodIcon(foodItem: string): string {
  const f = foodItem.toLowerCase();
  if (/(mouse|mice|rat|pinky|fuzzy|hopper)/.test(f)) return '🐭';
  if (/cricket/.test(f)) return '🦗';
  if (/(dubia|roach)/.test(f)) return '🪳';
  if (/(worm|larva)/.test(f)) return '🪱';
  if (/(green|veg|weed|leaf|salad)/.test(f)) return '🥬';
  return '🍽️';
}
```

- [ ] **Step 5: Create `src/features/feedings/EditFeedingSheet.tsx`.** Outcome here is Ate / Refused only. Regurgitations stay linked to their meal and are deleted with it.

```tsx
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import type { Feeding, FeedingOutcome } from '../../domain/types';
import { atTime, dateKey, parseDateKey } from '../../domain/dates';
import { updateFeeding } from '../../db/feedings';
import { listFoodItems } from '../../db/foodItems';
import { ValidationError } from '../../db/ids';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { Segmented } from '../../ui/Segmented';

const OUTCOMES = [
  { value: 'ate', label: 'Ate it' },
  { value: 'refused', label: 'Refused' },
] as const;

export default function EditFeedingSheet({ feeding, onClose }: { feeding: Feeding; onClose: () => void }) {
  const at = parseISO(feeding.at);
  const foods = useLiveQuery(() => listFoodItems(), []);
  const [date, setDate] = useState(dateKey(at));
  const [time, setTime] = useState(format(at, 'HH:mm'));
  const [foodItem, setFoodItem] = useState(feeding.foodItem);
  const [quantity, setQuantity] = useState(feeding.quantity);
  const [outcome, setOutcome] = useState<FeedingOutcome>(feeding.outcome);
  const [notes, setNotes] = useState(feeding.notes ?? '');
  const [error, setError] = useState<string>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await updateFeeding(feeding.id, {
        at: atTime(parseDateKey(date), time).toISOString(),
        foodItem, quantity, outcome, notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : 'Could not save. Please try again.');
    }
  }

  const foodNames = foods?.map((f) => f.name) ?? [];
  if (!foodNames.includes(feeding.foodItem)) foodNames.unshift(feeding.foodItem);

  return (
    <Sheet open onClose={onClose} title="Edit feeding">
      <form onSubmit={onSubmit} noValidate>
        <div className="rounded" style={{ fontSize: 18, marginBottom: 8 }}>Edit feeding</div>
        {error && <div role="alert" className="form-error">{error}</div>}
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field">
          <span>Food</span>
          <select value={foodItem} onChange={(e) => setFoodItem(e.target.value)}>
            {foodNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="field"><span>Quantity</span><Stepper label="quantity" value={quantity} onChange={setQuantity} /></div>
        <Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
        <label className="field stack" style={{ marginTop: 10 }}>
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">Save changes</button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 6: Create `src/features/feedings/FeedingHistory.tsx`**

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { Feeding } from '../../domain/types';
import { buildMonthMarks } from '../../domain/calendar';
import { dateKey, parseDateKey } from '../../domain/dates';
import { nextFeedingDue } from '../../domain/feeding';
import { deleteFeeding } from '../../db/feedings';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/Pill';
import { CalendarLegend, MonthCalendar } from '../../ui/MonthCalendar';
import { useNow } from '../../ui/useNow';
import { usePetDetail } from '../pets/usePetDetail';
import EditFeedingSheet from './EditFeedingSheet';
import { foodIcon } from './foodIcon';

export default function FeedingHistory({ now: fixedNow }: { now?: Date }) {
  const { id } = useParams();
  const now = useNow(fixedNow);
  const detail = usePetDetail(id);
  const [month, setMonth] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
  const [selectedKey, setSelectedKey] = useState<string>();
  const [editing, setEditing] = useState<Feeding | null>(null);

  if (!detail) return null;
  const { pet, feedings, regurgitations } = detail;
  if (!pet) return <Card><h2>Pet not found</h2><Link to="/">Back to My Reptiles</Link></Card>;

  const regurgitated = new Set(regurgitations.map((r) => r.feedingId));
  const marks = buildMonthMarks({
    ...month, feedings, regurgitations,
    nextDue: nextFeedingDue(pet, feedings), intervalDays: pet.feedingIntervalDays, now,
  });
  const byDay = new Map<string, Feeding[]>();
  for (const f of feedings) {
    const key = dateKey(parseISO(f.at));
    byDay.set(key, [...(byDay.get(key) ?? []), f]);
  }
  const shown = feedings
    .filter((f) => {
      const d = parseISO(f.at);
      return selectedKey
        ? dateKey(d) === selectedKey
        : d.getFullYear() === month.year && d.getMonth() === month.month;
    })
    .reverse();
  const shift = (delta: number) => {
    setSelectedKey(undefined);
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const outcomeText = (f: Feeding) =>
    f.outcome === 'refused' ? 'Refused' : regurgitated.has(f.id) ? 'Regurgitated' : 'Ate it';

  async function onDelete(f: Feeding) {
    if (!window.confirm('Delete this feeding? This can’t be undone.')) return;
    await deleteFeeding(f.id);
  }

  return (
    <>
      <div className="topbar"><Link to={`/pets/${pet.id}`}>‹ {pet.name}</Link></div>
      <h1>Feedings</h1>
      <Card>
        <MonthCalendar
          {...month}
          size="large"
          marks={marks}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          selectedKey={selectedKey}
          onSelectDay={(key) => setSelectedKey((k) => (k === key ? undefined : key))}
          dayIcon={(key) => {
            const meal = byDay.get(key)?.find((f) => f.outcome === 'ate');
            return meal ? foodIcon(meal.foodItem) : undefined;
          }}
        />
        <CalendarLegend />
      </Card>

      <div className="label">
        {selectedKey ? format(parseDateKey(selectedKey), 'EEE, MMM d') : `All in ${format(new Date(month.year, month.month, 1), 'MMMM')}`}
      </div>
      {shown.length === 0 && <p className="muted">No feedings logged.</p>}
      {shown.map((f) => (
        <Card key={f.id} role="article">
          <div className="row">
            <div className="grow">
              <b>{format(parseISO(f.at), 'EEE, MMM d · h:mm a')}</b>
              <div className="muted">{`${foodIcon(f.foodItem)} ${f.quantity} ${f.foodItem} · ${outcomeText(f)}`}</div>
              {f.notes && <div style={{ marginTop: 4 }}>{f.notes}</div>}
            </div>
            <Pill tone={outcomeText(f) === 'Ate it' ? 'ok' : 'late'}>{outcomeText(f)}</Pill>
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setEditing(f)}>Edit</button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(f)}>Delete</button>
          </div>
        </Card>
      ))}

      {editing && <EditFeedingSheet feeding={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
```

- [ ] **Step 7: Add the route in `src/app/App.tsx`.** Add the import:

```tsx
import FeedingHistory from '../features/feedings/FeedingHistory';
```
and inside the `AppShell` route:
```tsx
        <Route path="pets/:id/feedings" element={<FeedingHistory />} />
```

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: add feeding history with large calendar, edit and delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Settings (Light / Dark / Auto) and sample pets

**Files:**
- Create: `src/env.d.ts`, `src/dev/sampleData.ts`, `src/features/settings/SettingsScreen.tsx`
- Modify: `vite.config.ts` (`define`), `src/app/TabBar.tsx` (Settings tab), `src/app/App.tsx` (route)
- Test: `src/dev/sampleData.test.ts`, `src/features/settings/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `getSettings`, `updateSettings`, `createPet`, `listActivePets`, `logFeeding`, `resetDb` (Task 4), `Segmented`, `Card` (Task 6), `summarize`, `sortSummaries` (Task 7), `dateKey` (Task 2)
- Produces:
  - `__APP_VERSION__: string` (a global, from `package.json`)
  - `loadSampleData(now?: Date): Promise<void>` creates the 4 mockup pets with history relative to `now`: Basil 1 day late, Noodle due today, Pebble tomorrow, Ziggy in 2 days.
  - Route `/settings` → `SettingsScreen`. The tab bar gains **Settings**.
- Deferred to Plan 3: Units, Add reminders to Calendar, Export/Import backup and the storage warning (spec §5.15, §8–9).

- [ ] **Step 1: Write failing tests `src/dev/sampleData.test.ts`**

```ts
import { beforeEach, expect, it } from 'vitest';
import { resetDb } from '../db/db';
import { listActivePets } from '../db/pets';
import { listFeedings } from '../db/feedings';
import { sortSummaries, summarize } from '../features/pets/usePetSummaries';
import { loadSampleData } from './sampleData';

beforeEach(async () => {
  await resetDb();
});

it('creates four pets in every feeding state', async () => {
  const now = new Date(2026, 10, 8, 9, 0);
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
```

- [ ] **Step 2: Write failing tests `src/features/settings/SettingsScreen.test.tsx`**

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
  expect(await screen.findByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
});

it('loads sample pets in development builds', async () => {
  renderSettings();
  await userEvent.click(await screen.findByRole('button', { name: 'Load sample pets' }));
  await vi.waitFor(async () => expect(await listActivePets()).toHaveLength(4));
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npm test -- src/dev src/features/settings`
Expected: FAIL. `Failed to resolve import "./sampleData"` / `"./SettingsScreen"`.

- [ ] **Step 4: Expose the app version.** In `vite.config.ts`, add `define` to the config object (beside `base`):

```ts
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
```
Create `src/env.d.ts`:
```ts
declare const __APP_VERSION__: string;
```
Add `"node"` to `types` in `tsconfig.json` so `process.env` type-checks in `vite.config.ts`:
```json
    "types": ["vite/client", "vite-plugin-pwa/client", "node"]
```
and install the Node types:
```bash
npm install -D @types/node@24
```

- [ ] **Step 5: Create `src/dev/sampleData.ts`**

```ts
import { addDays, startOfDay, subMonths } from 'date-fns';
import { createPet } from '../db/pets';
import { logFeeding } from '../db/feedings';
import { dateKey } from '../domain/dates';
import type { FeedingOutcome } from '../domain/types';

/** Dev builds only: the four pets from the approved mockups, with history relative to `now`. */
export async function loadSampleData(now: Date = new Date()): Promise<void> {
  const at = (offsetDays: number, hour = 18) => {
    const d = addDays(startOfDay(now), offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
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
}
```

- [ ] **Step 6: Create `src/features/settings/SettingsScreen.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '../../db/settings';
import { listActivePets } from '../../db/pets';
import type { ThemePref } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Segmented } from '../../ui/Segmented';
import { loadSampleData } from '../../dev/sampleData';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
] as const;

export default function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  const petCount = useLiveQuery(async () => (await listActivePets()).length, []);
  const [loading, setLoading] = useState(false);
  if (!settings) return null;

  return (
    <>
      <h1>Settings</h1>
      <Card style={{ marginTop: 12 }}>
        <div className="row">
          <div className="grow">
            <b style={{ fontSize: 17 }}>RepTender</b>
            <div className="muted">{`${petCount ?? 0} pets · version ${__APP_VERSION__}`}</div>
          </div>
        </div>
      </Card>

      <div className="label">Appearance</div>
      <Card>
        <Segmented<ThemePref>
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
        <p className="muted" style={{ margin: '8px 2px 0', fontSize: 13 }}>
          Auto follows your iPhone's light/dark setting.
        </p>
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
              await loadSampleData();
              setLoading(false);
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

- [ ] **Step 7: Add the tab and route**

In `src/app/TabBar.tsx`, add the Settings entry to `TABS`:
```ts
  { to: '/settings', label: 'Settings', icon: '⚙️' },
```
In `src/app/App.tsx`, add the import and route:
```tsx
import SettingsScreen from '../features/settings/SettingsScreen';
```
```tsx
        <Route path="settings" element={<SettingsScreen />} />
```

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck` → Expected: all pass, exit 0.

- [ ] **Step 9: Preview the whole app on localhost**

Run `npm run dev` and open `http://localhost:5173/RepTender/`.
1. Settings → **Load sample pets**. Home now shows Basil (1 day late), Noodle (Today), Pebble (Tomorrow) and Ziggy (In 2 days), with the "Basil is hungry" banner.
2. Settings → **Dark**. The whole app switches to the charcoal theme. Reload the page; it stays dark with no light flash.
3. Open Noodle → the calendar shows the refusal and meals, with today glowing amber.

Stop the server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add Settings with Light/Dark/Auto and dev sample pets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Installable offline app, icon, GitHub Pages deploy

**Files:**
- Create: `public/icons/icon.svg`, `scripts/make-icons.mjs`, `public/icons/*.png` (generated, committed), `src/app/UpdatePrompt.tsx`, `.github/workflows/deploy.yml`, `docs/iphone-checklist.md`
- Modify: `vite.config.ts` (VitePWA), `src/main.tsx` (UpdatePrompt + persistent storage), `src/features/settings/SettingsScreen.tsx` (icon in the app card), `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: an installable PWA at `https://josephsester.github.io/RepTender/`, deployed on every push to `main`

- [ ] **Step 1: Create the master icon `public/icons/icon.svg`** ("Scaled Eye", option 2a, approved)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="iris" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#FBE38A"/>
      <stop offset=".55" stop-color="#E9A04B"/>
      <stop offset="1" stop-color="#9E5422"/>
    </radialGradient>
    <pattern id="scales" width="14" height="12" patternUnits="userSpaceOnUse">
      <path d="M0 12 A7 7 0 0 1 14 12 M-7 6 A7 7 0 0 1 7 6 M7 6 A7 7 0 0 1 21 6" fill="none" stroke="#4B7139" stroke-width="1.4"/>
    </pattern>
    <clipPath id="almond">
      <path d="M12 50 Q50 14 88 50 Q50 86 12 50 Z"/>
    </clipPath>
  </defs>
  <rect width="100" height="100" fill="#2F4A24"/>
  <rect width="100" height="100" fill="url(#scales)" opacity=".8"/>
  <path d="M6 50 Q50 6 94 50 Q50 94 6 50 Z" fill="#1E3217"/>
  <path d="M12 50 Q50 14 88 50 Q50 86 12 50 Z" fill="#5E8E47"/>
  <g clip-path="url(#almond)">
    <circle cx="50" cy="50" r="27" fill="url(#iris)"/>
    <g transform="translate(50 50)" stroke="#A85C24" stroke-width="1.1" stroke-linecap="round" opacity=".55">
      <line x1="0" y1="-8" x2="0" y2="-25"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(22.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(45)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(67.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(90)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(112.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(135)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(157.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(180)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(202.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(225)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(247.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(270)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(292.5)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(315)"/>
      <line x1="0" y1="-8" x2="0" y2="-25" transform="rotate(337.5)"/>
    </g>
    <ellipse cx="50" cy="50" rx="5" ry="24" fill="#16140F"/>
    <path d="M12 50 Q50 14 88 50" fill="none" stroke="#1E3217" stroke-width="5" opacity=".45"/>
  </g>
  <circle cx="60" cy="39" r="4.2" fill="#fff" opacity=".9"/>
  <circle cx="64.5" cy="46" r="1.6" fill="#fff" opacity=".7"/>
</svg>
```

- [ ] **Step 2: Create `scripts/make-icons.mjs`** (renders the PNG sizes iOS and the manifest need)

```js
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('../public/icons/', import.meta.url);
const file = (name) => fileURLToPath(new URL(name, dir));
const svg = await readFile(file('icon.svg'));
const render = (size) => sharp(svg, { density: 1024 }).resize(size, size).png();

for (const [name, size] of [['apple-touch-icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await render(size).toFile(file(name));
}

// Maskable: icon at 80% inside a full-bleed background so Android/iOS masks never crop the eye.
const inner = await render(410).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2F4A24' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(file('icon-maskable-512.png'));

console.log('icons written to public/icons/');
```

- [ ] **Step 3: Generate the icons**

```bash
npm install -D sharp@0.35.5
```
```bash
node scripts/make-icons.mjs
```
Expected: `icons written to public/icons/`. `public/icons/` now has `icon.svg` plus 4 PNGs. Open `icon-512.png` to confirm it shows the golden eye on scales.

- [ ] **Step 4: Add the PWA plugin to `vite.config.ts`.** The whole file becomes:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/RepTender/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'RepTender',
        short_name: 'RepTender',
        description: 'Track reptile feedings and husbandry.',
        start_url: '/RepTender/',
        scope: '/RepTender/',
        display: 'standalone',
        background_color: '#F6F1E7',
        theme_color: '#2F4A24',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

- [ ] **Step 5: Create `src/app/UpdatePrompt.tsx`** (spec §10: "Update available — tap to refresh")

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <button
      type="button"
      className="btn-primary"
      style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 76px)', width: 'auto', zIndex: 40 }}
      onClick={() => updateServiceWorker(true)}
    >
      Update available — tap to refresh
    </button>
  );
}
```

- [ ] **Step 6: Mount it and ask for persistent storage in `src/main.tsx`.** The whole file becomes:

```tsx
import './theme/tokens.css';
import './theme/base.css';
import './ui/ui.css';
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
> `UpdatePrompt` lives in `main.tsx`, not `App`, so component tests never touch the service-worker virtual module.

- [ ] **Step 7: Show the icon in Settings.** In `SettingsScreen.tsx`, inside the app card's `<div className="row">`, add this before `<div className="grow">`:

```tsx
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={48} height={48} style={{ borderRadius: 12 }} />
```

- [ ] **Step 8: Build and check the output**

Run: `npm test && npm run build`
Expected: tests pass. The build ends listing `dist/manifest.webmanifest` and `dist/sw.js`.
Run: `npm run preview` and open `http://localhost:4173/RepTender/`.
Expected: the app loads. In DevTools → Application, the Manifest shows "RepTender" with the eye icon and a service worker is activated. Tick "Offline" in DevTools and reload: the app still loads. Stop the preview.

- [ ] **Step 9: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 10: Create `docs/iphone-checklist.md`** (spec §12, run before each release)

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
```

- [ ] **Step 11: Update `README.md`.** Replace the "Status" line with:

````markdown
## Develop

```bash
npm install
npm run dev        # http://localhost:5173/RepTender/
npm test
```

Pushing to `main` deploys to https://josephsester.github.io/RepTender/.

## Install on iPhone

Open the link above in Safari → Share → **Add to Home Screen**.
````

- [ ] **Step 12: Commit and push as JosephSester**

```bash
git add -A
git commit -m "feat: make RepTender an installable offline PWA and deploy to GitHub Pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
```bash
GH_TOKEN="$(gh auth token --user JosephSester)" git push
```

- [ ] **Step 13: Turn on GitHub Pages (workflow source) and watch the deploy**

```bash
GH_TOKEN="$(gh auth token --user JosephSester)" gh api -X POST repos/JosephSester/RepTender/pages -f build_type=workflow
```
Expected: JSON with `"build_type": "workflow"`. If it says Pages already exists, run the same command with `-X PUT`.
```bash
GH_TOKEN="$(gh auth token --user JosephSester)" gh workflow run deploy.yml --repo JosephSester/RepTender
```
```bash
GH_TOKEN="$(gh auth token --user JosephSester)" gh run watch --repo JosephSester/RepTender --exit-status
```
Expected: both jobs succeed. Open `https://josephsester.github.io/RepTender/` on the PC. RepTender loads with an empty Home (sample data is dev-only).

- [ ] **Step 14: Run `docs/iphone-checklist.md` on the iPhone 17** and record any failures as issues before calling Plan 1 done.

---

## Plan 1 done when

- `npm test` and `npm run typecheck` pass. The GitHub Actions deploy is green.
- On localhost: pets can be added and edited with photos; feedings logged as Ate/Refused/Regurgitated; Home sorts by urgency; the profile calendar shows ate, refused, regurgitated, next due, planned and today; history edits and deletes work; Light/Dark/Auto switches with no flash.
- On the iPhone: the checklist passes.

**Next:** Plan 2 (husbandry: sheds, poop, the regurgitation sheet, weight & length, habitat, care tasks, vet, notes, Schedule tab, Add tab, Quick log, show archived). Plan 3 (Calendar reminders, the icon badge, backup export/import, units, the error boundary, the storage warning).
