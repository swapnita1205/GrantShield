import type { PortfolioGrant, TimelineEvent } from "@/lib/types";

export function getTimelineForInvestigationPage(grant: PortfolioGrant, maxEvents: number = 7): TimelineEvent[] {
  const list = [...(grant.timeline ?? [])];
  list.sort((a, b) => b.date.localeCompare(a.date));
  return list.slice(0, maxEvents);
}

export function timelineDotColor(severity: TimelineEvent["severity"]): string {
  if (severity === "critical" || severity === "high") return "var(--red)";
  if (severity === "medium") return "var(--amber)";
  if (severity === "low") return "var(--blue)";
  return "var(--text-dim)";
}
