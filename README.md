# GrantShield

Agentic federal grant oversight tool. Cross-references USASpending, the Federal Audit Clearinghouse (FAC), SAM.gov, and Crustdata to flag risky grantees for program officers.

**Engineering deep dive (Next.js app, data flow, files, extension points):** see **[ENGINEERING.md](./ENGINEERING.md)**.

---

## What's done so far

- **Task 1 — Types** → `lib/types.ts`. All shared interfaces (Grant, AuditData, SamEntity, etc.). Don't modify this file.
- **Supabase database** → 7 tables in `supabase/schema.sql`, live in a real Supabase project, already populated with **~1,000 real HRSA Health Center grants** (CFDA 93.224) + **real FAC audit findings** pulled from public APIs.
- **Live fetchers** → `lib/fetchers/` hits USASpending (works), FAC (works with free key), SAM (needs key), Crustdata (stub).
- **Populate script** → `npm run db:populate` refills the DB from the public APIs. Idempotent.

### What's *not* done (pick yours up below)

- **Task 2 — Risk Scoring Engine** (no owner yet — needs one)
- **Task 4** — Dashboard (Person 2) — **✓ initial UI:** `app/page.tsx`, `lib/dashboard-aggregates.ts`, `components/GrantsTable.tsx`, routes `/agent` (Task 6 placeholder) and `/investigate/[award_id]` (Task 5 placeholder). Data: `data/portfolio.json`. Verify: `python3 task4check.py`.
- **Task 5** — Investigation View (Person 3) — **✓ initial UI:** `app/investigate/[award_id]/page.tsx` (id = award_id), `components/investigation/*`, `lib/investigation-*.ts`. Data: `getPortfolioGrantByAwardId` → `data/portfolio.json` (Sunrise = `HRSA-00001`). “Mark as reviewed” → `localStorage` key `grantshield:review:<award_id>`. Verify: `python3 task5check.py`.
- **Task 6** — Agent Feed + SSE (Person 4)
- **Task 7** — LLM Briefing (Person 5)
- **Task 8** — Intro Cards (Person 5)
- **Task 9** — End-to-end integration (whoever has bandwidth)

---

## For database

The plan had Task 3 create a file `data/portfolio.json` with 73 fake demo records. **We skipped that and built a live Supabase database with real data instead.** 
Can continue with original plan, Supabase - was to just get the view of the data available. 

Consequences:

- Task 4 (Dashboard), Task 5 (Investigation View) should **query Supabase**, not load a JSON file.
- The "Sunrise Community Health" top-case is fictional and isn't in the real data. We have two choices:
  1. **Hand-insert one fake Sunrise row** into Supabase so the demo has a guaranteed 9.2 critical case.
  2. **Find the actual highest-risk real grantee** in our data and feature them instead.

Decide as a team before Task 5 starts. If you pick option 1, someone writes a one-off SQL insert script.

---

## Setup (every teammate, one-time, ~5 min)

You need Node 20+ and Git.

1. Clone the repo and install:
   ```
   git clone <repo-url>
   cd grantshield
   npm install
   ```

2. Create your own `.env.local` by copying `.env.example`:
   ```
   cp .env.example .env.local
   ```

3. Shifa will send you:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

   Paste them into `.env.local`. **Never commit this file.** (Also never paste the service role key into Slack — use a password manager.)

4. (Optional, only if you plan to run the populate script yourself) Grab a free FAC key at https://app.fac.gov/developers and add `FAC_API_KEY` to `.env.local`.

Verify setup:
```
npx tsc --noEmit --strict lib/types.ts
```
No output = you're good.

---

## How to view the database

Shifa will invite you to the Supabase project by email. Once accepted:

1. Go to https://supabase.com/dashboard and open the project.
2. **Table Editor** (left sidebar) → click any of the 7 tables to browse rows:
   - `grants` — ~1,000 real federal awards. **This is the main table.**
   - `audit_data`, `audit_findings` — real FAC records
   - `risk_scores`, `timeline_events` — placeholder rows (zero risk) until Task 2 is done
   - `sam_entities`, `crustdata_profiles` — empty (waiting on API keys)
3. **SQL Editor** → **New query** → write SQL to explore.

Handy queries to get a feel for the data:

```sql
-- 10 largest grants in the portfolio
select recipient_name, state, award_amount
from grants
order by award_amount desc
limit 10;

-- Grantees that have material weaknesses in their audits
select g.recipient_name, g.state, af.year, af.type_requirement
from grants g
join audit_findings af on af.auditee_uei = g.recipient_uei
where af.is_material_weakness = true
order by af.year desc;

-- Burn-rate outliers (spending too fast or too slow vs. time elapsed)
select recipient_name, burn_rate_pct, time_elapsed_pct, burn_time_ratio
from grants
where burn_time_ratio > 1.3 or (burn_time_ratio < 0.5 and burn_time_ratio > 0)
order by burn_time_ratio desc;
```

To query from code instead of the dashboard, use `lib/db/client.ts`:
```ts
import { supabase } from "@/lib/db/client";
const { data, error } = await supabase.from("grants").select("*").limit(10);
```
Note: `lib/db/client.ts` has `import "server-only"` — it only works in Server Components or API routes, not in client components or a plain Node script (the populate script works around this with a Node flag in the `db:populate` npm script).

---

## Your task, spelled out

### Task 2 — Risk Scoring Engine (unassigned — please claim)
Build `lib/risk-scoring.ts`. Export one function:
```ts
export function computeRiskScore(
  grant: Grant,
  audits: AuditData,
  sam: SamEntity,
  crustdata: CrustdataProfile
): RiskScore
```
Weighted model described in the original spec (Tier 1 = 2–3 pts, Tier 2 = 1–2 pts, Tier 3 = 0.5–1 pt; cap at 10).

After you ship it, patch `scripts/populate.ts` to call it instead of using the placeholder `{ total: 0, level: "low", signals: [] }`. Then rerun `npm run db:populate` to backfill real scores.

### Task 4 — Dashboard (Person 2)
**Status (2026-04-24):** Next.js app is wired locally. `npm run dev` serves the dashboard at `/`. Summary metrics, risk distribution, alerts, 6‑month trend (synthetic until history API exists), and a sortable grants table are driven by `data/portfolio.json` via `lib/dashboard-aggregates.ts` (swap `loadPortfolio()` later for Supabase). `python3 task4check.py` runs `npm run build` and file checks.

**Future changes (when backend is ready):** replace the static JSON import with a server-side Supabase query returning the same aggregates; keep `GrantsTable` props JSON-serializable; point the “Investigate Portfolio” button at `/agent` (Task 6 SSE) — already linked.

Build `app/page.tsx` per the design spec (dark theme, Bloomberg aesthetic). Query Supabase from a Server Component:
```ts
const { data: grants } = await supabase
  .from("grants")
  .select("*, risk_scores(total, level)")
  .order("risk_scores(total)", { ascending: false })
  .limit(10);
```
While Task 2 isn't done, every row's risk score will be 0. You can mock the top-10 with hardcoded values to unblock yourself, then swap once Task 2 lands.

Also does Task 9 (integration) unless someone else picks it up.

### Task 5 — Investigation View (Person 3)
**Status (2026-04-24):** Investigation view is implemented. Route: `app/investigate/[award_id]/page.tsx` (same id the dashboard table uses; original spec’s `[id]` = `award_id`). The page resolves a `PortfolioGrant` via `getPortfolioGrantByAwardId` in `lib/investigation-data.ts` (currently from `data/portfolio.json` through `loadPortfolio()`). Renders: back link, entity header, 2×2 evidence cards (source-colored dots: USASpending blue, FAC purple, SAM orange, Crustdata green; severity icons), vertical timeline (newest first, up to 7 events), AI briefing (hardcoded **Sunrise** / `HRSA-00001` copy; others get a text placeholder that points to Task 7), and action buttons (stubs for four exports / letters; **Mark as reviewed** is real and appends a JSON line to `localStorage` for demo assurance).

**Seamless backend swap:** keep `InvestigationView` and child props; replace `getPortfolioGrantByAwardId` with a Supabase query (join grants + audit + …) and map rows into `PortfolioGrant` or a forward-compatible DTO. Replace `getInvestigationBriefing` with `POST /api/briefing` (Task 7) while keeping the Sunrise string as a cached demo fallback. For production, replace the client-only review log with `POST` to your API and store reviewer identity from session/auth — keep the same JSON shape: `{ reviewer, timestamp, grant_id, signals_seen }`. *Earlier brief:* wire Supabase by `award_id` and all seven tables; add `/api/briefing` for the AI card (now partially reflected above).

### Task 6 — Agent Feed + SSE (Person 4)
`app/api/investigate/route.ts` streams 6 hardcoded `AgentStep` events with 3-sec gaps (messages are in the original spec — don't paraphrase them, the word counts matter for the demo). `components/AgentFeed.tsx` consumes it via `EventSource`. **No DB dependency** — the messages are fiction for the demo.

### Task 7 — LLM Briefing (Person 5)
`app/api/briefing/route.ts` — POST with entity data, returns `{ briefing, recommended_action }`. Cache the 3 demo cases (Sunrise, Metro Health Alliance, Coastal Bend Wellness) as hardcoded strings so the demo never waits on the Claude API.

Use the current Claude model ID: **`claude-sonnet-4-6`** (the spec listed an older ID; use the latest).

### Task 8 — Intro Cards (Person 5)
`components/IntroSequence.tsx` with the 6 fade-in cards. Route at `/intro` so the demo video can record it standalone.

---

## Running things

Dev server (dashboard on `/`):
```
npm run dev
```

Task 4 dashboard check (TypeScript + file contracts + `next build`):
```
python3 task4check.py
```

Task 5 investigation check:
```
python3 task5check.py
```

Repopulate the DB from public APIs (idempotent):
```
npm run db:populate -- --cfda 93.224 --limit 1000
```
This takes ~15 minutes for 1000 grants because FAC is called once per UEI.

Typecheck everything:
```
npx tsc --noEmit --strict lib/types.ts lib/derive.ts lib/db/client.ts lib/db/writer.ts lib/fetchers/*.ts scripts/populate.ts
```

---

## When you're stuck

- DB schema question → read `supabase/schema.sql`, it's short and commented.
- Type shape question → read `lib/types.ts`, it's the source of truth.
- Want to see an existing row → Supabase dashboard → Table Editor.
- Something about fetchers / populate → ping Shifa.
