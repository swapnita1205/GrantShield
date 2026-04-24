-- RLS intentionally deferred. Add policies before any real auth.

create extension if not exists "uuid-ossp";

create table grants (
  award_id text primary key,
  recipient_name text not null,
  recipient_uei text not null,
  cfda_number text not null,
  award_amount numeric not null,
  total_outlays numeric not null,
  start_date date not null,
  end_date date not null,
  state text not null,
  city text not null,
  modification_count integer not null,
  burn_rate_pct numeric not null,
  time_elapsed_pct numeric not null,
  burn_time_ratio numeric not null
);

create index grants_recipient_uei_idx on grants (recipient_uei);

create table audit_data (
  auditee_uei text primary key,
  audit_years integer[] not null,
  audit_opinion text not null check (audit_opinion in ('unmodified','qualified','adverse','disclaimer')),
  has_going_concern boolean not null,
  has_material_noncompliance boolean not null
);

create table audit_findings (
  id uuid primary key default uuid_generate_v4(),
  auditee_uei text not null references audit_data(auditee_uei) on delete cascade,
  year integer not null,
  type_requirement text not null,
  is_material_weakness boolean not null,
  is_significant_deficiency boolean not null,
  is_questioned_costs boolean not null,
  questioned_costs_amount numeric not null,
  is_repeated boolean not null
);

create index audit_findings_auditee_uei_idx on audit_findings (auditee_uei);

create table sam_entities (
  uei text primary key,
  legal_name text not null,
  registration_status text not null check (registration_status in ('Active','Inactive','Expired','Submitted')),
  expiration_date date not null,
  has_delinquent_debt boolean not null,
  debt_amount numeric not null,
  has_exclusion boolean not null,
  exclusion_type text not null
);

create table crustdata_profiles (
  matched_uei text primary key,
  headcount integer not null,
  headcount_qoq_pct numeric not null,
  ceo_name text not null,
  employee_reviews_rating numeric not null,
  recent_review_snippets text[] not null,
  job_postings integer not null,
  leadership_vacancy boolean not null
);

create table risk_scores (
  award_id text primary key references grants(award_id) on delete cascade,
  total numeric not null,
  level text not null check (level in ('low','medium','high','critical')),
  signals jsonb not null
);

create table timeline_events (
  id uuid primary key default uuid_generate_v4(),
  award_id text not null references grants(award_id) on delete cascade,
  event_date date not null,
  source text not null check (source in ('USASpending','FAC','SAM','Crustdata')),
  severity text not null check (severity in ('low','medium','high','critical')),
  description text not null
);

create index timeline_events_award_id_idx on timeline_events (award_id);
