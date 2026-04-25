import type { CrustdataProfile } from "../types";

/**
 * The trial tier only exposes `GET /screener/company/?company_name=X` for
 * company lookups. Headcount-history, Glassdoor, and job-openings endpoints
 * (`/data_lab/*`) return 404 on this token, so QoQ change, review rating, and
 * job-posting count default to 0 / false and should be treated as unknown in
 * the UI.
 */
type ScreenerHit = {
  company_id?: number;
  linkedin_id?: string;
  company_name?: string;
  employee_count_range?: string;
  linkedin_profile_url?: string;
  company_website_domain?: string;
  hq_country?: string;
  company_type?: string;
};

const BASE = "https://api.crustdata.com";

let disabledLogged = false;

function tokenFromEnv(): string | null {
  const key = process.env.CRUSTDATA_API_KEY || process.env.CRUSTDATA_API_TOKEN;
  return key ? key.trim() : null;
}

/** Parse `"1001-5000"` → midpoint 3000. `"10001+"` → 10001. Empty → 0. */
function parseHeadcountRange(range: string | undefined): number {
  if (!range) return 0;
  const trimmed = range.trim();
  const plusMatch = trimmed.match(/^(\d+)\+$/);
  if (plusMatch) return Number(plusMatch[1]);
  const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const lo = Number(rangeMatch[1]);
    const hi = Number(rangeMatch[2]);
    return Math.round((lo + hi) / 2);
  }
  const single = Number(trimmed);
  return Number.isFinite(single) ? single : 0;
}

async function searchCompanyByName(name: string, token: string): Promise<ScreenerHit | null> {
  const url = `${BASE}/screener/company/?company_name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Token ${token}`,
    },
  });
  if (res.status === 429) {
    console.warn(`[crustdata] rate-limited (429) for "${name}"`);
    return null;
  }
  if (!res.ok) {
    console.warn(`[crustdata] search ${res.status} for "${name}"`);
    return null;
  }
  const json = (await res.json().catch(() => [])) as ScreenerHit[];
  const hits = Array.isArray(json) ? json : [];
  if (hits.length === 0) return null;
  // Prefer a US-headquartered hit; the screener sometimes returns same-named
  // orgs from other countries first.
  const us = hits.find((h) => h.hq_country === "USA");
  return us ?? hits[0];
}

/**
 * Task 9 — live Crustdata enrichment. Calls the trial-tier company screener
 * and maps what it returns onto `CrustdataProfile`. Fields the trial tier
 * does not expose (QoQ headcount change, Glassdoor rating, job postings,
 * leadership vacancy) default to 0 / false; the existing signal builders
 * handle them as "no data" rather than false positives.
 */
export async function fetchCrustdataProfile(
  uei: string,
  orgName: string,
): Promise<CrustdataProfile | null> {
  const token = tokenFromEnv();
  if (!token) {
    if (!disabledLogged) {
      console.warn("Crustdata disabled: CRUSTDATA_API_KEY not set");
      disabledLogged = true;
    }
    return null;
  }
  try {
    const hit = await searchCompanyByName(orgName, token);
    if (!hit) return null;

    return {
      matched_uei: uei,
      headcount: parseHeadcountRange(hit.employee_count_range),
      headcount_qoq_pct: 0,
      ceo_name: "",
      employee_reviews_rating: 0,
      recent_review_snippets: [],
      job_postings: 0,
      leadership_vacancy: false,
    };
  } catch (err) {
    console.warn(`[crustdata] fetch failed for "${orgName}":`, err);
    return null;
  }
}
