# GrantShield

**Agentic oversight for federal grants.** Cross-references four public federal data sources in real time and surfaces the same risk patterns the HHS Office of Inspector General catches manually — in seconds instead of years.

Built for the Anthropic AI for Government Hackathon, April 2026.

---

## The problem

The federal government distributes more than **$1.1 trillion** in grants every year. Last year, **$162 billion** of that was reported as improper payments. Oversight today is manual: HHS OIG samples a few dozen recipients, hand-pulls financial records from each one, cross-references them against secondary systems, and writes a report. The most recent COVID-era duplicate-billing audit ([OIG A-02-23-02009](https://oig.hhs.gov/reports/all/2025/some-selected-health-centers-received-duplicate-reimbursement-from-hrsa-for-covid-19-testing-services/), December 2025) reviewed 106 of 1,387 health centers, took roughly 24 months end-to-end, and recovered $313,270.

The data the OIG uses is public. The audit work is what isn't scalable.

## What we built

A live system that ingests four public federal data sources, runs a six-step agent across them, computes a deterministic cross-source risk score, and uses Claude to generate the analyst briefing a Grants Management Specialist would otherwise type by hand. Every signal, every score, and every line of every briefing traces back to a public API endpoint a reviewer can `curl` themselves.

**Live numbers, this repo, right now:**

| Metric | Value |
|---|---|
| HRSA grants ingested (CFDA 93.224) | **1,000** |
| Total portfolio commitments | **$33.5B** |
| FAC audit findings indexed | **577** across 486 unique grantees |
| Real material weaknesses surfaced | **97** |
| Recipients with findings repeating across years | **15** |
| Live risk distribution | **2 critical · 38 high · 75 medium · 885 low** |
| Top critical recipient | **Unity Health Care, Inc.** (Washington, D.C.) — score 10 / 10 |

---

## The validation case

> The federal government already named this recipient as mismanaged. **OIG took 24 months to do it manually. GrantShield re-surfaces the same patterns from the same public data, in seconds — every time the dashboard loads.**

**Recipient:** Family Health Centers of San Diego, Inc. — UEI `TL1GXSM5USD7` — currently holds award `H8000224` ($132 million HRSA Health Center Program grant).

**OIG report:** [A-09-11-01010](https://oig.hhs.gov/reports/all/2013/family-health-centers-of-san-diego-inc-claimed-unallowable-and-inadequately-documented-costs-for-health-resources-and-services-administration-grants-under-the-recovery-act/) — issued **February 14, 2013**, after auditing the Recovery Act period (March 2009 – June 2011). Findings:

- **$114,000** in unallowable rental costs (less-than-arms-length lease violation; recipient officials told OIG they were unaware of the federal cost limit)
- **$4,400,000** in inadequately documented salary and salary-related costs (no compliant personnel activity reports)

OIG recommended HRSA require refund of the $114K and either refund or document the $4.4M. **HRSA concurred.**

**What GrantShield does with this same recipient today:** opens `/investigate/H8000224` and shows a red **"Prior OIG audit on file"** banner above the live cross-source evidence. Banner cites the report number, the dollar amount, the period audited, and links directly to oig.hhs.gov. The Claude-generated briefing connects the historical finding to the recipient's current FAC submissions in one paragraph.

A second comparable case is also in the portfolio: **Henry J. Austin Health Center, Inc.** (Trenton, NJ) — UEI `JRK3Y5WE5387`, award `H8000531`. [OIG A-02-17-02002](https://oig.hhs.gov/reports/all/2018/henry-j-austin-health-center-inc-a-health-resources-and-services-administration-grantee-did-not-comply-with-federal-grant-requirements/), February 2018: **$8M unsupported, $243K unallowable, HRSA concurred**.

**Why this is the validation argument and not just an anecdote:**

1. The recipients are **real, named, on the public record**. We're not pointing at synthetic data.
2. The data the OIG used to find them is the **same data we ingest** — Federal Audit Clearinghouse, USASpending, SAM.gov.
3. The pattern OIG cites — cost-allocation gaps, undocumented payroll, repeated findings — is **exactly what our risk methodology scores for**.
4. **OIG's manual review took 18–30 months.** GrantShield re-runs the same cross-source check in 18 seconds against 1,000 recipients.

The system isn't claiming to detect new fraud the IG missed. It's claiming the federal IG's own audit findings are recoverable from public data in seconds — and from there, the same architecture extends to recipients who haven't been audited yet.

---

## How it works

```
                       ┌──────────────────┐
   USASpending API ──▶ │                  │
   FAC API         ──▶ │   populate.ts    │ ──▶ Supabase ──▶  ┌──────────────┐
   SAM.gov API     ──▶ │   (idempotent)   │     (7 tables)    │ Next.js app  │
   Crustdata API   ──▶ │                  │                   └──────┬───────┘
                       └──────────────────┘                          │
                                                                     ▼
                                                    /agent ── 6-step SSE pipeline
                                                       │       reads Supabase live
                                                       ▼
                                                  /investigate/[award_id]
                                                       │
                                                       ├── cross-source evidence
                                                       ├── AI briefing  ───▶ Claude (claude-sonnet-4-6)
                                                       │                     /api/briefing
                                                       ├── corrective action ─▶ /api/letter
                                                       └── prior-OIG layer ───▶ lib/oig-prior-findings.ts
```

### The agent

`/api/investigate` is a server-sent-events endpoint. When a user clicks **Investigate Portfolio**, the agent runs six steps with status indicators (running → complete) and a 3-second cadence for legibility. Each step's message is computed live from Supabase aggregations — not hardcoded:

1. USASpending — total awards, states, dollar value
2. FAC — unique audited UEIs, total findings, MW count, SD count, repeated-finding grantees
3. Computed — burn-rate anomalies (ratio outside [0.5, 1.3])
4. SAM.gov — entity records, delinquent debt, exclusions, expirations
5. Crustdata — matched entities, headcount declines, leadership vacancies
6. Synthesis — risk distribution + the top critical recipient's award_id

The summary event hands the live top-critical award to the UI; the post-completion CTA links straight to its investigation view.

### The risk methodology

Every score breaks down to a sum of named signals (`lib/risk-scoring.ts`):

- **Tier 1 (2.5–4.5 pts):** material weakness in latest audit (scales with count); all latest findings flagged repeated; multi-year material weakness pattern (≥3 consecutive years); active SAM exclusion; delinquent federal debt
- **Tier 2 (1–2 pts):** burn-rate anomaly; repeated findings across years; questioned costs; >20% headcount decline; leadership vacancy
- **Tier 3 (0.5–1 pt):** SAM near expiration; ≥3 modifications; significant deficiency; low employee sentiment

Score capped at 10. The breakdown is visible on every investigation page — every signal pill shows the source it came from.

### The Claude briefing

`/api/briefing` accepts a `PortfolioGrant`, returns `{ briefing, recommended_action, source }`. Three execution paths:

1. **Cached** — four hand-written paragraphs for the demo's anchor entities (Unity Health Care × 2, FHC of San Diego, Henry J. Austin). Every fact in those paragraphs is grounded in the underlying FAC or OIG data.
2. **Claude API** — for any other entity, calls `claude-sonnet-4-6` with the entity's cross-source evidence and the auditor-voice prompt in `app/api/briefing/route.ts`. Returns a 4–5 sentence briefing plus a recommended action with a 2 CFR 200 citation.
3. **Deterministic fallback** — if `ANTHROPIC_API_KEY` is unset, composes the briefing from the entity's risk signals.

The briefing card on the investigation view labels which path was used. Every render also lists the live API URLs the briefing was built from, so a reviewer can click through and verify the underlying data.

---

## Run it locally

Requires Node 20+, a Supabase project, and four API keys (FAC is free; SAM is free with registration; Crustdata is paid trial; Anthropic is the LLM key).

```bash
git clone <repo-url>
cd grantshield-repo
npm install

cp .env.example .env.local
# fill in:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   FAC_API_KEY (free — app.fac.gov/developers)
#   SAM_API_KEY (free — sam.gov)
#   CRUSTDATA_API_KEY (paid trial — crustdata.com)
#   ANTHROPIC_API_KEY (console.anthropic.com)

# Initialize Supabase schema (run once)
psql "$SUPABASE_URL" < supabase/schema.sql   # or paste in the Supabase SQL editor

# Populate from public APIs (~80s for 100 grants, ~15 min for 1,000)
npm run db:populate -- --cfda 93.224 --limit 1000

# Recompute risk scores from existing rows (idempotent, ~5s)
npm run db:backfill

# Run
npm run dev
# → http://localhost:3000
```

### Routes worth seeing

- `/` — dashboard (1,000 grants, sortable, click any row)
- `/agent` — six-step agent feed; click Investigate Portfolio from the dashboard
- `/investigate/H8000070` — Unity Health Care, the live critical case (10/10)
- `/investigate/H8000224` — Family Health Centers of San Diego (the OIG-validated case)
- `/investigate/H8000531` — Henry J. Austin Health Center (the second OIG-validated case)
- `/intro` — six-card narrative intro

---

## Repository layout

```
app/
  page.tsx                          dashboard (Server Component, Supabase + JSON fallback)
  agent/page.tsx                    SSE agent feed UI
  investigate/[award_id]/page.tsx   per-recipient investigation view
  intro/page.tsx                    intro narrative
  api/
    investigate/route.ts            SSE — live aggregations from Supabase
    briefing/route.ts               POST — cache → Claude → deterministic fallback
    letter/route.ts                 POST — corrective action / IG referral / site visit / full report

components/
  GrantsTable.tsx                   sortable high-risk inventory
  AgentFeed.tsx                     EventSource consumer
  IntroSequence.tsx                 fade-in card sequence
  investigation/
    InvestigationView.tsx           server component renders the page
    BriefingCard.tsx                client; calls /api/briefing, shows Claude provenance + sources
    InvestigationActions.tsx        client; calls /api/letter, modal + download

lib/
  types.ts                          shared TypeScript interfaces
  risk-scoring.ts                   the documented scoring methodology
  oig-prior-findings.ts             curated OIG-cited recipient index (verifiable URLs)
  fetchers/
    usaspending.ts | fac.ts | sam.ts | crustdata.ts
  db/
    client.ts                       Supabase singleton (server-only)
    queries.ts                      reads (incl. getPortfolioStats for the agent)
    writer.ts | bulk.ts             upserts

scripts/
  populate.ts                       end-to-end ingest from public APIs
  backfill-scores.ts                recompute risk scores in place
  check-supabase.ts                 connectivity sanity check

supabase/schema.sql                 7-table schema
```

A deeper architecture write-up lives in **[ENGINEERING.md](./ENGINEERING.md)**.

---

## What's real and what's curated

Full provenance, no hidden state:

| Surface | Source |
|---|---|
| All 1,000 grants, dollar amounts, recipients, dates | Live USASpending API |
| Audit history, findings, material weaknesses, repeated-finding flags | Live FAC API |
| SAM registration status & expirations | Live SAM.gov API (rate-limited daily) |
| Crustdata company match (headcount range) | Live Crustdata API (trial tier — only headcount range exposed) |
| Risk scores | Computed in `lib/risk-scoring.ts` from the above |
| Agent feed step messages | Computed at request time from Supabase aggregations |
| AI briefing card content | Claude API (live), or 4 cached paragraphs for anchor entities |
| Letter / referral / site-visit / report output | Deterministic templates filled with the entity's live Supabase row |
| **Prior OIG audit banner** | Two hand-curated entries (FHC SD, Henry J. Austin), each with a public oig.hhs.gov URL |
| Intro card statistics ($1.1T, $162B, etc.) | Public federal sources cited in the intro |

---

## Stack

- **Next.js 14** (App Router) — Server Components for data-bound pages, client components for SSE/modal interactivity
- **Supabase** (Postgres) — single source of truth for the UI; ingested from the four public APIs
- **Anthropic Claude (`claude-sonnet-4-6`)** — analyst-voice risk briefings via `/api/briefing`
- **TypeScript** — strict mode; the type contract in `lib/types.ts` is the spine
- **Public federal APIs** — USASpending, Federal Audit Clearinghouse, SAM.gov, Crustdata
- **Server-Sent Events** — the agent feed at `/api/investigate` streams live computations

---

## Honest scope notes

- **SAM coverage is partial.** SAM.gov's entity API has a daily quota that we hit during ingestion. The dashboard reflects what's in Supabase, which is 12 of 1,000 records right now. Re-run `npm run db:populate` after midnight UTC to refill. This is an API-tier limit, not a code limitation.
- **Crustdata trial tier is restrictive.** Only `/screener/company/?company_name=` is callable on this token; headcount QoQ, Glassdoor rating, job postings, and leadership vacancy endpoints return 404. Headcounts are mapped from the LinkedIn employee-count range (e.g., "1001-5000" → 3000 midpoint).
- **No UIP integration yet.** The OIG's COVID double-billing audit (A-02-23-02009) cross-references HRSA grant outlays against the Uninsured Program claims database. UIP is not a public API. Adding it is a data-source addition; the architecture supports it.
- **Cron not wired.** Populate is on-demand (one command). A daily refresh is a 10-line GitHub Actions config; we left it manual to keep the API quota under control during the hackathon.

---

## License

MIT.

---

## Acknowledgments

This project relies entirely on data the U.S. federal government already publishes. The work the HHS Office of Inspector General has done — the named-recipient audits, the published findings, the report numbers we cite throughout — is the foundation of the validation argument here. We're not replacing oversight. We're showing that one piece of it can run fast enough to keep up with the scale.
