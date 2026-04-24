// FAC PostgREST-style API (https://api.fac.gov). Field names that matter here
// are not obvious, so documenting them up front:
//   /general:
//     - auditee_uei, audit_year, report_id
//     - opinion_on_financial_statements (code: U/Q/A/D)
//     - going_concern (boolean)
//   /findings:
//     - reference_number, type_requirement
//     - is_material_weakness, is_significant_deficiency, is_questioned_costs
//     - questioned_costs_amount (or questioned_costs on older rows)
//     - repeat_prior_reference (boolean)

import type { AuditData, AuditFinding } from "../types";

const BASE = "https://api.fac.gov";
let disabledLogged = false;

interface GeneralRow {
  auditee_uei?: string;
  audit_year?: number | string;
  report_id?: string;
  opinion_on_financial_statements?: string;
  opinion?: string;
  going_concern?: boolean;
}

interface FindingRow {
  audit_year?: number | string;
  type_requirement?: string;
  is_material_weakness?: boolean;
  is_significant_deficiency?: boolean;
  is_questioned_costs?: boolean;
  questioned_costs_amount?: number | string;
  questioned_costs?: number | string;
  repeat_prior_reference?: boolean;
}

function mapOpinion(code: unknown): AuditData["audit_opinion"] {
  switch (String(code ?? "").toUpperCase()) {
    case "U":
      return "unmodified";
    case "Q":
      return "qualified";
    case "A":
      return "adverse";
    case "D":
      return "disclaimer";
    default:
      return "unmodified";
  }
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

    const mostRecent = general[0];
    const audit_years = Array.from(
      new Set(general.map((g) => Number(g.audit_year)).filter((n) => !Number.isNaN(n))),
    ).sort((a, b) => b - a);

    let findings: AuditFinding[] = [];
    if (mostRecent.report_id) {
      const fUrl = `${BASE}/findings?report_id=eq.${encodeURIComponent(mostRecent.report_id)}`;
      const fResp = await fetch(fUrl, { headers });
      if (fResp.ok) {
        const rows = (await fResp.json()) as FindingRow[];
        findings = (Array.isArray(rows) ? rows : []).map((r) => ({
          year: Number(r.audit_year ?? mostRecent.audit_year ?? 0),
          type_requirement: r.type_requirement ?? "",
          is_material_weakness: Boolean(r.is_material_weakness),
          is_significant_deficiency: Boolean(r.is_significant_deficiency),
          is_questioned_costs: Boolean(r.is_questioned_costs),
          questioned_costs_amount: Number(r.questioned_costs_amount ?? r.questioned_costs ?? 0),
          is_repeated: Boolean(r.repeat_prior_reference),
        }));
      } else {
        console.warn(`fac: findings ${fResp.status} for report ${mostRecent.report_id}`);
      }
    }

    return {
      auditee_uei: uei,
      audit_years,
      audit_opinion: mapOpinion(mostRecent.opinion_on_financial_statements ?? mostRecent.opinion),
      findings,
      has_going_concern: Boolean(mostRecent.going_concern),
      // Conservative default — computing this reliably requires knowing which
      // type_requirement codes count as "compliance" findings.
      has_material_noncompliance: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`fac: error for uei ${uei}: ${msg}`);
    return null;
  }
}
