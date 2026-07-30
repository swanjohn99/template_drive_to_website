# Architecture (for Cursor planners)

Use this file when planning changes in repos created from this template.
Source of truth for data flow, spreadsheet schema, config, build output, and **where the live site is hosted**.

## Purpose

Static website generated from:

1. **Google Spreadsheet** (public) — page copy / metadata + **Publish** button (Apps Script)
2. **Google Drive files** (public) — photos referenced by the sheet
3. **GitHub Action in this repo** — fetch → resize → write `site/`
4. **GitHub Pages on this same repo** — Action uploads `site/` as a Pages artifact and deploys it

**Primary publish path:** editor clicks a button (or **Import/Export → Publish website**) in the spreadsheet → Google Apps Script sends `repository_dispatch` → Action builds and deploys Pages.

No runtime backend. No Google API keys for Sheet/Drive read. Public share links only.

Human steps + Apps Script: [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md) · script source: [`google-apps-script/Code.gs`](google-apps-script/Code.gs)

## One-repo model

Build and host live in **one** repository. For a root user/org URL (`https://username.github.io/`), name the repo `username.github.io` (or the org equivalent) and enable Pages with source **GitHub Actions**.

| Piece | Role |
|------|------|
| **This repo** | Sheet/Drive wiring, builder scripts, Action that builds `site/` and deploys Pages |
| **GitHub Pages** | Serves the uploaded `site/` artifact at the repo’s Pages URL (root for `*.github.io` repos) |

```text
Editors / uploaders
  ├─ Google Drive  (images, Anyone-with-link)
  └─ Google Sheet  (rows + Apps Script button)
           │
           │  click "Publish website"
           ▼
  Apps Script  →  GitHub API repository_dispatch (event: rebuild-site)
           │         (Script property GH_PAT — Actions write on THIS repo)
           ▼
  This repo  GitHub Action (.github/workflows/build.yml)
           │
           ▼
  scripts/build.py
      ├─ export Sheet as CSV
      ├─ download Drive file(s) by id/url
      ├─ resize with Pillow → site/images/*.jpg
      └─ render site/index.html + assets + data.json
           │
           ▼
  upload-pages-artifact (path: site) → deploy-pages
           │         (GITHUB_TOKEN — pages: write + id-token: write)
           ▼
  GitHub Pages on THIS repo (public site)
```

### One PAT (`GH_PAT` only)

| Token | Stored in | Repo it targets | Fine-grained permission |
|-------|-----------|-----------------|-------------------------|
| **`GH_PAT`** | Apps Script **Script properties** | **This** repo | **Actions: Read and write** (+ Metadata R) |

`GH_PAT` is usually created on a **contributor** account. `GH_REPO` should be the full repo URL (`https://github.com/owner/repo`); the script parses owner/name from it (not from the PAT author). Legacy split props `GH_REPO_OWNER` / `GH_OWNER` + repo name still work.

Deploy uses the workflow’s built-in `GITHUB_TOKEN` with `pages: write` and `id-token: write`. Never commit `GH_PAT`.

## Rebuild triggers

| Trigger | When to use |
|---------|-------------|
| **Google Sheet button / Import/Export menu** (primary) | After editing Sheet or Drive content — see `GOOGLE_SHEETS_SETUP.md` |
| `repository_dispatch` type `rebuild-site` | What Apps Script sends |
| Manual `workflow_dispatch` | Backup from GitHub Actions UI |
| Push to `main` touching build config/scripts | After template/code changes |

After Sheet or Drive content changes, click **Publish website** in the sheet (do not rely on a schedule). That rebuild also redeploys GitHub Pages.

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

### Secrets / variables (Actions)

| Name | Kind | Maps to |
|------|------|---------|
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

### Pages hosting checklist

1. Repo named for root URL if needed: `username.github.io` (or org equivalent)
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. First successful workflow run creates the `github-pages` environment and publishes
4. Live URL: `https://username.github.io/` for a user/org site repo; project repos use `https://username.github.io/repo-name/`

## Code map

| Path | Role |
|------|------|
| `scripts/build.py` | Builder only: fetch CSV, Drive download, resize, HTML/CSS/JS emit |
| `.github/workflows/build.yml` | CI: `repository_dispatch` / build → upload Pages artifact → deploy-pages |
| `google-apps-script/Code.gs` | Sheet button/menu script (copy into Apps Script project) |
| `GOOGLE_SHEETS_SETUP.md` | Step-by-step Sheet + Apps Script + button + PAT instructions |
| `config.json` | Sheet + brand settings |
| `sample/content.csv` | Demo sheet shape when no real id configured |
| `site/` | **Generated** static output (gitignored; local preview + Pages artifact) |
| `site/index.html` | Page |
| `site/images/` | Resized JPEGs |
| `site/assets/site.css`, `site/assets/site.js` | Styles / scroll-in motion |
| `site/data.json` | Build snapshot for debugging |
| `requirements.txt` | `Pillow`, `requests` |
| `README.md` | Human setup guide |
| `ARCHITECTURE.md` | This file — planner contract |

## Invariants for planners

1. **Do not** add a server or Google service-account flow for Sheet/Drive **reads** unless explicitly requested — reads stay public-link based.
2. **Primary publish trigger is the Sheet Apps Script button** (`repository_dispatch` / `rebuild-site`), not cron.
3. Spreadsheet schema above is the contract; column renames need matching aliases in `scripts/build.py` (`process_rows` / `normalize_key`).
4. `site/` is build output — prefer changing `scripts/build.py` (HTML/CSS/JS templates live inside it) over hand-editing `site/` long-term. Do not commit `site/`.
5. After content changes, publish from the sheet — that rebuild **and** redeploys GitHub Pages on this repo.
6. Demo mode: empty/`REPLACE_*` `spreadsheet_id` → `sample/content.csv` placeholders; real deploys need a real sheet id + public Drive files.
7. **Live hosting is this repo’s GitHub Pages** (Actions artifact), not a second destination repo.
8. **One PAT**: `GH_PAT` (Apps Script → this repo Actions; usually a **contributor’s** token). Pair with `GH_REPO` as the full GitHub URL. Deploy uses `GITHUB_TOKEN`. Never commit PATs. Never use Codespaces secrets for Actions.

## Typical change recipes

| Goal | Touch |
|------|-------|
| New sheet columns on the page | Sheet header + `scripts/build.py` (`process_rows`, `render_html`) |
| Visual redesign | CSS/HTML/JS strings inside `scripts/build.py` (`write_assets`, `render_html`) |
| Different sheet / brand | `config.json` or Actions vars — then publish from Sheet |
| Image size/quality | `image_max_width` / `image_quality` — then publish from Sheet |
| Enable / fix hosting | Repo Pages source = GitHub Actions; for root URL use `username.github.io` |
| Change publish button / Apps Script | `google-apps-script/Code.gs` + `GOOGLE_SHEETS_SETUP.md` + keep `repository_dispatch` types in sync |
| Dispatch event name | Workflow `repository_dispatch.types` **and** Apps Script `GH_EVENT_TYPE` / `rebuild-site` together |

## Local build

```bash
pip install -r requirements.txt
python scripts/build.py          # uses config.json; sample if id unset/REPLACE_*
USE_SAMPLE=1 python scripts/build.py
```

Open `site/index.html`. Remote Pages deploy happens only in GitHub Actions.
