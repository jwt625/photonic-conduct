# DevLog-005: Standalone spin-off and Pages deploy

| Field | Value |
|---|---|
| Date | 2026-11-22 |
| Source | PlayGround `20261122_photonics_compliance_training` at commit 5476f49 (plus 08ae6fd, a DevLog redaction) |
| Repo | github.com/jwt625/photonic-conduct |
| Live | https://outside5sigma.com/photonic-conduct/ |

## Decisions (his answers, 2026-11-22)

- Name `photonic-conduct` (repo, local folder and URL subroute).
- Agent creates the public repo; GPL-3.0 for code; third-party media keep their listed licenses.
- PlayGround folder frozen; this repo is canonical from here on. Internal corpus-mining notes (`research/mine_*.md`) are not published.
- Listings: PlayGround readme (committed and pushed) and blog timeline (local edit only; he pushes the blog with other work).

## What changed in the copy

- Fresh history: `git archive` of the committed PlayGround folder, one initial commit.
- Added root `index.html` (forwards to `course/index.html`), `.nojekyll`, `.gitignore`, `README.md`, `LICENSE`.
- Removed `research/mine_*.md`.

## Deploy

Legacy branch Pages from `main` at `/`; the user site's custom domain gives the `outside5sigma.com/photonic-conduct/` path. Dev mode stays off on the deployed host (it is honored only on localhost and file://).

## Verification

- [ ] Local base-path test (parent directory served, `photonic-conduct/` subpath)
- [ ] Live HTTP checks (root, course catalog, player, a narration clip, a render, KaTeX font)
- [ ] Live headless screenshot and a click-through of the first steps
