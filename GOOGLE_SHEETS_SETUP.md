# Google Spreadsheet + Apps Script setup

This guide is for the **web hosting repo** after you copy the **public template** into it. The template repo’s GitHub owner is irrelevant.

**Pages requirement:** host repo name **must** be **`owner.github.io`**. GitHub only serves the root user/org site from that name. CI enforces it.

Publish from a public Google Sheet into that host. Pages from **`main` / root**. **No `DEPLOY_TOKEN`.**

Copy-paste script: [`google-apps-script/Code.gs`](google-apps-script/Code.gs) · Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## What you will end up with

1. Public Google Spreadsheet + **Import/Export** menu / Publish button
2. Public template copied into **`owner.github.io`** (required website host name)
3. Pages: **Deploy from a branch → `main` → `/` (root)**
4. Click Publish → Action builds → commits site files on `main`

**One token only** (from the **hosting** repo owner — not related to who owns the public template):

| Token | Where | Purpose |
|-------|-------|---------|
| **`GH_PAT`** | Apps Script Script properties | Hosting-owner fine-grained PAT — **Actions R/W on `owner.github.io` only** — starts the Action |

After setup, non-technical owners only edit the Sheet / Drive and click Publish. No GitHub config file. Add a technical contributor on the hosting repo for design/template changes.

---

## Part 0 — Hosting repo (required)

1. Repo name **must** be **`{owner}.github.io`** — required for Pages at `https://owner.github.io/`
2. Copy the public template into that repo (template owner does not matter)
3. **Settings → Pages → Deploy from a branch → `main` → `/` (root)**
4. Actions enabled; workflow can commit with `GITHUB_TOKEN`

CI runs `scripts/check_host_repo.py` and **fails** if the name is not `owner.github.io` or Pages is not `main` + `/`.

---

## Part A — Spreadsheet content

### A1. Create the spreadsheet

Google Sheets → Blank → rename (e.g. `My Site Content`)

### A2. Content tab

1. Rename the data tab to **`your website content`**
2. Headers in row 1:

| title | description | image (or **Picture URLs**) | section | order | published |
|-------|-------------|-----------------------------|---------|-------|-----------|

`Picture URLs` is written by **Import Picture URLs** in Apps Script; the builder treats it the same as `image`.

### A2b. Settings tab

1. Add a second tab named **`settings`**
2. Headers: **`key`** | **`value`**
3. Rows (examples):

| key | value |
|-----|-------|
| site_title | Your Brand |
| site_tagline | One short line |
| image_max_width | 1400 |
| image_quality | 82 |

Publish sends these to the Action. Missing tab → builder defaults (`Photo Journal`, etc.).

### A3. Share publicly

**Anyone with the link → Viewer** (needed if the Action falls back to CSV export).

Publish-from-sheet usually sends rows + settings inline — you do **not** need a repo config file. Optional fallback: Actions var `SPREADSHEET_ID`.

### A4. Drive pictures

Each **image file** must be **Anyone with the link → Viewer** (the Action downloads by file id without Google login). Parent-folder sharing alone is not reliable — open each link in incognito to confirm the preview loads without sign-in. `?usp=drivesdk` in the URL is fine; redirects that drop it are normal.

Put id/URL in `image` or **`Picture URLs`**. Optional: sibling folder **`Pictures`** for **Import Picture URLs** (writes into the **`your website content`** tab, same as Publish).

---

## Part B — Owner fine-grained PAT (`GH_PAT`)

Created by the **owner** of `owner.github.io` (unrelated to who owns the public template).

1. https://github.com/settings/personal-access-tokens → **Fine-grained** → Generate
2. **Resource owner**: the hosting repo owner
3. **Repository access**: **Only select repositories** → pick **`owner.github.io`** (the token must not list zero repositories)
4. Permissions:

| Permission | Access |
|------------|--------|
| **Actions** | **Read and write** |
| **Contents** | **Read and write** (required for `repository_dispatch`; Actions alone often returns 403) |
| **Metadata** | **Read-only** (usually auto-selected) |

5. Copy once → Apps Script `GH_PAT`

**Collaborators:** a fine-grained PAT from a collaborator works if the token is scoped to the hosting repo with the same permissions. The hosting repo owner’s PAT is the default recommendation.

**Test (PowerShell):** `Invoke-RestMethod -Method POST -Uri "https://api.github.com/repos/owner/owner.github.io/dispatches" -Headers @{ Authorization = "Bearer YOUR_PAT"; Accept = "application/vnd.github+json"; "X-GitHub-Api-Version" = "2022-11-28" } -Body '{"event_type":"rebuild-site"}' -ContentType "application/json"` → no error means **204** success.

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
| `SETTINGS_SHEET_NAME` | `settings` | Optional |

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
| Apps Script `401`/`403` on dispatch | Fine-grained PAT: hosting repo **selected**, **Contents R/W** + **Actions R/W**; token from owner or scoped collaborator |
| Apps Script `404` | `GH_REPO` must be the hosting URL |
| “Sheet tab not found” | Tab `your website content` or set `CONTENT_SHEET_NAME` |
| Wrong brand / image size | Edit **`settings`** tab (`site_title`, `site_tagline`, `image_max_width`, `image_quality`) |
| Action succeeds, no `images/` | Sheet uses **`Picture URLs`** column (Import Picture URLs) — builder supports it; or use `image` header. Check Drive per-file public share. Action log: `WARN no images saved` |
| Empty site | Public share sheet/Drive; or check dispatch payload / `SPREADSHEET_ID` fallback |

---

## Security notes

- Store `GH_PAT` only in Apps Script Script properties
- Limit who can edit the Apps Script project
- Never commit PATs; never add `DEPLOY_TOKEN`
- Rotate if leaked
