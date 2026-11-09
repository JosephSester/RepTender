# SDD ledger — plan: docs/superpowers/plans/2026-11-08-reptender-plan-3-reminders-backup.md

Spec: docs/superpowers/specs/2026-11-08-reptender-design.md
Branch: feat/plan-3-reminders-backup (from main fb42edb)

## Pre-flight scan
Plan author applied all 11 tasks' code in order to a fresh clone of main (4f83d8c) in %TEMP%: each RED step failed as described; tsc + full suite green after every task; final 374 tests / 75 files passed 4 consecutive runs with no act() warnings or unhandled errors; build clean (no chunk warning); localhost browser run verified toast, crash screen, export, and a real-Blob photo export→import round trip (byte-identical). That run found and folded in an updateSettings atomicity fix (Task 2).

| Pair / task | Finding |
|---|---|
| T3 ics ↔ T4/T5/T6 builders/delivery | consistent (validated) |
| T6 useScheduleSources ↔ T7 badge | consistent (validated) |
| T8 backup data layer ↔ T9 UI ↔ T10 error boundary export | consistent (validated) |
| T11 crash-test route ↔ T10 | consistent (validated) |
| Each task self-consistency | validated by execution |

Ruling: accept the plan author's spec-ambiguity resolutions (UTC events, vet UID by visit id, 09:00 default for untimed care, skip past occurrences, two-tap export for iOS share user-activation, data-URL photos, schema-1 import migration, restored lastBackupAt = exportedAt, badge = Schedule open items, Reload returns to Pets, Calendar fallbacks) — consistent with spec intent and validated — cost if wrong: targeted follow-up edits.
Ruling: `#/crash-test` route ships in production (needed for the iPhone checklist); it only throws inside the error boundary — cost if wrong: a hidden route a user is unlikely to visit.

## Progress
Task 1: complete (commits fb42edb..e44bea7, review clean)
Task 1: minor (deferred, CARRY to Task 8): formatMoney $NaN/negatives — guard with Number.isFinite before import brings odd values
Task 1: minor (deferred): intervalProgress NaN on invalid due (bar width NaN%); no legacy >365 pet test; save error doesn't name field
Task 2: complete (commits e44bea7..79a2f15, review clean)
Task 2: minor (deferred): units/theme failure alerts untested; inline marginBottom
Task 3: complete (commits 79a2f15..d7f2798, review clean)
Task 3: minor (deferred, final-review candidate): fold test doesn't straddle a multi-byte char at 75 bytes; lone \r not escaped (/\r\n|\r|\n/); care invalid-due branch untested; '' clinic doesn't fall back; misleading test comment
Task 4: complete (commits d7f2798..734518e, review clean)
Task 4: minor (deferred, final-review candidate): RemindToast error message cleared in same commit (dead error path); cancel hides toast; revoke/disabled/timer tests missing; live region inserted populated; deliver tests leave 60s timers
Task 5: complete (commits 734518e..8ce43f8, review clean)
Task 5: minor (deferred): error/cancel/double-tap paths untested; care error shows at top of long list; import order; redundant guard
Task 6: complete (commits 8ce43f8..9696537, review clean)
Task 6: minor (deferred): alert failure path untested; stale success note; Settings test uses real clock; duplicate live queries in Settings
Task 7: complete (commits 9696537..3398ffc, review clean)
Task 7: minor (deferred, CARRY to Task 10): AppBadge mounted at app root — ensure Task 10's error boundary wraps it (a throwing live query must not blank the app)
Task 7: minor (deferred): dedupe/tick paths untested; permission-rejected badge not retried until count changes
Task 8: review — Important (plan-mandated): nested null inside habitatTargets (and sire/dam) passes validation and is stored → Habitat shows all readings high, setup sheet can't save
Ruling: fix #1 despite plan text (spec §9: validate before write; corrupt restored data) and fold #2 (TABLE_NAMES == db.tables guard test), #5 (v1 habitatTargets null → default like Dexie upgrade), #6 (data URL MIME must be image/*), #7 (encode photos sequentially to cut iPhone peak memory) — data-safety/robustness, cheap — cost if wrong: small diff
Task 8: minor (deferred): iso accepts non-canonical ISO forms; unknown extra fields stored verbatim; round-trip test spot-checks only (thumbBlob, vet photo, regurgitations)
Task 8: fix round 1/5 (5 addressed, 0 open — nested null cleaning, table guard, v1 null default, image/* only, sequential encode; commits 7b9dba3..281df90)
Task 8: complete (commits 3398ffc..281df90, review clean)
Task 8: minor (deferred, final-review candidate): restrict photo MIME to jpeg/png/webp/gif (svg allowed today, inert in <img>)
Task 9: complete (commits 281df90..b86a6c5, review clean)
Task 9: minor (FINAL-FIX: CI race risk): BackupSettings "stays hidden below that" test is vacuous and its estimate state update can land after the test ends (same class as the Plan 2 CI failure); cancelled-share test doesn't await the rejection
Task 9: minor (deferred): markBackedUp/restore-failure alerts + ref guards untested; stale prepared snapshot; hidden file input not keyboard/VoiceOver reachable; large-file parse on main thread; inline marginTop hack
Task 10: complete (commits b86a6c5..5c0f913, review clean)
Task 10: minor (deferred): reloadHome untested; persist() sync throw not caught; boundary doesn't catch async/handler errors (by design)
Task 11: complete (commits 5c0f913..edbfcff, review: code clean)
Task 11: Important (plan-mandated, FINAL-FIX docs): checklist item 24 can't be done in standalone app (no address bar; Safari has separate data) → reword to run in Safari, explain it tests screen + file hand-off not real data; item 18 Fallback B wrong item number + Safari will also share-sheet; item 23 non-backup file must be a .json (accept filter greys out photos/PDF)
Controller browser check (localhost): Settings shows Units + Reminders & data + Never backed up (amber); units → oz updates Weight screen (1.5 oz); Export backup prepares file (8 KB) — not saved; #/crash-test shows the error screen with Reload + Export backup; no horizontal overflow (scrollWidth == innerWidth).
Final review: With fixes — 0 Critical, 1 Important (one unreadable photo aborts the whole backup incl. crash-screen export, backup.ts:84-87 → skip unreadable photos, re-prune references, report count)
Ruling: final fix wave = Important + final-review "fix now" triage + queued FINAL-FIX items (BackupSettings test race; checklist items 18/23/24 wording) — one dispatch — cost if wrong: small diff
Final fix wave: commits edbfcff..4eb5312 — re-review: all findings addressed (394 tests). Deferred (can wait): final-review M4–M10, M12.
Deploy: run 42554586078 success (4eb5312); live bundle matches local build.
