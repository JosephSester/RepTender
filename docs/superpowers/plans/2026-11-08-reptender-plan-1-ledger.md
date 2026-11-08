# SDD ledger — plan: docs/superpowers/plans/2026-11-08-reptender-plan-1-foundation.md

Spec: docs/superpowers/specs/2026-11-08-reptender-design.md
Branch: feat/plan-1-foundation (from main f0551cd)

## Pre-flight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T13 | T1 tsconfig types include vite-plugin-pwa/client; T13 adds VitePWA | consistent (pkg installed in T1) |
| T1 ↔ T7 | T1 App.test expects heading "RepTender"; T7 replaces App + App.test | consistent (T7 replaces both) |
| T1/T5/T6 ↔ T13 | main.tsx CSS imports added in T5, T6; T13 rewrites full main.tsx incl. all 3 imports | consistent |
| T12 ↔ T13 | T12 adds `define` to vite.config; T13 full vite.config includes same define | consistent |
| T2 ↔ T4 | pushBackOverride(Date, pet, days) used by feedings.ts | consistent |
| T4 ↔ T7..T12 | repo signatures (createPet, logFeeding w/ regurgitated, listFeedings oldest-first) | consistent |
| T6 ↔ T8/T11 | MonthCalendar props (size, dayIcon, onSelectDay, selectedKey) | consistent |
| T7 ↔ T8 | TONE exported from PetsHome, imported by PetProfile | consistent |
| T7 ↔ T10 | T10 adds useState to PetsHome; must precede early return | plan states it explicitly |
| T8 ↔ T10 | T8 PetProfile has `children` slot; T10 removes it and adds Log button | consistent (T10 says remove) |
| T9 ↔ T8 | Edit link (T8) → route added in T9 | consistent |
| T13 steps 12–14 | push to main, enable Pages, iPhone checklist | conflicts with working on a feature branch — see ruling |
| Each task self-consistency (T1–T13) | tests vs code checked during authoring | no conflicts found |

Ruling: Task 13 implementer does steps 1–11 and commits on the branch; the controller performs the merge to main, push, Pages enablement and deploy watch at finish — user authorized building the whole thing; deploy needs main — if wrong, the branch just gets pushed/merged later by the user.
Ruling: Step 14 (iPhone checklist) is left for the user — it needs the physical phone — cost: none.

## Progress
Task 1: complete (commits f0551cd..9d21e97, review clean)
Task 1: minor (deferred): caret ranges in package.json (lockfile pins exact) — plan-mandated npm install behavior
Task 1: minor (deferred): EBADENGINE jsdom@31 wants node >=24.15, local 24.13 (CI uses latest 24)
Task 1: minor (deferred): npm audit 6 low/moderate in dev tree
Ruling: Tasks 2 and 3 dispatched as one batch (both pure domain transcription with full code) — saves a dispatch/review cycle — cost if wrong: one larger review
Task 2+3: complete (commits 9d21e97..027efe6, review clean)
Task 2+3: ⚠️ resolved: override clearing on 'ate' lives in Task 4 logFeeding (plan code clears nextFeedingOverride) — verified in plan text
Task 2+3: minor (deferred): no DST-crossing test cases (spec §12 asks for TZ/DST edges)
Task 2+3: minor (deferred): intervalProgress end<=start branch untested
Task 2+3: minor (deferred): atTime('') → Invalid Date; formatAge future/bad date → negative/NaN — forms must validate
Task 4: complete (commits 027efe6..260d630, review clean)
Task 4: minor (deferred, relevant to Task 11): deleteFeeding/updateFeeding don't recompute nextFeedingOverride; editing ate→refused leaves linked regurgitation
Task 4: minor (deferred): rollback test asserts only feedings count; updatePet doesn't trim name/species; archivePet/updateFeeding silent on missing id; at/foundAt ISO not validated; listRegurgitations unordered; getSettings returns shared DEFAULT_SETTINGS object; addFoodItem check-then-add race
Ruling: Tasks 5 and 6 dispatched as one batch (theme + UI kit, full code in plan, no shared logic beyond CSS imports in main.tsx) — fewer cycles — cost if wrong: larger review
Task 5+6: complete (commits 260d630..6be09cd, review clean)
Task 5+6: minor (deferred, final-review candidate): dark-mode contrast — white text on --late-text (#F09A8A) / amber fills ~2:1 (is-regurgitated, cal-x, is-nextDue, banner)
Task 5+6: minor (deferred): Sheet lacks focus trap/restore and body scroll lock; window Escape closes all stacked sheets
Task 5+6: minor (deferred): Segmented no roving tabindex/arrow keys; small tap targets (cal-head buttons, 32px compact days); month change not announced; usePhotoUrl revoke-before-set flicker; theme-color meta ignores explicit pref; thin tests (Sheet backdrop, ThemeSync auto, usePhotoUrl, calendar classes)
Task 7: complete (commits 6be09cd..a7ec77f, review clean)
Task 7: ⚠️ real-browser render unverified — controller will check in the preview pane after Task 12 (sample data)
Task 7: minor (deferred): useNow ignores changed `fixed`; live query re-runs N+1 per minute; App(HashRouter+ThemeSync) untested; test gaps (bannerLine, no-banner case, never-fed pet)
Task 8: complete (commits a7ec77f..d9a31be, review clean)
Task 8: minor (deferred): obscure "Every day" regex; empty muted div in From card; price not currency-formatted; inline styles; calendar month not advanced past midnight; nav test checks heading only
Task 9: review — Important #1 (plan-mandated): createImageBitmap(file,{imageOrientation:'from-image'}) may throw on iOS Safari → every photo fails
Ruling: fix #1 despite plan text — spec §5.16 + user's explicit photo requirement outrank the plan's code — cost if wrong: a few extra lines of fallback code
Task 9: minor (deferred): orphan photo rows on cancel/re-pick; sire/dam petId dropped on edit; updatePet/toInput don't trim; createPet lets undefined usualFeedTime override default; edit-save replace history; alert not scrolled into view; PNG transparency→black, bitmap not closed on error, double decode, hidden input not keyboard reachable; getPet effect unhandled rejection; negative price message; test gaps
Task 9: note for Plan 2: form lacks enclosureLabel, habitatTargets, parent petId link — Plan 2 habitat work must add editing of enclosure label + targets
Task 9: fix round 1/5 (1 addressed, 0 open — Safari-safe decodeImage fallback; commits 03d0b9c..37919d5)
Task 9: complete (commits d9a31be..37919d5, review clean)
Task 9: minor (deferred): plain createImageBitmap fallback may skip EXIF orientation on some engines — check with a portrait iPhone photo
Task 10: review — Important #1 (plan-mandated): clearing Date/Found date → Invalid Date → format() throws in render → white screen
Ruling: fix #1 despite plan text (spec §11: forms must not fail; a crash loses user input) and fold in minor #2 (clear stale error on submit) since same lines — cost if wrong: small extra diff
Task 10: minor (deferred): preview vs save disagree on bad push-back value; orphan custom food if logFeeding fails; refusal test doesn't assert override untouched; no error-path/PetProfile-button tests
Task 10: fix round 1/5 (2 addressed, 0 open — invalid-date guard, stale error; commits a588876..7f0fa42)
Task 10: complete (commits 37919d5..7f0fa42, review clean)
Task 10: minor (deferred): no inline reason when Save disabled; cleared Time silently → midnight
Ruling: Task 11 also fixes Task 4 deferred minor (deleteFeeding leaves push-back override; editing ate→refused leaves linked regurgitation) because Task 11 exposes edit/delete in the UI — spec §7 rule 4 — cost if wrong: small extra repo logic + tests
Task 11: complete (commits 7f0fa42..4079108, review clean)
Task 11: minor (deferred): deleteFeeding unhandled rejection in UI; silent regurg removal on edit→Refused; generic error on cleared date in edit sheet; editing meal time doesn't move regurg/override; confirm spy not restored; missing tests (refused edit + unrelated override)
Task 12: complete (commits 4079108..5d2526f, review clean)
Task 12: minor (deferred): updateSettings promise dropped; loadSampleData no try/finally + duplicates on re-click (dev-only); __APP_VERSION__ relies on npm script env; node types global in src; no test for DEV=false gating
Task 13: complete (commits 5d2526f..02bc6d9, review clean)
Task 13: minor (deferred): cancel-in-progress true on pages group; pages/id-token perms workflow-wide; persist() no catch; no periodic SW update check; hard-coded 76px prompt offset
Controller browser check (localhost, sample data): Home, profile calendar, Log feeding Regurgitated (day red, next due +10), dark mode all render correctly — Task 7/10/12 ⚠️ manual checks resolved
Controller finding (Important, for final fix wave): `.switch` checkbox inside `.field` is stretched by `.field input { flex: 1 }` → wide green bar with knob drawn at the "off" position while checked (Log feeding push-back switch; PetForm "Birth date is approximate"). Fix: `.field input.switch { flex: none; width: 46px; }` (or equivalent).
Final review: With fixes — 0 Critical, 4 Important (I1 iOS input zoom 15px; I2 Archive no confirm + no way back; I3 contrast white-on-amber/salmon + light banner; I4 logFeeding clears push-back even for backfilled older meal). Ledger fix-now: contrast (=I3), PetForm error scroll-into-view. Carry to Plan 2: editing pet drops sire/dam petId link.
Ruling: final fix wave = I1–I4 + PetForm alert scroll + controller's .switch stretch bug, in ONE dispatch — spec §11 / user-facing correctness — cost if wrong: small CSS/logic diff
Final fix wave: commits 02bc6d9..91cbbd7 (I4 backfill rule, archive confirm + alert focus, 16px fields/contrast/switch width); 101 tests pass
Controller browser check after fixes: switch renders as 46px toggle (on), dark next-due day readable
Final: minor (deferred): light-mode refused-day text 4.49:1 (just under 4.5); dark banner gradient darkened (#9f6220→#8a4519)
Final re-review: I1, I2, I4, switch ADDRESSED; I3 partially (banner subline opacity 0.9 → ~3.96–4.35:1); alert repeat-failure gap (Minor)
Ruling: park I3 residual (banner subline opacity) and alert repeat-failure gap; fix as first items of Plan 2 — no second fix wave per process, both cosmetic/minor, no data or crash risk — cost if wrong: slightly faint subtitle text on the banner until Plan 2
Final: minor (deferred to Plan 2): scrollIntoView mock not restored in finally; regurgitated backfill can shorten active push-back; updateFeeding refused→ate doesn't re-apply newest-meal rule; add "no zoom on text field" to iphone-checklist
Plan 1: merged to main 91cbbd7, deployed (run 42522174147 success), live https://josephsester.github.io/RepTender/
