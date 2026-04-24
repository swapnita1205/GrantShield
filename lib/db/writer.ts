import { supabase } from "./client";
import type { PortfolioGrant } from "../types";

function fail(step: string, awardId: string, message: string): never {
  throw new Error(`writer: failed at ${step} for award_id ${awardId}: ${message}`);
}

export async function upsertPortfolioGrant(pg: PortfolioGrant): Promise<void> {
  const awardId = pg.grant.award_id;

  {
    const { error } = await supabase
      .from("grants")
      .upsert(pg.grant, { onConflict: "award_id" });
    if (error) fail("grants", awardId, error.message);
  }

  if (pg.sam) {
    const { error } = await supabase
      .from("sam_entities")
      .upsert(pg.sam, { onConflict: "uei" });
    if (error) fail("sam_entities", awardId, error.message);
  }

  if (pg.audit) {
    const { findings, ...auditOnly } = pg.audit;
    {
      const { error } = await supabase
        .from("audit_data")
        .upsert(auditOnly, { onConflict: "auditee_uei" });
      if (error) fail("audit_data", awardId, error.message);
    }
    {
      const { error } = await supabase
        .from("audit_findings")
        .delete()
        .eq("auditee_uei", pg.audit.auditee_uei);
      if (error) fail("audit_findings.delete", awardId, error.message);
    }
    if (findings.length > 0) {
      const rows = findings.map((f) => ({ ...f, auditee_uei: pg.audit!.auditee_uei }));
      const { error } = await supabase.from("audit_findings").insert(rows);
      if (error) fail("audit_findings.insert", awardId, error.message);
    }
  }

  if (pg.crustdata) {
    const { error } = await supabase
      .from("crustdata_profiles")
      .upsert(pg.crustdata, { onConflict: "matched_uei" });
    if (error) fail("crustdata_profiles", awardId, error.message);
  }

  {
    const { error } = await supabase.from("risk_scores").upsert(
      {
        award_id: awardId,
        total: pg.risk.total,
        level: pg.risk.level,
        signals: pg.risk.signals,
      },
      { onConflict: "award_id" },
    );
    if (error) fail("risk_scores", awardId, error.message);
  }

  {
    const { error } = await supabase
      .from("timeline_events")
      .delete()
      .eq("award_id", awardId);
    if (error) fail("timeline_events.delete", awardId, error.message);
  }
  if (pg.timeline.length > 0) {
    const rows = pg.timeline.map((e) => ({
      award_id: awardId,
      event_date: e.date,
      source: e.source,
      severity: e.severity,
      description: e.description,
    }));
    const { error } = await supabase.from("timeline_events").insert(rows);
    if (error) fail("timeline_events.insert", awardId, error.message);
  }
}
