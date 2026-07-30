# Architecture (for Cursor planners)

Use this file when planning changes in repos created from this template.
Source of truth for data flow, spreadsheet schema, config, and build output.

## Purpose

Static website generated from:

1. **Google Spreadsheet** (public) — page copy / metadata
2. **Google Drive files** (public) — photos referenced by the sheet
3. **GitHub Action** — fetch → resize → write `site/` → optional Pages deploy

No runtime backend. No Google API keys. Public share links only.

## Data flow

```text
Editors / uploaders
  ├─ Google Drive  (images, Anyone-with-link)
  └─ Google Sheet  (rows of content, Anyone-with-link)
           │
           ▼
  GitHub Action (.github/workflows/build.yml)
           │
           ▼
  scripts/build.py
      ├─ export Sheet as CSV
      ├─ download Drive file(s) by id/url
      ├─ resize with Pillow → site/images/*.jpg
      └─ render site/index.html + assets + data.json
           │
           ▼
  Commit site/  +  GitHub Pages artifact
```

**Rebuild triggers**

- Manual: Actions → `Build site from Google Drive + Sheets` → Run workflow
- Schedule: hourly cron
- Push to `main` touching `config.json`, `scripts/**`, `sample/**`, workflow, or `requirements.txt`

After any Sheet or Drive content change, re-run the Action (or wait for cron).

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
| `output_dir`      | Output folder (default `site`) |

### Env / Actions variable overrides

| Env / var           | Maps to |
|---------------------|---------|
| `SPREADSHEET_ID`    | `spreadsheet_id` |
| `SPREADSHEET_URL`   | parses id + optional `gid` |
| `SHEET_GID`         | `sheet_gid` |
| `SITE_TITLE`        | `site_title` |
| `SITE_TAGLINE`      | `site_tagline` |
| `IMAGE_MAX_WIDTH`   | `image_max_width` |
| `IMAGE_QUALITY`     | `image_quality` |
| `USE_SAMPLE=1`      | force `sample/content.csv` + placeholder JPEGs |
| `CONFIG_PATH`       | alternate config file path |

Env wins over `config.json` when set.

## Code map

| Path | Role |
|------|------|
| `scripts/build.py` | Only builder: fetch CSV, Drive download, resize, HTML/CSS/JS emit |
| `.github/workflows/build.yml` | CI: install → build → commit `site/` → Pages artifact/deploy |
| `config.json` | Site + sheet wiring |
| `sample/content.csv` | Demo sheet shape when no real id configured |
| `site/` | **Generated** static output (committed by Action) |
| `site/index.html` | Page |
| `site/images/` | Resized JPEGs |
| `site/assets/site.css`, `site/assets/site.js` | Styles / scroll-in motion |
| `site/data.json` | Build snapshot for debugging |
| `requirements.txt` | `Pillow`, `requests` |
| `README.md` | Human setup guide |

## Invariants for planners

1. **Do not** add a server or Google service-account flow unless explicitly requested — template is public-link based.
2. Spreadsheet schema above is the contract; column renames need matching aliases in `scripts/build.py` (`process_rows` / `normalize_key`).
3. `site/` is build output — prefer changing `scripts/build.py` (HTML/CSS/JS templates live inside it) over hand-editing `site/` long-term.
4. After content or schema-driven template changes, the Action must be run again to refresh `site/`.
5. Demo mode: empty/`REPLACE_*` `spreadsheet_id` → `sample/content.csv` placeholders; real deploys need a real sheet id + public Drive files.
6. Pages: repo Settings → Pages → Source **GitHub Actions** (workflow deploys on `main`).

## Typical change recipes

| Goal | Touch |
|------|-------|
| New sheet columns on the page | Sheet header + `scripts/build.py` (`process_rows`, `render_html`) |
| Visual redesign | CSS/HTML/JS strings inside `scripts/build.py` (`write_assets`, `render_html`) |
| Different sheet / brand | `config.json` or Actions vars — then re-run Action |
| Image size/quality | `image_max_width` / `image_quality` — then re-run Action |
| Rebuild cadence | `.github/workflows/build.yml` `on.schedule` / `workflow_dispatch` |

## Local build

```bash
pip install -r requirements.txt
python scripts/build.py          # uses config.json; sample if id unset/REPLACE_*
USE_SAMPLE=1 python scripts/build.py
```

Open `site/index.html`.
