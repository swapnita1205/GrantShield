import type { Grant } from "./types";

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

export function deriveBurnFields(grant: Grant): Grant {
  const burn_rate_pct =
    grant.award_amount === 0 ? 0 : round((grant.total_outlays / grant.award_amount) * 100, 1);

  const start = new Date(grant.start_date);
  const end = new Date(grant.end_date);
  let time_elapsed_pct = 0;
  if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
    const total = end.getTime() - start.getTime();
    if (total > 0) {
      const elapsed = Date.now() - start.getTime();
      const raw = (elapsed / total) * 100;
      time_elapsed_pct = round(Math.max(0, Math.min(100, raw)), 1);
    }
  }

  const burn_time_ratio = time_elapsed_pct === 0 ? 0 : round(burn_rate_pct / time_elapsed_pct, 2);

  return { ...grant, burn_rate_pct, time_elapsed_pct, burn_time_ratio };
}
