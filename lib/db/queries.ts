import "server-only";
import { supabase } from "./client";
import type {
  AuditData,
  AuditFinding,
  CrustdataProfile,
  Grant,
  PortfolioGrant,
  RiskScore,
  SamEntity,
  Severity,
  TimelineEvent,
} from "../types";

type GrantRow = Grant;

type RiskRow = { award_id: string; total: number | string; level: Severity; signals: unknown };

type AuditRow = Omit<AuditData, "findings">;

type FindingRow = AuditFinding & { auditee_uei: string };

type SamRow = SamEntity;

type CrustRow = CrustdataProfile;

type TimelineRow = {
  award_id: string;
  event_date: string;
  source: TimelineEvent["source"];
  severity: Severity;
  description: string;
};

function groupBy<T>(rows: T[], pick: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const key = pick(r);
    if (!key) continue;
    (out[key] ??= []).push(r);
  }
  return out;
}

function coerceNumber(n: unknown): number {
  if (typeof n === "number") return n;
  if (typeof n === "string") {
    const parsed = Number(n);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function coerceGrant(row: GrantRow): Grant {
  return {
    award_id: row.award_id,
    recipient_name: row.recipient_name,
    recipient_uei: row.recipient_uei,
    cfda_number: row.cfda_number,
    award_amount: coerceNumber(row.award_amount),
    total_outlays: coerceNumber(row.total_outlays),
    start_date: String(row.start_date ?? ""),
    end_date: String(row.end_date ?? ""),
    state: row.state ?? "",
    city: row.city ?? "",
    modification_count: Math.round(coerceNumber(row.modification_count)),
    burn_rate_pct: coerceNumber(row.burn_rate_pct),
    time_elapsed_pct: coerceNumber(row.time_elapsed_pct),
    burn_time_ratio: coerceNumber(row.burn_time_ratio),
  };
}

function coerceFinding(f: FindingRow): AuditFinding {
  return {
    year: Math.round(coerceNumber(f.year)),
    type_requirement: f.type_requirement,
    is_material_weakness: Boolean(f.is_material_weakness),
    is_significant_deficiency: Boolean(f.is_significant_deficiency),
    is_questioned_costs: Boolean(f.is_questioned_costs),
    questioned_costs_amount: coerceNumber(f.questioned_costs_amount),
    is_repeated: Boolean(f.is_repeated),
  };
}

function coerceRisk(row: RiskRow | undefined): RiskScore {
  if (!row) return { total: 0, level: "low", signals: [] };
  const signals = Array.isArray(row.signals) ? (row.signals as RiskScore["signals"]) : [];
  return { total: coerceNumber(row.total), level: row.level, signals };
}

async function fetchAll<T>(table: string): Promise<T[]> {
  if (!supabase) throw new Error("Supabase not configured — missing env vars");
  const out: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`queries: ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

/**
 * Read the whole portfolio from Supabase and rebuild `PortfolioGrant[]` so the
 * UI aggregations keep working unchanged.
 */
export async function loadPortfolioFromSupabase(): Promise<PortfolioGrant[]> {
  if (!supabase) throw new Error("Supabase not configured — missing env vars");
  const [grants, risks, audits, findings, sams, crusts, timelines] = await Promise.all([
    fetchAll<GrantRow>("grants"),
    fetchAll<RiskRow>("risk_scores"),
    fetchAll<AuditRow>("audit_data"),
    fetchAll<FindingRow>("audit_findings"),
    fetchAll<SamRow>("sam_entities"),
    fetchAll<CrustRow>("crustdata_profiles"),
    fetchAll<TimelineRow>("timeline_events"),
  ]);

  const riskByAward = new Map(risks.map((r) => [r.award_id, r]));
  const auditByUei = new Map(audits.map((a) => [a.auditee_uei, a]));
  const findingsByUei = groupBy(findings, (f) => f.auditee_uei);
  const samByUei = new Map(sams.map((s) => [s.uei, s]));
  const crustByUei = new Map(crusts.map((c) => [c.matched_uei, c]));
  const timelineByAward = groupBy(timelines, (t) => t.award_id);

  const out: PortfolioGrant[] = [];
  for (const g of grants) {
    const grant = coerceGrant(g);
    const auditHeader = auditByUei.get(grant.recipient_uei);
    let audit: AuditData | undefined = undefined;
    if (auditHeader) {
      const rows = findingsByUei[grant.recipient_uei] ?? [];
      audit = {
        auditee_uei: auditHeader.auditee_uei,
        audit_years: Array.isArray(auditHeader.audit_years)
          ? auditHeader.audit_years.map((y) => Math.round(coerceNumber(y)))
          : [],
        audit_opinion: auditHeader.audit_opinion,
        findings: rows.map(coerceFinding),
        has_going_concern: Boolean(auditHeader.has_going_concern),
        has_material_noncompliance: Boolean(auditHeader.has_material_noncompliance),
      };
    }
    const sam = samByUei.get(grant.recipient_uei);
    const crustdata = crustByUei.get(grant.recipient_uei);
    const tlRows = timelineByAward[grant.award_id] ?? [];
    const timeline: TimelineEvent[] = tlRows.map((t) => ({
      date: String(t.event_date ?? ""),
      source: t.source,
      severity: t.severity,
      description: t.description,
    }));

    out.push({
      grant,
      ...(audit ? { audit } : {}),
      ...(sam ? { sam } : {}),
      ...(crustdata ? { crustdata } : {}),
      risk: coerceRisk(riskByAward.get(grant.award_id)),
      timeline,
    });
  }
  return out;
}

export async function getPortfolioGrantFromSupabase(
  awardId: string,
): Promise<PortfolioGrant | null> {
  if (!supabase) throw new Error("Supabase not configured — missing env vars");
  const id = decodeURIComponent(awardId).trim();
  const { data: grantRows, error: gErr } = await supabase
    .from("grants")
    .select("*")
    .eq("award_id", id)
    .limit(1);
  if (gErr) throw new Error(`queries: grants: ${gErr.message}`);
  const grantRow = grantRows?.[0] as GrantRow | undefined;
  if (!grantRow) return null;
  const grant = coerceGrant(grantRow);

  const uei = grant.recipient_uei;
  const [risksRes, auditRes, findingsRes, samRes, crustRes, tlRes] = await Promise.all([
    supabase.from("risk_scores").select("*").eq("award_id", id).limit(1),
    uei
      ? supabase.from("audit_data").select("*").eq("auditee_uei", uei).limit(1)
      : Promise.resolve({ data: [] as AuditRow[], error: null }),
    uei
      ? supabase.from("audit_findings").select("*").eq("auditee_uei", uei)
      : Promise.resolve({ data: [] as FindingRow[], error: null }),
    uei
      ? supabase.from("sam_entities").select("*").eq("uei", uei).limit(1)
      : Promise.resolve({ data: [] as SamRow[], error: null }),
    uei
      ? supabase.from("crustdata_profiles").select("*").eq("matched_uei", uei).limit(1)
      : Promise.resolve({ data: [] as CrustRow[], error: null }),
    supabase.from("timeline_events").select("*").eq("award_id", id),
  ]);

  for (const r of [risksRes, auditRes, findingsRes, samRes, crustRes, tlRes]) {
    if ("error" in r && r.error) throw new Error(`queries: join: ${r.error.message}`);
  }

  const risk = coerceRisk((risksRes.data?.[0] as RiskRow | undefined) ?? undefined);

  const auditRow = auditRes.data?.[0] as AuditRow | undefined;
  let audit: AuditData | undefined = undefined;
  if (auditRow) {
    audit = {
      auditee_uei: auditRow.auditee_uei,
      audit_years: Array.isArray(auditRow.audit_years)
        ? auditRow.audit_years.map((y) => Math.round(coerceNumber(y)))
        : [],
      audit_opinion: auditRow.audit_opinion,
      findings: ((findingsRes.data ?? []) as FindingRow[]).map(coerceFinding),
      has_going_concern: Boolean(auditRow.has_going_concern),
      has_material_noncompliance: Boolean(auditRow.has_material_noncompliance),
    };
  }
  const sam = (samRes.data?.[0] as SamRow | undefined) ?? undefined;
  const crustdata = (crustRes.data?.[0] as CrustRow | undefined) ?? undefined;
  const timeline: TimelineEvent[] = ((tlRes.data ?? []) as TimelineRow[]).map((t) => ({
    date: String(t.event_date ?? ""),
    source: t.source,
    severity: t.severity,
    description: t.description,
  }));

  return {
    grant,
    ...(audit ? { audit } : {}),
    ...(sam ? { sam } : {}),
    ...(crustdata ? { crustdata } : {}),
    risk,
    timeline,
  };
}

export interface PortfolioStats {
  cfda: string;
  total_grants: number;
  total_award_value_usd: number;
  unique_states: number;
  audit_unique_ueis: number;
  audit_findings_total: number;
  audit_material_weaknesses: number;
  audit_significant_deficiencies: number;
  audit_repeated_findings_ueis: number;
  burn_rate_anomalies: number;
  sam_records: number;
  sam_delinquent_debt: number;
  sam_active_exclusions: number;
  sam_expiring_within_90_days: number;
  crustdata_matched: number;
  crustdata_headcount_decline_20: number;
  crustdata_leadership_vacancies: number;
  risk_critical: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  top_critical_award_id: string | null;
  top_critical_recipient_name: string | null;
  top_critical_score: number | null;
}

/**
 * Single-shot live aggregate for the agent feed step messages. Reads what is
 * actually in Supabase right now — no hardcoded counts.
 */
export async function getPortfolioStats(cfda = "93.224"): Promise<PortfolioStats> {
  if (!supabase) throw new Error("Supabase not configured — missing env vars");

  const [grants, audits, findings, sams, crusts, risks] = await Promise.all([
    fetchAll<GrantRow>("grants"),
    fetchAll<AuditRow>("audit_data"),
    fetchAll<FindingRow>("audit_findings"),
    fetchAll<SamRow>("sam_entities"),
    fetchAll<CrustRow>("crustdata_profiles"),
    fetchAll<RiskRow & { signals: unknown }>("risk_scores"),
  ]);

  const states = new Set<string>();
  let totalValue = 0;
  let burnAnomalies = 0;
  for (const g of grants) {
    if (g.state) states.add(g.state);
    totalValue += coerceNumber(g.award_amount);
    const ratio = coerceNumber(g.burn_time_ratio);
    if (ratio > 1.3 || (ratio > 0 && ratio < 0.5)) burnAnomalies += 1;
  }

  const findingsByUei = groupBy(findings, (f) => f.auditee_uei);
  let mwCount = 0;
  let sdCount = 0;
  let repeatedUeiCount = 0;
  for (const [uei, fs] of Object.entries(findingsByUei)) {
    const seen = new Set<string>();
    for (const f of fs) {
      const key = `${f.year}|${(f as unknown as Record<string, unknown>).reference_number ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (f.is_material_weakness) mwCount += 1;
      if (f.is_significant_deficiency) sdCount += 1;
    }
    if (fs.some((f) => f.is_repeated)) repeatedUeiCount += 1;
    void uei;
  }

  let samDelinquent = 0;
  let samExclusions = 0;
  let samExpiring = 0;
  const today = Date.now();
  const ms90 = 90 * 24 * 60 * 60 * 1000;
  for (const s of sams) {
    if (s.has_delinquent_debt) samDelinquent += 1;
    if (s.has_exclusion) samExclusions += 1;
    const exp = s.expiration_date ? new Date(s.expiration_date).getTime() : NaN;
    if (Number.isFinite(exp) && exp >= today && exp - today <= ms90) samExpiring += 1;
  }

  let crustDecline = 0;
  let crustVacancy = 0;
  for (const c of crusts) {
    if (coerceNumber(c.headcount_qoq_pct) <= -20) crustDecline += 1;
    if (c.leadership_vacancy) crustVacancy += 1;
  }

  const dist = { low: 0, medium: 0, high: 0, critical: 0 };
  let topCritical: { award_id: string; total: number } | null = null;
  for (const r of risks) {
    const total = coerceNumber(r.total);
    const level = (r.level || "low") as keyof typeof dist;
    if (level in dist) dist[level] += 1;
    if (!topCritical || total > topCritical.total) {
      topCritical = { award_id: r.award_id, total };
    }
  }
  let topName: string | null = null;
  if (topCritical) {
    const match = grants.find((g) => g.award_id === topCritical!.award_id);
    topName = match?.recipient_name ?? null;
  }

  return {
    cfda,
    total_grants: grants.length,
    total_award_value_usd: totalValue,
    unique_states: states.size,
    audit_unique_ueis: audits.length,
    audit_findings_total: findings.length,
    audit_material_weaknesses: mwCount,
    audit_significant_deficiencies: sdCount,
    audit_repeated_findings_ueis: repeatedUeiCount,
    burn_rate_anomalies: burnAnomalies,
    sam_records: sams.length,
    sam_delinquent_debt: samDelinquent,
    sam_active_exclusions: samExclusions,
    sam_expiring_within_90_days: samExpiring,
    crustdata_matched: crusts.length,
    crustdata_headcount_decline_20: crustDecline,
    crustdata_leadership_vacancies: crustVacancy,
    risk_critical: dist.critical,
    risk_high: dist.high,
    risk_medium: dist.medium,
    risk_low: dist.low,
    top_critical_award_id: topCritical?.award_id ?? null,
    top_critical_recipient_name: topName,
    top_critical_score: topCritical?.total ?? null,
  };
}
