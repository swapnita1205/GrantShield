import type { SamEntity } from "../types";

let disabledLogged = false;

// Delinquent-debt and exclusion data live behind SAM's "sensitive data" API
// role, which requires federal agency sponsorship. The public entity API
// does not expose them, so has_delinquent_debt / debt_amount / has_exclusion
// / exclusion_type are hardcoded to their "none" values below. Wire those in
// only if/when a sensitive-data key becomes available.
function mapStatus(v: unknown): SamEntity["registration_status"] {
  const s = String(v ?? "");
  if (s === "Active" || s === "Inactive" || s === "Expired" || s === "Submitted") return s;
  return "Inactive";
}

interface SamEntityRow {
  entityRegistration?: {
    ueiSAM?: string;
    legalBusinessName?: string;
    registrationStatus?: string;
    registrationExpirationDate?: string;
  };
}

interface SamResponse {
  entityData?: SamEntityRow[];
  entities?: SamEntityRow[];
}

export async function fetchSamEntityByUEI(uei: string): Promise<SamEntity | null> {
  const key = process.env.SAM_API_KEY;
  if (!key) {
    if (!disabledLogged) {
      console.warn("SAM disabled: SAM_API_KEY not set");
      disabledLogged = true;
    }
    return null;
  }

  try {
    const url =
      `https://api.sam.gov/entity-information/v3/entities?ueiSAM=${encodeURIComponent(uei)}` +
      `&api_key=${encodeURIComponent(key)}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) {
      console.warn(`sam: ${resp.status} for uei ${uei}`);
      return null;
    }
    const json = (await resp.json()) as SamResponse;
    const entity = json.entityData?.[0] ?? json.entities?.[0];
    if (!entity) return null;
    const reg = entity.entityRegistration ?? {};
    return {
      uei: reg.ueiSAM ?? uei,
      legal_name: reg.legalBusinessName ?? "",
      registration_status: mapStatus(reg.registrationStatus),
      expiration_date: reg.registrationExpirationDate ?? "",
      has_delinquent_debt: false,
      debt_amount: 0,
      has_exclusion: false,
      exclusion_type: "",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`sam: error for uei ${uei}: ${msg}`);
    return null;
  }
}
