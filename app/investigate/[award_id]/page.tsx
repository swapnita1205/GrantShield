/**
 * Task 4+ — investigation route shell (CTA from dashboard `GrantsTable` → `/investigate/[award_id]`).
 * Full per-award deep-dive UI is Task 5; this page keeps the route valid for builds and `task4check.py`.
 */
import Link from "next/link";

type Props = { params: { award_id: string } };

export default function InvestigatePage({ params }: Props) {
  const label = decodeURIComponent(params.award_id);
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--text)", padding: 32 }}>
      <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
        <Link href="/" style={{ color: "var(--brand)" }}>
          ← Portfolio
        </Link>
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Investigation</h1>
      <p className="num" style={{ color: "var(--text-dim)", marginTop: 12, maxWidth: 520, lineHeight: 1.5 }}>
        <span style={{ color: "var(--text)" }}>{label}</span> — full evidence view, timeline, and actions ship in
        Task 5.
      </p>
    </div>
  );
}
