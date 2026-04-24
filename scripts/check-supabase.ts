import { loadPortfolioFromSupabase } from "../lib/db/queries";

async function main(): Promise<void> {
  const rows = await loadPortfolioFromSupabase();
  console.log(`grants loaded: ${rows.length}`);

  const dist: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let withAudit = 0;
  let withSam = 0;
  let withCrust = 0;
  let withTimeline = 0;
  for (const r of rows) {
    dist[r.risk.level] = (dist[r.risk.level] ?? 0) + 1;
    if (r.audit) withAudit++;
    if (r.sam) withSam++;
    if (r.crustdata) withCrust++;
    if (r.timeline.length > 0) withTimeline++;
  }
  console.log(`risk levels: ${JSON.stringify(dist)}`);
  console.log(`with audit: ${withAudit}  with sam: ${withSam}  with crust: ${withCrust}  with timeline events: ${withTimeline}`);

  const top = [...rows].sort((a, b) => b.risk.total - a.risk.total).slice(0, 5);
  console.log("\ntop 5 by risk:");
  for (const r of top) {
    console.log(`  ${r.risk.total.toFixed(1).padStart(4)} (${r.risk.level.padEnd(8)}) ${r.grant.award_id.padEnd(14)} ${r.grant.recipient_name}`);
  }

  const sunrise = rows.find((r) => r.grant.award_id === "HRSA-00001");
  if (sunrise) {
    console.log(`\n✓ Sunrise flagship present: HRSA-00001  risk=${sunrise.risk.total} (${sunrise.risk.level})  signals=${sunrise.risk.signals.length}`);
  } else {
    console.log(`\n✗ Sunrise flagship NOT present. Run scripts/seed-sunrise.sql in the Supabase SQL editor.`);
  }
}

main().catch((err) => {
  console.error(`check-supabase: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
