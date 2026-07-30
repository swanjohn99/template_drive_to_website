# Architecture (for Cursor planners)

Use this file when planning changes in repos created from this template.
Source of truth for data flow, spreadsheet schema, config, build output, and **where the live site is hosted**.

## Purpose

Static website generated from:

1. **Google Spreadsheet** (public) — page copy / metadata
2. **Google Drive files** (public) — photos referenced by the sheet
3. **GitHub Action in this (content) repo** — fetch → resize → write `site/`
4. **Push generated files into a separate public website repo** — that repo is what GitHub Pages hosts

No runtime backend. No Google API keys. Public share links only.

## Two-repo model

GitHub user/org sites are typically one primary public host (`username.github.io` or one designated Pages repo). This template assumes:

| Repo | Role |
|------|------|
| **Content / build repo** (this template, or a copy) | Sheet/Drive wiring, tweaks, Action that builds `site/` |
| **Destination website repo** (another user’s public host) | Receives generated static files; Pages serves that repo |

The person running the content repo is a **collaborator with write access to `main`** (or the deploy branch) on the destination repo.

```text
Editors / uploaders
  ├─ Google Drive  (images, Anyone-with-link)
  └─ Google Sheet  (rows of content, Anyone-with-link)
           │
           ▼
  Content repo  (template copy — tweaks live here)
  GitHub Action (.github/workflows/build.yml)
           │
           ▼
  scripts/build.py
      ├─ export Sheet as CSV
      ├─ download Drive file(s) by id/url
      ├─ resize with Pillow → site/images/*.jpg
      └─ render site/index.html + assets + data.json
           │
           ├─ optional: commit site/ in content repo (preview / history)
           │
           ▼
  Push site/ contents → destination website repo (main or configured branch)
           │
           ▼
  GitHub Pages on the DESTINATION repo (public site)
```

**Default `GITHUB_TOKEN` cannot push to another repo.** Deploy needs secret `DEPLOY_TOKEN`.

### What `DEPLOY_TOKEN` / PAT means

**PAT** = **Personal Access Token** — a GitHub credential for a user account, used by CI instead of a password.

| Piece | Meaning |
|-------|---------|
| Why | Action in content repo must push commits into a *different* destination repo |
| Why not `GITHUB_TOKEN` | Scoped only to the repo running the workflow; no write access to other repos |
| Who creates it | An account that is already a **collaborator with write** on the destination |
| Where it lives | Content repo → Settings → Secrets → Actions → secret name `DEPLOY_TOKEN` |
| Recommended type | Fine-grained PAT, single destination repo, **Contents: Read and write** |
| Security | Never commit the token; rotate if leaked or expired |

Human-oriented steps: `README.md` § “What is a PAT?”.

### Multi-site warning


Several content repos pushing into the **same** destination path will overwrite each other. Prefer:

- one content repo → one destination path, or
- different `deploy_path` subfolders per site, or
- different destination repos

## Rebuild triggers

- Manual: Actions → `Build site from Google Drive + Sheets` → Run workflow
- Schedule: hourly cron
- Push to `main` touching `config.json`, `scripts/**`, `sample/**`, workflow, or `requirements.txt`

After any Sheet or Drive content change, re-run the Action (or wait for cron). That rebuild also re-pushes to the destination website repo when deploy is configured.

## Google Spreadsheet configuration

### Access

- Share: **Anyone with the link → Viewer** (required)
- Builder URL pattern:

  `https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={sheet_gid}`

- `spreadsheet_id` / `sheet_gid` come from `config.json` or Actions vars/env
- If export returns HTML, sharing is wrong (not public)

### Header row (required shape)

First row must be headers. Headers are normalized to snake_case
(`Title Text` → `title_text`). Preferred exact headers:

| Column        | Required | Meaning |
|---------------|----------|---------|
| `title`       | yes*     | Item heading. Fallback aliases: `name` |
| `description` | no       | Caption / body. Aliases: `caption`, `body` |
| `image`       | yes**    | Drive file id **or** share/download URL. Aliases: `image_id`, `drive_id`, `photo` |
| `section`     | no       | `featured` (hero) or `gallery` (default) |
| `order`       | no       | Integer sort key (lower first). Default `9999` |
| `published`   | no       | `yes`/`y`/`true`/`1`/`published` or empty = show. `no` = skip |

\* If missing, builder uses `Item N`.  
\*\* Rows without a resolvable image still emit text-only items; gallery cards without `image_src` are omitted from the grid.

### Example rows

```csv
title,description,image,section,order,published
Studio light,Work in progress on the long table.,1abc...DriveFileId,featured,1,yes
Morning market,Vendors before sunrise.,https://drive.google.com/file/d/1abc.../view,gallery,1,yes
Draft only,Should not appear.,1xyz...,gallery,9,no
```

See also `sample/content.csv`.

### `section` rules

| Value       | Placement |
|-------------|-----------|
| `featured`  | First featured row → hero full-bleed image; its `description` → lede under hero |
| `gallery`   | Remaining published rows with images → gallery figures |
| (other/empty) | Treated as `gallery` |

Sort: featured first, then `order` ascending, then `title`.

### `image` cell formats accepted

Builder extracts a Drive file id from any of:

- Raw id: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
- `/file/d/{id}/...`
- `open?id={id}` / `uc?id={id}` / `thumbnail?id={id}`
- `lh3.googleusercontent.com/d/{id}`

Non-Drive `http(s)` URLs are kept as remote `src` (not downloaded/resized).

Each Drive file must be **Anyone with the link → Viewer**.

## Repo configuration

### `config.json`

| Key               | Role |
|-------------------|------|
| `spreadsheet_id`  | Sheet id (`REPLACE_WITH_YOUR_SHEET_ID` → demo/sample mode) |
| `sheet_gid`       | Tab gid (default `"0"`) |
| `site_title`      | Brand / hero brand text |
| `site_tagline`    | Hero headline |
| `image_max_width` | Resize max width px (default 1400) |
| `image_quality`   | JPEG quality (default 82) |
| `output_dir`      | Local build folder (default `site`) |
| `deploy_repo`     | Destination `owner/repo` (empty = skip remote push) |
| `deploy_branch`   | Branch on destination (default `main`) |
| `deploy_path`     | Path inside destination to write files (default `.` = repo root) |
| `commit_site_locally` | If `true`, also commit `site/` back to this content repo |

### Secrets / variables (Actions)

| Name | Kind | Maps to |
|------|------|---------|
| `DEPLOY_TOKEN` | **Secret** (required for remote deploy) | Personal Access Token (PAT) for a collaborator; Contents read/write on destination |
| `DEPLOY_REPO` | Var/secret optional override | `deploy_repo` |
| `DEPLOY_BRANCH` | Var optional | `deploy_branch` |
| `DEPLOY_PATH` | Var optional | `deploy_path` |
| `SPREADSHEET_ID` | Var/secret | `spreadsheet_id` |
| `SPREADSHEET_URL` | Var/secret | parses id + optional `gid` |
| `SHEET_GID` | Var | `sheet_gid` |
| `SITE_TITLE` | Var | `site_title` |
| `SITE_TAGLINE` | Var | `site_tagline` |
| `IMAGE_MAX_WIDTH` | Var | `image_max_width` |
| `IMAGE_QUALITY` | Var | `image_quality` |
| `USE_SAMPLE=1` | Env | force `sample/content.csv` + placeholder JPEGs |
| `CONFIG_PATH` | Env | alternate config file path |

Env / Actions vars win over `config.json` when set.

### Destination website repo checklist

1. Public repo that GitHub Pages serves (often `username.github.io`)
2. Pages enabled on that repo (branch/`deploy_path` as configured)
3. Content-repo operator added as collaborator with push to deploy branch
4. Content repo secret `DEPLOY_TOKEN` = their Personal Access Token (fine-grained, Contents: Read and write on destination)

## Code map

| Path | Role |
|------|------|
| `scripts/build.py` | Builder only: fetch CSV, Drive download, resize, HTML/CSS/JS emit |
| `.github/workflows/build.yml` | CI: build → optional local `site/` commit → push `site/` to destination repo |
| `config.json` | Sheet + brand + **deploy_repo / branch / path** |
| `sample/content.csv` | Demo sheet shape when no real id configured |
| `site/` | **Generated** static output (source of files pushed remotely) |
| `site/index.html` | Page |
| `site/images/` | Resized JPEGs |
| `site/assets/site.css`, `site/assets/site.js` | Styles / scroll-in motion |
| `site/data.json` | Build snapshot for debugging |
| `requirements.txt` | `Pillow`, `requests` |
| `README.md` | Human setup guide |
| `ARCHITECTURE.md` | This file — planner contract |

## Invariants for planners

1. **Do not** add a server or Google service-account flow unless explicitly requested — template is public-link based.
2. Spreadsheet schema above is the contract; column renames need matching aliases in `scripts/build.py` (`process_rows` / `normalize_key`).
3. `site/` is build output — prefer changing `scripts/build.py` (HTML/CSS/JS templates live inside it) over hand-editing `site/` long-term.
4. After content changes, the Action must run again — that rebuild **and** re-pushes to the destination website repo.
5. Demo mode: empty/`REPLACE_*` `spreadsheet_id` → `sample/content.csv` placeholders; real deploys need a real sheet id + public Drive files.
6. **Live hosting is the destination repo**, not (primarily) this content repo’s Pages. Do not assume same-repo `actions/deploy-pages` is the production path.
7. Cross-repo push requires `DEPLOY_TOKEN`; never commit PATs. Do not rely on default `GITHUB_TOKEN` for destination writes.
8. When planning multi-site templates, call out `deploy_path` / overwrite risk explicitly.

## Typical change recipes

| Goal | Touch |
|------|-------|
| New sheet columns on the page | Sheet header + `scripts/build.py` (`process_rows`, `render_html`) |
| Visual redesign | CSS/HTML/JS strings inside `scripts/build.py` (`write_assets`, `render_html`) |
| Different sheet / brand | `config.json` or Actions vars — then re-run Action |
| Image size/quality | `image_max_width` / `image_quality` — then re-run Action |
| Point at host website repo | `deploy_repo`, `deploy_branch`, `deploy_path` + secret `DEPLOY_TOKEN` |
| Rebuild cadence | `.github/workflows/build.yml` `on.schedule` / `workflow_dispatch` |

## Local build

```bash
pip install -r requirements.txt
python scripts/build.py          # uses config.json; sample if id unset/REPLACE_*
USE_SAMPLE=1 python scripts/build.py
```

Open `site/index.html`. Remote push happens only in GitHub Actions when deploy is configured.
