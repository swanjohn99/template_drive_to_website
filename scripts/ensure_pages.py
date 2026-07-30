#!/usr/bin/env python3
"""Ensure GitHub Pages on the destination repo uses branch + folder publishing.

Intended for the destination website repo (not this content repo).
Uses DEPLOY_TOKEN against the GitHub Pages API.

Exit 0 always unless required env is missing — permission failures print
manual steps so existing Contents-only PATs keep working.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


API = "https://api.github.com"


def die(msg: str, code: int = 1) -> None:
    print(f"::error::{msg}")
    sys.exit(code)


def gh(method: str, path: str, token: str, body: dict | None = None) -> tuple[int, dict | list | None]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "drive-sheets-static-site-ensure-pages",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = {"message": raw}
        return e.code, payload


def pages_path_for_deploy(deploy_path: str) -> str | None:
    """Map deploy_path to a GitHub Pages source path (/ or /docs only)."""
    p = (deploy_path or ".").strip().strip("/")
    if p in ("", "."):
        return "/"
    if p == "docs":
        return "/docs"
    return None


def site_url(owner: str, repo: str) -> str:
    owner_l, repo_l = owner.lower(), repo.lower()
    if repo_l == f"{owner_l}.github.io":
        return f"https://{owner_l}.github.io/"
    return f"https://{owner_l}.github.io/{repo}/"


def naming_notes(owner: str, repo: str) -> list[str]:
    notes: list[str] = []
    owner_l, repo_l = owner.lower(), repo.lower()
    user_site = f"{owner_l}.github.io"
    if repo_l == user_site:
        notes.append(
            f"User/org site name OK: `{owner}/{repo}` → {site_url(owner, repo)}"
        )
    elif repo_l.endswith(".github.io"):
        notes.append(
            f"Repo `{repo}` ends with `.github.io` but owner is `{owner}`. "
            f"Apex user/org sites must be named exactly `{owner}.github.io` "
            f"(case-insensitive). This will be a project site at "
            f"{site_url(owner, repo)} unless renamed."
        )
    else:
        notes.append(
            f"Project site: `{owner}/{repo}` → {site_url(owner, repo)}. "
            f"For an apex URL (`https://{owner_l}.github.io/`), name the "
            f"destination repo `{owner}.github.io`."
        )
    return notes


def main() -> int:
    token = os.environ.get("DEPLOY_TOKEN", "").strip()
    deploy_repo = os.environ.get("DEPLOY_REPO", "").strip()
    branch = (os.environ.get("DEPLOY_BRANCH") or "main").strip()
    deploy_path = (os.environ.get("DEPLOY_PATH") or ".").strip() or "."

    if not token:
        die("DEPLOY_TOKEN is required to configure Pages")
    if not deploy_repo or "/" not in deploy_repo:
        die("DEPLOY_REPO must be owner/repo")

    owner, repo = deploy_repo.split("/", 1)
    pages_path = pages_path_for_deploy(deploy_path)

    print("Destination Pages checklist")
    for line in naming_notes(owner, repo):
        print(f"  - {line}")

    if pages_path is None:
        print(
            f"::warning::deploy_path `{deploy_path}` is not `/` or `docs`. "
            "GitHub Pages branch publishing only supports source folders `/` "
            "or `/docs`. Enable Pages manually or set deploy_path to `.` or `docs`."
        )
        return 0

    desired = {
        "build_type": "legacy",
        "source": {"branch": branch, "path": pages_path},
    }
    print(
        f"Ensuring Pages: {owner}/{repo} → branch `{branch}`, path `{pages_path}`"
    )

    status, current = gh("GET", f"/repos/{owner}/{repo}/pages", token)
    if status == 404:
        create_status, create_body = gh(
            "POST", f"/repos/{owner}/{repo}/pages", token, desired
        )
        if create_status in (201, 204):
            print(f"Enabled GitHub Pages. Site: {site_url(owner, repo)}")
            return 0
        msg = (create_body or {}).get("message", create_body)
        print(
            f"::warning::Could not enable Pages ({create_status}): {msg}. "
            "Grant fine-grained PAT permission Pages: Read and write on the "
            f"destination, or set Settings → Pages → Deploy from branch → "
            f"`{branch}` / `{pages_path}` manually."
        )
        return 0

    if status == 403:
        print(
            "::warning::DEPLOY_TOKEN cannot read Pages settings (need Pages: "
            "Read and write). Skipping auto-configure; verify Settings → Pages "
            f"manually: branch `{branch}`, folder `{pages_path}`."
        )
        return 0

    if status != 200 or not isinstance(current, dict):
        print(f"::warning::Unexpected Pages GET {status}: {current}")
        return 0

    src = current.get("source") or {}
    cur_branch = src.get("branch")
    cur_path = src.get("path")
    build_type = current.get("build_type") or "legacy"
    html_url = current.get("html_url") or site_url(owner, repo)

    if (
        build_type == "legacy"
        and cur_branch == branch
        and cur_path == pages_path
    ):
        print(f"Pages already correct. Site: {html_url}")
        return 0

    print(
        f"Updating Pages (was build_type={build_type}, "
        f"branch={cur_branch}, path={cur_path})"
    )
    put_status, put_body = gh(
        "PUT", f"/repos/{owner}/{repo}/pages", token, desired
    )
    if put_status in (200, 204):
        print(f"Updated GitHub Pages. Site: {html_url}")
        return 0

    msg = (put_body or {}).get("message", put_body) if isinstance(put_body, dict) else put_body
    print(
        f"::warning::Could not update Pages ({put_status}): {msg}. "
        f"Set Settings → Pages → Deploy from branch → `{branch}` / `{pages_path}`."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
