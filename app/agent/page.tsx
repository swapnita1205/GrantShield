import Link from "next/link";

/**
 * Task 6 will mount `AgentFeed` here and connect to `GET /api/investigate` (SSE).
 * The dashboard "Investigate Portfolio" CTA links to this route.
 */
export default function AgentFeedPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--text)", padding: 32 }}>
      <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
        <Link href="/" style={{ color: "var(--brand)" }}>
          ← Portfolio
        </Link>
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Agent feed</h1>
      <p className="num" style={{ color: "var(--text-dim)", marginTop: 12, maxWidth: 520, lineHeight: 1.5 }}>
        Placeholder. Task 6: stream investigation steps (SSE) into this view.
      </p>
    </div>
  );
}
