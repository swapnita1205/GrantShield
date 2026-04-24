/**
 * Task 4 — Server-side read path: loads `PortfolioGrant[]` from Supabase
 * (same shape as `data/portfolio.json`). `app/page.tsx` uses this in production
 * and falls back to `loadPortfolio()` from `lib/dashboard-aggregates.ts` when
 * env is missing or the query returns no rows.
 */
import "server-only";

import type {
  AuditData,
  AuditFinding,
  CrustdataProfile,
  DataSource,
  Grant,
  PortfolioGrant,
  RiskScore,
  SamEntity,
  Severity,
  TimelineEvent,
} from "../types";

function isConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function ymd(d: unknown): string {
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

function asGrant(r: Record<string, unknown>): Grant {
  return {
    award_id: String(r.award_id),
    recipient_name: String(r.recipient_name),
    recipient_uei: String(r.recipient_uei),
    cfda_number: String(r.cfda_number),
    award_amount: num(r.award_amount),
    total_outlays: num(r.total_outlays),
    start_date: ymd(r.start_date),
    end_date: ymd(r.end_date),
    state: String(r.state),
    city: String(r.city),
    modification_count: Math.round(num(r.modification_count)),
    burn_rate_pct: num(r.burn_rate_pct),
    time_elapsed_pct: num(r.time_elapsed_pct),
    burn_time_ratio: num(r.burn_time_ratio),
  };
}

function asAuditFinding(f: Record<string, unknown>): AuditFinding {
  return {
    year: Math.round(num(f.year)),
    type_requirement: String(f.type_requirement),
    is_material_weakness: Boolean(f.is_material_weakness),
    is_significant_deficiency: Boolean(f.is_significant_deficiency),
    is_questioned_costs: Boolean(f.is_questioned_costs),
    questioned_costs_amount: num(f.questioned_costs_amount),
    is_repeated: Boolean(f.is_repeated),
  };
}

function asAuditData(
  a: Record<string, unknown> | undefined,
  findings: AuditFinding[] | undefined
): AuditData | undefined {
  if (!a) return undefined;
  return {
    auditee_uei: String(a.auditee_uei),
    audit_years: (Array.isArray(a.audit_years) ? a.audit_years : []).map((x) => Math.round(num(x))),
    audit_opinion: a.audit_opinion as AuditData["audit_opinion"],
    findings: findings ?? [],
    has_going_concern: Boolean(a.has_going_concern),
    has_material_noncompliance: Boolean(a.has_material_noncompliance),
  };
}

function asSam(r: Record<string, unknown>): SamEntity {
  return {
    uei: String(r.uei),
    legal_name: String(r.legal_name),
    registration_status: r.registration_status as SamEntity["registration_status"],
    expiration_date: ymd(r.expiration_date),
    has_delinquent_debt: Boolean(r.has_delinquent_debt),
    debt_amount: num(r.debt_amount),
    has_exclusion: Boolean(r.has_exclusion),
    exclusion_type: String(r.exclusion_type),
  };
}

function asCrust(r: Record<string, unknown>): CrustdataProfile {
  const snippets = r.recent_review_snippets;
  return {
    matched_uei: String(r.matched_uei),
    headcount: Math.round(num(r.headcount)),
    headcount_qoq_pct: num(r.headcount_qoq_pct),
    ceo_name: String(r.ceo_name),
    employee_reviews_rating: num(r.employee_reviews_rating),
    recent_review_snippets: Array.isArray(snippets) ? (snippets as string[]) : [],
    job_postings: Math.round(num(r.job_postings)),
    leadership_vacancy: Boolean(r.leadership_vacancy),
  };
}

function asTimeline(rows: { event_date: string; source: string; severity: string; description: string }[]): TimelineEvent[] {
  return rows.map((row) => ({
    date: ymd(row.event_date),
    source: row.source as DataSource,
    severity: row.severity as Severity,
    description: String(row.description),
  }));
}

function asRisk(s: { total: unknown; level: unknown; signals: unknown }): RiskScore {
  return {
    total: num(s.total),
    level: s.level as RiskScore["level"],
    signals: (Array.isArray(s.signals) ? s.signals : []) as RiskScore["signals"],
  };
}

export async function loadPortfolioFromSupabase(): Promise<PortfolioGrant[]> {
  if (!isConfigured()) {
    return [];
  }
  const { supabase } = await import("./client");

  const [
    { data: grantRows, error: eG },
    { data: riskRows, error: eR },
    { data: timelineRows, error: eT },
    { data: auditDataRows, error: eA },
    { data: findingRows, error: eF },
    { data: samRows, error: eS },
    { data: crustRows, error: eC },
  ] = await Promise.all([
    supabase.from("grants").select("*").order("award_id"),
    supabase.from("risk_scores").select("*"),
    supabase.from("timeline_events").select("award_id, event_date, source, severity, description").order("event_date", { ascending: true }),
    supabase.from("audit_data").select("*"),
    supabase.from("audit_findings").select("*"),
    supabase.from("sam_entities").select("*"),
    supabase.from("crustdata_profiles").select("*"),
  ]);

  for (const err of [eG, eR, eT, eA, eF, eS, eC]) {
    if (err) throw new Error(err.message);
  }
  if (!Array.isArray(grantRows) || !Array.isArray(riskRows)) {
    return [];
  }

  function byAwardId<T extends { award_id: string }>(rows: T[]): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      if (!m.has(r.award_id)) m.set(r.award_id, []);
      m.get(r.award_id)!.push(r);
    }
    return m;
  }

  const riskMap = new Map(
    (riskRows as { award_id: string; total: unknown; level: unknown; signals: unknown }[]).map(
      (r) => [r.award_id, r]
    )
  );

  const tRows = (timelineRows ?? []) as { award_id: string; event_date: string; source: string; severity: string; description: string }[];
  const timelineByAward = byAwardId(tRows);

  const findByUei = new Map<string, AuditFinding[]>();
  for (const fr of (findingRows ?? []) as Record<string, unknown>[]) {
    const uei = String(fr.auditee_uei);
    if (!findByUei.has(uei)) findByUei.set(uei, []);
    findByUei.get(uei)!.push(asAuditFinding(fr));
  }

  const auditByUei = new Map<string, AuditData>();
  for (const a of (auditDataRows ?? []) as Record<string, unknown>[]) {
    const uei = String(a.auditee_uei);
    const findings = findByUei.get(uei) ?? [];
    const built = asAuditData(a, findings);
    if (built) auditByUei.set(uei, built);
  }

  const samByUei = new Map(
    ((samRows ?? []) as Record<string, unknown>[]).map((r) => [String(r.uei), asSam(r)])
  );
  const crustByUei = new Map(
    ((crustRows ?? []) as Record<string, unknown>[]).map((r) => [String(r.matched_uei), asCrust(r)])
  );

  const out: PortfolioGrant[] = [];
  for (const raw of grantRows as Record<string, unknown>[]) {
    const g = asGrant(raw);
    const risk = riskMap.get(g.award_id);
    if (!risk) {
      continue;
    }

    const uei = g.recipient_uei;
    const audit = auditByUei.get(uei);
    const sam = samByUei.get(uei);
    const crust = crustByUei.get(uei);
    const timeline = asTimeline(timelineByAward.get(g.award_id) ?? []);

    out.push({
      grant: g,
      ...(audit ? { audit } : {}),
      ...(sam ? { sam } : {}),
      ...(crust ? { crustdata: crust } : {}),
      risk: asRisk(risk),
      timeline,
    });
  }
  return out;
}
