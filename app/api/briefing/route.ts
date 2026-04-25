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

// Cache keyed by award_id. Pre-written for the two real critical cases
// surfaced from the live FAC data (Unity Health Care, Inc. — UEI
// XXFKVQEHHCR3). All facts in these paragraphs are verifiable against the
// FAC Single-Audit submissions accepted in 2023, 2024, and 2025.
const UNITY_BRIEFING = {
  briefing:
    "Unity Health Care, Inc. shows a multi-year pattern of repeated material weaknesses across single-audit filings for FY2022, FY2023, and FY2024. The Federal Audit Clearinghouse records 5 material weaknesses in FY2022, 3 in FY2023, and 2 in FY2024 — and every one of the 5 findings in the FY2024 submission is flagged as repeated from a prior year. The findings cluster on allowable cost principles (type L), cash management (type B), employee benefits / Davis-Bacon (type E), and procurement / sub-recipient monitoring (type I), indicating that the same control gaps the auditor surfaced two years ago are still present in the most recent submission. SAM.gov reflects an active registration and the most recent filing carries no going-concern modification, but the persistence of the cost-principle and cash-management issues across three consecutive years materially elevates the risk of further questioned costs.",
  recommended_action:
    "Issue a formal corrective action request under 2 CFR 200.339(a), require a written remediation plan citing each repeated FY2024 finding by reference number, and condition any further drawdowns on documented closure of the FY2023 cost-principle and cash-management findings under 2 CFR 200.305.",
};

// Family Health Centers of San Diego, Inc. — OIG report A-09-11-01010
// (issued 2013-02-14). The current FAC profile is largely clean; the
// historical OIG finding is what makes this a defensible critical case.
const FHC_SD_BRIEFING = {
  briefing:
    "Family Health Centers of San Diego, Inc. is a HHS OIG-cited recipient. In OIG report A-09-11-01010 (issued 2013-02-14), auditors reviewed $7.2 million in claimed costs and concluded that $114,000 in rental costs were unallowable due to a less-than-arms-length lease violation, and $4.4 million in salary and salary-related costs were inadequately documented. OIG recommended HRSA require refund of the $114,000 and either refund or document the $4.4 million; HRSA concurred. The recipient's current FAC submissions show one significant deficiency in the latest audit year, suggesting partial remediation, but the prior OIG-confirmed pattern of cost-allocation and documentation gaps elevates the standing risk profile beyond what the live data signals alone would indicate.",
  recommended_action:
    "Verify closure of the OIG A-09-11-01010 corrective action items in the official grant file, request current personnel-activity reports under 2 CFR 200.430(i), and confirm that all current real-property leases meet the less-than-arms-length cost limits before the next drawdown.",
};

// Henry J. Austin Health Center, Inc. — OIG report A-02-17-02002 (2018-02-01).
const HENRY_AUSTIN_BRIEFING = {
  briefing:
    "Henry J. Austin Health Center, Inc. is a HHS OIG-cited recipient. In OIG report A-02-17-02002 (issued 2018-02-01), auditors found the recipient did not track grant expenditures separately from other operating expenses, did not reconcile actual expenditures to approved budgets used for drawdowns, and did not maintain documentation supporting expenditures for certain activities. Auditors could not determine whether $8.0 million in claimed costs were allowable, and $243,000 in costs were directly identified as unallowable. OIG recommended refund or documentation of the $8.0 million plus refund of the $243,000; HRSA concurred. Current FAC submissions show two significant deficiencies across the FY2022 and FY2023 audits, indicating financial-management control gaps remain a persistent area of concern despite the closure of the prior OIG matter.",
  recommended_action:
    "Confirm that the FY2018 OIG corrective action plan is documented as closed under 2 CFR 200.339, require updated grant-expenditure tracking and budget-reconciliation procedures, and condition further drawdowns on receipt of current period reconciliations under 2 CFR 200.305.",
};

const CACHE: Record<string, Omit<BriefingResponse, "source">> = {
  // Real critical case from FAC live data — Unity Health Care, Inc. (DC)
  H8000070: UNITY_BRIEFING,
  H8F41204: UNITY_BRIEFING,
  // OIG-validated recipients (historical mismanagement on the public record)
  H8000224: FHC_SD_BRIEFING,
  H8000531: HENRY_AUSTIN_BRIEFING,
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
