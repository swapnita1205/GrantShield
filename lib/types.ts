/** Risk severity levels, ordered from least to most severe. */
export type Severity = "low" | "medium" | "high" | "critical";

/** Upstream data providers GrantShield pulls from. */
export type DataSource = "USASpending" | "FAC" | "SAM" | "Crustdata";

/** Lifecycle state of a single investigation step. */
export type AgentStatus = "pending" | "running" | "complete" | "error";

/**
 * A federal award record sourced from USASpending.
 * `burn_rate_pct`, `time_elapsed_pct`, and `burn_time_ratio` are derived
 * client-side from the raw award fields — treat them as required.
 */
export interface Grant {
  award_id: string;
  recipient_name: string;
  recipient_uei: string;
  cfda_number: string;
  award_amount: number;
  total_outlays: number;
  /** ISO 8601 date string. */
  start_date: string;
  /** ISO 8601 date string. */
  end_date: string;
  state: string;
  city: string;
  modification_count: number;
  /** Derived client-side: total_outlays / award_amount * 100. */
  burn_rate_pct: number;
  /** Derived client-side: elapsed / (end_date - start_date) * 100. */
  time_elapsed_pct: number;
  /** Derived client-side: burn_rate_pct / time_elapsed_pct. */
  burn_time_ratio: number;
}

/** A single finding from a Federal Audit Clearinghouse (FAC) filing. */
export interface AuditFinding {
  year: number;
  type_requirement: string;
  is_material_weakness: boolean;
  is_significant_deficiency: boolean;
  is_questioned_costs: boolean;
  /** Dollar amount of questioned costs; 0 means none. */
  questioned_costs_amount: number;
  is_repeated: boolean;
}

/** FAC audit history rolled up per recipient UEI. */
export interface AuditData {
  auditee_uei: string;
  audit_years: number[];
  audit_opinion: "unmodified" | "qualified" | "adverse" | "disclaimer";
  findings: AuditFinding[];
  has_going_concern: boolean;
  has_material_noncompliance: boolean;
}

/** Registration + integrity snapshot for an entity in SAM.gov. */
export interface SamEntity {
  uei: string;
  legal_name: string;
  registration_status: "Active" | "Inactive" | "Expired" | "Submitted";
  expiration_date: string;
  has_delinquent_debt: boolean;
  /** Delinquent debt amount; 0 means none. */
  debt_amount: number;
  has_exclusion: boolean;
  /** Exclusion category label; empty string means none. */
  exclusion_type: string;
}

/** Organization profile matched from Crustdata — match may fail upstream. */
export interface CrustdataProfile {
  matched_uei: string;
  headcount: number;
  headcount_qoq_pct: number;
  ceo_name: string;
  employee_reviews_rating: number;
  recent_review_snippets: string[];
  job_postings: number;
  leadership_vacancy: boolean;
}

/** One discrete risk indicator contributing to a RiskScore. */
export interface RiskSignal {
  source: DataSource;
  severity: Severity;
  label: string;
  detail: string;
}

/** Aggregate risk assessment for a single PortfolioGrant. */
export interface RiskScore {
  /** Composite risk score on a 0–100 scale. */
  total: number;
  level: Severity;
  signals: RiskSignal[];
}

/** A dated event surfaced on the grant's investigation timeline. */
export interface TimelineEvent {
  date: string;
  source: DataSource;
  severity: Severity;
  description: string;
}

/** One step in the agent's investigation trace, shown in the UI. */
export interface AgentStep {
  step_number: number;
  source: DataSource;
  status: AgentStatus;
  label: string;
  detail: string;
  timestamp: string;
}

/**
 * Composed per-grant record assembled by the agent.
 * Keep nested — do not flatten. `audit`, `sam`, and `crustdata` are optional
 * because upstream lookups may return nothing (no FAC filing, no SAM match,
 * no Crustdata match). Everything else is required.
 */
export interface PortfolioGrant {
  grant: Grant;
  audit?: AuditData;
  sam?: SamEntity;
  crustdata?: CrustdataProfile;
  risk: RiskScore;
  timeline: TimelineEvent[];
}
