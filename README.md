# Drive + Sheets → static website

**Copy this template into your web hosting repo** (`owner.github.io`). That repo builds and hosts the site. No second “content” repo. **No `DEPLOY_TOKEN`.**

Sheet/Drive → Publish button → Action on `owner.github.io` → files on **`main` root** → GitHub Pages.

**Setup:** [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md) · **Planners:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

## Setup

### 1. Hosting repo

1. Create or use **`owner.github.io`**
2. Copy this template into it (or use “Use this template” and rename to `owner.github.io`)
3. **Settings → Pages → Deploy from a branch → Branch: `main` → Folder: `/` (root)**
4. The Action checks naming + Pages settings and fails if wrong

### 2. Google Spreadsheet + Publish button

Follow [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md).

- Tab name: **`your website content`**
- Headers: `title`, `description`, `image`, `section`, `order`, `published`
- Share sheet + Drive files: **Anyone with the link → Viewer**

### 3. `config.json` (optional sheet id)

```json
{
  "spreadsheet_id": "",
  "sheet_gid": "0",
  "site_title": "Your Brand",
  "site_tagline": "One short line",
  "image_max_width": 1400,
  "image_quality": 82,
  "output_dir": "site"
}
```

Publish-from-sheet sends the sheet id (and often inline CSV). Set `spreadsheet_id` only for manual / push rebuilds.

### 4. Owner fine-grained PAT (`GH_PAT`)

Created by the **owner** of `owner.github.io`:

1. Fine-grained PAT → **only** that hosting repo
2. Permission: **Actions: Read and write** (+ Metadata)
3. Store in Apps Script Script properties as `GH_PAT`
4. `GH_REPO` = `https://github.com/owner/owner.github.io`

Never commit the PAT. There is no deploy PAT / `DEPLOY_TOKEN`.

### 5. Publish

**Import/Export → Publish website** (or the sheet button) → Actions tab on the hosting repo → when green, open `https://owner.github.io/`.

## Local build

```bash
pip install -r requirements.txt
python scripts/build.py
```

Open `site/index.html`. `site/` is gitignored; CI publishes to repo root.

## Flow

```text
Google Drive + Sheet (Publish)
        → repository_dispatch (rebuild-site)
        → Action on owner.github.io
        → check name + Pages (main /)
        → build site/ → copy to repo root → commit main
        → GitHub Pages
```
