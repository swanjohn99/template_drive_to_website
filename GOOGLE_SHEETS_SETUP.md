# Google Spreadsheet + Apps Script setup

Step-by-step: put content in a public Google Sheet, add a **Publish website** button, and have that button trigger the GitHub Action that builds static files and pushes them to the destination website repo.

Copy-paste script: [`google-apps-script/Code.gs`](google-apps-script/Code.gs)

Architecture overview: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## What you will end up with

1. A Google Spreadsheet (shared publicly for CSV export)
2. Apps Script attached to that sheet (`Code.gs` + `ImageBrowser.html`)
3. Sheet menu **Site → Browse Drive images** (previews + copyable share URLs) and **Site → Publish website**
4. Optional drawing buttons for both actions
5. Publish click → GitHub `repository_dispatch` (`rebuild-site`) → Action builds `site/` → pushes to the destination Pages repo

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
3. Copy the link; note the id:

`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

Put `SPREADSHEET_ID` into the content repo `config.json` → `spreadsheet_id` (or Actions variable `SPREADSHEET_ID`).

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
2. Delete any stub `myFunction` code in `Code.gs`
3. Paste the full contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs)
4. Click **+** next to Files → **HTML** → name it exactly `ImageBrowser` (Apps Script adds `.html`)
5. Paste the full contents of [`google-apps-script/ImageBrowser.html`](google-apps-script/ImageBrowser.html) into that file
6. Click **Save**. Project name e.g. `Site publish`

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
| `DRIVE_FOLDER_ID` | `1abc…FolderId` | Drive folder that holds uploaded pictures (Part E) |

3. Save

### C3. Authorize the script

1. In the Apps Script editor, select function `checkPublishConfig` → **Run**
2. Choose your Google account → **Allow** (spreadsheet, Drive, and external requests)
3. You should see an alert that `GH_PAT` / owner / repo / `DRIVE_FOLDER_ID` look correct

### C4. Add the custom menu

1. Close and reopen the spreadsheet (or refresh)
2. After a few seconds a **Site** menu appears with:
   - **Browse Drive images**
   - **Publish website**

If the menu is missing: Extensions → Apps Script → run `onOpen` once, then refresh the sheet.

---

## Part D — Buttons on the sheet (optional drawings)

You can add one or both drawings:

| Button label | Assign script name |
|--------------|--------------------|
| `Publish website` | `publishWebsite` |
| `Browse Drive images` | `showDriveImageBrowser` |

### D1. Insert a drawing button

1. In the spreadsheet: **Insert → Drawing**
2. Draw a rectangle, add the label text
3. **Save and close**
4. Position the drawing where editors can click it

### D2. Assign the script

1. Click the drawing once → click the **⋮** (three dots) on the drawing
2. **Assign script**
3. Type the function name exactly (no spaces, no `()`)
4. OK

### D3. First Publish click

1. Click **Publish website**
2. Google may ask to authorize again — allow
3. Success alert: **Publish started** + link to GitHub Actions  
4. Failure alert: shows HTTP code/body (bad token, wrong repo, missing Actions permission, etc.)

---

## Part E — Browse Drive images (previews + copy URLs)

Editors upload pictures to one Drive folder. The sheet sidebar lists them with thumbnails and share URLs so you can paste into the `image` column.

### G1. Create / pick the upload folder

1. In [Google Drive](https://drive.google.com), create a folder e.g. `Site photos`
2. Open the folder → copy its id from the URL:

`https://drive.google.com/drive/folders/FOLDER_ID`

3. Put `FOLDER_ID` in Apps Script Script property `DRIVE_FOLDER_ID` (Part C2)
4. Upload JPG/PNG/WebP (etc.) images into that folder

Recommended: share the **folder** as **Anyone with the link → Viewer** so new uploads are easier to publish. The sidebar can also set per-file sharing.

### G2. Open the browser

1. Refresh the spreadsheet so the **Site** menu loads
2. **Site → Browse Drive images** (or click a drawing assigned to `showDriveImageBrowser`)
3. Sidebar shows each image: thumbnail, name, share URL, public/private badge

### G3. Copy or paste into the sheet

1. Click the cell in the **`image`** column for that row
2. In the sidebar, either:
   - **Copy URL** → paste into the cell, or
   - **Paste into cell** (writes the share URL into the active cell)
3. If the badge says **Not public yet**, click **Make public** (or **Share all**) so the GitHub Action can download the file
4. Fill `title` / `description` / `section` / `order` / `published` as usual
5. **Site → Publish website** when ready

Share URL format used:

`https://drive.google.com/file/d/FILE_ID/view?usp=sharing`

(The build script accepts this and extracts the file id.)

---

## Part F — Content repo must accept the event

Confirm `.github/workflows/build.yml` includes:

```yaml
on:
  repository_dispatch:
    types: [rebuild-site]
  workflow_dispatch:
```

`GH_EVENT_TYPE` / `event_type` in Apps Script must be exactly `rebuild-site` (unless you change both sides together).

Also ensure:

1. `config.json` has the real `spreadsheet_id`
2. `deploy_repo` / `deploy_branch` point at the website host
3. Actions secret `DEPLOY_TOKEN` is set (deploy PAT — Contents R/W on the **destination** repo)
4. Actions are enabled on the content repo

---

## Part G — End-to-end test

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
| Button does nothing | Script name typo | Assign `publishWebsite` or `showDriveImageBrowser` exactly |
| Browse images: missing folder | `DRIVE_FOLDER_ID` unset / wrong | Part E |
| Browse images: empty list | No image files in folder | Upload JPG/PNG/etc., then Refresh |
| Browse images: preview broken | Private file / Drive thumbnail delay | Still use Copy URL; click Make public; Refresh |
| Paste into cell writes wrong place | Wrong cell selected | Click the target `image` cell first |
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
