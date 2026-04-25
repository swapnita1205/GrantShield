import type { PortfolioGrant } from "@/lib/types";

export const dynamic = "force-dynamic";

type BriefingBody = { grant: PortfolioGrant };

type BriefingResponse = {
  briefing: string;
  recommended_action: string;
  source: "cache" | "claude" | "fallback";
};

/**
 * Task 7 — AI risk briefing endpoint. Precedence:
 *   1. Cached briefing for the 3 demo entities (never waits on LLM).
 *   2. Live Claude call if ANTHROPIC_API_KEY is set.
 *   3. Deterministic fallback composed from `risk.signals` — keeps the demo
 *      working when the key is absent.
 */

const CACHE: Record<string, Omit<BriefingResponse, "source">> = {
  "HRSA-00001": {
    briefing:
      "Across all four data sources, Sunrise Community Health presents a convergent high-risk pattern. The Federal Audit Clearinghouse records material weaknesses in personnel cost controls for three consecutive filing years (FY2022–FY2024) with $287K in questioned costs, while USASpending shows a 91% burn rate against a 74% period elapsed, compressing the margin to resolve open findings before the December 2026 period of performance end. SAM.gov reflects an active registration but carries $142K in delinquent federal debt on the entity record. Crustdata signals are consistent with operating strain: a 34% headcount decline quarter-over-quarter, an Executive Director vacancy, and below-benchmark workforce sentiment. Taken together, these observations warrant immediate program officer engagement, a documented corrective action plan, and resolution of prior-year findings prior to any further draws.",
    recommended_action:
      "Issue a formal corrective action request under 2 CFR 200.339(a), freeze further drawdowns pending resolution of the FY2024 material weakness, and initiate a site visit within 15 business days.",
  },
  "HRSA-00002": {
    briefing:
      "Metro Health Alliance shows a deteriorating profile across three of four sources. FAC filings carry a qualified audit opinion with two significant deficiencies in sub-recipient monitoring and one repeated finding on procurement, while USASpending shows 4 modifications over the last 18 months and outlays running ahead of baseline. SAM.gov registration is active but expires within 90 days. Crustdata reflects stable headcount but elevated recent turnover in the finance function. The combination of repeated procurement findings, imminent SAM expiration, and finance-office instability is the principal concern.",
    recommended_action:
      "Request an updated procurement policy and sub-recipient monitoring plan under 2 CFR 200.332, confirm SAM.gov renewal before expiration, and schedule a desk review of the finance function.",
  },
  "HRSA-00003": {
    briefing:
      "Coastal Bend Wellness presents medium-risk signals that cluster around financial control rather than programmatic capacity. FAC shows a significant deficiency on allowable costs and an unresolved prior-year questioned cost item; USASpending indicates a below-expected burn of 41% with 62% of the period elapsed. SAM.gov is clean, and Crustdata reflects flat headcount with a 3.1/5.0 workforce rating. The underspend paired with an open questioned-cost item raises concern about grant execution capacity and documentation sufficiency, not integrity.",
    recommended_action:
      "Request a written spend-down plan citing 2 CFR 200.305, reconcile the open questioned cost with supporting documentation, and waive further action if resolved within 30 days.",
  },
};

function buildFallback(grant: PortfolioGrant): Omit<BriefingResponse, "source"> {
  const g = grant.grant;
  const topSignals = grant.risk.signals.slice(0, 4);
  const bySource = topSignals.reduce<Record<string, string[]>>((acc, s) => {
    (acc[s.source] ??= []).push(s.detail);
    return acc;
  }, {});
  const sourceSentence = Object.entries(bySource)
    .map(([src, details]) => `${src} notes ${details.join("; ")}`)
    .join(". ");
  const burnSentence =
    g.burn_time_ratio > 1.1
      ? `Outlays at ${g.burn_rate_pct.toFixed(0)}% of award with ${g.time_elapsed_pct.toFixed(0)}% of the period elapsed indicate an elevated burn ratio of ${g.burn_time_ratio.toFixed(2)}.`
      : `Outlays at ${g.burn_rate_pct.toFixed(0)}% of award against ${g.time_elapsed_pct.toFixed(0)}% of the period elapsed place the burn ratio at ${g.burn_time_ratio.toFixed(2)}.`;
  const score = grant.risk.total.toFixed(1);
  const briefing = `${g.recipient_name} carries a composite risk score of ${score}/10 (${grant.risk.level}) across ${topSignals.length} cross-source signals. ${sourceSentence}. ${burnSentence} Resolution of the highest-severity findings should precede any further draws on award ${g.award_id}.`;
  const cfr = grant.risk.level === "critical" || grant.risk.level === "high"
    ? "2 CFR 200.339(a)"
    : grant.risk.level === "medium"
      ? "2 CFR 200.332"
      : "2 CFR 200.305";
  const recommended_action = `Document the findings in the grant file, issue a written inquiry to the recipient citing ${cfr}, and set a 30-day response deadline.`;
  return { briefing, recommended_action };
}

async function callClaude(
  grant: PortfolioGrant,
  apiKey: string,
): Promise<Omit<BriefingResponse, "source"> | null> {
  const g = grant.grant;
  const audit = grant.audit;
  const sam = grant.sam;
  const cr = grant.crustdata;

  const evidence = [
    `USASpending: burn ${g.burn_rate_pct.toFixed(0)}% against ${g.time_elapsed_pct.toFixed(0)}% period elapsed (ratio ${g.burn_time_ratio.toFixed(2)}); award $${(g.award_amount / 1e6).toFixed(1)}M; ${g.modification_count} modifications; outlays $${(g.total_outlays / 1e6).toFixed(2)}M`,
    audit
      ? `Federal Audit Clearinghouse: ${audit.audit_opinion} opinion, years ${audit.audit_years.join(",")}, ${audit.findings.length} findings, material-weakness count ${audit.findings.filter((f) => f.is_material_weakness).length}, questioned costs $${audit.findings.reduce((s, f) => s + (f.questioned_costs_amount || 0), 0).toLocaleString("en-US")}`
      : "Federal Audit Clearinghouse: no audit record in snapshot",
    sam
      ? `SAM.gov: status ${sam.registration_status}, expires ${sam.expiration_date}, delinquent debt ${sam.has_delinquent_debt ? "$" + sam.debt_amount.toLocaleString("en-US") : "none"}, exclusion ${sam.has_exclusion ? sam.exclusion_type || "active" : "none"}`
      : "SAM.gov: no registration record in snapshot",
    cr
      ? `Crustdata: headcount ${cr.headcount} (${cr.headcount_qoq_pct.toFixed(0)}% QoQ), employee rating ${cr.employee_reviews_rating.toFixed(1)}/5.0, leadership vacancy ${cr.leadership_vacancy ? "yes" : "no"}`
      : "Crustdata: no profile in snapshot",
  ].join("\n");

  const prompt = `You are a federal grant oversight analyst. Given the following evidence about a grantee, write a 4-5 sentence risk briefing in professional, concise language. Connect findings across data sources to identify patterns. End with a specific recommended action citing the relevant 2 CFR 200 section.

Evidence:
${evidence}

Write as a single paragraph. Be specific about dollar amounts and percentages. No bullet points. No em dashes. After the paragraph, on a new line starting with "RECOMMENDED_ACTION:", write one sentence naming the specific action and 2 CFR 200 citation.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn("[briefing] Claude API non-2xx:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? []).map((b) => b.text ?? "").join("").trim();
    if (!text) return null;
    const marker = "RECOMMENDED_ACTION:";
    const i = text.indexOf(marker);
    if (i >= 0) {
      return {
        briefing: text.slice(0, i).trim(),
        recommended_action: text.slice(i + marker.length).trim(),
      };
    }
    return { briefing: text, recommended_action: "Recommended action not parsed; see briefing." };
  } catch (err) {
    console.warn("[briefing] Claude call failed:", err);
    return null;
  }
}

export async function POST(req: Request) {
  let body: BriefingBody;
  try {
    body = (await req.json()) as BriefingBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const grant = body?.grant;
  if (!grant || !grant.grant?.award_id) {
    return Response.json({ error: "Missing grant.grant.award_id" }, { status: 400 });
  }

  const awardId = grant.grant.award_id;
  const cached = CACHE[awardId];
  if (cached) {
    const out: BriefingResponse = { ...cached, source: "cache" };
    return Response.json(out);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const live = await callClaude(grant, apiKey);
    if (live) {
      const out: BriefingResponse = { ...live, source: "claude" };
      return Response.json(out);
    }
  }

  const fallback = buildFallback(grant);
  const out: BriefingResponse = { ...fallback, source: "fallback" };
  return Response.json(out);
}
