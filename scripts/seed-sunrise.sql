-- Seed the flagship demo case (Sunrise Community Health Inc. / HRSA-00001)
-- into the real Supabase tables so the dashboard always has a 9.2 critical row.
-- Idempotent: safe to re-run. Paste into Supabase SQL editor and run once.

begin;

insert into grants (
  award_id, recipient_name, recipient_uei, cfda_number,
  award_amount, total_outlays, start_date, end_date,
  state, city, modification_count,
  burn_rate_pct, time_elapsed_pct, burn_time_ratio
) values (
  'HRSA-00001', 'Sunrise Community Health Inc.', 'J4KNMH7E2XL3', '93.224',
  3800000, 3458000, '2023-01-01', '2026-12-31',
  'CO', 'Greeley', 5,
  91.0, 95.0, 0.96
)
on conflict (award_id) do update set
  recipient_name = excluded.recipient_name,
  recipient_uei = excluded.recipient_uei,
  cfda_number = excluded.cfda_number,
  award_amount = excluded.award_amount,
  total_outlays = excluded.total_outlays,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  state = excluded.state,
  city = excluded.city,
  modification_count = excluded.modification_count,
  burn_rate_pct = excluded.burn_rate_pct,
  time_elapsed_pct = excluded.time_elapsed_pct,
  burn_time_ratio = excluded.burn_time_ratio;

insert into audit_data (
  auditee_uei, audit_years, audit_opinion,
  has_going_concern, has_material_noncompliance
) values (
  'J4KNMH7E2XL3', ARRAY[2022,2023,2024], 'qualified',
  false, true
)
on conflict (auditee_uei) do update set
  audit_years = excluded.audit_years,
  audit_opinion = excluded.audit_opinion,
  has_going_concern = excluded.has_going_concern,
  has_material_noncompliance = excluded.has_material_noncompliance;

delete from audit_findings where auditee_uei = 'J4KNMH7E2XL3';

insert into audit_findings (
  auditee_uei, year, type_requirement,
  is_material_weakness, is_significant_deficiency, is_questioned_costs,
  questioned_costs_amount, is_repeated
) values
  ('J4KNMH7E2XL3', 2022, 'Personnel Cost Controls', true, true, false, 0,      true),
  ('J4KNMH7E2XL3', 2023, 'Personnel Cost Controls', true, true, false, 0,      true),
  ('J4KNMH7E2XL3', 2024, 'Personnel Cost Controls', true, true, true,  287000, true);

insert into sam_entities (
  uei, legal_name, registration_status, expiration_date,
  has_delinquent_debt, debt_amount, has_exclusion, exclusion_type
) values (
  'J4KNMH7E2XL3', 'Sunrise Community Health Inc.', 'Active', '2026-11-20',
  true, 142000, false, ''
)
on conflict (uei) do update set
  legal_name = excluded.legal_name,
  registration_status = excluded.registration_status,
  expiration_date = excluded.expiration_date,
  has_delinquent_debt = excluded.has_delinquent_debt,
  debt_amount = excluded.debt_amount,
  has_exclusion = excluded.has_exclusion,
  exclusion_type = excluded.exclusion_type;

insert into crustdata_profiles (
  matched_uei, headcount, headcount_qoq_pct, ceo_name,
  employee_reviews_rating, recent_review_snippets, job_postings, leadership_vacancy
) values (
  'J4KNMH7E2XL3', 96, -34.0, 'Interim Leadership Team',
  2.8,
  ARRAY['Chronic staffing turnover in operations and billing.','Leadership transition has delayed corrective action plans.'],
  4, true
)
on conflict (matched_uei) do update set
  headcount = excluded.headcount,
  headcount_qoq_pct = excluded.headcount_qoq_pct,
  ceo_name = excluded.ceo_name,
  employee_reviews_rating = excluded.employee_reviews_rating,
  recent_review_snippets = excluded.recent_review_snippets,
  job_postings = excluded.job_postings,
  leadership_vacancy = excluded.leadership_vacancy;

insert into risk_scores (award_id, total, level, signals) values (
  'HRSA-00001', 9.2, 'critical',
  '[
    {"source":"FAC","severity":"critical","label":"Consecutive material weaknesses","detail":"Material weaknesses persisted FY2022-FY2024 in personnel cost controls."},
    {"source":"FAC","severity":"high","label":"Questioned costs","detail":"FAC reported $287,000 in questioned costs."},
    {"source":"USASpending","severity":"medium","label":"Burn profile pressure","detail":"91% spend against 95% elapsed time suggests constrained closeout margin."},
    {"source":"SAM","severity":"high","label":"Delinquent federal debt","detail":"SAM indicates $142,000 delinquent debt."},
    {"source":"Crustdata","severity":"high","label":"Headcount contraction","detail":"Workforce declined 34% quarter-over-quarter."},
    {"source":"Crustdata","severity":"medium","label":"Leadership vacancy","detail":"Executive Director role remains vacant."}
  ]'::jsonb
)
on conflict (award_id) do update set
  total = excluded.total,
  level = excluded.level,
  signals = excluded.signals;

delete from timeline_events where award_id = 'HRSA-00001';

insert into timeline_events (award_id, event_date, source, severity, description) values
  ('HRSA-00001', '2022-10-05', 'FAC',         'high',     'FY2022 single audit identified material weakness in personnel cost controls.'),
  ('HRSA-00001', '2023-10-09', 'FAC',         'high',     'FY2023 audit repeated personnel cost control material weakness.'),
  ('HRSA-00001', '2024-09-30', 'USASpending', 'medium',   'USASpending refresh showed burn rate at 91% on $3.8M award.'),
  ('HRSA-00001', '2024-10-11', 'FAC',         'critical', 'FY2024 audit reported third consecutive material weakness and $287K questioned costs.'),
  ('HRSA-00001', '2024-11-02', 'SAM',         'high',     'SAM flagged $142K delinquent federal debt on active registration.'),
  ('HRSA-00001', '2024-11-18', 'Crustdata',   'high',     'Crustdata showed 34% headcount decline and Executive Director vacancy.'),
  ('HRSA-00001', '2024-12-20', 'USASpending', 'critical', 'Composite risk score finalized at 9.2 (critical).');

commit;
