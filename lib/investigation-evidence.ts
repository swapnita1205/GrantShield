import type { PortfolioGrant } from "@/lib/types";

export type EvidenceSeverityUi = "critical" | "warning" | "ok";

export type EvidenceItem = { text: string; icon: EvidenceSeverityUi };

export type EvidenceSourceKey = "USASpending" | "FAC" | "SAM" | "Crustdata";

export const SOURCE_EVIDENCE_COLORS: Record<EvidenceSourceKey, { dot: string; label: string }> = {
  USASpending: { dot: "#3b82f6", label: "USASpending" },
  FAC: { dot: "#a855f7", label: "FAC" },
  SAM: { dot: "#f97316", label: "SAM" },
  Crustdata: { dot: "#22c55e", label: "Crustdata" },
};

function sevToIcon(severity: "low" | "medium" | "high" | "critical"): EvidenceSeverityUi {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "medium") return "warning";
  return "ok";
}

function atMost<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}

/**
 * Two to three evidence lines per source, derived from `PortfolioGrant` fields.
 * When Supabase is connected, pass the same shape from joined tables.
 */
export function buildEvidenceBySource(grant: PortfolioGrant): Record<EvidenceSourceKey, EvidenceItem[]> {
  const g = grant.grant;
  const audit = grant.audit;
  const sam = grant.sam;
  const cr = grant.crustdata;

  const usa: EvidenceItem[] = [
    {
      text: `Award / grant ID ${g.award_id}: $${(g.award_amount / 1e6).toFixed(1)}M; ${g.modification_count} mods.`,
      icon: "ok",
    },
    {
      text: `Burn ${g.burn_rate_pct.toFixed(0)}% of award with ${g.time_elapsed_pct.toFixed(0)}% of period elapsed (ratio ${g.burn_time_ratio.toFixed(2)}).`,
      icon: sevToIcon(g.burn_time_ratio > 1.1 ? "high" : "medium"),
    },
  ];
  const uSig = grant.risk.signals.find((s) => s.source === "USASpending");
  if (uSig) {
    usa.push({ text: uSig.detail, icon: sevToIcon(uSig.severity) });
  }
  if (usa.length < 2) {
    usa.push({ text: `Outlays to date: ${(g.total_outlays / 1e6).toFixed(2)}M.`, icon: "ok" });
  }

  const fac: EvidenceItem[] = [];
  if (audit) {
    fac.push({
      text: `Audit opinion: ${audit.audit_opinion}. Filing years: ${audit.audit_years.join(", ")}.`,
      icon: "warning",
    });
    const f0 = audit.findings[0];
    if (f0) {
      fac.push({
        text: `FY${f0.year} — ${f0.type_requirement}: material weakness ${f0.is_material_weakness ? "yes" : "no"}.`,
        icon: f0.is_material_weakness ? "critical" : "warning",
      });
    }
    const q = audit.findings.find((x) => x.is_questioned_costs && x.questioned_costs_amount > 0);
    if (q) {
      fac.push({
        text: `Questioned costs: $${q.questioned_costs_amount.toLocaleString("en-US")}.`,
        icon: "critical",
      });
    }
  }
  if (fac.length < 2) {
    const fSig = grant.risk.signals.find((s) => s.source === "FAC");
    if (fSig) {
      fac.push({ text: fSig.detail, icon: sevToIcon(fSig.severity) });
    }
  }
  if (fac.length === 0) {
    fac.push({ text: "No audit block in this export for this UEI.", icon: "warning" });
  }

  const sa: EvidenceItem[] = [];
  if (sam) {
    sa.push({ text: `Registration ${sam.registration_status.toLowerCase()}; UEI valid through ${sam.expiration_date}.`, icon: "ok" });
    sa.push({
      text: sam.has_delinquent_debt
        ? `Delinquent federal debt: $${sam.debt_amount.toLocaleString("en-US")}.`
        : "No delinquent federal debt flag.",
      icon: sam.has_delinquent_debt ? "critical" : "ok",
    });
    sa.push({
      text: sam.has_exclusion
        ? `Exclusion: ${sam.exclusion_type || "active entry"}`
        : "No government-wide exclusion in snapshot.",
      icon: sam.has_exclusion ? "critical" : "ok",
    });
  } else {
    const sSig = grant.risk.signals.find((s) => s.source === "SAM");
    sa.push(
      sSig
        ? { text: sSig.detail, icon: sevToIcon(sSig.severity) }
        : { text: "No SAM.gov record matched this UEI in the latest populate run.", icon: "warning" }
    );
    if (!sSig) {
      sa.push({
        text: "SAM.gov entity API is daily-quota throttled; re-run db:populate after midnight UTC to refresh.",
        icon: "warning",
      });
    }
  }

  const crItems: EvidenceItem[] = [];
  if (cr) {
    crItems.push({
      text: `Workforce: ${cr.headcount} headcount, QoQ ${cr.headcount_qoq_pct > 0 ? "+" : ""}${cr.headcount_qoq_pct.toFixed(0)}%.`,
      icon: cr.headcount_qoq_pct < -20 ? "critical" : "warning",
    });
    crItems.push({
      text: `Public reviews aggregate: ${cr.employee_reviews_rating.toFixed(1)}/5.0.`,
      icon: cr.employee_reviews_rating < 3 ? "warning" : "ok",
    });
    crItems.push({
      text: cr.leadership_vacancy ? "Executive Director vacancy on file." : "No C-suite vacancy flag.",
      icon: cr.leadership_vacancy ? "warning" : "ok",
    });
  } else {
    const cSig = grant.risk.signals.find((s) => s.source === "Crustdata");
    crItems.push(
      cSig
        ? { text: cSig.detail, icon: sevToIcon(cSig.severity) }
        : { text: "No Crustdata profile in this export.", icon: "warning" }
    );
  }

  return {
    USASpending: atMost(usa, 3),
    FAC: atMost(fac, 3),
    SAM: atMost(sa, 3),
    Crustdata: atMost(crItems, 3),
  };
}

