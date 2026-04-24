import Link from "next/link";

export default function InvestigateNotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--text)", padding: 40, maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Award not in portfolio</h1>
      <p className="num" style={{ color: "var(--text-dim)", margin: "12px 0 20px" }}>
        No `PortfolioGrant` was found for this ID in `data/portfolio.json`.
      </p>
      <Link href="/" style={{ color: "var(--brand)", fontWeight: 500 }}>
        ← Back to portfolio
      </Link>
    </div>
  );
}
