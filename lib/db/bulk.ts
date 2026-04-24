import "server-only";
import { supabase } from "./client";

/**
 * Supabase REST caps each request around a few MB. 500 rows is a safe default
 * for this schema (JSONB `signals` is the heaviest field).
 */
const BATCH = 500;

async function chunked<T>(rows: T[], fn: (batch: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    await fn(rows.slice(i, i + BATCH));
  }
}

export async function bulkUpsertRiskScores(
  rows: { award_id: string; total: number; level: string; signals: unknown }[],
): Promise<void> {
  await chunked(rows, async (batch) => {
    const { error } = await supabase
      .from("risk_scores")
      .upsert(batch, { onConflict: "award_id" });
    if (error) throw new Error(`bulk: risk_scores: ${error.message}`);
  });
}

export async function replaceTimelineEventsByAward(
  awardIds: string[],
  events: { award_id: string; event_date: string; source: string; severity: string; description: string }[],
): Promise<void> {
  // Delete in chunks by award_id — single IN clause for a batch.
  await chunked(awardIds, async (batch) => {
    const { error } = await supabase.from("timeline_events").delete().in("award_id", batch);
    if (error) throw new Error(`bulk: timeline delete: ${error.message}`);
  });
  // Insert new events in chunks.
  await chunked(events, async (batch) => {
    const { error } = await supabase.from("timeline_events").insert(batch);
    if (error) throw new Error(`bulk: timeline insert: ${error.message}`);
  });
}
