"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AgentFeed } from "@/components/AgentFeed";

interface TopCritical {
  award_id: string;
  recipient_name: string | null;
  score: number | null;
}

interface Summary {
  critical?: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  elapsed_seconds: number;
  top_critical?: TopCritical | null;
}

export default function AgentFeedPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleComplete = useCallback((s: Summary) => {
    setSummary(s);
  }, []);

  const top = summary?.top_critical ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-0)",
        color: "var(--text)",
        padding: "32px 40px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <p style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 32 }}>
        <Link href="/" style={{ color: "var(--brand)", textDecoration: "none" }}>
          ← Portfolio
        </Link>
      </p>

      <AgentFeed onComplete={handleComplete} />

      {summary && top && (
        <div
          style={{
            marginTop: 32,
            padding: "20px 24px",
            background: "linear-gradient(180deg, rgba(58,26,28,0.45) 0%, var(--bg-1) 100%)",
            border: "1px solid #5c2024",
            borderRadius: 8,
            animation: "fadeInUp 0.5s ease",
          }}
        >
          <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }`}</style>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#ff8b8e",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 0,
              marginBottom: 14,
            }}
          >
            Top priority — highest composite risk score
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "var(--text)" }}>
                {top.recipient_name ?? top.award_id}
              </p>
              <p className="num" style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
                Award {top.award_id} · CFDA 93.224 · Risk score{" "}
                <span style={{ color: "#ff8b8e", fontWeight: 700 }}>
                  {top.score?.toFixed(1) ?? "—"} / 10
                </span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
                Surfaced from live FAC + USASpending + SAM + Crustdata pull this run.
              </p>
            </div>
            <Link
              href={`/investigate/${encodeURIComponent(top.award_id)}`}
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "#c8372d",
                color: "#fff",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Investigate →
            </Link>
          </div>
        </div>
      )}

      {summary && !top && (
        <div
          style={{
            marginTop: 32,
            padding: "20px 24px",
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14 }}>
            No critical-level recipients in this run. {summary.high_risk} high-risk and{" "}
            {summary.medium_risk} medium-risk recipients to triage.
          </p>
        </div>
      )}
    </div>
  );
}
