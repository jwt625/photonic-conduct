# DevLog-009: Ferroelectric course timelapse montage

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Status | Delivered, awaiting review |
| Repo | photonic-conduct |
| Scope | New `course/tools/montage/` (capture and assembly scripts); output video in `outputs/montage/` (untracked) |
| Depends on | Engine as of DevLog-008 (`course/engine/player.js`), course `course/courses/ferroelectric.js` |

## 1. Instructions (verbatim, 2026-11-23)

```text
inspect repo. I want a ~1 min montage of the ferroelectric and crystal orientation training course material, by going thru the full course (all interactions and wrong options and right options for the quiz) as timelapse. Can you do it? Keep output frame rate and encoding as usual and web/mobile compatible
```

## 2. Course inventory (FE-0042, from `courses/ferroelectric.js`)

8 chapters, 188 steps: slide 47, check 34, chat 32, photo 10, reveal 10, video 11 (310 s), ack 8, takeaways 7, refs 7, widget 5, cards 4, hotspots 4, reflect 4, sort 3, spot 2. Inside them: 37 popup questions, 37 stages, 148 check options, 38 tabs, 22 hotspots, 17 cards, 6 spot targets, 24 sort items. Final assessment: 10 questions drawn from a pool of 19 (3 options each), pass 80 percent, then result, certificate, disclaimer.

## 3. Plan

| # | Decision | Why |
|---|---|---|
| D54 | Drive the real learner page (not dev mode) with Playwright, served on a free port under a non-dev hostname (`--host-resolver-rules`), so no DEV badge, dev links, shot notes or path overlays appear | The montage shows what a learner sees |
| D55 | Narration is fast-forwarded, not skipped: Playwright fake clock, recorded clips and browser speech disabled so the engine falls back to its timed captions, then `clock.fast_forward` jumps until each gate opens (`run_for` only for short animations). Captions and progress ring still appear | 100 min of narration cannot be waited out; gating stays real |
| D56 | Interactions: every check gets every wrong option first, then the right one; popup questions alternate wrong / right (one pick each, engine rule); cards choose: wrong cards then right; hotspots, tabs, cards explore, stages, chat taps all opened; spot: one miss then every target; sort: each item dropped in a wrong category first, then the right one; reflect answered and submitted; ack name + tick; widgets driven to completion with slider sweeps; exam: two questions answered wrong first (80 percent, pass), the rest right first | His ask: all interactions, wrong and right options |
| D57 | Capture = one screenshot per visual event at 1920x1080 (1440x810 CSS px at 4/3 scale), JPEG; assembly = ffmpeg concat with per-shot hold, scaled to about 60 s, 30 fps, H.264 yuv420p + silent AAC stereo + faststart | His standard encode; silent track for player compatibility |
| D58 | Learner name on the acknowledgments and certificate: "Gary M." (the course's fictional engineer) | No real name in a video that may be shared |

## 4. TODO

- [x] Capture script `course/tools/montage/capture.py`, pilot on the first module
- [x] Full capture, shot log JSONL
- [x] Assembly `course/tools/montage/assemble.py`, about 60 s
- [x] Verify: ffprobe, contact sheet of sampled frames
- [ ] Remove the capture frames (kept in the session scratchpad until he approves the pacing, so a re-cut needs no recapture)

## 5. Progress

- 2026-11-23 21:20 Pilot (12 steps): learner chrome, captions, wrong/right states, popups, animatics all render.
- 2026-11-23 21:27 First full run used `clock.run_for` for waits: every timer and animation frame fired (60 canvas redraws per simulated video second), about 6 s per step. Stalled at the first sort step: placed chips move in the DOM, so the n-th `.sr-item` was the wrong chip. Fixed with `[data-i]`; stuck gates now raise instead of waiting.
- 2026-11-23 21:33 Waits switched to `clock.fast_forward` (each due timer fires once per jump), shorter settle delays: 27 steps in 69 s (was about 5 min). No benchmark had been run before the first full run; lesson recorded.
- 2026-11-23 21:39 Run crashed in the pyroelectric widget: its pulsing hint moves to the next slider on first touch, so a `.hint` selector lost its element mid-sweep. Sliders are now bound once by a data attribute.
- 2026-11-23 21:49 Full run clean: 201 steps (188 course steps, 10 exam questions, result, certificate, disclaimer), 1229 shots, about 8.5 min wall time. Exam: 2 questions wrong first, 80 percent, passed.
- 2026-11-23 21:50 Assembled: `outputs/montage/fe0042_course_timelapse_2026-11-23.mp4`, 60.00 s, 1920x1080, 30 fps, 1800 frames, H.264 High yuv420p + AAC LC 48 kHz stereo (silent), faststart, 30.6 MB. Bookend holds fixed (catalog 1.0 s, start 0.8 s, result 0.8 s, certificate 2.5 s, disclaimer 0.8 s); the rest rescaled from per-kind weights: 945 shots get 1 frame, 159 get 2, 120 get 3 (about 20 shots per second).

Rebuild:

```sh
uv run --no-project --with playwright==1.65.2 python course/tools/montage/capture.py --out <dir>
uv run --no-project python course/tools/montage/assemble.py --cap <dir> --out outputs/montage/<name>.mp4 [--seconds 60]
```
