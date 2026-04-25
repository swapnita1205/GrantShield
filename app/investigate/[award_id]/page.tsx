import { notFound } from "next/navigation";
import { InvestigationView } from "@/components/investigation/InvestigationView";
import { getPortfolioGrantFromSupabase } from "@/lib/db/queries";
import { getPortfolioGrantByAwardId } from "@/lib/investigation-data";
import type { PortfolioGrant } from "@/lib/types";

type PageProps = { params: { award_id: string } };

// Render per request so fresh Supabase rows show up without a rebuild.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Task 5 — investigation surface. Supabase first, `data/portfolio.json` as fallback
 * (mirrors the pattern in `app/page.tsx`). Evidence, timeline, and risk badge are
 * pure renders off `PortfolioGrant`, so the view adapts to whichever source returns.
 */
export default async function InvestigateByAwardPage({ params }: PageProps) {
  let grant: PortfolioGrant | null = null;
  try {
    grant = await getPortfolioGrantFromSupabase(params.award_id);
  } catch (err) {
    console.warn("[investigate] Supabase lookup failed, falling back to JSON:", err);
  }
  if (!grant) {
    grant = getPortfolioGrantByAwardId(params.award_id);
  }
  if (!grant) {
    notFound();
  }
  return <InvestigationView grant={grant} />;
}
