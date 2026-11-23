# Photonic Conduct

A parody of corporate compliance training (the harassment and cybersecurity kind) for niche photonics pitfalls. The fictional Five Sigma Photonics Learning Center runs two narrated, interactive courses in a mock learning-management system: crystal orientation and charge conduct for lithium niobate, and zero tolerance for unsolicited optical feedback into lasers. The jokes are corporate; the physics, numbers and citations are real.

Live: https://outside5sigma.com/photonic-conduct/

## Courses

| Code | Title | Modules |
|---|---|---|
| FE-0042 | Ferroelectric Workplace Conduct and Crystal Orientation Awareness | Crystal Orientation Awareness; Sources of Orientation Misconduct; Respecting Boundaries: Mode Conversion in Bends; Photorefractive Conduct; Pyroelectric Awareness; Bias Point Retention; Simulation Integrity; final assessment |
| FB-1550 | Feedback, Reflection and Zero Tolerance for Retaliation in the Optical Workplace | Recognizing Unsolicited Feedback; Every Interface Is a Cavity; Classifying Unsolicited Feedback; Mode Hop Awareness; Reciprocity Is Not Optional; Backscatter in High-Q Resonators; Your Instruments Are Averaging; final assessment |

Each course has 188 steps, recorded narration for every spoken line (Kokoro-82M, about 100 and 84 minutes), and a certificate at the end.

## Features

- Incident videos and cold opens drawn in code (microscope-style chip views, traveling-wave modulator, flip-chip lasers, isolators), one frame with simulated RF field lines and optical modes.
- Interactive activities backed by real models: a full-vector anisotropic mode solver sweep for x-cut lithium niobate (TE/TM anticrossing versus propagation angle), photorefractive and thermal resonance sweeps, bias drift, pyroelectric charge, electro-optic tensor rotation, parasitic etalons, Lang-Kobayashi mode hops, and backscatter doublets.
- Scenario chats in several messaging and email styles, OK / not OK popups, click-to-reveal stages, drag-and-drop sorting, reflection prompts, and knowledge checks.
- A Blender-rendered presenter with animated talking loops, Blender product renders, licensed photos, and literature figures (CC BY crops or redrawn) with citations.
- Math rendered with KaTeX; all media credits, licenses and disclaimers on one page after the certificate.

## Run locally

Static, no build. Serve the repository root and open `course/index.html`:

```sh
python3 -m http.server 47311
# http://127.0.0.1:47311/course/index.html
```

Opening `course/index.html` from disk also works. Add `&dev=1` to a player URL (for example `course/player.html?c=ferroelectric&dev=1`) for dev mode: unlocked navigation, a step list and voice toggles. Dev mode is honored only on localhost and file://.

## Layout

- `course/` the site: `index.html` (course catalog), `player.html`, `engine/` (player, styles, speech, chat skins, sound, KaTeX), `courses/` (course content), `widgets/` and `anims/` (interactive activities and drawn videos), `media/` (photos, renders, literature figures, credits registries), `audio/` (narration clips and manifest).
- `course/tools/`: `validate.js` (schema and content checks), `tts/` (narration build), `blender/` (renders), `modesolver/` (anisotropic mode solver and sweep), `fields/` (RF and optical field solve), `lit/` (figure crops and redraws), `widgets_src/`, `sound/`, `avatars/`.
- `course/COURSE_SPEC.md`: the content and engine contract.
- `DevLog/`: development log. `research/`: planning, audits and reference notes.

Checks: `node course/tools/validate.js course/courses/ferroelectric.js` (and `feedback.js`). Narration: `uv run --no-project --with kokoro-onnx --with pyloudnorm python course/tools/tts/build_audio.py` from `course/` (skips existing clips).

## Deploy

GitHub Pages from `main`, repository root, served at `outside5sigma.com/photonic-conduct/`. The root `index.html` forwards to `course/index.html`. All links are relative.

## License

Code: GPL-3.0 (see `LICENSE`). Photos, figures, music and other third-party media keep the licenses listed in `course/media/credits_*.js` and on the course's final Disclaimer and Media Credits page.
