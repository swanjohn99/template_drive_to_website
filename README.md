# Drive + Sheets → static website

**This repo (a copy of the template) is the website host.** There is no second “destination” repo. Sheet/Drive content builds here; GitHub Pages serves from here.

People upload pictures to a **public Google Drive**. Editors put titles and captions in a **public Google Spreadsheet**. A **button on the spreadsheet** (Google Apps Script) triggers a GitHub Action in **this template copy**, which builds static files and **deploys GitHub Pages on this same repo**.

After Sheet/Drive updates: click **Publish website** on the sheet (or use **Import/Export → Publish website**).

**Setup for the sheet + button:** [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md)  
**Planners / Cursor:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

## Setup

### 0. Use the template copy as the host

1. Create a repo from this template (or fork/copy it)
2. That copy **is** the public website — enable Pages on **it**
3. For a root URL (`https://username.github.io/`), name the copy `username.github.io` (or the org equivalent)
4. Point Apps Script `GH_REPO` at **this copy’s** URL — not a separate site repo

### 1. Google Spreadsheet + Publish button

Follow **[`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md)** end-to-end (columns, public share, Apps Script, button, dispatch PAT).

Header row:

| title | description | image | section | order | published |
|-------|-------------|-------|---------|-------|-----------|
| Morning market | Vendors before sunrise | `DRIVE_FILE_ID_OR_URL` | gallery | 1 | yes |

- `image` — Drive file id or share URL
- `section` — `featured` (hero) or `gallery`
- Share sheet: **Anyone with the link → Viewer**

### 2. Google Drive pictures

Share files **Anyone with the link → Viewer**. Put file id/URL in the sheet `image` column.

### 3. Configure this template copy

`config.json` (in the website-host repo — this copy):

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

`spreadsheet_id` can stay empty when you publish from the sheet — Apps Script sends the id. Set it (or Actions var `SPREADSHEET_ID`) only for manual / push rebuilds without the sheet button.

### 4. GitHub Pages on this template copy + contributor Actions access

1. This template copy **is** the Pages host (do not push built files to another repo)
2. For a **root** site URL (`https://username.github.io/`), name **this** repo `username.github.io` (or the org equivalent)
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. **Settings → Collaborators**: add the contributor with **Write** (required so they can start Actions)
5. **Settings → Actions → General**: Actions enabled; workflow permissions **Read and write**
6. No second token / no destination repo — the workflow uses `GITHUB_TOKEN` to publish the `site/` artifact on **this** repo

Contributor check: they can open **this** repo’s **Actions** tab and **Run workflow**.

### 5. GitHub token for the sheet (`GH_PAT`)

**PAT** = **Personal Access Token**. Needed so the spreadsheet can start this repo’s Action (`repository_dispatch`).

Create it on the **contributor** account **after** they have Write access:

- **Usual:** classic PAT with `public_repo` (public repo) or `repo` (private) — fine-grained often cannot target another person’s user-owned repo
- **If available:** fine-grained with **Actions: Read and write** on this repo

In Apps Script Script properties set:

| Property | Meaning |
|----------|---------|
| `GH_PAT` | Contributor’s token (usual) |
| `GH_REPO` | Full URL of **this template copy** (the website host), e.g. `https://github.com/owner/username.github.io` |

Full steps: [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md) (Part 0 + Part B).

**Never** put a PAT in `config.json`, commit it, or paste it into issues/chat.

### 6. Publish from the spreadsheet

1. Edit Sheet / Drive content as needed  
2. Click the **Publish website** button (or **Import/Export → Publish website**)  
3. Confirm the run under this repo’s **Actions** tab  
4. When green, open the Pages URL (Actions → deploy job → environment URL, or Settings → Pages)

Backup: Actions → **Build site from Google Drive + Sheets** → **Run workflow**.

## Local build

```bash
pip install -r requirements.txt
python scripts/build.py
```

Demo mode if sheet id is unset/`REPLACE_*`. Open `site/index.html`. `site/` is gitignored.

## Flow

```text
Google Drive + Google Sheet (button / Apps Script)
        → repository_dispatch (rebuild-site)
        → template-copy Action (build site/)
        → upload Pages artifact → deploy-pages
        → GitHub Pages on the template copy (website host)
```
