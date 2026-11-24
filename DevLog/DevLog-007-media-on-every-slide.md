# DevLog-007: Media on every slide, cast portraits

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Status | Delivered for review and committed 2026-11-23; certificate A chosen |
| Repo | photonic-conduct (standalone; the PlayGround folder is stale) |
| Depends on | DevLog-004, DevLog-006, `course/COURSE_SPEC.md` |

## 1. Instructions (verbatim, 2026-11-23)

```text
meanwhile, continue polishing content and slides that lack media, e.g. "Module 0 | Welcome and Course Navigation Meet the people in this course" Should have each button also show the corresponding character with svg or blender or photos/images as needed, probably in the flip card format. Apply similar quality standard and improvements to similar slides that are text only. Every slide should have some form of media. Trainee is normie whos brain only trigger when seeing moving, or colorful, or intruiguing things, or fancy visuals.
```

```text
and remember new work now all happens in the standlaone repo. Write new devlog(s) and track progress properly.
```

## 2. Inventory (2026-11-23, steps with no image, media, widget, video, chat or cards)

| Course | Total | policy slides | bullet slides | checks | reveals | takeaways | ack | refs | reflect | sort |
|---|---|---|---|---|---|---|---|---|---|---|
| ferroelectric | 89 | 15 | 7 | 30 | 8 | 7 | 8 | 7 | 4 | 3 |
| feedback | 90 | 13 | 10 | 34 | 3 | 8 | 8 | 7 | 4 | 3 |

## 3. Decisions

| # | Decision | Why |
|---|---|---|
| D46 | Contract: any step may carry `image: { src, alt, kb }` (photo panel with push-in) or `art: { name, params }` (looping code-drawn canvas panel, `LMS_DRAW.art[name](ctx, w, h, t, params)`, t in seconds). The engine places the panel per step type (split for slides, side for checks / ack / reflect / sort, banner for takeaways and refs) and stacks it on phones; reduced motion draws one still frame; animation stops on step change and pauses with the course | One mechanism for 180 steps; motion is what holds attention |
| D47 | Engine fallback: a step that still has no media shows its chapter cover with a slow push-in, so nothing is ever text-only; the validator warns on every fallback so content lanes can clear them | His rule: every slide has media |
| D48 | "Meet the people": flip cards with Blender portraits of the cast in the same clay character kit as Pat (Gary, Morgan, Dana Okafor), plus the crystal; same treatment in the feedback course if it introduces people | His example; style consistency with the presenter |
| D49 | Art is code-drawn (canvas or SVG), colorful, moving, physically correct when it shows hardware or physics, with minimal labels and no disclaimer wording; photos only from existing licensed media or new Commons / public-domain files with credits; no image generation | Standing rules |

## 4. Lanes

| Lane | Scope | Files |
|---|---|---|
| ENG | `image` / `art` panels on all step types, fallback, validator warnings, spec | engine/*, tools/validate.js, COURSE_SPEC.md |
| CAST | Blender cast portraits and the flip-card people steps | tools/blender/, media/render/, media/avatars (only if asked), the people steps |
| MFE | Media for every ferroelectric step without it | courses/ferroelectric.js, anims/art_fe.js, media/ |
| MFB | Media for every feedback step without it | courses/feedback.js, anims/art_fb.js, media/ |

## 5. TODO

- [x] ENG panels and fallback
- [x] CAST portraits and flip cards
- [x] MFE, MFB media for all listed steps
- [x] Validator shows zero media-fallback warnings; browser sweep of every step
- [x] Certificate variants reviewed (DevLog-006): A chosen

## 6. Progress

- 2026-11-23: inventory taken; stubs `anims/art_fe.js`, `anims/art_fb.js` added and loaded in player.html. Lanes launched.
- 2026-11-23: ENG done. `image` / `art` panels on every slotted type (slides split right 40 percent, checks kc-split, takeaways / refs banner, ack / reflect / sort side, reveal banner), art in CSS pixels on a pre-scaled canvas, t freezes when paused or hidden, reduced motion draws t = 2; chapter-cover fallback with push-in; shared helpers in speech_lines.js; validator errors on unknown art, warns per fallback step. Browser checks 540 with 0 failures. Fallback counts before content lanes: ferroelectric 108 (19 in the exam pool), feedback 115 (22 in the exam pool). Decision: exam questions also get media (his rule: every slide). Content lanes told.
- 2026-11-23: CAST done. Portraits in the clay kit, same set as Pat (900 x 1200, about 18 s each): cast_gary (overalls, glasses on forehead), cast_gary_cleanroom (hood, mask, GARY on the chest), cast_morgan, cast_dana, cast_crystal_ln_wafer (wafer on its flat in a stand, +Z scribed). 'Meet the people in this course' is now flip cards (explore mode, narration per card unchanged, all cards required). Chat avatars for Gary (cleanroom), Morgan and Dana switched to 256 px crops of the renders (old files kept unused). Feedback course has no people intro; left for his call. Script tools/blender/shot_cast.py.
- 2026-11-23: MFB done. All 115 feedback steps (including 22 exam questions) carry looping art: 63 functions in anims/art_fb.js (policy stamp, signature and seal for acks, literature figure carousel for refs, mantra badge for takeaways, Airy / Fresnel / etalon ring-down, Faraday isolator one-way, ring doublet coupled-mode, mode-hop staircase, OSA resolution convolution, reflectometer trace, and more), assigned by an anchored post-pass in feedback.js that throws on ambiguous matches. Validator: feedback media fallback 0. Checked at 4 sizes x 6 times (no exceptions) and in the player at desktop and phone. Note: takeaways show the mantra both as animated banner and as chips.
- 2026-11-23: MFE done. All 107 ferroelectric steps (including 19 exam questions) carry media: 57 art functions in anims/art_fe.js (index ellipsoid with x-cut slab, rotation-test curves, wafer V pi map, eight category scenes, bend TE/TM glow, r33 vs r13 bars, photorefractive shift, pyro dipoles and charge build-up, bias drift, traveling-wave velocity matching, symmetric-model Q, journal-card refs with literature thumbnails, signature and seal acks, mantra banners) plus 2 reused licensed photos; helpers (objectives, takeaways, ack, refs, q, catSteps) take an optional media argument. Validator: ferroelectric media fallback 0.
- 2026-11-23: coordinator check: both validators OK, media fallback 0 in both courses, narration unchanged and fully recorded (1474, 1528); full browser sweep of all 201 steps per course: 0 page errors, 0 failed requests, 0 unrendered math. Nothing committed (commit attempt blocked; waits for his ask).
- 2026-11-23: committed and pushed on his ask. research/certificate_samples (8 review PNGs, 30 MB) left untracked until a variant is picked.
