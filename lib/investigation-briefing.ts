import type { PortfolioGrant } from "@/lib/types";

/** Task 7 will replace with POST `/api/briefing`; keep this for Sunrise and offline fallback. */
const SUNRISE_BRIEFING = `Across all four data sources, Sunrise Community Health presents a convergent high-risk pattern. The FAC single audit has documented repeated material weaknesses in personnel cost controls (FY2022–FY2024) and questioned costs, while USASpending shows spending ahead of the award timeline, compressing the margin to complete corrective actions. SAM.gov reflects active status but with delinquent federal debt on the entity’s record. Crustdata labor-market signals are consistent with operations strain—material headcount decline, elevated vacancy at executive leadership, and below-benchmark staff sentiment. Together, these points justify direct program officer engagement, a documented monitoring plan, and follow-up on audit resolution prior to the cohort’s December 2026 period of performance end.`;

export function getInvestigationBriefing(grant: PortfolioGrant): { text: string; isCachedDemo: boolean } {
  if (grant.grant.award_id === "HRSA-00001" || grant.grant.recipient_name.includes("Sunrise Community Health")) {
    return { text: SUNRISE_BRIEFING, isCachedDemo: true };
  }

  const top = grant.risk.signals.slice(0, 3).map((s) => s.detail).join(" ");
  return {
    text: `Composite score ${grant.risk.total.toFixed(1)}/10 (${grant.risk.level}). ${top} This briefing is a placeholder until Task 7’s \`/api/briefing\` is wired; inputs are derived from \`data/portfolio.json\`.`,
    isCachedDemo: false,
  };
}
