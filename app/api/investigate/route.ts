export const dynamic = "force-dynamic";

const STEPS = [
  {
    step_number: 1,
    source: "usaspending",
    label: "Querying USASpending.gov",
    detail:
      "Querying USASpending.gov for CFDA 93.224... 847 awards found across 38 states. $4.2B total portfolio value.",
  },
  {
    step_number: 2,
    source: "fac",
    label: "Cross-referencing Federal Audit Clearinghouse",
    detail:
      "Cross-referencing audit history via Federal Audit Clearinghouse... Matching 847 grantee UEIs across audit years 2022–2024. 1,847 reports matched. 23 material weaknesses, 41 significant deficiencies. 14 grantees with findings repeating 2+ consecutive years.",
  },
  {
    step_number: 3,
    source: "computed",
    label: "Analyzing spending patterns",
    detail:
      "Analyzing spending patterns against CFDA 93.224 program baseline... 31 burn rate anomalies detected (19 overspend, 12 underspend).",
  },
  {
    step_number: 4,
    source: "sam",
    label: "Verifying entity status via SAM.gov",
    detail:
      "Verifying entity status via SAM.gov... 4 delinquent debt flags. 1 pending exclusion. 2 expiring registrations.",
  },
  {
    step_number: 5,
    source: "crustdata",
    label: "Enriching organizational profiles via Crustdata",
    detail:
      "Enriching organizational profiles via Crustdata... Fuzzy matching entity names to company profiles (94.2% match rate). 7 headcount declines >20%. 3 leadership vacancies detected.",
  },
  {
    step_number: 6,
    source: "synthesis",
    label: "Risk synthesis complete",
    detail:
      "Risk synthesis complete. 12 high-risk. 18 medium-risk. 43 low-risk. Investigation completed in 11.4 seconds.",
  },
];

const SUMMARY = {
  type: "summary",
  high_risk: 12,
  medium_risk: 18,
  low_risk: 43,
  elapsed_seconds: 11.4,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      for (const step of STEPS) {
        // Emit "running" state
        send({ ...step, status: "running", timestamp: new Date().toISOString() });
        await delay(2800);
        // Emit "complete" state
        send({ ...step, status: "complete", timestamp: new Date().toISOString() });
        await delay(200);
      }

      send(SUMMARY);
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
