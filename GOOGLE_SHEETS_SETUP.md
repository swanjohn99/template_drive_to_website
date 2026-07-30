# Google Spreadsheet + Apps Script setup

Step-by-step: put content in a public Google Sheet, add a **Publish website** button, and have that button trigger the GitHub Action that builds static files and pushes them to the destination website repo.

Copy-paste script: [`google-apps-script/Code.gs`](google-apps-script/Code.gs)

Architecture overview: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## What you will end up with

1. A Google Spreadsheet (shared publicly for CSV export)
2. Apps Script attached to that sheet
3. A sheet menu **Site → Publish website** and/or a clickable button
4. Click → GitHub `repository_dispatch` (`rebuild-site`) → Action builds `site/` → pushes to the destination Pages repo

You need **two different GitHub tokens** (do not reuse one for both jobs):

| Token | Where stored | Purpose |
|-------|--------------|---------|
| **Dispatch PAT** (`GH_PAT` in Apps Script) | Apps Script **Script properties** | Lets the sheet call GitHub to **start** the Action on the **content** repo |
| **Deploy PAT** (`DEPLOY_TOKEN`) | Content repo → Actions **secret** | Lets the Action **push** built files to the **destination website** repo |

---

## Part A — Spreadsheet content

### A1. Create the spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) → **Blank** spreadsheet
2. Rename it (e.g. `My Site Content`)
3. Rename the data tab to **`your website content`** (bottom tab label — the Publish button reads this tab, not whichever tab is open)

### A2. Header row (row 1)

Type exactly these headers in row 1 (or use the same meaning; builder normalizes case/spaces):

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| `title` | `description` | `image` | `section` | `order` | `published` |

### A3. Add data rows

Example:

| title | description | image | section | order | published |
|-------|-------------|-------|---------|-------|-----------|
| Studio light | Work on the long table. | `DRIVE_FILE_ID_OR_URL` | featured | 1 | yes |
| Morning market | Vendors before sunrise. | `DRIVE_FILE_ID_OR_URL` | gallery | 1 | yes |

Rules:

- `section`: `featured` (hero) or `gallery`
- `published`: `yes` to show, `no` to skip
- `image`: Google Drive **file id** or share URL (`/file/d/FILE_ID/...`)
- Each Drive file: **Share → Anyone with the link → Viewer**

### A4. Share the spreadsheet publicly (required for the Action)

1. **Share** (top right)
2. **General access** → **Anyone with the link** → **Viewer**
3. Copy the link; the **Publish website** button sends this sheet's id to GitHub automatically — you do **not** need `spreadsheet_id` in `config.json` when publishing from the sheet.

   Optional fallback for manual Action runs: set `spreadsheet_id` in `config.json` or Actions variable `SPREADSHEET_ID`.

### A5. Confirm CSV export works

In a private browser window open:

`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=csv&gid=0`

You should download/see CSV text, not a Google login HTML page. If you get HTML, sharing is wrong.

---

## Part B — Dispatch PAT (for Apps Script → GitHub)

This token starts the workflow. It is **not** `DEPLOY_TOKEN`.

### B1. Create a fine-grained PAT (preferred)

1. Open https://github.com/settings/personal-access-tokens  
2. **Generate new token** (fine-grained)
3. **Resource owner**: your user (must be able to run Actions on the **content** repo)
4. **Repository access**: **Only select the content / build repo** (the template copy — not the website host)
5. Repository permissions:

| Permission | Access |
|------------|--------|
| **Actions** | **Read and write** |
| **Metadata** | **Read-only** (usually automatic) |
| Contents | No access (unless GitHub requires read; add **Contents: Read-only** if dispatch returns 404) |

6. Generate → copy once (`github_pat_…`)

Classic alternative: token with `repo` scope on an account that can administer Actions on the content repo (broader — prefer fine-grained).

### B2. Keep this token ready

You will paste it into Apps Script Script properties as `GH_PAT` in Part C. Never commit it to Git.

---

## Part C — Apps Script project

### C1. Open Apps Script from the sheet

1. In the spreadsheet: **Extensions → Apps Script**
2. Delete any stub `myFunction` code
3. Paste the full contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs)
4. Click **Save** (disk icon). Project name e.g. `Publish website`

### C2. Set Script properties

1. In Apps Script: **Project Settings** (gear icon)
2. Scroll to **Script properties** → **Add script property**

Add:

| Property | Example value | Notes |
|----------|---------------|-------|
| `GH_PAT` | `github_pat_…` | Dispatch PAT from Part B |
| `GH_OWNER` | `swanjohn99` | Owner of the **content** repo |
| `GH_REPO` | `my-site-content` | **Content** repo name only (not `owner/repo`) |
| `GH_EVENT_TYPE` | `rebuild-site` | Optional; must match workflow `repository_dispatch` types |
| `CONTENT_SHEET_NAME` | `your website content` | Optional; tab name with site rows (default: `your website content`) |

3. Save

### C3. Authorize the script

1. In the Apps Script editor, select function `checkPublishConfig` → **Run**
2. Choose your Google account → **Allow** the permissions (spreadsheet + external requests)
3. You should see an alert that `GH_PAT` is set and owner/repo look correct

### C4. Add the custom menu

1. Close and reopen the spreadsheet (or refresh)
2. After a few seconds a **Site** menu appears
3. **Site → Publish website** runs the same publish function as the button

If the menu is missing: Extensions → Apps Script → run `onOpen` once, then refresh the sheet.

---

## Part D — Button on the sheet (drawing)

### D1. Insert a drawing button

1. In the spreadsheet: **Insert → Drawing**
2. Draw a rectangle, add text e.g. `Publish website`
3. **Save and close**
4. Position the drawing where editors can click it

### D2. Assign the script

1. Click the drawing once → click the **⋮** (three dots) on the drawing
2. **Assign script**
3. Type exactly: `publishWebsite` (no spaces, no `()`)
4. OK

### D3. First click

1. Click the button
2. Google may ask to authorize again — allow
3. Success alert: **Publish started** + link to GitHub Actions  
4. Failure alert: shows HTTP code/body (bad token, wrong repo, missing Actions permission, etc.)

---

## Part E — Content repo must accept the event

Confirm `.github/workflows/build.yml` includes:

```yaml
on:
  repository_dispatch:
    types: [rebuild-site]
  workflow_dispatch:
```

`GH_EVENT_TYPE` / `event_type` in Apps Script must be exactly `rebuild-site` (unless you change both sides together).

Also ensure:

1. `deploy_repo` / `deploy_branch` point at the website host
2. Actions secret `DEPLOY_TOKEN` is set (deploy PAT — Contents R/W on the **destination** repo)
3. Actions are enabled on the content repo

`spreadsheet_id` in `config.json` is optional when editors publish from the sheet (Apps Script sends sheet id + row CSV in the dispatch payload). Keep it only for manual `workflow_dispatch` / push builds without the button.

---

## Part F — End-to-end test

1. Edit a cell in the sheet → save
2. Click **Publish website** (button or Site menu)
3. Open `https://github.com/GH_OWNER/GH_REPO/actions`
4. Run **Build site from Google Drive + Sheets** should appear (event `repository_dispatch`)
5. When green: check the destination website repo for a new commit and refresh the live Pages URL

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Apps Script `401` / `403` | Bad/expired `GH_PAT` or wrong scopes | New fine-grained PAT with **Actions: Read and write** on content repo |
| Apps Script `404` | Wrong `GH_OWNER` / `GH_REPO` | Use content repo, not website repo |
| Alert “Missing script properties” | Properties not saved | Part C2 |
| Menu missing | `onOpen` not run | Refresh sheet; or run `onOpen` in editor |
| Button does nothing | Script name typo | Assign `publishWebsite` exactly |
| Alert “Sheet tab not found” | Missing/wrong tab name | Rename tab to `your website content` or set `CONTENT_SHEET_NAME` |
| Action runs but site empty / old | Sheet not public / wrong spreadsheet_id | Part A4–A5; check `config.json` |
| Action fails on push | `DEPLOY_TOKEN` / `deploy_branch` | See README PAT section + destination `main` branch |
| `Remote branch … not found` | Destination branch name mismatch | Set `deploy_branch` to the real branch on the website repo |

---

## Security notes

- Store **dispatch** PAT only in Apps Script Script properties
- Store **deploy** PAT only as GitHub Actions secret `DEPLOY_TOKEN`
- Anyone who can edit the Apps Script project can read Script properties — limit editors
- Spreadsheet “Anyone with the link” makes **content** public (required for CSV export without API keys)
- Rotate PATs if leaked; revoke old tokens in GitHub settings
