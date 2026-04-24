#!/usr/bin/env python3
from __future__ import annotations

"""
Task 4 — Dashboard (Next.js) acceptance checks.

What this validates:
- `data/portfolio.json` shape and record count
- required dashboard and routing files for the product shell
- `next build` passes (TypeScript + static generation)

Seamless backend handoff (read this before changing code):
- **Current:** `lib/dashboard-aggregates.ts` calls `loadPortfolio()` which **imports** `data/portfolio.json` at build time. Aggregates, alerts, and the grants table are pure functions of `PortfolioGrant[]`.
- **Future (Supabase):** Replace or wrap `loadPortfolio()` in an async `lib/dashboard-data.ts` that maps DB rows to `PortfolioGrant` (or a slimmer DTO) using the same `computeMetrics`, `buildGrantRows`, `buildRecentAlerts`, etc. Keep the React tree in `app/page.tsx` a Server Component that `await`s the fetch, then passes serializable props to `GrantsTable` (Client Component) exactly as now.
- **Task 6:** The primary CTA targets `/agent` — mount `components/AgentFeed.tsx` and wire `EventSource` to `GET /api/investigate` on that page.

Exit codes: 0 = pass, 1 = fail.
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, List, Tuple

ROOT = Path(__file__).resolve().parent
PORTFOLIO = ROOT / "data" / "portfolio.json"
REQUIRED_PATHS: List[Path] = [
    ROOT / "app" / "page.tsx",
    ROOT / "app" / "layout.tsx",
    ROOT / "app" / "globals.css",
    ROOT / "app" / "agent" / "page.tsx",
    ROOT / "app" / "investigate" / "[award_id]" / "page.tsx",
    ROOT / "lib" / "dashboard-aggregates.ts",
    ROOT / "components" / "GrantsTable.tsx",
    ROOT / "package.json",
    ROOT / "next.config.mjs",
]


def run(cmd: List[str], cwd: Path) -> Tuple[int, str]:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return proc.returncode, (proc.stdout + "\n" + proc.stderr).strip()


def read_page_tsx() -> str:
    return (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")


def read_aggregates() -> str:
    return (ROOT / "lib" / "dashboard-aggregates.ts").read_text(encoding="utf-8")


def main() -> int:
    errors: List[str] = []

    for p in REQUIRED_PATHS:
        if not p.is_file():
            errors.append(f"Missing file: {p.relative_to(ROOT)}")

    if not PORTFOLIO.is_file():
        errors.append("Missing `data/portfolio.json`.")
    else:
        try:
            data: Any = json.loads(PORTFOLIO.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"`data/portfolio.json` is not valid JSON: {e}")
            data = None
        if data is not None:
            if not isinstance(data, list):
                errors.append("Portfolio data must be a JSON array.")
            elif len(data) != 73:
                errors.append(f"Expected 73 portfolio records, found {len(data)}.")
            elif len(data) > 0 and not all(isinstance(x, dict) for x in data):
                errors.append("Portfolio array items must be objects.")

    # Static integration points (survive refactors that keep names).
    try:
        page = read_page_tsx()
        if 'href="/agent"' not in page and "href='/agent'" not in page:
            errors.append("`app/page.tsx` must link the portfolio CTA to `/agent` (Task 6 feed).")
        if "GrantsTable" not in page or "loadPortfolio" not in page:
            errors.append("`app/page.tsx` should load portfolio data and render `GrantsTable`.")

        ag = read_aggregates()
        for needle in [
            "export function loadPortfolio",
            "export function computeMetrics",
            "export function buildGrantRows",
            "../data/portfolio.json",
        ]:
            if needle not in ag:
                errors.append(f"`lib/dashboard-aggregates.ts` missing expected symbol/export: {needle!r}.")

        grants = (ROOT / "components" / "GrantsTable.tsx").read_text(encoding="utf-8")
        if "/investigate/" not in grants or "router.push" not in grants:
            errors.append("Row navigation to `/investigate/[award_id]` not found in `GrantsTable.tsx`.")

        # Brand and theme markers (soft checks — warn only).
        css = (ROOT / "app" / "globals.css").read_text(encoding="utf-8")
        if "#0f6e56" not in css.lower() and "0F6E56" not in css:
            errors.append("Brand green #0F6E56 not found in `app/globals.css` (check casing).")
    except OSError as e:
        errors.append(f"Error reading file for static checks: {e}")

    # Next build (catches type errors, missing imports, and React issues).
    code, out = run(["npm", "run", "build"], ROOT)
    if code != 0:
        # Truncate only for the error summary; still useful in CI.
        tail = out[-8000:] if len(out) > 8000 else out
        errors.append(f"`npm run build` failed (exit {code}).\n{tail}")

    if errors:
        print("TASK 4 CHECK: FAIL")
        for e in errors:
            print(f"- {e}")
        return 1

    print("TASK 4 CHECK: PASS")
    print("- `data/portfolio.json` present and count is 73.")
    print("- Dashboard route files and `lib/dashboard-aggregates.ts` are in place.")
    print("- CTA to `/agent` and investigation routes are wired for Tasks 5–6.")
    print("- `npm run build` completed successfully (no type errors).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
