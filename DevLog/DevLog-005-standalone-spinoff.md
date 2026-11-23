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

- [x] Local base-path test: parent directory served, redirect to course/index.html, dev-mode sweep of all 201 steps per course under the subpath: 0 errors, 0 failed requests
- [x] Live HTTP checks: root, catalog, player, audio manifest and a clip, presenter video, KaTeX font, mode data: all 200
- [x] Live headless: root forwards to the catalog; `?dev=1` ignored on the live host; both courses begin with Next locked during narration; no page errors or failed requests

## Listings (2026-11-22)

- PlayGround readme spun-off section and `assets/photonic-conduct.png`: committed and pushed (27c70d8).
- Blog `_data/projects.yml` entry and thumbnail: edited locally only; he pushes the blog with other work.
