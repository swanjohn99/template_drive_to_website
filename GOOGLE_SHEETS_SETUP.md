# Google Spreadsheet + Apps Script setup

Publish from a public Google Sheet into the **web hosting repo** (`owner.github.io`) where this template was copied. That repo hosts GitHub Pages from **`main` / root**. **No `DEPLOY_TOKEN`.**

Copy-paste script: [`google-apps-script/Code.gs`](google-apps-script/Code.gs) · Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## What you will end up with

1. Public Google Spreadsheet + **Import/Export** menu / Publish button
2. Template copied into **`owner.github.io`** (website host)
3. Pages: **Deploy from a branch → `main` → `/` (root)**
4. Click Publish → Action builds → commits site files on `main`

**One token only:**

| Token | Where | Purpose |
|-------|-------|---------|
| **`GH_PAT`** | Apps Script Script properties | Owner fine-grained PAT — **Actions R/W on the hosting repo only** — starts the Action |

---

## Part 0 — Hosting repo (required)

1. Repo name must be **`{owner}.github.io`**
2. Copy this template into that repo
3. **Settings → Pages → Deploy from a branch → `main` → `/` (root)**
4. Actions enabled; workflow permissions allow the default `GITHUB_TOKEN` to commit (contents write is set in the workflow)

CI runs `scripts/check_host_repo.py` and fails if naming or Pages settings are wrong.

---

## Part A — Spreadsheet content

### A1. Create the spreadsheet

Google Sheets → Blank → rename (e.g. `My Site Content`)

### A2. Content tab

1. Rename the data tab to **`your website content`**
2. Headers in row 1:

| title | description | image | section | order | published |
|-------|-------------|-------|---------|-------|-----------|

### A3. Share publicly

**Anyone with the link → Viewer** (needed if the Action falls back to CSV export).

Publish-from-sheet usually sends rows inline — you do **not** need `spreadsheet_id` in `config.json` for that path. Optional fallback: Actions var `SPREADSHEET_ID` or `config.json`.

### A4. Drive pictures

Files: **Anyone with the link → Viewer**. Put id/URL in `image`. Optional: sibling folder **`Pictures`** for **Import Picture URLs**.

---

## Part B — Owner fine-grained PAT (`GH_PAT`)

Created by the **owner** of `owner.github.io` (not a separate content-repo token).

1. https://github.com/settings/personal-access-tokens → **Fine-grained** → Generate
2. **Resource owner**: the hosting repo owner
3. **Repository access**: **Only** `owner.github.io`
4. Permissions:

| Permission | Access |
|------------|--------|
| **Actions** | **Read and write** |
| **Metadata** | **Read-only** |
| Contents | Read-only only if dispatch returns 404 without it |

5. Copy once → Apps Script `GH_PAT`

Do **not** create or document a deploy PAT / `DEPLOY_TOKEN`.

---

## Part C — Apps Script

### C1. Paste script

Extensions → Apps Script → paste [`google-apps-script/Code.gs`](google-apps-script/Code.gs) → Save

### C2. Script properties

| Property | Example | Notes |
|----------|---------|-------|
| `GH_PAT` | `github_pat_…` | Owner fine-grained; hosting repo only |
| `GH_REPO` | `https://github.com/owner/owner.github.io` | Full hosting repo URL |
| `GH_EVENT_TYPE` | `rebuild-site` | Optional |
| `CONTENT_SHEET_NAME` | `your website content` | Optional |

Legacy: name-only `GH_REPO` + `GH_OWNER` still parses.

### C3. Authorize

Run `checkPublishConfig` once → Allow. Refresh sheet for **Import/Export** menu.

### C4. Optional drawing button

Insert → Drawing → Assign script: `publishWebsite`

---

## Part D — End-to-end

1. Edit the **`your website content`** tab → Publish website
2. Open `https://github.com/owner/owner.github.io/actions`
3. When green: `https://owner.github.io/`

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| CI: repo name error | Rename / use `{owner}.github.io` |
| CI: Pages not enabled / wrong branch | Pages → branch `main`, folder `/` |
| Apps Script `401`/`403` | New owner fine-grained PAT, Actions R/W on hosting repo only |
| Apps Script `404` | `GH_REPO` must be the hosting URL |
| “Sheet tab not found” | Tab `your website content` or set `CONTENT_SHEET_NAME` |
| Empty site | Public share sheet/Drive; or check dispatch payload / `SPREADSHEET_ID` fallback |

---

## Security notes

- Store `GH_PAT` only in Apps Script Script properties
- Limit who can edit the Apps Script project
- Never commit PATs; never add `DEPLOY_TOKEN`
- Rotate if leaked
