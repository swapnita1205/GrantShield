/**
 * Fast backfill: read what's already in Supabase, compute real risk scores +
 * timelines in-memory, and bulk-write the results back. NO external API calls.
 * Turns the 15-minute repopulate into a seconds-long pass.
 *
 * Safe to re-run. Idempotent.
 */

import { loadPortfolioFromSupabase } from "../lib/db/queries";
import { bulkUpsertRiskScores, replaceTimelineEventsByAward } from "../lib/db/bulk";
import { computeRiskScore } from "../lib/risk-scoring";
import { neutralAudit, neutralSam, neutralCrustdata } from "../lib/risk-defaults";
import { buildTimelineForGrant } from "../lib/timeline-builder";

async function main(): Promise<void> {
  const started = Date.now();
  console.log("Reading portfolio from Supabase...");
  const rows = await loadPortfolioFromSupabase();
  console.log(`  ${rows.length} grants loaded in ${Date.now() - started}ms`);

  const riskRows: { award_id: string; total: number; level: string; signals: unknown }[] = [];
  const timelineRows: { award_id: string; event_date: string; source: string; severity: string; description: string }[] = [];
  const awardIds: string[] = [];
  const dist: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };

  for (const pg of rows) {
    const grant = pg.grant;
    const risk = computeRiskScore(
      grant,
      pg.audit ?? neutralAudit(grant),
      pg.sam ?? neutralSam(grant),
      pg.crustdata ?? neutralCrustdata(grant),
    );
    riskRows.push({
      award_id: grant.award_id,
      total: risk.total,
      level: risk.level,
      signals: risk.signals,
    });

    const tl = buildTimelineForGrant(grant, pg.audit ?? null, pg.sam ?? null, pg.crustdata ?? null, risk);
    awardIds.push(grant.award_id);
    for (const e of tl) {
      timelineRows.push({
        award_id: grant.award_id,
        event_date: e.date,
        source: e.source,
        severity: e.severity,
        description: e.description,
      });
    }
    dist[risk.level] = (dist[risk.level] ?? 0) + 1;
  }

  console.log(
    `Scored ${rows.length} grants -> low=${dist.low} medium=${dist.medium} high=${dist.high} critical=${dist.critical}`,
  );
  console.log(`Writing ${riskRows.length} risk_scores + ${timelineRows.length} timeline_events...`);

  const writeStart = Date.now();
  await bulkUpsertRiskScores(riskRows);
  await replaceTimelineEventsByAward(awardIds, timelineRows);
  console.log(`  wrote in ${Date.now() - writeStart}ms`);

  // Flagship assertion
  const sunrise = rows.find((r) => r.grant.award_id === "HRSA-00001");
  if (sunrise) {
    const srRisk = riskRows.find((r) => r.award_id === "HRSA-00001");
    console.log(`Sunrise (HRSA-00001): risk=${srRisk?.total} level=${srRisk?.level}`);
  } else {
    console.log("NOTE: Sunrise (HRSA-00001) not in DB. Run scripts/seed-sunrise.sql to add it.");
  }

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error(`backfill: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
