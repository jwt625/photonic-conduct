# DevLog-006: Downloadable completion certificate

| Field | Value |
|---|---|
| Date | 2026-11-23 |
| Status | In progress: design variants for his review |
| Depends on | DevLog-004, DevLog-005; `course/COURSE_SPEC.md` |

## 1. Instructions (verbatim, 2026-11-23)

```text
fix it. Also from now on the playground repo folder is stale and all new work continues in the standalone repo.
Also, at the end when the trainee pass the course, it should get a downloadable certificate, with flamboyant font and wording and autofill from their name filled earlier from the course material printed. Add proper frame and elements to the certificate to make it look authentic. The topic being so specific and unhinged should be a clear enough sign this is parody. Pat Reynolds prints her name and role and signs the certificate. Make few versions for me to review and confirm.
```

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D44 | All new work happens in this repo; the PlayGround folder is stale. Review server on port 47293 now serves `photonic-conduct/course` (tmux `compliance-training`, `uv run --no-project python -m http.server`) | His instruction; uv-only rule |
| D45 | Certificate drawn in code (SVG), fonts vendored (OFL, woff2) so it works offline; name autofilled from the acknowledgement step (`state.name`); Pat Reynolds printed name, role and a code-drawn signature; download as PNG (US Letter landscape at 300 dpi) plus print / save as PDF; several design variants on a review page before wiring one | His instruction; offline no-build |

## 3. TODO

- [ ] Variants and review page (`research/certificate_samples/`)
- [ ] His pick
- [ ] Wire the chosen design into the certificate step, download and print verified

## 4. Progress

- 2026-11-23: README and DevLog-002 now use `uv run` for the local server; review server moved to this repo under uv. Plan written.
