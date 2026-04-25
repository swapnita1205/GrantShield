import type { PortfolioGrant } from "@/lib/types";

export const dynamic = "force-dynamic";

type LetterType = "corrective_action" | "ig_referral" | "site_visit" | "full_report";

type LetterBody = { grant: PortfolioGrant; type: LetterType };

type LetterResponse = {
  type: LetterType;
  subject: string;
  filename: string;
  body: string;
};

const REVIEWER = "Grants Management Specialist · HHS/HRSA Office of Federal Assistance Management";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function summarizeAuditFindings(grant: PortfolioGrant): string {
  const audit = grant.audit;
  if (!audit || audit.findings.length === 0) {
    return "No FAC findings of record in the most recent submission cycle.";
  }
  const mw = audit.findings.filter((f) => f.is_material_weakness);
  const sd = audit.findings.filter((f) => f.is_significant_deficiency);
  const repeated = audit.findings.filter((f) => f.is_repeated);
  const qcSum = audit.findings.reduce((s, f) => s + (f.questioned_costs_amount || 0), 0);
  const years = Array.from(new Set(audit.findings.map((f) => f.year))).sort((a, b) => b - a);
  const lines = [
    `Audit years on file: ${years.join(", ")}.`,
    `Material weaknesses (count): ${mw.length}.`,
    `Significant deficiencies (count): ${sd.length}.`,
    `Findings flagged repeated from prior years: ${repeated.length}.`,
    qcSum > 0 ? `Questioned costs aggregate: ${fmtUsd(qcSum)}.` : `No questioned-costs amounts recorded.`,
  ];
  return lines.join(" ");
}

function summarizeSignals(grant: PortfolioGrant): string {
  if (grant.risk.signals.length === 0) return "No risk signals recorded.";
  return grant.risk.signals
    .map((s, i) => `  ${i + 1}. [${s.source}] ${s.label} — ${s.detail}`)
    .join("\n");
}

function buildCorrectiveAction(grant: PortfolioGrant): LetterResponse {
  const g = grant.grant;
  const today = fmtDate(new Date().toISOString());
  const body = [
    `${today}`,
    ``,
    `${g.recipient_name}`,
    `${g.city}, ${g.state}`,
    `UEI: ${g.recipient_uei}`,
    ``,
    `Re: Award ${g.award_id} (CFDA ${g.cfda_number}) — Notice of Required Corrective Action`,
    ``,
    `Dear Authorized Organization Representative,`,
    ``,
    `The Health Resources and Services Administration has completed a cross-source review of your award referenced above. The review draws on USASpending outlay records, Federal Audit Clearinghouse single-audit submissions, SAM.gov registration data, and publicly available organizational signals.`,
    ``,
    `Composite risk assessment: ${grant.risk.total.toFixed(1)} of 10 (${grant.risk.level}).`,
    ``,
    `Findings of concern:`,
    summarizeSignals(grant),
    ``,
    `Audit summary: ${summarizeAuditFindings(grant)}`,
    ``,
    `Spending posture: outlays of ${fmtUsd(g.total_outlays)} against an award of ${fmtUsd(g.award_amount)} (${g.burn_rate_pct.toFixed(1)}% drawn) with ${g.time_elapsed_pct.toFixed(1)}% of the period of performance elapsed (${fmtDate(g.start_date)} to ${fmtDate(g.end_date)}). Burn-to-time ratio: ${g.burn_time_ratio.toFixed(2)}.`,
    ``,
    `Required corrective action:`,
    `  1. Within 30 calendar days of receipt, provide a written corrective action plan addressing each finding above, including the responsible position, target completion date, and supporting documentation evidencing remediation.`,
    `  2. Suspend further drawdowns under this award until the corrective action plan has been reviewed and accepted in writing by the assigned Grants Management Specialist, in accordance with 2 CFR 200.339(a) and 200.305.`,
    `  3. Submit prior-year finding resolution evidence for any item flagged as repeated.`,
    ``,
    `Failure to respond within 30 calendar days may result in additional remedies under 2 CFR 200.339, up to and including disallowance of costs and termination for material non-compliance.`,
    ``,
    `This letter is generated from data current as of ${today} and is to be entered in the official grant file.`,
    ``,
    `Sincerely,`,
    `${REVIEWER}`,
  ].join("\n");
  return {
    type: "corrective_action",
    subject: `Corrective Action — ${g.award_id} ${g.recipient_name}`,
    filename: `${g.award_id}-corrective-action.txt`,
    body,
  };
}

function buildIgReferral(grant: PortfolioGrant): LetterResponse {
  const g = grant.grant;
  const today = fmtDate(new Date().toISOString());
  const body = [
    `MEMORANDUM`,
    ``,
    `Date: ${today}`,
    `From: ${REVIEWER}`,
    `To:   HHS Office of Inspector General — Office of Audit Services`,
    `Re:   Referral for further review — Award ${g.award_id} / UEI ${g.recipient_uei}`,
    ``,
    `Recipient:    ${g.recipient_name}`,
    `Location:     ${g.city}, ${g.state}`,
    `CFDA:         ${g.cfda_number}`,
    `Award:        ${fmtUsd(g.award_amount)} (outlays ${fmtUsd(g.total_outlays)} / ${g.burn_rate_pct.toFixed(1)}% drawn)`,
    `Period:       ${fmtDate(g.start_date)} through ${fmtDate(g.end_date)}`,
    ``,
    `Composite cross-source risk: ${grant.risk.total.toFixed(1)} / 10 (${grant.risk.level}).`,
    ``,
    `Pattern observed:`,
    summarizeSignals(grant),
    ``,
    `Audit context:`,
    summarizeAuditFindings(grant),
    ``,
    `The signals above were derived automatically from public source systems (USASpending.gov, FAC, SAM.gov, organizational data) and have not yet been hand-validated. The pattern is consistent with risk profiles that have historically merited expanded audit work, and is forwarded to OIG-OAS for any investigative review you deem appropriate. Source records and the underlying data extract are available on request.`,
    ``,
    `Per 2 CFR 200.339, the Grants Management Office has issued a corrective-action notice to the recipient on the same date as this referral.`,
    ``,
    `Respectfully,`,
    `${REVIEWER}`,
  ].join("\n");
  return {
    type: "ig_referral",
    subject: `OIG Referral — ${g.award_id} ${g.recipient_name}`,
    filename: `${g.award_id}-oig-referral.txt`,
    body,
  };
}

function buildSiteVisit(grant: PortfolioGrant): LetterResponse {
  const g = grant.grant;
  const today = fmtDate(new Date().toISOString());
  const body = [
    `${today}`,
    ``,
    `${g.recipient_name}`,
    `${g.city}, ${g.state}`,
    `UEI: ${g.recipient_uei}`,
    ``,
    `Re: Award ${g.award_id} — Notice of Site Visit`,
    ``,
    `Dear Authorized Organization Representative,`,
    ``,
    `Pursuant to 2 CFR 200.337, HRSA will conduct an on-site programmatic and financial review at your organization within the next 15 business days. The visit will be coordinated by the assigned Grants Management Specialist and the Project Officer.`,
    ``,
    `Items to be examined include, at minimum:`,
    `  • General ledger transactions supporting outlays drawn against the award (period ${fmtDate(g.start_date)} – ${fmtDate(g.end_date)}, ${g.burn_rate_pct.toFixed(1)}% of the award currently drawn).`,
    `  • Personnel cost allocations and time-and-effort documentation for staff charged to the award.`,
    `  • Procurement files and sub-recipient monitoring evidence.`,
    `  • Corrective action documentation responsive to findings in the most recent FAC submissions (${(grant.audit?.audit_years ?? []).join(", ") || "no FAC record on file"}).`,
    `  • Internal control and cost-allocation policies in effect during the audit period.`,
    ``,
    `Please confirm receipt of this notice within 5 business days and identify a primary point of contact for scheduling and document production. The Project Officer will follow up with a detailed agenda and document request within the next 7 business days.`,
    ``,
    `Sincerely,`,
    `${REVIEWER}`,
  ].join("\n");
  return {
    type: "site_visit",
    subject: `Site Visit — ${g.award_id} ${g.recipient_name}`,
    filename: `${g.award_id}-site-visit-notice.txt`,
    body,
  };
}

function buildFullReport(grant: PortfolioGrant): LetterResponse {
  const g = grant.grant;
  const today = fmtDate(new Date().toISOString());
  const tlLines = (grant.timeline ?? [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
    .map((e) => `  ${fmtDate(e.date).padEnd(20)}  [${e.source}] ${e.description}`);
  const body = [
    `GRANTSHIELD INVESTIGATION REPORT`,
    `Generated ${today} by ${REVIEWER}`,
    `=`.repeat(72),
    ``,
    `RECIPIENT`,
    `  Name:      ${g.recipient_name}`,
    `  Location:  ${g.city}, ${g.state}`,
    `  UEI:       ${g.recipient_uei}`,
    `  CFDA:      ${g.cfda_number}`,
    `  Award:     ${g.award_id}`,
    ``,
    `FINANCIAL POSTURE`,
    `  Award amount:   ${fmtUsd(g.award_amount)}`,
    `  Outlays:        ${fmtUsd(g.total_outlays)}  (${g.burn_rate_pct.toFixed(1)}% drawn)`,
    `  Period:         ${fmtDate(g.start_date)} – ${fmtDate(g.end_date)} (${g.time_elapsed_pct.toFixed(1)}% elapsed)`,
    `  Burn/time:      ${g.burn_time_ratio.toFixed(2)}`,
    `  Modifications:  ${g.modification_count}`,
    ``,
    `COMPOSITE RISK`,
    `  Score:  ${grant.risk.total.toFixed(1)} / 10`,
    `  Level:  ${grant.risk.level.toUpperCase()}`,
    ``,
    `CROSS-SOURCE SIGNALS`,
    summarizeSignals(grant),
    ``,
    `FEDERAL AUDIT CLEARINGHOUSE`,
    `  ${summarizeAuditFindings(grant)}`,
    grant.audit
      ? `  Going concern flagged: ${grant.audit.has_going_concern ? "YES" : "no"}.`
      : `  No FAC record on file.`,
    ``,
    `SAM.GOV`,
    grant.sam
      ? `  Status: ${grant.sam.registration_status}.  Expires: ${grant.sam.expiration_date}.\n  Delinquent debt: ${grant.sam.has_delinquent_debt ? fmtUsd(grant.sam.debt_amount) : "none"}.\n  Exclusion: ${grant.sam.has_exclusion ? grant.sam.exclusion_type || "active entry" : "none"}.`
      : `  No SAM record on file.`,
    ``,
    `ORGANIZATIONAL SIGNALS (Crustdata)`,
    grant.crustdata
      ? `  Headcount: ${grant.crustdata.headcount}.  QoQ change: ${grant.crustdata.headcount_qoq_pct.toFixed(1)}%.\n  Employee rating: ${grant.crustdata.employee_reviews_rating.toFixed(1)} / 5.0.\n  Leadership vacancy: ${grant.crustdata.leadership_vacancy ? "yes" : "no"}.`
      : `  No organizational profile matched.`,
    ``,
    `TIMELINE (most recent first)`,
    tlLines.length ? tlLines.join("\n") : "  No timeline events recorded.",
    ``,
    `=`.repeat(72),
    `End of report. This document is generated from public source data and is`,
    `intended for internal grant-management use. Validate against source records`,
    `before any adverse action.`,
  ].join("\n");
  return {
    type: "full_report",
    subject: `Investigation Report — ${g.award_id} ${g.recipient_name}`,
    filename: `${g.award_id}-investigation-report.txt`,
    body,
  };
}

export async function POST(req: Request) {
  let body: LetterBody;
  try {
    body = (await req.json()) as LetterBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.grant?.grant?.award_id || !body?.type) {
    return Response.json({ error: "Missing grant or type" }, { status: 400 });
  }

  let payload: LetterResponse;
  switch (body.type) {
    case "corrective_action":
      payload = buildCorrectiveAction(body.grant);
      break;
    case "ig_referral":
      payload = buildIgReferral(body.grant);
      break;
    case "site_visit":
      payload = buildSiteVisit(body.grant);
      break;
    case "full_report":
      payload = buildFullReport(body.grant);
      break;
    default:
      return Response.json({ error: `Unknown type: ${body.type}` }, { status: 400 });
  }
  return Response.json(payload);
}
