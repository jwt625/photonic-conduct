# DevLog-008: Catalog index, media backgrounds and status groups

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Status | Delivered for review 2026-11-23 (not committed) |
| Repo | photonic-conduct |
| Scope | `course/index.html` (catalog), its styles in `course/engine/lms.css` |
| Depends on | DevLog-007 (chapter covers), media registries in `course/media/credits_*.js` |

## 1. Instructions (verbatim, 2026-11-23)

```text
improvement:
- the course index page's every course should have filled media/images in the background of the boxes. For coming soon courses, make text grey to further stress it is not implemented yet. Or even create categories on the index page to have completed, in progress, not started, and coming soon ategories. See how applied multiphysics home page is laid out.
```

## 2. Reference: applied-multiphysics landing (`apps/web/src/lib/landing/`)

- Sections per category, each headed by a small uppercase label with a count and a 1px bottom divider; dense card grid under it.
- Cards: image fills the preview area (`object-fit: cover`), title and compact meta under or over it, details in the hover tooltip.

## 3. Plan

| # | Decision | Why |
|---|---|---|
| D50 | Four status sections in his order: Completed, In progress, Not started, Coming soon. Header = uppercase label + count + 1px divider, as on applied-multiphysics. Status from the saved progress (`lms_parody_<id>`: completed step count vs total steps + exam): 100 percent = completed, more than 0 = in progress, else not started. Empty sections stay, with a one-line dim note, so all four categories are always visible | His categories; a first-time visitor would otherwise see only two |
| D51 | Live course tiles: the photo fills the whole tile; the course's chapter covers (first step image of each chapter, `LMS_chapterCover`) cross-fade in order with a slow push-in; a dark gradient veil carries white text. Reduced motion: first cover, still | Same covers as the course start screen; motion |
| D52 | Coming-soon tiles: one existing, already licensed photo per course from the media registry (no new downloads, no image generation), shown greyscale and dimmed; all text grey | His ask: stress that they are not implemented |
| D53 | Every photo shows its registry credit in small type in the tile corner (as in the player); alt text from the registry | CC BY attribution on every page that shows the image |

Coming-soon picks (all in `media/credits_*.js`):

| Course | Photo | Why this one |
|---|---|---|
| PKG-1444 The Adhesive Is an Optical Component | `media/render/sin_microring_lensed_fiber.jpg` | Fiber-to-chip interface |
| PKG-0260 Warpage Is an Alignment Error | `media/fe/card_packaged_chip.jpg` | Die in a ceramic package |
| RF-0443 Your DC Is Not Your RF | `media/render/tfln_probe_station_closeup.jpg` | RF probes on a coplanar electrode |
| MET-0003 Metric Reporting Integrity | `media/fe/sim_lab_notebook.jpg` | Writing results down |
| SIM-0001 Simulation Integrity and Boundary Conduct | `media/fe/sim_screen_from_behind.jpg` | Engineer at a console |
| CAV-0124 Ultrastable Cavity Conduct | `media/fb/fp_sodium_rings.jpg` | Fabry-Perot fringes |

## 4. TODO

- [x] Status sections and counts
- [x] Live tiles: cover cross-fade backgrounds, credits
- [x] Coming-soon tiles: greyscale photos, grey text, credits
- [x] Check light and dark themes, desktop and phone width, each status (seeded progress), reduced motion; no console errors

## 5. Progress

- 2026-11-23: plan written.
- 2026-11-23: built. `index.html` loads `engine/speech_hash.js`, `engine/speech_lines.js` (for `LMS_chapterCover`) and the fe, fb and render credit registries; tiles are grouped into the four sections; live tiles cycle all 8 chapter covers every 7 s (staggered 2.5 s per tile; skipped while the tab is hidden); coming-soon tiles use the photos in the table above, greyscale, with grey text and grey outline tags. Styles in `engine/lms.css` (catalog block before the 820 px media query). Tiles are 300 px minimum height, the veil is clear over the top third so the photo reads, and the text sits on the dark lower part. Start / Resume labels, KPIs and the due date are unchanged; a finished course now shows a green COMPLETE tag instead of the grey one, which was unreadable on a photo.
- 2026-11-23: checked in headless Chromium (Playwright 1.62, review server 47293): fresh progress, one course completed plus one in progress (seeded localStorage), light and dark, 1280 px and 390 px and 360 px, reduced motion. Sections and counts correct (fresh: 0, 0, 2, 6; seeded: 1, 1, 0, 6), KPIs follow (1 completed, 13 percent), every tile has a credit, 0 page errors, 0 failed requests, no horizontal scroll, all tags on one line. Note: Chromium full-page screenshots at phone width drew the lower greyscale tiles blank; a viewport screenshot of the same section shows them correctly (images loaded, opacity 1).
