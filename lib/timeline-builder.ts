import type {
  AuditData,
  CrustdataProfile,
  Grant,
  RiskScore,
  SamEntity,
  Severity,
  TimelineEvent,
} from "./types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date: string): number | null {
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return null;
  return Math.ceil((t.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Build a chronological timeline from raw fields. Used by the populate script
 * so rows in Supabase have real events (not just the grant start).
 */
export function buildTimelineForGrant(
  grant: Grant,
  audit: AuditData | null,
  sam: SamEntity | null,
  crustdata: CrustdataProfile | null,
  risk: RiskScore,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (grant.start_date) {
    events.push({
      date: grant.start_date,
      source: "USASpending",
      severity: "low",
      description: `Award obligated: $${grant.award_amount.toLocaleString()} to ${grant.recipient_name}.`,
    });
  }

  if (audit) {
    for (const year of audit.audit_years) {
      const yearFindings = audit.findings.filter((f) => f.year === year);
      const mws = yearFindings.filter((f) => f.is_material_weakness).length;
      const sds = yearFindings.filter((f) => f.is_significant_deficiency).length;
      const qc = yearFindings.reduce((s, f) => s + (f.questioned_costs_amount || 0), 0);

      let severity: Severity = "low";
      let desc = `FY${year} Single Audit filed (opinion: ${audit.audit_opinion}).`;
      if (mws > 0) {
        severity = "high";
        desc = `FY${year} Single Audit filed with ${mws} material weakness${mws > 1 ? "es" : ""}${qc > 0 ? `; questioned costs $${qc.toLocaleString()}` : ""}.`;
      } else if (sds > 0) {
        severity = "medium";
        desc = `FY${year} Single Audit filed with ${sds} significant deficienc${sds > 1 ? "ies" : "y"}.`;
      }
      events.push({
        date: `${year}-09-30`,
        source: "FAC",
        severity,
        description: desc,
      });
    }
  }

  if (sam) {
    if (sam.has_delinquent_debt && sam.debt_amount > 0) {
      events.push({
        date: sam.expiration_date || today(),
        source: "SAM",
        severity: "high",
        description: `Delinquent federal debt flagged: $${sam.debt_amount.toLocaleString()}.`,
      });
    }
    if (sam.has_exclusion) {
      events.push({
        date: sam.expiration_date || today(),
        source: "SAM",
        severity: "critical",
        description: `Active exclusion on file${sam.exclusion_type ? `: ${sam.exclusion_type}` : ""}.`,
      });
    }
    const dte = daysUntil(sam.expiration_date);
    if (dte !== null && dte >= 0 && dte <= 90) {
      events.push({
        date: sam.expiration_date,
        source: "SAM",
        severity: "medium",
        description: `SAM registration expires in ${dte} day(s).`,
      });
    }
  }

  if (crustdata) {
    if (crustdata.headcount_qoq_pct <= -20) {
      events.push({
        date: today(),
        source: "Crustdata",
        severity: "high",
        description: `Headcount down ${Math.abs(crustdata.headcount_qoq_pct).toFixed(0)}% quarter-over-quarter.`,
      });
    }
    if (crustdata.leadership_vacancy) {
      events.push({
        date: today(),
        source: "Crustdata",
        severity: "medium",
        description: "Executive leadership vacancy detected.",
      });
    }
  }

  events.push({
    date: today(),
    source: "USASpending",
    severity: risk.level,
    description: `Composite risk score ${risk.total.toFixed(1)}/10 (${risk.level}).`,
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
