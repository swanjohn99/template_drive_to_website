# Drive + Sheets → static website

People upload pictures to a **public Google Drive** folder/files. Editors put titles and captions in a **public Google Spreadsheet**. A GitHub Action pulls both, resizes images, and writes a static HTML site.

Re-run the Action whenever Sheet or Drive content changes (or wait for the hourly schedule).

**Planners / Cursor:** read [`ARCHITECTURE.md`](ARCHITECTURE.md) for system architecture and the Google Spreadsheet schema contract.

## Setup

### 1. Google Spreadsheet

Create a sheet with this header row:

| title | description | image | section | order | published |
|-------|-------------|-------|---------|-------|-----------|
| Morning market | Vendors before sunrise | `DRIVE_FILE_ID_OR_URL` | gallery | 1 | yes |

Column notes:

- `image` — Drive file id, or any share / `uc?id=` / `/file/d/` URL
- `section` — `featured` (hero) or `gallery`
- `order` — lower numbers first
- `published` — `yes` / `no`

Share the spreadsheet: **Anyone with the link → Viewer**.

Copy the spreadsheet id from the URL:

`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

### 2. Google Drive pictures

1. Upload images to Drive
2. Share each file (or the parent folder) as **Anyone with the link → Viewer**
3. Paste the file id or share link into the sheet `image` column

File id is the segment after `/file/d/` in the Drive URL.

### 3. Configure this repo

Edit `config.json`:

```json
{
  "spreadsheet_id": "YOUR_SHEET_ID",
  "sheet_gid": "0",
  "site_title": "Your Brand",
  "site_tagline": "One short line",
  "image_max_width": 1400,
  "image_quality": 82,
  "output_dir": "site"
}
```

Or set GitHub **Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|----------|---------|
| `SPREADSHEET_ID` | Sheet id |
| `SPREADSHEET_URL` | Full sheet URL (optional alternative) |
| `SHEET_GID` | Tab gid (default `0`) |
| `SITE_TITLE` | Brand name |
| `SITE_TAGLINE` | Hero line |

### 4. Enable GitHub Pages

Settings → Pages → Source: **GitHub Actions**.

### 5. Run the Action

Actions → **Build site from Google Drive + Sheets** → **Run workflow**.

After Sheet/Drive updates: run it again (or wait for the hourly cron).

## Local build

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/build.py
```

With no real sheet id configured, the script builds a demo site from `sample/content.csv` and placeholder images. Open `site/index.html`.

## Output

| Path | Role |
|------|------|
| `site/index.html` | Static page |
| `site/images/` | Resized JPEGs |
| `site/assets/` | CSS + JS |
| `site/data.json` | Build snapshot |

## Flow

```text
Google Drive (public images)
        \\
         +--> GitHub Action (scripts/build.py)
        /         |
Google Sheet      +--> resize images
(public CSV)      +--> write site/
                  +--> GitHub Pages
```
