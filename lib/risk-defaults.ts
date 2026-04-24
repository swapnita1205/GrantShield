import type { AuditData, CrustdataProfile, Grant, SamEntity } from "./types";

/**
 * Neutral defaults for entities we couldn't match upstream. `computeRiskScore`
 * requires all four inputs non-null — use these when FAC/SAM/Crustdata returned
 * nothing, so missing data doesn't trigger false-positive signals.
 */
export function neutralAudit(grant: Grant): AuditData {
  return {
    auditee_uei: grant.recipient_uei || grant.award_id,
    audit_years: [],
    audit_opinion: "unmodified",
    findings: [],
    has_going_concern: false,
    has_material_noncompliance: false,
  };
}

export function neutralSam(grant: Grant): SamEntity {
  return {
    uei: grant.recipient_uei || grant.award_id,
    legal_name: grant.recipient_name,
    registration_status: "Active",
    // Far enough out that calcDaysUntil > 90 and doesn't trip the "near expiry" signal.
    expiration_date: "2099-01-01",
    has_delinquent_debt: false,
    debt_amount: 0,
    has_exclusion: false,
    exclusion_type: "",
  };
}

export function neutralCrustdata(grant: Grant): CrustdataProfile {
  return {
    matched_uei: grant.recipient_uei || grant.award_id,
    headcount: 0,
    headcount_qoq_pct: 0,
    ceo_name: "",
    // 3.0+ so "low sentiment" (< 3) doesn't fire on missing data.
    employee_reviews_rating: 3.5,
    recent_review_snippets: [],
    job_postings: 0,
    leadership_vacancy: false,
  };
}
