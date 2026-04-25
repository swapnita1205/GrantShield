// FAC PostgREST-style API (https://api.fac.gov). The findings endpoint returns
// "Y"/"N" strings, NOT booleans — `Boolean("N")` is `true`, so we must parse
// them explicitly. Field names that matter:
//   /general:
//     - auditee_uei, audit_year, report_id, auditee_name
//     - is_going_concern_included ("Yes"/"No")
//   /findings:
//     - reference_number, type_requirement, audit_year, report_id
//     - is_material_weakness, is_significant_deficiency, is_questioned_costs (Y/N)
//     - is_repeat_finding (Y/N)  ← actual field, not `repeat_prior_reference`

import type { AuditData, AuditFinding } from "../types";

const BASE = "https://api.fac.gov";
let disabledLogged = false;

interface GeneralRow {
  auditee_uei?: string;
  auditee_name?: string;
  audit_year?: number | string;
  report_id?: string;
  is_going_concern_included?: string;
}

interface FindingRow {
  audit_year?: number | string;
  reference_number?: string;
  type_requirement?: string;
  is_material_weakness?: string;
  is_significant_deficiency?: string;
  is_questioned_costs?: string;
  is_repeat_finding?: string;
  questioned_costs_amount?: number | string;
  questioned_costs?: number | string;
}

function yn(v: unknown): boolean {
  return String(v ?? "").trim().toUpperCase() === "Y";
}

function yesNo(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true";
}

export async function fetchAuditDataByUEI(uei: string): Promise<AuditData | null> {
  const key = process.env.FAC_API_KEY;
  if (!key) {
    if (!disabledLogged) {
      console.warn("FAC disabled: FAC_API_KEY not set");
      disabledLogged = true;
    }
    return null;
  }

  try {
    const headers = { "x-api-key": key, Accept: "application/json" };
    const generalUrl = `${BASE}/general?auditee_uei=eq.${encodeURIComponent(uei)}&order=audit_year.desc`;
    const gResp = await fetch(generalUrl, { headers });
    if (!gResp.ok) {
      console.warn(`fac: general ${gResp.status} for uei ${uei}`);
      return null;
    }
    const general = (await gResp.json()) as GeneralRow[];
    if (!Array.isArray(general) || general.length === 0) return null;

    const audit_years = Array.from(
      new Set(general.map((g) => Number(g.audit_year)).filter((n) => !Number.isNaN(n))),
    ).sort((a, b) => b - a);

    // Pull findings across ALL years for this UEI so the multi-year "repeated"
    // signal can detect the same type_requirement appearing in 2+ years.
    const fUrl = `${BASE}/findings?auditee_uei=eq.${encodeURIComponent(uei)}&order=audit_year.desc`;
    const fResp = await fetch(fUrl, { headers });
    let findings: AuditFinding[] = [];
    if (fResp.ok) {
      const rows = (await fResp.json()) as FindingRow[];
      // Dedupe on (year, reference_number) — FAC duplicates the same finding
      // row once per federal_award covered, which inflates counts otherwise.
      const seen = new Set<string>();
      findings = (Array.isArray(rows) ? rows : [])
        .filter((r) => {
          const key = `${r.audit_year}|${r.reference_number}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((r) => ({
          year: Number(r.audit_year ?? 0),
          type_requirement: r.type_requirement ?? "",
          is_material_weakness: yn(r.is_material_weakness),
          is_significant_deficiency: yn(r.is_significant_deficiency),
          is_questioned_costs: yn(r.is_questioned_costs),
          questioned_costs_amount: Number(r.questioned_costs_amount ?? r.questioned_costs ?? 0),
          is_repeated: yn(r.is_repeat_finding),
        }));
    } else {
      console.warn(`fac: findings ${fResp.status} for uei ${uei}`);
    }

    return {
      auditee_uei: uei,
      audit_years,
      // Opinion isn't on /general for this dataset; default unmodified. The
      // real risk signal here is multi-year material weaknesses, which we
      // capture via findings.
      audit_opinion: "unmodified",
      findings,
      has_going_concern: yesNo(general[0].is_going_concern_included),
      has_material_noncompliance: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`fac: error for uei ${uei}: ${msg}`);
    return null;
  }
}
