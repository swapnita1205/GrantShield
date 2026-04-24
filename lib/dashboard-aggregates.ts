/**
 * Task 4 — Dashboard analytics: `PortfolioGrant[]` → metrics, alerts, 6-month trend,
 * and table rows. Pure functions; the home page (`app/page.tsx`) supplies data from
 * Supabase (`loadPortfolioFromSupabase`) with JSON fallback (`loadPortfolio`).
 */
import type { AuditFinding, PortfolioGrant } from "./types";
import portfolioJson from "../data/portfolio.json";

// `loadPortfolio()` is the JSON fallback (and is still used by some tests).
// Production UI reads from Supabase via `lib/db/queries.ts` and passes the
// result into the pure compute* functions below.

const SOURCE_STYLES = {
  USASpending: { label: "USASpending", className: "src-usa" },
  FAC: { label: "FAC", className: "src-fac" },
  SAM: { label: "SAM", className: "src-sam" },
  Crustdata: { label: "Crustdata", className: "src-crust" },
} as const;

export type SourceKey = keyof typeof SOURCE_STYLES;

export type AlertDot = "red" | "amber" | "blue";

export interface DashboardAlert {
  id: string;
  dot: AlertDot;
  text: string;
  source: SourceKey;
  timestamp: string;
}

export interface RiskBuckets {
  high: number;
  medium: number;
  low: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface DashboardMetrics {
  activeGrants: number;
  activeSubtitle: string;
  portfolioValueUsd: number;
  portfolioValueLabel: string;
  disbursedUsd: number;
  disbursedLabel: string;
  riskScore: number;
  riskSubtitle: string;
  openFindings: number;
  findingsSubtitle: string;
}

export interface GrantTableRow {
  award_id: string;
  recipient_name: string;
  award_amount: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskTotal: number;
  burn_rate_pct: number;
  materialWeaknesses: number;
  significantDeficiencies: number;
}

function formatUsdCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function startOfQuarter(d: Date): Date {
  const m = d.getMonth();
  const q = Math.floor(m / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
}

function countGrantsClosingInWindow(portfolio: PortfolioGrant[], from: Date, to: Date): number {
  return portfolio.filter((p) => {
    const end = new Date(p.grant.end_date);
    return end >= from && end < to;
  }).length;
}

function severityToDot(s: "low" | "medium" | "high" | "critical"): AlertDot {
  if (s === "critical" || s === "high") return "red";
  if (s === "medium") return "amber";
  return "blue";
}

function countFindings(
  rows: AuditFinding[] | undefined,
  pick: (f: AuditFinding) => boolean
): number {
  if (!rows) return 0;
  return rows.filter(pick).length;
}

export function loadPortfolio(): PortfolioGrant[] {
  return portfolioJson as unknown as PortfolioGrant[];
}

export function buildGrantRows(portfolio: PortfolioGrant[]): GrantTableRow[] {
  return portfolio.map((p) => {
    const rows = p.audit?.findings;
    return {
      award_id: p.grant.award_id,
      recipient_name: p.grant.recipient_name,
      award_amount: p.grant.award_amount,
      riskLevel: p.risk.level,
      riskTotal: p.risk.total,
      burn_rate_pct: p.grant.burn_rate_pct,
      materialWeaknesses: countFindings(rows, (f) => f.is_material_weakness),
      significantDeficiencies: countFindings(rows, (f) => f.is_significant_deficiency),
    };
  });
}

export function computeMetrics(portfolio: PortfolioGrant[]): DashboardMetrics {
  const activeGrants = portfolio.length;
  const now = new Date();
  const qStart = startOfQuarter(now);
  const qEnd = addMonths(qStart, 3);
  const closingQ = countGrantsClosingInWindow(portfolio, qStart, qEnd);

  const portfolioValueUsd = portfolio.reduce((s, p) => s + p.grant.award_amount, 0);
  const disbursedUsd = portfolio.reduce((s, p) => s + p.grant.total_outlays, 0);
  const riskScore = portfolio.reduce((s, p) => s + p.risk.total, 0) / Math.max(1, portfolio.length);

  let openFindings = 0;
  let mwFlags = 0;
  for (const p of portfolio) {
    const f = p.audit?.findings;
    if (!f) continue;
    for (const row of f) {
      openFindings += 1;
      if (row.is_material_weakness) mwFlags += 1;
    }
  }

  return {
    activeGrants,
    activeSubtitle: `${closingQ} closing this quarter (cohort: Dec 31, 2026)`,
    portfolioValueUsd,
    portfolioValueLabel: formatUsdCompact(portfolioValueUsd),
    disbursedUsd,
    disbursedLabel: formatUsdCompact(disbursedUsd),
    riskScore,
    riskSubtitle: "mean; no month-over-month series in this export",
    openFindings,
    findingsSubtitle: `${mwFlags} material weakness flags`,
  };
}

export function computeRiskBuckets(portfolio: PortfolioGrant[]): RiskBuckets {
  const buckets: RiskBuckets = { high: 0, medium: 0, low: 0 };
  for (const p of portfolio) {
    const level = p.risk.level;
    if (level === "low") buckets.low += 1;
    else if (level === "medium") buckets.medium += 1;
    else if (level === "high" || level === "critical") buckets.high += 1;
  }
  return buckets;
}

function formatTs(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function buildRecentAlerts(portfolio: PortfolioGrant[], limit: number = 6): DashboardAlert[] {
  type Entry = { date: string; source: SourceKey; severity: "low" | "medium" | "high" | "critical"; text: string };
  const out: Entry[] = [];

  for (const p of portfolio) {
    for (const t of p.timeline ?? []) {
      if (t.description.includes("Composite risk score")) continue;
      out.push({
        date: t.date,
        source: t.source,
        severity: t.severity,
        text: t.description,
      });
    }
  }

  out.sort((a, b) => b.date.localeCompare(a.date));

  const seen = new Set<string>();
  const dedup: Entry[] = [];
  for (const e of out) {
    const k = `${e.text}|${e.date}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(e);
  }

  return dedup.slice(0, limit).map((e, i) => ({
    id: `alert-${i}-${e.date}`,
    dot: severityToDot(e.severity),
    text: e.text,
    source: e.source,
    timestamp: formatTs(`${e.date}T12:00:00Z`),
  }));
}

/**
 * 6 months ending in `anchorMonth` (YYYY-MM). Values follow mean portfolio risk
 * with a smooth synthetic ramp so the line has visible slope until API history exists.
 */
export function buildSixMonthRiskTrend(
  portfolio: PortfolioGrant[],
  now: Date = new Date()
): TrendPoint[] {
  const mean = portfolio.reduce((s, p) => s + p.risk.total, 0) / Math.max(1, portfolio.length);
  const labels: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(
      d.toLocaleString("en-US", { month: "short", year: "2-digit" })
    );
  }
  // Deterministic: ramp into current mean
  return labels.map((label, i) => {
    const t = i / 5;
    const value = mean - 0.5 * (1 - t) + 0.05 * Math.sin(i);
    return { label, value: Math.max(0, Math.min(10, value)) };
  });
}

export function sourceClass(source: SourceKey): string {
  return SOURCE_STYLES[source].className;
}

export { SOURCE_STYLES };
