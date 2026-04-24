# GrantShield — engineering handbook

This document is the **technical deep dive** for the web UI and data wiring that sit alongside the main team `README.md` (onboarding, Supabase, and task ownership). Read this if you need to own the codebase the way the original author would: structure, data flow, tradeoffs, and what to change for production.

---

## 1. What this slice of the repo is

- **Next.js 14 (App Router)** app under `app/`: server components by default, a few **client** islands (`"use client"`) only where interactivity is required.
- **Demo / local data** for the UI: `data/portfolio.json` is a static array of **73** `PortfolioGrant`-shaped records (from Task 3), imported at build time. The “real” product path in the org is **Supabase** + populate scripts; the UI is written so you can **swap the data source** without rewriting screens.

- **Type source of truth:** `lib/types.ts` (Task 1). The team rule is: **do not edit** this file unless the whole product agrees on a schema change. All UI and lib code should conform to these interfaces.

---

## 2. Stack and tooling

| Piece | Version / note |
|--------|----------------|
| **Runtime** | Node 20+ recommended |
| **Framework** | Next.js 14.x, React 18, TypeScript 5.4+ strict |
| **Path alias** | `@/*` → repo root (see `tsconfig.json`) |
| **Data (backend demo)** | `@supabase/supabase-js` for `scripts/` / `lib/db` — not used by the static dashboard yet |
| **Populate script** | `tsx` with `--env-file=.env.local` for `db:populate` |
| **Checks** | Python 3: `task4check.py`, `task5check.py` (and older `task1check`–`task3check` for types / risk / portfolio data) |

**Commands:**

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build; must pass for CI-style checks
npm run start        # after build
npm run db:populate  # requires .env.local (Supabase + optional FAC key)
```

---

## 3. Directory map (web UI and libs)

```
app/
  layout.tsx              # Root layout, global CSS import
  globals.css             # Design tokens, buttons, source colors, table scroll
  page.tsx                # Dashboard (portfolio home)
  agent/page.tsx          # Task 6 placeholder — “Investigate Portfolio” CTA target
  investigate/
    [award_id]/
      page.tsx            # Task 5 — loads one PortfolioGrant, renders InvestigationView
      not-found.tsx       # Unknown award_id

components/
  GrantsTable.tsx         # Client: sort, top-10 default, row → /investigate/:id
  investigation/
    InvestigationView.tsx # Server: full investigation layout
    InvestigationActions.tsx  # Client: action stubs + “Mark as reviewed” + localStorage
    EvidenceIcon.tsx        # SVG: triangle / “clock” / check for evidence rows

lib/
  types.ts                 # **Frozen** shared interfaces
  dashboard-aggregates.ts  # loadPortfolio, metrics, alerts, trend, table rows
  investigation-data.ts    # getPortfolioGrantByAwardId, formatting helpers
  investigation-evidence.ts  # Per-source evidence bullets from PortfolioGrant
  investigation-briefing.ts  # Sunrise vs placeholder briefing text
  investigation-timeline.ts  # Sort timeline, severity → dot color
  (risk-scoring, fetchers, db/)  # rest of monolith — not all consumed by this UI yet

data/
  portfolio.json           # 73 records; primary input for the current UI

public/
  grant_logo.png           # Header logo (copy of repo `grant_logo.png` for static serving)
```

`next.config.mjs`, `tsconfig.json`, `next-env.d.ts` are standard Next/TS setup.

---

## 4. Data model (what the UI expects)

A **`PortfolioGrant`** (`lib/types.ts`) bundles:

- **`grant`** — `Grant` (USASpending-shaped): `award_id`, `recipient_name`, UEI, CFDA, amounts, dates, `burn_rate_pct`, `time_elapsed_pct`, `burn_time_ratio`, etc.
- **`audit`** (optional) — `AuditData` + `findings[]`
- **`sam`**, **`crustdata`** (optional in type; usually present in JSON demo)
- **`risk`** — `RiskScore` (`total` on a 0–10 **display** scale in the product, `level` severity, `signals[]`)
- **`timeline`** — `TimelineEvent[]` (date, source, severity, description)

The JSON may include extra fields (e.g. `audits`, `risk_score` aliases); the code paths use the canonical fields above.

---

## 5. Routes and user flows

| URL | Renders | Data |
|-----|---------|------|
| `/` | Dashboard: metrics, alerts, risk bars, 6-month trend, grants table | `loadPortfolio()` from JSON |
| `/investigate/[award_id]` | Investigation: header, 2×2 evidence, timeline, AI briefing, actions | `getPortfolioGrantByAwardId(award_id)` |
| `/agent` | Placeholder for Task 6 agent feed (SSE) | None |

- Dashboard table and rows navigate to **`/investigate/{award_id}`** (URL-encoded as needed).  
- “**Investigate Portfolio**” (green) links to **`/agent`**.

**Dynamic vs static:** `/investigate/[award_id]` is **dynamic** (rendered on demand). Home is statically generated in production build for the data baked at build time.

---

## 6. Task 4 — Dashboard (implementation details)

**File:** `app/page.tsx` (and helpers in `lib/dashboard-aggregates.ts`).

**Behavior:**

- **Metrics** — Computed from the full JSON: active count, total/disbursement, mean risk, finding counts, quarter-closing copy where applicable. Numbers use monospace utility class `num` where specified.
- **Risk distribution** — Buckets: Low / Medium / **High+Critical** (grouped in one “High” bar in the spec language).
- **Alerts** — Built from `timeline` events, deduped, excluding generic “Composite risk score” lines, newest first, capped to 6. Dot color maps severity to red/amber/blue.
- **6-month trend** — **Synthetic** smooth series anchored to the portfolio mean (until a real time series exists). `buildSixMonthRiskTrend` in `lib/dashboard-aggregates.ts`.
- **Trend chart (SVG)** — Custom SVG in `TrendChart` (same file as page). It was iteratively fixed so **x-axis month labels** do not clip: wider `viewBox`, horizontal insets, **start/middle/end** `textAnchor` for first/last/inner labels, bottom padding for label row, `preserveAspectRatio="xMidYMid meet"`.
- **Grants table** — Client component `GrantsTable.tsx`: default **top 10 by risk**; optional “show all 73”; sort by risk, name, amount, burn. Pills: High/Medium/Low (critical shown as “High” for the pill label). Burn column: mini bar + percent.

**Header branding:**

- Wordmark: **grantshield** in white; logo image **`/grant_logo.png`** in `public/` (Next `Image`).

**Styling:** Dark, Bloomberg-like palette in `app/globals.css` (CSS variables: `--bg-0`, `--border`, `--brand` **#0f6e56**, etc.).

---

## 7. Task 5 — Investigation view (implementation details)

**Entry:** `app/investigate/[award_id]/page.tsx`  
- Resolves the grant; **`notFound()`** → `not-found.tsx` if `award_id` is missing from JSON.

**Server UI:** `components/investigation/InvestigationView.tsx`

- **Back** link: “← Back to portfolio” → `/`.
- **Header:** Name; metadata (city, state, UEI, CFDA, grant id); second line: award $, date range, **period remaining %** = `100 - time_elapsed_pct` (capped 0–100).
- **Risk badge** — `riskBadgeLabel` in `lib/investigation-data.ts` (red/amber/green panel by level).
- **Evidence grid (2×2)** — `buildEvidenceBySource` in `lib/investigation-evidence.ts`. Source **dot colors:** USASpending **blue**, FAC **purple**, SAM **orange**, Crustdata **green**.  
  Icons: `EvidenceIcon` maps internal severity to **triangle** (critical/high), **clock** (warning tier), **check** (ok).
- **Timeline** — `getTimelineForInvestigationPage` (newest first, max 7). Vertical rail + severity-colored dot; small **source pill** per event (tinted from same palette as evidence).
- **AI briefing** — `getInvestigationBriefing` in `lib/investigation-briefing.ts`: long **cached paragraph** for Sunrise / `HRSA-00001`; all others get a short placeholder that references future **`/api/briefing`** (Task 7).

**Client:** `components/investigation/InvestigationActions.tsx`

- **Stubs** (alert): Generate corrective action letter, Draft IG referral, Request site visit, Export full report.
- **“Mark as reviewed”** (product-critical demo): **Amber** CTA (`.btn-mark-reviewed` in `globals.css` — not green workflow, not error red) placed **in the same flex row** as other actions, **immediately after** “Export full report.”  
- On click, writes **`localStorage`** key:  
  `grantshield:review:<award_id>`  
  Value JSON:  
  `{ reviewer: "Sarah Chen, GMS", timestamp: ISO string, grant_id, signals_seen: string[] }`  
  where `signals_seen` is the list of **`risk.signals[].label`**.  
- UI replaces the button with an amber **banner** (`.mark-reviewed-banner`) showing **“Reviewed — &lt;localized date/time&gt;**” from `timestamp`.

---

## 8. Styling and component conventions (buttons)

Key classes in `app/globals.css`:

- `.num` — tabular / monospace for figures.
- `.btn-portfolio` — brand green primary (corrective letter, “Investigate portfolio,” etc.).
- `.btn-investigate` — neutral outline.
- `.btn-mark-reviewed` — **gold/amber** gradient, dark text; paired with `.mark-reviewed-banner` for the post-click state.
- Pills, source classes (`.src-usa`, `.src-fac`, …) for tags.

**Fonts:** Inter + JetBrains Mono (Google Fonts link in `globals.css`).

---

## 9. Verification scripts (Python)

These are **contract + build** checks, not E2E browser tests.

| Script | What it enforces (high level) |
|--------|------------------------------|
| `task4check.py` | `portfolio.json` (73 rows), key files, dashboard wiring, `npm run build` |
| `task5check.py` | Investigation files, `localStorage` / mark-reviewed markers, `npm run build` |
| `task1check`–`task3check` | Types, risk module, portfolio shape (as designed earlier) |

Run from repo root: `python3 task4check.py` and `python3 task5check.py`.

---

## 10. Environment and database (outside the static UI path)

- **`.env.local`** (not committed) — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `FAC_API_KEY`. See `.env.example`.
- **`npm run db:populate`** — fills Supabase from public APIs; uses `lib/db/`, `scripts/populate.ts`. The **Next dashboard** does not call Supabase until you replace `loadPortfolio` / `getPortfolioGrantByAwardId` with server-side queries.

---

## 11. How to wire production data without rewriting the UI

**Dashboard**

1. Add a server-only module (e.g. `lib/dashboard-data.server.ts`) that fetches from Supabase and **maps rows** into aggregates or a `PortfolioGrant[]`.
2. Replace `loadPortfolio()` usage in `app/page.tsx` with `await`ed data (or pass props from a parent async server component).
3. Keep `GrantsTable` props **JSON-serializable** (plain objects, numbers, strings).

**Investigation**

1. Replace `getPortfolioGrantByAwardId` in `lib/investigation-data.ts` with a DB call that returns the same `PortfolioGrant` shape (or a thin mapper).
2. Replace `getInvestigationBriefing` with `fetch` to `POST /api/briefing` when Task 7 exists; keep Sunrise copy as **offline** fallback if desired.
3. **Mark as reviewed:** replace `localStorage` with `POST` to your API; persist `reviewer` from auth; same JSON body shape for an easy migration.

**Task 6** — Point `/agent` to `EventSource` + `components/AgentFeed` when implemented.

---

## 12. Non-goals and known limitations (current branch)

- Risk score **comment** in `types.ts` may say 0–100; the dataset and UI treat **`risk.total` as 0–10** for display. Align types with product when you centralize.
- **Trend line** is synthetic for demo; not historical API data.
- **Several action buttons** are `alert` stubs.
- **Simple Browser** / where localhost opens (Cursor) is an **IDE** behavior, not something this repo controls.

---

## 13. Quick reference: important IDs and keys

- **Demo flagship grant:** `HRSA-00001` — Sunrise Community Health Inc. (9.2 / critical in JSON).
- **localStorage review key pattern:** `grantshield:review:<award_id>`.
- **Brand green (UI):** `#0f6e56` (`--brand` in CSS).

---

## 14. Relationship to `README.md`

- **`README.md`** — team process, who owns which task, database navigation, one-time setup, SQL snippets.
- **`ENGINEERING.md` (this file)** — how the **Next app and investigation UI** are put together, file-by-file behavior, and extension points.

If both conflict, the **code** wins; **update the closer doc** when you change behavior.

---

*Last aligned with: Next 14, portfolio demo with 73 records, Task 4 + Task 5 UI as described above.*
