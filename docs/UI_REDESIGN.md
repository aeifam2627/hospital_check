# Mobile redesign, November 2026

The current visual system is documented in `design-system/hospital-daily-inspection/MASTER.md`. It supersedes the old green-card direction in DESIGN.md. Noto Sans Thai is bundled, not merely named as a font fallback.

History timestamps use Asia/Bangkok and a full Buddhist year. An absent legacy timestamp previously passed through `new Date(null)` and displayed 1 January 2513. `recordedTime` now explicitly handles missing/invalid timestamps and preserves work dates independently.

Emergency catalog repair reads only columns A–C of inventory rows 2–41 in the supplied Excel workbook. Run `node --env-file=.env.local scripts/sync-emergency-catalog.mjs` to inspect the report, and add `--commit` to reconcile the five shelf groups and confirmed standards. It retains historical variants and uses 2026-11-10 as the cutover date. Standard values encoded as Excel dates remain pending confirmation. Unspecified source units are called “หน่วย”, not guessed clinical units.
