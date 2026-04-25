import { getPortfolioStats } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  const encoder = new TextEncoder();

  // Compute live stats up front so step messages can reference real numbers.
  // The 3-second per-step pacing is for demo readability, not because the
  // queries are slow — getPortfolioStats finishes in ~1s.
  let stats: Awaited<ReturnType<typeof getPortfolioStats>> | null = null;
  try {
    stats = await getPortfolioStats("93.224");
  } catch (err) {
    console.warn("[/api/investigate] live stats failed, using zeroed steps:", err);
  }

  const startedAt = Date.now();

  const STEPS = [
    {
      step_number: 1,
      source: "usaspending",
      label: "Querying USASpending.gov",
      detail: stats
        ? `Querying USASpending.gov for CFDA ${stats.cfda}... ${stats.total_grants.toLocaleString("en-US")} awards across ${stats.unique_states} states. ${fmtUsd(stats.total_award_value_usd)} total portfolio value.`
        : "Querying USASpending.gov... data temporarily unavailable.",
    },
    {
      step_number: 2,
      source: "fac",
      label: "Cross-referencing Federal Audit Clearinghouse",
      detail: stats
        ? `Cross-referencing audit history via FAC... matching ${stats.audit_unique_ueis.toLocaleString("en-US")} grantee UEIs across recent audit years. ${stats.audit_findings_total.toLocaleString("en-US")} findings indexed. ${stats.audit_material_weaknesses} material weaknesses, ${stats.audit_significant_deficiencies} significant deficiencies. ${stats.audit_repeated_findings_ueis} grantees with findings repeating from prior years.`
        : "Cross-referencing FAC... data temporarily unavailable.",
    },
    {
      step_number: 3,
      source: "computed",
      label: "Analyzing spending patterns",
      detail: stats
        ? `Analyzing spending patterns against the program baseline... ${stats.burn_rate_anomalies} burn-rate anomalies detected (burn-to-time ratio outside [0.5, 1.3]).`
        : "Spending pattern analysis... data temporarily unavailable.",
    },
    {
      step_number: 4,
      source: "sam",
      label: "Verifying entity status via SAM.gov",
      detail: stats
        ? stats.sam_records === 0
          ? `Verifying entity status via SAM.gov... 0 records returned (daily quota exhausted; refresh after midnight UTC).`
          : `Verifying entity status via SAM.gov... ${stats.sam_records.toLocaleString("en-US")} entity records read. ${stats.sam_delinquent_debt} delinquent-debt flags. ${stats.sam_active_exclusions} active exclusions. ${stats.sam_expiring_within_90_days} registrations expiring within 90 days.`
        : "SAM.gov verification... data temporarily unavailable.",
    },
    {
      step_number: 5,
      source: "crustdata",
      label: "Enriching organizational profiles via Crustdata",
      detail: stats
        ? `Enriching organizational profiles via Crustdata... ${stats.crustdata_matched.toLocaleString("en-US")} of ${stats.total_grants.toLocaleString("en-US")} entities matched. ${stats.crustdata_headcount_decline_20} headcount declines >20%. ${stats.crustdata_leadership_vacancies} leadership vacancies on file.`
        : "Crustdata enrichment... data temporarily unavailable.",
    },
    {
      step_number: 6,
      source: "synthesis",
      label: "Risk synthesis complete",
      detail: stats
        ? `Risk synthesis complete. ${stats.risk_critical} critical, ${stats.risk_high} high, ${stats.risk_medium} medium, ${stats.risk_low} low.`
        : "Risk synthesis complete.",
    },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      for (const step of STEPS) {
        send({ ...step, status: "running", timestamp: new Date().toISOString() });
        await delay(2800);
        send({ ...step, status: "complete", timestamp: new Date().toISOString() });
        await delay(200);
      }

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      send({
        type: "summary",
        critical: stats?.risk_critical ?? 0,
        high_risk: stats?.risk_high ?? 0,
        medium_risk: stats?.risk_medium ?? 0,
        low_risk: stats?.risk_low ?? 0,
        elapsed_seconds: Number(elapsed),
        top_critical: stats?.top_critical_award_id
          ? {
              award_id: stats.top_critical_award_id,
              recipient_name: stats.top_critical_recipient_name,
              score: stats.top_critical_score,
            }
          : null,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
