# Drive + Sheets → static website

People upload pictures to a **public Google Drive**. Editors put titles and captions in a **public Google Spreadsheet**. A GitHub Action in **this content repo** builds static files, then **pushes them into a separate public website repo** (GitHub Pages host).

Re-run the Action after Sheet/Drive updates (or wait for hourly cron).

**Planners / Cursor:** read [`ARCHITECTURE.md`](ARCHITECTURE.md) — spreadsheet schema + **two-repo deploy** contract.

## Setup

### 1. Google Spreadsheet

Header row:

| title | description | image | section | order | published |
|-------|-------------|-------|---------|-------|-----------|
| Morning market | Vendors before sunrise | `DRIVE_FILE_ID_OR_URL` | gallery | 1 | yes |

- `image` — Drive file id or share URL
- `section` — `featured` (hero) or `gallery`
- Share sheet: **Anyone with the link → Viewer**

### 2. Google Drive pictures

Share files **Anyone with the link → Viewer**. Put file id/URL in the sheet `image` column.

### 3. Configure this (content) repo

`config.json`:

```json
{
  "spreadsheet_id": "YOUR_SHEET_ID",
  "sheet_gid": "0",
  "site_title": "Your Brand",
  "site_tagline": "One short line",
  "image_max_width": 1400,
  "image_quality": 82,
  "output_dir": "site",
  "deploy_repo": "other-user/other-user.github.io",
  "deploy_branch": "main",
  "deploy_path": ".",
  "commit_site_locally": true
}
```

### 4. Destination website repo

1. Other user’s public Pages repo (you are a **collaborator** with push to `main`)
2. Pages enabled on **that** repo
3. In **this** content repo → Actions secret `DEPLOY_TOKEN` = PAT that can write the destination

Without `deploy_repo` + `DEPLOY_TOKEN`, the Action only builds (and optionally commits) `site/` locally.

### 5. Run the Action

Actions → **Build site from Google Drive + Sheets** → **Run workflow**.

## Local build

```bash
pip install -r requirements.txt
python scripts/build.py
```

Demo mode if sheet id is unset/`REPLACE_*`. Open `site/index.html`.

## Flow

```text
Google Drive + Google Sheet
        → content repo Action (build site/)
        → push to destination website repo
        → GitHub Pages (destination)
```
