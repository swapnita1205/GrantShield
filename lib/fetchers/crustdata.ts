import type { CrustdataProfile } from "../types";

let disabledLogged = false;

export async function fetchCrustdataProfile(
  _uei: string,
  _orgName: string,
): Promise<CrustdataProfile | null> {
  const key = process.env.CRUSTDATA_API_KEY;
  if (!key) {
    if (!disabledLogged) {
      console.warn("Crustdata disabled: CRUSTDATA_API_KEY not set");
      disabledLogged = true;
    }
    return null;
  }
  // TODO: implement Crustdata company lookup once a paid trial key is
  // available. Expected flow: search-by-name (orgName) → pick best match →
  // enrich for headcount, reviews, job_postings, leadership status. Endpoint
  // specifics should be filled in once the API docs + key are in hand.
  return null;
}
