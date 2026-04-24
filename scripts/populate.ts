import {
  fetchUSASpendingByCFDA,
  fetchAuditDataByUEI,
  fetchSamEntityByUEI,
  fetchCrustdataProfile,
} from "../lib/fetchers";
import { deriveBurnFields } from "../lib/derive";
import { upsertPortfolioGrant } from "../lib/db/writer";
import { computeRiskScore } from "../lib/risk-scoring";
import { neutralAudit, neutralSam, neutralCrustdata } from "../lib/risk-defaults";
import { buildTimelineForGrant } from "../lib/timeline-builder";
import type {
  AuditData,
  CrustdataProfile,
  Grant,
  PortfolioGrant,
  SamEntity,
} from "../lib/types";

interface Args {
  cfda: string;
  limit: number;
  concurrency: number;
}

function parseArgs(): Args {
  let cfda = "93.224";
  let limit = 20;
  let concurrency = 8;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--cfda" && i + 1 < args.length) {
      cfda = args[++i];
    } else if (a === "--limit" && i + 1 < args.length) {
      const n = Number(args[++i]);
      if (!Number.isNaN(n) && n > 0) limit = n;
    } else if (a === "--concurrency" && i + 1 < args.length) {
      const n = Number(args[++i]);
      if (!Number.isNaN(n) && n > 0) concurrency = Math.min(20, Math.max(1, n));
    }
  }
  return { cfda, limit, concurrency };
}

/**
 * De-dup fetch layer keyed by UEI. Multiple grants often share a UEI; without
 * caching we'd call FAC/SAM/Crustdata once per grant instead of once per UEI.
 */
function ueiCache<T>(fn: (uei: string) => Promise<T | null>): (uei: string) => Promise<T | null> {
  const cache = new Map<string, Promise<T | null>>();
  return (uei: string) => {
    if (!uei) return Promise.resolve(null);
    let p = cache.get(uei);
    if (!p) {
      p = fn(uei);
      cache.set(uei, p);
    }
    return p;
  };
}

async function withConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(pool);
  return results;
}

async function main(): Promise<void> {
  const { cfda, limit, concurrency } = parseArgs();
  const started = Date.now();
  console.log(`cfda=${cfda} limit=${limit} concurrency=${concurrency}`);

  const rawGrants = await fetchUSASpendingByCFDA(cfda, limit);
  console.log(`Got ${rawGrants.length} grants from USASpending.`);

  const fetchAudit = ueiCache<AuditData>((uei) => fetchAuditDataByUEI(uei));
  const fetchSam = ueiCache<SamEntity>((uei) => fetchSamEntityByUEI(uei));
  // Crustdata takes (uei, orgName) — wrap so the cache key is the UEI.
  const crustByUei = new Map<string, Promise<CrustdataProfile | null>>();
  const fetchCrust = (uei: string, orgName: string): Promise<CrustdataProfile | null> => {
    if (!uei) return Promise.resolve(null);
    let p = crustByUei.get(uei);
    if (!p) {
      p = fetchCrustdataProfile(uei, orgName);
      crustByUei.set(uei, p);
    }
    return p;
  };

  let auditCount = 0;
  let samCount = 0;
  let crustCount = 0;
  const dist: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let done = 0;

  await withConcurrency(rawGrants, concurrency, async (raw, i) => {
    const grant: Grant = deriveBurnFields(raw);

    let audit: AuditData | null = null;
    let sam: SamEntity | null = null;
    let crustdata: CrustdataProfile | null = null;

    if (grant.recipient_uei) {
      [audit, sam, crustdata] = await Promise.all([
        fetchAudit(grant.recipient_uei),
        fetchSam(grant.recipient_uei),
        fetchCrust(grant.recipient_uei, grant.recipient_name),
      ]);
    }

    const risk = computeRiskScore(
      grant,
      audit ?? neutralAudit(grant),
      sam ?? neutralSam(grant),
      crustdata ?? neutralCrustdata(grant),
    );
    const timeline = buildTimelineForGrant(grant, audit, sam, crustdata, risk);

    const pg: PortfolioGrant = {
      grant,
      ...(audit ? { audit } : {}),
      ...(sam ? { sam } : {}),
      ...(crustdata ? { crustdata } : {}),
      risk,
      timeline,
    };

    await upsertPortfolioGrant(pg);

    if (audit) auditCount++;
    if (sam) samCount++;
    if (crustdata) crustCount++;
    dist[risk.level] = (dist[risk.level] ?? 0) + 1;
    done++;

    // Log every row; index ensures the order is readable enough under concurrency.
    console.log(
      `[${String(done).padStart(4)}/${rawGrants.length}] #${i + 1} ${grant.recipient_name.padEnd(40).slice(0, 40)}  ` +
        `audit:${audit ? "y" : "n"} sam:${sam ? "y" : "n"} crust:${crustdata ? "y" : "n"}  ` +
        `risk=${risk.total.toFixed(1)} (${risk.level})`,
    );
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsed}s. ${rawGrants.length} written. audit:${auditCount} sam:${samCount} crust:${crustCount}.`,
  );
  console.log(
    `Risk distribution: low=${dist.low} medium=${dist.medium} high=${dist.high} critical=${dist.critical}`,
  );
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`populate: ${msg}`);
  process.exit(1);
});
