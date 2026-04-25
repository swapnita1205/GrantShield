/**
 * Curated index of HHS OIG audit reports that named the recipient by name and
 * recommended refunds, recoveries, or further investigation. This is a
 * complementary signal layer for entities the federal IG has *already*
 * formally cited — distinct from the live FAC self-audit data.
 *
 * Every entry here is verifiable: each has a public OIG report number and a
 * permalink on oig.hhs.gov. The dollar figures and findings are quoted from
 * the OIG reports themselves.
 */

export interface OigPriorFinding {
  /** SAM.gov UEI of the cited recipient. */
  uei: string;
  /** Recipient name as it appears in the OIG report. */
  recipient_name: string;
  /** OIG report number (e.g., "A-09-11-01010"). */
  report_number: string;
  /** Report title. */
  title: string;
  /** ISO-8601 date the report was issued. */
  issued_date: string;
  /** Period audited. */
  period_audited: string;
  /** Permalink on oig.hhs.gov. */
  url: string;
  /** Headline findings, in plain prose. */
  findings: string[];
  /** Total dollars OIG flagged as unallowable + inadequately documented. */
  refund_or_recovery_recommended_usd: number;
  /** OIG recommended actions. */
  recommendations: string[];
  /** Did HRSA concur? "concurred" / "partially_concurred" / "did_not_concur" / "not_stated". */
  hrsa_response: "concurred" | "partially_concurred" | "did_not_concur" | "not_stated";
}

const PRIOR_FINDINGS: OigPriorFinding[] = [
  {
    uei: "TL1GXSM5USD7",
    recipient_name: "Family Health Centers of San Diego, Inc.",
    report_number: "A-09-11-01010",
    title:
      "Family Health Centers of San Diego, Inc., Claimed Unallowable and Inadequately Documented Costs for Health Resources and Services Administration Grants Under the Recovery Act",
    issued_date: "2013-02-14",
    period_audited: "March 1, 2009 – June 30, 2011",
    url: "https://oig.hhs.gov/reports/all/2013/family-health-centers-of-san-diego-inc-claimed-unallowable-and-inadequately-documented-costs-for-health-resources-and-services-administration-grants-under-the-recovery-act/",
    findings: [
      "Of $7.2M in costs reviewed, $2.7M was allowable.",
      "$114,000 in unallowable rental costs and related indirect costs (less-than-arms-length lease violation).",
      "$4,400,000 in inadequately documented salary and salary-related costs.",
      "Health Center officials were unaware of the federal requirement limiting rental costs under a less-than-arms-length lease.",
    ],
    refund_or_recovery_recommended_usd: 4_514_000,
    recommendations: [
      "Refund $114,000 in unallowable rental costs.",
      "Either refund $4.4M in inadequately documented salary costs or work with HRSA to determine allowability.",
      "Educate officials on less-than-arms-length lease cost limits.",
      "Maintain personnel activity reports compliant with federal requirements.",
    ],
    hrsa_response: "concurred",
  },
  {
    uei: "JRK3Y5WE5387",
    recipient_name: "Henry J. Austin Health Center, Inc.",
    report_number: "A-02-17-02002",
    title:
      "Henry J. Austin Health Center, Inc., a Health Resources and Services Administration Grantee, Did Not Comply With Federal Grant Requirements",
    issued_date: "2018-02-01",
    period_audited: "Community Health Center Program grant period",
    url: "https://oig.hhs.gov/reports/all/2018/henry-j-austin-health-center-inc-a-health-resources-and-services-administration-grantee-did-not-comply-with-federal-grant-requirements/",
    findings: [
      "Did not track grant expenditures separately from other federal and non-federal operating expenses.",
      "Did not reconcile actual grant expenditures to approved budgeted amounts used to draw down federal funds.",
      "Did not maintain documentation supporting grant expenditures for certain activities.",
      "Auditors could not determine whether $8,000,000 in claimed costs were allowable.",
      "$243,000 in costs claimed for activities that were unallowable.",
    ],
    refund_or_recovery_recommended_usd: 8_243_000,
    recommendations: [
      "Refund $8M to the federal government, or work with HRSA to determine what portion was allowable.",
      "Refund $243,000 for unallowable costs.",
    ],
    hrsa_response: "concurred",
  },
];

const BY_UEI = new Map<string, OigPriorFinding>(PRIOR_FINDINGS.map((p) => [p.uei, p]));
const BY_AWARD_ID = new Map<string, OigPriorFinding>();

export function getOigPriorFinding(uei: string): OigPriorFinding | null {
  return BY_UEI.get(uei) ?? null;
}

/** Used by the dashboard to surface a "prior OIG finding" badge per row. */
export function listEntitiesWithPriorOigFinding(): OigPriorFinding[] {
  return PRIOR_FINDINGS.slice();
}

/**
 * Index by award_id once we know which awards belong to which UEI. Called by
 * dashboard aggregation — no-op on subsequent calls.
 */
export function indexByAwardId(awards: Array<{ award_id: string; recipient_uei: string }>): void {
  if (BY_AWARD_ID.size > 0) return;
  for (const a of awards) {
    const f = BY_UEI.get(a.recipient_uei);
    if (f) BY_AWARD_ID.set(a.award_id, f);
  }
}

export function getOigPriorFindingByAwardId(awardId: string): OigPriorFinding | null {
  return BY_AWARD_ID.get(awardId) ?? null;
}
