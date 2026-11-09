# SDD ledger — plan: docs/superpowers/plans/2026-11-08-reptender-plan-2-husbandry.md

Spec: docs/superpowers/specs/2026-11-08-reptender-design.md
Branch: feat/plan-2-husbandry (from main d5fb9d7)

## Pre-flight scan
The plan author applied every task's code in order to a scratch copy of main: after each of the 14 tasks `tsc --noEmit` was clean and the full suite passed; final `npm run build` OK and the suite passed 4 consecutive runs (277 tests / 53 files). This is stronger than a read-only scan for cross-task produce/consume consistency.

| Pair / task | Finding |
|---|---|
| T2 (schema v2, units, combineDateTime, useUnits) ↔ T3–T14 | consistent (validated by sequential application) |
| T3 shared Field/DateTimeFields/SheetHeader ↔ T4–T10 | consistent (validated) |
| T4 subScreen.tsx ↔ T5–T10 | consistent (validated) |
| T11 profile tiles ↔ T4–T10 routes | consistent (validated) |
| T12/T13 tabs ↔ Plan 1 TabBar TABS | consistent (validated) |
| T14 deploy hand-off | implementer commits only; controller merges/pushes |
| Each task self-consistency | validated by execution |

Ruling: accept the plan author's spec-ambiguity resolutions (Pet.inBlueSince, completion semantics, rounding, limits, light late-text #AB3528, Add tab as routed screen, etc.) — they follow the spec's intent and were validated in code — cost if wrong: targeted follow-up edits.
Ruling: dispatch one task per implementer (tasks are each a screen with own tests); no batching except where noted.

## Progress
Ruling: accept commit trailers naming the model that actually wrote the code (subagents' own attribution reminder) instead of amending — accurate attribution, no functional effect — cost if wrong: cosmetic trailer text
Task 1: complete (commits d5fb9d7..02fdd9b, review clean)
Task 1: minor (deferred): archivedAt parse unguarded on Home; Unarchive failure uses window.alert; onPhoto error doesn't re-focus; showArchived stays expanded
Task 2: complete (commits 02fdd9b..c5aaaf7, review clean)
Task 2: minor (deferred, CARRY to Task 8): formatTimeOfDay throws on non-HH:mm → return '' when !isTimeOfDay
Task 2: minor (deferred, CARRY to Tasks 6/7): useUnits returns new object each render → useMemo if a form pre-fills in useEffect([units])
Task 2: minor (deferred): upgrade test doesn't query v1 indexes; deletePet test gaps; roundTo half-rounding; parseOptionalNumber accepts hex/exp
Task 3: complete (commits c5aaaf7..e99fcc5, review clean)
Task 3: minor (deferred, final-review candidate): regurg preview should use nextFeedingDue with override (backdated edge); no inline reason when Save disabled (cleared found date / bad days); aria-label hides "already logged"; small touch targets .thumb-remove 24px/.check 28px
Task 4: complete (commits e99fcc5..aabcaf6, review clean)
Task 4: minor (deferred, final-review candidate): one-tap "Log poop now" no double-tap guard; one-tap uses useNow (≤60s stale) instead of new Date(); invalid at would crash (import path); PetNotFound h2 without h1; future poop shows "today"
Task 5: complete (commits aabcaf6..a69ec9e, review clean)
Task 5: minor (deferred): no test for double-tap guard; in-blue mark hidden if sheds drop below 2; pre-filled in-blue date can conflict with earlier shed date; bare "Delete" buttons lack per-row aria-label (applies to all history lists); same-day sheds → 0-day gap
Task 6: complete (commits a69ec9e..0acbb12, review clean)
Task 6: minor (deferred): same-day entries unstable order in list; "1 entries" plural; chart has no y values / a11y values; date without year under big number; future entries accepted
Task 7: complete (commits 0acbb12..c6ef79d, review clean)
Task 7: minor (deferred, final-review candidate): one-sided targets → degenerate gauge (±1 scale) and no sparkline band; future/stale reading shown as current; type=number unparseable '' could clear a target in setup sheet; no delete UI for readings; unused now prop; test gaps
Task 8: complete (commits c6ef79d..4abf020, review clean)
Task 8: minor (deferred, FINAL-FIX candidate): iOS type=time has no clear control → add "Clear" next to optional time fields (care timeOfDay; check vet next-appointment time too)
Task 8: minor (deferred): no upper bound on intervalDays (cap e.g. 3650); "For" label duplicated; global .chip cursor default; suggestion-chip guard untested
Task 9: review — Important (plan-mandated): telHref merges extension digits / keeps mid-string + / dead tel: for no digits
Ruling: fix telHref despite plan text (wrong number dialed = real user harm) and fold Minor #1 (cancel during in-flight save can delete photos a saved visit references — data integrity) — cost if wrong: small diff
Task 9: minor (deferred): unmount orphans added photos; Add photos label not keyboard-focusable; negative cost message; cost not 2-decimal; untested guards; same-day visit order; generic photo error for quota; no reason when Save disabled
Task 9: fix round 1/5 (2 addressed, 0 open — telHref extension/plus/no-digit; cancel no-op while saving; commits 2d0a1b8..691566b)
Task 9: complete (commits 4abf020..691566b, review clean)
Task 9: minor (deferred): "(+44)" / "Tel: +44" lose the +; vanity numbers with x cut early
Task 10: complete (commits 691566b..b53d42d, review clean)
Task 10: minor (deferred): same-at notes unordered (createdAt tiebreak); edit rewrites at to minute; cancel guard untested
Task 11: complete (commits b53d42d..b7edd0a, review clean)
Task 11: minor (deferred): duplicate local plural in PetProfile; Weight tile shows length when no weight; usePetHusbandry no error path (blank profile on rejection)
Task 12: complete (commits b7edd0a..c0ccfab, review clean)
Task 12: minor (deferred): guard/uncheck/error path untested; day-7/8 boundary + override + timeOfDay untested; aria-pressed misused on feeding rows; Coming up not a heading; O(tasks×completions)
Task 13: complete (commits c0ccfab..f70a146, review clean)
Task 13: minor (deferred): global .chip cursor:default in profile.css; multi-pet add-new-pet link / pet switch untested
Task 14: complete (commits f70a146..0e775b6, review clean)
Task 14: minor (deferred): today's sample habitat reading can be future-stamped before 08:15 (dev-only); Load twice duplicates (dev-only)
Controller browser check (localhost, existing Plan 1 v1 data): v1→v2 upgrade preserved all pets/feedings/override; tabs Pets/Schedule/Add/Settings; profile Quick log + Husbandry tiles render (dark); Weight entry 42 g/18 in saves, chart + list update; Schedule today/coming-up correct. Note: a stale Vite process (my Plan 1 dev server's child) caused a misleading overlay — killed; not an app bug.
Final review: With fixes — 0 Critical, 3 Important (I1 iOS optional time/date fields can't be cleared — care timeOfDay, shed inBlue (prefilled, can block save); I2 huge day counts: 9-digit care interval saved → Schedule crashes; 9-digit push-back crashes regurg sheet while typing; I3 v1→v2 upgrade not rehearsed in real browser + no checklist line). Fix-now from ledger: Log poop now double-tap guard + tap-time, 28px .check tap area, care interval cap.
Controller note on I3: rehearsed in real Chromium IndexedDB with Plan 1 v1 data — upgrade preserved everything (see browser check line). Still add an iPhone checklist line.
Ruling: final fix wave = I1, I2 (caps + crash guards), I3 checklist line, poop guard/tap-time, .check ≥44px tap area — one dispatch — cost if wrong: small diff
Final fix wave: commit 903e755 — re-review: all findings addressed (291 tests)
Final: carry to Plan 3: cap pet feedingIntervalDays (Plan 1 field) and guard statusLabel for overflowed dues; main chunk 506 kB warning (code-split later)
Deploy: first run failed (CI-only test race: SettingsScreen sample-load test ended before loadSampleData finished → setState after jsdom teardown); fixed in 4375284 (test waits for load to finish + try/finally); run 42544887979 success; live.
