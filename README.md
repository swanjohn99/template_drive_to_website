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
3. Create a **PAT** and store it as Actions secret `DEPLOY_TOKEN` in **this** content repo (see below)

Without `deploy_repo` + `DEPLOY_TOKEN`, the Action only builds (and optionally commits) `site/` locally.

### 5. What is a PAT?

**PAT** = **Personal Access Token**. A password-like string GitHub issues to *your* account so automation can act as you.

Why it’s needed here:

- The Action runs in the **content** repo
- It must `git push` into a **different** repo (the website host)
- GitHub’s built-in `GITHUB_TOKEN` only works for the repo where the Action runs — it **cannot** push to someone else’s website repo
- So you create a PAT on an account that **already has write access** to the destination (you, as collaborator), and give the Action that token as `DEPLOY_TOKEN`

**Never** put a PAT in `config.json`, commit it, or paste it into issues/chat. Only store it as a GitHub Actions **secret**.

#### Create a fine-grained PAT (preferred)

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**  
   Direct link: https://github.com/settings/personal-access-tokens
2. **Resource owner**: your user (the collaborator on the website repo)
3. **Repository access**: Only select the **destination website repo** (not All repositories)
4. **Permissions** — set only what is listed below, leave everything else **No access**
5. Generate, copy the token once (starts with `github_pat_…`)

##### Fine-grained permissions (scopes)

| Permission | Access | Required? | Why |
|------------|--------|-----------|-----|
| **Contents** | **Read and write** | **Yes** | Clone the destination and `git push` built files |
| **Metadata** | **Read-only** | Yes (GitHub usually adds this automatically) | Resolve the repository |

Do **not** grant Administration, Actions, Secrets, Workflows, or other permissions. This template only needs to push static files.

#### Classic PAT (alternative)

1. **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**  
   Direct link: https://github.com/settings/tokens
2. Enable **only** the scope(s) below — nothing else
3. Generate and copy once (starts with `ghp_…`)

##### Classic scopes

| Destination repo visibility | Scope to enable | Notes |
|-----------------------------|-----------------|-------|
| **Public** (typical Pages site) | `public_repo` | Enough to push to public repos |
| **Private** | `repo` | Full repo scope; broader — prefer fine-grained instead |

Do **not** enable `workflow`, `admin:org`, `delete_repo`, or other unrelated classic scopes.

Fine-grained is safer because you lock the token to **one** destination repo. Classic `repo` / `public_repo` can reach every matching repo your account can access.

#### Store it as `DEPLOY_TOKEN`

1. Open **this content repo** on GitHub  
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**  
3. Name: `DEPLOY_TOKEN`  
4. Value: paste the PAT → Save  

The workflow clones/pushes the destination with that secret. If the token expires or is revoked, deploys fail until you create a new PAT and update the secret.

### 6. Run the Action

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
