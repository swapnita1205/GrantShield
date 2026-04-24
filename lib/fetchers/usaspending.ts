import type { Grant } from "../types";

const ENDPOINT = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
// USASpending caps spending_by_award at 100 results per request. Anything
// larger requires paginating through `page`.
const PAGE_SIZE = 100;

interface RawResult {
  "Award ID"?: string;
  generated_internal_id?: string;
  "Recipient Name"?: string;
  recipient_id?: string;
  recipient_uei?: string;
  "Recipient UEI"?: string;
  "Award Amount"?: number | string;
  "Total Outlays"?: number | string;
  "Start Date"?: string;
  "End Date"?: string;
  "Place of Performance State Code"?: string;
  "Place of Performance City Code"?: string;
  "CFDA Number"?: string;
}

interface PageResponse {
  results?: RawResult[];
  page_metadata?: { hasNext?: boolean };
}

async function fetchPage(cfda: string, page: number, pageLimit: number): Promise<PageResponse> {
  const body = {
    filters: {
      award_type_codes: ["02", "03", "04", "05"],
      program_numbers: [cfda],
      time_period: [{ start_date: "2022-01-01", end_date: "2026-12-31" }],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Recipient UEI",
      "recipient_id",
      "Award Amount",
      "Total Outlays",
      "Start Date",
      "End Date",
      "Place of Performance State Code",
      "Place of Performance City Code",
      "CFDA Number",
    ],
    page,
    limit: pageLimit,
    sort: "Award Amount",
    order: "desc",
  };

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`usaspending: network error: ${msg}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `usaspending: ${response.status} ${response.statusText}: ${text.slice(0, 500)}`,
    );
  }

  return (await response.json()) as PageResponse;
}

function mapResult(r: RawResult, cfda: string): Grant {
  // Richer UEI data requires a per-award lookup at
  // GET /api/v2/awards/<generated_unique_award_id>/ — not done here.
  const uei = r.recipient_uei ?? r["Recipient UEI"] ?? "";
  const award_id = String(r["Award ID"] ?? r.generated_internal_id ?? "");
  if (!uei) {
    console.warn(`usaspending: no UEI for award ${award_id}`);
  }
  return {
    award_id,
    recipient_name: r["Recipient Name"] ?? "",
    recipient_uei: uei,
    cfda_number: r["CFDA Number"] ?? cfda,
    award_amount: Number(r["Award Amount"] ?? 0),
    total_outlays: Number(r["Total Outlays"] ?? 0),
    start_date: r["Start Date"] ?? "",
    end_date: r["End Date"] ?? "",
    state: r["Place of Performance State Code"] ?? "",
    city: r["Place of Performance City Code"] ?? "",
    // TODO: modification_count requires a per-award modifications lookup
    modification_count: 0,
    burn_rate_pct: 0,
    time_elapsed_pct: 0,
    burn_time_ratio: 0,
  };
}

export async function fetchUSASpendingByCFDA(cfda: string, limit: number): Promise<Grant[]> {
  const out: Grant[] = [];
  let page = 1;
  while (out.length < limit) {
    const remaining = limit - out.length;
    const pageLimit = Math.min(PAGE_SIZE, remaining);
    const json = await fetchPage(cfda, page, pageLimit);
    const results = json.results ?? [];
    for (const r of results) out.push(mapResult(r, cfda));

    const hasNext = json.page_metadata?.hasNext;
    // Stop if the API says no more, or if we got a short page (end of data).
    if (results.length < pageLimit || hasNext === false) break;
    page++;
  }
  return out;
}
