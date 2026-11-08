# RepTender: Design Spec

**Date:** 2026-11-08
**Status:** Draft, awaiting review
**Repo:** `JosephSester/RepTender` (public)

## 1. Summary

RepTender is an app for keeping track of reptile feedings and husbandry. It is built as a free **home-screen web app** (PWA): developed and previewed on Windows at `localhost`, hosted on GitHub Pages, and installed on an iPhone 17 through Safari → Share → **Add to Home Screen**. There is no App Store, no Apple Developer fee and no server. All data lives on the phone.

**Primary user:** one keeper (the developer's daughter) with a handful of reptiles, such as a corn snake, a leopard gecko, a bearded dragon and a tortoise.

**Why a web app and not a native app:** a native iPhone app that installs for free without a Mac stops opening after 7 days and has to be re-signed every week. A paid Apple Developer account costs $99/year. A home-screen web app is free and permanent, works offline and keeps its data on the device. The trade-offs are covered in §8 (Reminders).

## 2. Goals and non-goals

**Goals (v1)**
- Know at a glance which pet is due to eat, which is late and when each one is next due.
- Log a feeding in a few taps: date, time, food item, quantity, and whether it ate or refused.
- Keep a rich profile for each pet: photo, name, description, species/morph, sex, date of birth and age, length, weight, parents, who it was bought from.
- A monthly feeding calendar for each pet.
- Husbandry tracking: sheds, poop, regurgitation, weight and length, habitat readings (temps and humidity), care tasks, vet visits, notes.
- Light, dark and auto appearance.
- Works fully offline, and data survives app updates.
- Export and import backups.

**Non-goals (v1)**
- Accounts, cloud sync or sharing between devices.
- True push notifications (no server). See §8.
- Breeding, clutch and genetics tracking, QR codes, a marketplace, AI features.
- Android-specific polish. It will likely work on Android, but the target is iPhone Safari.

## 3. Architecture

| Concern | Choice |
|---|---|
| Language / UI | TypeScript + React |
| Build / dev server | Vite (`npm run dev` → `http://localhost:5173`) |
| PWA | `vite-plugin-pwa`: manifest, service worker, offline cache, update prompt |
| Routing | React Router with **hash routing** (works on GitHub Pages with no server rewrites) |
| Storage | IndexedDB through **Dexie** |
| Dates | `date-fns` |
| Styling | Plain CSS with design tokens (CSS custom properties) for the Terrarium theme, light and dark. No UI kit. |
| Charts | Small hand-rolled SVG components (weight line chart, habitat sparkline) |
| Tests | Vitest + React Testing Library + `fake-indexeddb` |
| Deploy | GitHub Actions → GitHub Pages on every push to `main` |

**Folder layout**
```
src/
  domain/      pure logic, no React/DB: schedules, next-due, calendar marks, shed prediction, units, age
  db/          Dexie schema, migrations, repositories (one per table)
  features/    one folder per area: pets, feedings, sheds, poop, regurgitation, weight,
               habitat, care, vet, notes, schedule, settings, backup, calendar-export
  ui/          shared components: Card, Pill, Calendar, TabBar, Sheet, Stepper, Segmented, PhotoPicker
  theme/       tokens.css (light + dark), theme provider
  app/         routes, layout, service-worker registration
```
Boundaries: `domain/` depends on nothing. `db/` depends on `domain/` types. `features/` depend on `db/`, `domain/` and `ui/`. `ui/` has no data access.

**Desktop preview:** on a wide screen the app renders centered at phone width (max about 430px), so `localhost` shows what the phone will show.

**iPhone details:** `viewport-fit=cover` and `env(safe-area-inset-*)` padding for the Dynamic Island and the home indicator. `apple-mobile-web-app-capable`, a status-bar style and an apple-touch-icon so it launches full-screen with the right icon.

## 4. Visual design

**Direction A, "Terrarium":** warm, friendly and rounded. Approved mockups are in `docs/design/`.

**Light tokens:** background `#F6F1E7` (sand), cards `#FFFFFF`, text `#2E2A24`, muted `#8B7E68`, moss `#4E7A3A`, amber `#E9A04B`, late/refused `#B23A2B` on `#F8D9D4`.
**Dark tokens:** background `#171511`, cards `#24211B`, text `#F1EADC`, muted `#A99C84`, moss `#6E9E55` (brighter, for contrast), amber `#E9A04B`, late/refused `#F09A8A` on `#3B201D`.
**Type:** system font. Titles use SF Pro Rounded (`ui-rounded`) at heavy weight.

**App icon: "Scaled Eye" (2a).** A golden reptile eye with a slit pupil on dark moss, with a scale pattern behind it. It is produced as an SVG master and exported to the PNG sizes the manifest and apple-touch-icon need (180, 192, 512, plus a maskable 512). Home-screen label: **RepTender**.

**Navigation:** a bottom tab bar with 4 tabs.
1. **Pets** (home)
2. **Schedule**
3. **Add**: a sheet for quick-logging any entry for any pet
4. **Settings**

## 5. Screens

### 5.1 Pets (home)
- Title "My Reptiles", with a subtitle such as "4 pets · 1 feeding due today".
- An amber **"<Pet> is hungry"** banner for the most urgent pet due today, with a **Log** button. If several pets are due, it shows the most overdue one first.
- A card per pet: photo, name, species and morph, a progress bar through the current feeding interval, and a status pill: **In N days** (green), **Tomorrow**, **Today** (amber), **N days late** (red).
- Sort order: late first, then due today, then soonest.
- Archived pets are hidden behind a "Show archived" link.

### 5.2 Pet profile (scrolling page, top to bottom)
1. Hero header with the pet's photo, name and species/morph. "‹ Pets" and **Edit** at the top.
2. Chips: sex, age, and "captive bred" or "wild caught" when set.
3. **Next feeding** card: date and time, interval, usual food and quantity, status pill.
4. **Feeding calendar** card (compact month view), with ‹ › to change month:
   - Ate: filled moss circle.
   - Refused: pink circle with a ✕ badge.
   - Regurgitated: the meal's day is shown red.
   - Next due: amber with a glow.
   - Planned (the next 3 occurrences after next due): dashed amber outline.
   - Today: outlined. When today is also the next due day, both styles show.
   - A legend, and a footer such as "1 meal · 1 refusal this month · See all ›" that opens the full feeding history.
5. **Quick log** row: 🍽️ Fed · 🤢 Regurg. · 💩 Poop · 🐍 Shed.
6. **Husbandry** tiles, each with a summary line: Sheds, Poop, Weight, Habitat, Care tasks, Vet visits, plus a full-width Notes tile.
7. Stats grid: length, weight, born, age.
8. Lineage: sire and dam.
9. From: who it was bought from, the date and the price.
10. About: the description.

### 5.3 Log a feeding (bottom sheet)
- Pet avatar and name, plus "Last fed <date> · N days ago".
- Date and time, defaulting to now.
- Food item as chips: the pet's usual food first, then common items, then "+ Other".
- A quantity stepper, defaulting to the pet's usual quantity.
- Outcome: **Ate it** / **Refused**. Regurgitation is logged separately against a meal; see §5.5.
- Notes.
- Footer: "Next feeding → <date>", worked out live.
- After saving, a toast with a **📅 Remind me** button (§8).

### 5.4 Feeding history ("See all")
A large month calendar with food icons on the days it ate, and a list of entries below. Tapping a day shows that day's entries. Each entry can be edited or deleted.

### 5.5 Regurgitation (sheet)
- Pick which meal came back up. The last 5 eaten meals are listed, with the most recent selected.
- When it was found (date and time), and notes.
- A **"Push next feeding back?"** switch, on by default, set to 10 days and adjustable.
- Shown on the calendar in red on that meal's day.

### 5.6 Poop log
- A "Last poop" card: date, days ago, and the typical gap after a meal.
- One-tap logging with a kind: **Normal / Runny / Urate only / Abnormal**, plus notes.
- History list, with each entry labelled "N days after <meal date> meal" where a meal applies.

### 5.7 Sheds
- A "Next shed expected" card (only after 2 or more sheds are logged), with a **Mark "in blue"** button.
- History: date, quality (**Complete / Partial / Stuck**), the in-blue date, notes.

### 5.8 Weight & length
- The current weight (large), the change over the last 30 days, and the current length.
- An SVG line chart with ranges of 6M / 1Y / All.
- List of entries. Weight and length are each optional per entry, but at least one is required.

### 5.9 Habitat
- The enclosure label (free text, such as "40-gal tank") and the time of the last reading.
- Warm side, cool side and humidity, each with its target range and a gauge.
- A 7-day sparkline of the warm side, with the target band shaded.
- **Log a reading.** Each of the three values is optional, but at least one is required.

### 5.10 Care tasks
- Per-pet tasks, plus "All pets" tasks.
- Each task has a name, an every-N-days interval and an optional time of day.
- Checking a task off records a completion. Next due is the last completion plus the interval.
- Starter suggestions (one tap to add): spot clean (daily), fresh water (2 days), mist (2 days), deep clean (30 days), replace UVB bulb (180 days).

### 5.11 Vet visits
- Clinic card: name, vet, phone (tap to call).
- History: date, reason, notes, cost, photos.
- A next-appointment card with **📅 Add to Calendar**.

### 5.12 Notes
Dated free-text notes for each pet.

### 5.13 Schedule tab
- Header "Today", with "N of M done".
- A checklist for today across all pets: feedings due or late, plus care tasks due or late. Checking a feeding opens the Log sheet. Checking a care task completes it.
- "Coming up": the next 7 days, grouped by day.
- **📅 Add all reminders to Calendar.**

### 5.14 Add tab
A sheet: pick a pet (skipped when there is only one), then pick an entry type: Feeding, Regurgitation, Poop, Shed, Weight, Habitat reading, Vet visit, Note. It can also add a new pet.

### 5.15 Settings
- App card with the icon, the pet count and the version.
- **Appearance:** Light / Dark / Auto (Auto follows iOS `prefers-color-scheme`). Saved, and applied before first paint so the screen never flashes the wrong theme.
- **Units:** temperature (°F/°C), weight (g/oz/lb), length (in/cm).
- **Reminders & data:** Add reminders to Calendar · Export backup (shows the last export date) · Import backup.
- About and version.

### 5.16 Add / edit pet
A form for every pet field (§6.1), with a photo picker (camera or library). Photos are resized on the device to a 1024px longest edge and saved as JPEG at quality 0.8, plus a 256px thumbnail.

## 6. Data model

Stored in IndexedDB through Dexie. All IDs are UUIDs (`crypto.randomUUID()`). Every record has `createdAt` and `updatedAt`. **Canonical units:** grams, millimetres, °C. They are converted only for display.

### 6.1 Pet
| Field | Type | Notes |
|---|---|---|
| id | string | |
| name | string | required |
| photoId | string? | refers to a Photo |
| species | string | e.g. "Corn Snake" |
| morph | string? | morph or breed, e.g. "Amel" |
| sex | `male` \| `female` \| `unknown` | |
| birthDate | ISO date? | |
| birthDateApprox | boolean | shows "~" before the age |
| description | string? | |
| origin | `captive_bred` \| `wild_caught` \| `unknown` | |
| acquiredFrom | string? | breeder or store name |
| acquiredDate | ISO date? | |
| pricePaid | number? | |
| sire / dam | `{ name?: string; morph?: string; petId?: string }`? | free text, or a link to another pet |
| feedingIntervalDays | number | required, at least 1 |
| usualFoodItem | string? | |
| usualQuantity | number | default 1 |
| usualFeedTime | `HH:mm`? | default 18:00 |
| enclosureLabel | string? | |
| habitatTargets | `{ warmMinC?, warmMaxC?, coolMinC?, coolMaxC?, humidityMin?, humidityMax? }` | |
| nextFeedingOverride | ISO datetime? | set by the regurgitation push-back, cleared by the next "ate" feeding |
| archivedAt | ISO datetime? | |

### 6.2 Log tables (each has `id`, `petId`, `createdAt`, `updatedAt`)
| Table | Fields |
|---|---|
| **Feeding** | `at` (ISO datetime), `foodItem`, `quantity` (≥1), `outcome`: `ate` \| `refused`, `notes?` |
| **Regurgitation** | `at`, `feedingId` (the meal), `pushBackDays?`, `notes?` |
| **Poop** | `at`, `kind`: `normal` \| `runny` \| `urate_only` \| `abnormal`, `notes?` |
| **Shed** | `date`, `inBlueDate?`, `quality`: `complete` \| `partial` \| `stuck`, `notes?` |
| **Measurement** | `date`, `weightG?`, `lengthMm?` (at least one required) |
| **HabitatReading** | `at`, `warmC?`, `coolC?`, `humidityPct?` (at least one required) |
| **CareTask** | `petId?` (empty means all pets), `name`, `intervalDays`, `timeOfDay?`, `archivedAt?` |
| **CareCompletion** | `taskId`, `at` |
| **VetVisit** | `date`, `clinic?`, `vet?`, `phone?`, `reason?`, `notes?`, `cost?`, `photoIds[]`, `nextAppointment?` |
| **Note** | `at`, `text` |
| **FoodItem** | `name`, `isCustom`. Seeded: pinky / fuzzy / hopper / adult mouse, rat pup, crickets, dubia roaches, mealworms, superworms, greens, pellets |
| **Photo** | `blob` (JPEG), `thumbBlob`, `width`, `height` |
| **Settings** (single row) | `theme`: `light` \| `dark` \| `auto`, `tempUnit`, `weightUnit`, `lengthUnit`, `lastBackupAt?` |

Indexes: `[petId+at]` on the time-based log tables, `[petId+date]` on the date-based ones.

**Schema versioning:** a Dexie `version(n)` with an upgrade function for every change. The backup file records the schema version.

## 7. Domain rules (`src/domain/`, pure functions with full unit-test coverage)

1. **Last meal** = the most recent Feeding with `outcome = ate`. Refusals and regurgitations are ignored for this.
2. **Next feeding due:**
   - If `nextFeedingOverride` is set and is later than the last meal, it wins.
   - Otherwise, the last meal date + `feedingIntervalDays`, at `usualFeedTime`.
   - With no meals logged at all, the pet is "due now", and its card shows "No feedings yet".
3. **A refusal does not reset the clock.** The pet stays due, then late, until a meal with `outcome = ate` is logged.
4. **Regurgitation push-back:** when it is enabled, `nextFeedingOverride` = regurgitation date + `pushBackDays` (default 10). The next "ate" feeding clears the override.
5. **Status:**
   - `late`: now is past the due day (the day after the due date or later).
   - `today`: the due date is today.
   - `soon`: otherwise. Shown as "Tomorrow" or "In N days".
   - All comparisons use **calendar days in the phone's local time zone**.
6. **Calendar marks for a month:**
   - Each day gets a set of marks: `ate`, `refused`, `regurgitated`, `nextDue`, `planned`, `today`.
   - `planned` is next due + k × interval, for k = 1–3, limited to the visible month.
7. **Age** from `birthDate`: "N days" under 1 month, "N mo" under 2 years, otherwise "N yr M mo".
8. **Shed prediction:** needs 2 or more sheds. It averages the gaps between the most recent sheds (up to 5 gaps), then predicts last shed + average.
9. **Care task next due** = last completion (or the task's creation date) + `intervalDays`, with the same statuses as feeding.
10. **Units:** conversions both ways, with display rounding (g to whole numbers, °F to whole numbers, in to 1 decimal place).
11. **Poop "days after meal":** counted from the latest meal on or before the poop.

## 8. Reminders

A web app cannot schedule local iPhone notifications, and true web push needs a server, which v1 leaves out. Instead:

- **In-app status:** Pets and Schedule always show what's due and late.
- **App icon badge:** `navigator.setAppBadge(count)` with the number of late or due-today items, updated whenever the app runs. This works for home-screen web apps on iOS 16.4 and later. Where it isn't supported, the call is skipped without error.
- **Calendar events (.ics):**
  - After a feeding is logged, the toast's **📅 Remind me** creates a single event, such as "Feed Noodle · 1 pinky mouse", at the next due date and time, with an alert at the start time.
  - Care tasks and vet appointments have the same button.
  - **Add all reminders** builds one `.ics` file with the next occurrence of every feeding and care task.
  - Events have stable UIDs (`<petId|taskId>-<dueDate>@reptender`).
  - Repeating events are not used, because late feedings would make them drift.
- **Delivery to Calendar:** try `navigator.share({ files: [ics] })` first. If that isn't available, fall back to a download link to a blob URL.
  - **Known risk:** standalone home-screen apps on iOS can be inconsistent about handing `.ics` files to Calendar. This must be **checked on the iPhone in the first deployed build**.
  - If it fails, fall back to opening the `.ics` in Safari, which handles calendar files reliably.

**Future (not v1):** real push notifications through a free serverless scheduler, such as a Cloudflare Worker with a cron trigger and Web Push.

## 9. Backup and data safety

- **Export:**
  - Builds `reptender-backup-YYYY-MM-DD.json`: `{ app: "RepTender", schemaVersion, exportedAt, tables: {...} }`, with photos base64-encoded.
  - Delivered with `navigator.share({ files })` (to Files, iCloud Drive, AirDrop or Mail), falling back to a download.
  - Records `lastBackupAt`.
- **Import:**
  - Pick a file, parse it and validate it: correct shape, `app` field, a schema version it can migrate, and references that point to real records.
  - Show a summary ("4 pets, 120 entries, 6 photos"), then **replace** all data in one transaction.
  - Invalid files are rejected with a clear message, and the current data stays untouched.
  - Merging into existing data is not supported in v1.
- **Backup reminder:** Settings shows "Last backup N days ago" in amber after 30 days, or "Never backed up".
- **Persistent storage:** call `navigator.storage.persist()` on first launch, so the browser doesn't clear the data to free up space.
- **Storage warning:** if `navigator.storage.estimate()` shows more than 80% used, show a warning in Settings.

## 10. Offline and updates

- The service worker precaches the app shell and assets, so after the first load everything works offline.
- `registerType: 'prompt'`: when a new version is deployed, show a toast, **"Update available — tap to refresh."** Data in IndexedDB is not affected.

## 11. Error handling

- **Form validation, inline:** name required; interval at least 1; quantity at least 1; weight, length and temperatures must be positive and within sensible limits; humidity 0–100; at least one value in each measurement or habitat entry.
- **Database write failures:** show an error toast and keep the form open with its values. Never fail silently.
- **Photos:** a decode failure shows "Couldn't read that photo." Large images are always downscaled before saving.
- **Import errors:** see §9.
- **Unexpected rendering errors:** a top-level React error boundary shows a friendly screen with **Reload** and **Export backup** buttons, so data can always be saved.

## 12. Testing

- **Unit tests (Vitest), `src/domain/`:** the next-due rules (with and without the override, the refusal rule, no meals yet), status by calendar day (including time-zone and DST edges), calendar marks for a month, age formatting, shed prediction, care task due dates, unit conversions, the "days after meal" count and `.ics` generation.
- **Repository tests (Vitest + fake-indexeddb):** CRUD per table, cascading delete of a pet's logs, schema upgrade, export → import round trip (including photos), and rejection of invalid backups.
- **Component and flow tests (React Testing Library):** add a pet → it appears on Home; log a feeding → the status and next due update; a refusal keeps it due; regurgitation with push-back moves next due; theme switch; import replaces data.
- **Manual iPhone checklist (`docs/iphone-checklist.md`, written during implementation), run before each release:** Add to Home Screen; full-screen launch and icon; offline launch; camera and photo library; Remind me → Calendar; badge; export to Files; import; update prompt; light, dark and auto.

## 13. Deployment

- The Vite `base` is set to `/RepTender/`. The manifest's `start_url` and `scope` are `/RepTender/`.
- The GitHub Actions workflow `.github/workflows/deploy.yml` runs on every push to `main`: `npm ci` → `npm test` → `npm run build` → upload the Pages artifact → deploy.
- The site is served at `https://josephsester.github.io/RepTender/`.
- **Installing on the iPhone:** open that URL in Safari → Share → **Add to Home Screen** → "RepTender".

## 14. Sample data

A "Load sample pets" button, shown only in development builds, seeds the 4 pets from the mockups (Noodle, Ziggy, Basil, Pebble) with a few weeks of history. This makes previewing on `localhost` realistic.

## 15. Open items to confirm during implementation

- Calendar hand-off from the standalone PWA on iOS (§8): verify on the device first.
- Badging API behaviour on the iPhone 17 / current iOS: verify on the device. It's nice to have, not a blocker.
