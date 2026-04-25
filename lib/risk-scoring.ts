import type { AuditData, CrustdataProfile, Grant, RiskScore, RiskSignal, SamEntity, Severity } from "./types";

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function latestAuditYear(audits: AuditData): number | null {
  const years = new Set<number>(audits.audit_years);
  for (const finding of audits.findings) years.add(finding.year);
  if (years.size === 0) return null;
  return Math.max(...Array.from(years));
}

function parseIsoDate(date: string): Date | null {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calcDaysUntil(date: string): number | null {
  const parsed = parseIsoDate(date);
  if (!parsed) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((parsed.getTime() - Date.now()) / msPerDay);
}

function riskLevel(total: number): Severity {
  if (total < 3) return "low";
  if (total < 6) return "medium";
  if (total < 8) return "high";
  return "critical";
}

export function computeRiskScore(
  grant: Grant,
  audits: AuditData,
  sam: SamEntity,
  crustdata: CrustdataProfile,
): RiskScore {
  const signals: RiskSignal[] = [];
  let total = 0;

  const addSignal = (points: number, signal: RiskSignal): void => {
    total += points;
    signals.push(signal);
  };

  const latestYear = latestAuditYear(audits);
  const latestFindings =
    latestYear === null ? [] : audits.findings.filter((finding) => finding.year === latestYear);
  const latestMwCount = latestFindings.filter((f) => f.is_material_weakness).length;
  const latestRepeatedCount = latestFindings.filter((f) => f.is_repeated).length;

  // Tier 1 (2-3 points). MW signal scales with count: 1 MW = 2.5; each
  // additional MW adds 0.5 up to +2.0. A grantee with 4 MWs in the latest
  // single-audit is materially worse than one with a single isolated MW.
  if (latestMwCount > 0) {
    const points = Math.min(4.5, 2.5 + 0.5 * Math.max(0, latestMwCount - 1));
    addSignal(points, {
      source: "FAC",
      severity: "critical",
      label: "Material weakness in latest audit",
      detail:
        latestMwCount === 1
          ? `Latest FAC filing (${latestYear}) reports a material weakness.`
          : `Latest FAC filing (${latestYear}) reports ${latestMwCount} material weaknesses.`,
    });
  }

  // All findings in the latest audit flagged as repeated → recipient is
  // demonstrably failing to remediate prior-year findings. Strong Tier 1.
  if (latestFindings.length >= 2 && latestRepeatedCount === latestFindings.length) {
    addSignal(2, {
      source: "FAC",
      severity: "critical",
      label: "All latest findings are repeats",
      detail: `Every one of the ${latestFindings.length} findings in FY${latestYear} is flagged as repeated from a prior year.`,
    });
  }

  // Three or more consecutive audit years with at least one material weakness.
  // Encodes the multi-year persistence pattern OIG cites as the strongest
  // predictor of further questioned costs.
  const mwYears = Array.from(
    new Set(audits.findings.filter((f) => f.is_material_weakness).map((f) => f.year)),
  ).sort((a, b) => a - b);
  let longestStreak = 0;
  let currentStreak = 0;
  let prev: number | null = null;
  for (const y of mwYears) {
    if (prev !== null && y === prev + 1) currentStreak += 1;
    else currentStreak = 1;
    if (currentStreak > longestStreak) longestStreak = currentStreak;
    prev = y;
  }
  if (longestStreak >= 3) {
    addSignal(2, {
      source: "FAC",
      severity: "critical",
      label: "Multi-year material weakness pattern",
      detail: `Material weaknesses recorded in ${longestStreak} consecutive audit years (${mwYears.slice(-longestStreak).join(", ")}).`,
    });
  }

  if (audits.audit_opinion === "qualified" || audits.audit_opinion === "adverse") {
    addSignal(2.5, {
      source: "FAC",
      severity: "high",
      label: "Non-clean audit opinion",
      detail: `Audit opinion is ${audits.audit_opinion}.`,
    });
  }

  if (sam.has_exclusion) {
    addSignal(3, {
      source: "SAM",
      severity: "critical",
      label: "Active SAM exclusion",
      detail: sam.exclusion_type ? `Exclusion type: ${sam.exclusion_type}.` : "Entity has an active exclusion.",
    });
  }

  if (sam.has_delinquent_debt || sam.debt_amount > 0) {
    addSignal(2, {
      source: "SAM",
      severity: "high",
      label: "Delinquent federal debt",
      detail: `Reported delinquent debt: $${Math.max(0, sam.debt_amount).toLocaleString()}.`,
    });
  }

  // Tier 2 (1-2 points)
  const burnRatio = grant.burn_time_ratio;
  if (burnRatio > 1.3 || (burnRatio > 0 && burnRatio < 0.5)) {
    addSignal(1, {
      source: "USASpending",
      severity: "medium",
      label: "Burn-rate anomaly",
      detail: `Burn/time ratio is ${burnRatio.toFixed(2)} (burn ${grant.burn_rate_pct.toFixed(
        1,
      )}% vs elapsed ${grant.time_elapsed_pct.toFixed(1)}%).`,
    });
  }

  const repeatedYears = new Set<number>();
  const requirementToYears = new Map<string, Set<number>>();
  const materialWeaknessYears = new Set<number>();
  for (const finding of audits.findings) {
    if (finding.is_repeated) repeatedYears.add(finding.year);
    if (finding.is_material_weakness) materialWeaknessYears.add(finding.year);
    const key = finding.type_requirement.trim().toLowerCase();
    if (!key) continue;
    const years = requirementToYears.get(key) ?? new Set<number>();
    years.add(finding.year);
    requirementToYears.set(key, years);
  }
  const hasRequirementRepeated = Array.from(requirementToYears.values()).some((years) => years.size >= 2);
  if (repeatedYears.size >= 2 || materialWeaknessYears.size >= 2 || hasRequirementRepeated) {
    const repeatedAuditYears = Math.max(repeatedYears.size, materialWeaknessYears.size, 2);
    addSignal(1.5, {
      source: "FAC",
      severity: "high",
      label: "Repeated findings across multiple years",
      detail: `Repeated findings appear in at least ${repeatedAuditYears} audit years.`,
    });
  }

  const hasQuestionedCosts = audits.findings.some(
    (finding) => finding.is_questioned_costs || finding.questioned_costs_amount > 0,
  );
  const totalQuestionedCosts = audits.findings.reduce((sum, finding) => {
    return sum + Math.max(0, finding.questioned_costs_amount);
  }, 0);
  if (hasQuestionedCosts) {
    addSignal(1.5, {
      source: "FAC",
      severity: "high",
      label: "Questioned costs reported",
      detail:
        totalQuestionedCosts > 0
          ? `Total questioned costs across filings: $${totalQuestionedCosts.toLocaleString()}.`
          : "FAC reports questioned costs in at least one filing.",
    });
  }

  if (crustdata.headcount_qoq_pct <= -20) {
    addSignal(1.5, {
      source: "Crustdata",
      severity: "high",
      label: "Headcount decline",
      detail: `Quarter-over-quarter headcount change is ${crustdata.headcount_qoq_pct.toFixed(1)}%.`,
    });
  }

  if (crustdata.leadership_vacancy) {
    addSignal(1, {
      source: "Crustdata",
      severity: "medium",
      label: "Leadership vacancy",
      detail: "A key leadership role is currently vacant.",
    });
  }

  // Tier 3 (0.5-1 points)
  const daysToExpiry = calcDaysUntil(sam.expiration_date);
  if (daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 90) {
    addSignal(0.75, {
      source: "SAM",
      severity: "medium",
      label: "SAM registration near expiration",
      detail: `SAM registration expires in ${daysToExpiry} day(s).`,
    });
  }

  if (grant.modification_count >= 3) {
    addSignal(0.75, {
      source: "USASpending",
      severity: "medium",
      label: "Frequent award modifications",
      detail: `Award has ${grant.modification_count} modification(s).`,
    });
  }

  if (audits.findings.some((finding) => finding.is_significant_deficiency)) {
    addSignal(0.75, {
      source: "FAC",
      severity: "medium",
      label: "Significant deficiency reported",
      detail: "At least one FAC finding includes a significant deficiency.",
    });
  }

  if (crustdata.employee_reviews_rating < 3) {
    addSignal(0.75, {
      source: "Crustdata",
      severity: "medium",
      label: "Low employee sentiment",
      detail: `Employee review rating is ${crustdata.employee_reviews_rating.toFixed(1)}.`,
    });
  }

  const cappedTotal = Math.min(10, round(total, 1));
  return {
    total: cappedTotal,
    level: riskLevel(cappedTotal),
    signals,
  };
}
