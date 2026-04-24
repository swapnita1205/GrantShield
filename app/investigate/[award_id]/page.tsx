import { notFound } from "next/navigation";
import { InvestigationView } from "@/components/investigation/InvestigationView";
import { getPortfolioGrantByAwardId } from "@/lib/investigation-data";

type PageProps = { params: { award_id: string } };

/**
 * Task 5 — investigation surface. Resolves the entity from `data/portfolio.json` by `award_id`.
 * Swap `getPortfolioGrantByAwardId` for a Supabase join when the backend is ready.
 */
export default function InvestigateByAwardPage({ params }: PageProps) {
  const grant = getPortfolioGrantByAwardId(params.award_id);
  if (!grant) {
    notFound();
  }
  return <InvestigationView grant={grant} />;
}
