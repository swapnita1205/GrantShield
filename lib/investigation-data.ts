import { loadPortfolio } from "@/lib/dashboard-aggregates";
import type { PortfolioGrant } from "@/lib/types";

/**
 * Resolves a grant from `data/portfolio.json` by `award_id`.
 * Replace with a Supabase query returning `PortfolioGrant` (or a joined DTO) when the backend is live.
 */
export function getPortfolioGrantByAwardId(awardId: string): PortfolioGrant | null {
  const id = decodeURIComponent(awardId).trim();
  const rows = loadPortfolio();
  return rows.find((g) => g.grant.award_id === id) ?? null;
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function periodRemainingPct(timeElapsedPct: number): number {
  return Math.max(0, Math.min(100, 100 - timeElapsedPct));
}

export function riskBadgeLabel(level: PortfolioGrant["risk"]["level"], total: number): { title: string; sub: string; tone: "red" | "amber" | "green" } {
  const t = total.toFixed(1);
  if (level === "critical" || level === "high") {
    return { title: level === "critical" ? "Critical Risk" : "High Risk", sub: `${t} / 10`, tone: "red" };
  }
  if (level === "medium") {
    return { title: "Medium Risk", sub: `${t} / 10`, tone: "amber" };
  }
  return { title: "Low Risk", sub: `${t} / 10`, tone: "green" };
}
