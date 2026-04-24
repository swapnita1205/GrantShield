"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AgentFeed } from "@/components/AgentFeed";

interface Summary {
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  elapsed_seconds: number;
}

export default function AgentFeedPage() {
  const [complete, setComplete] = useState(false);

  const handleComplete = useCallback((summary: Summary) => {
    setComplete(true);
    // summary received — could use for additional UI if needed
    void summary;
  }, []);

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

      {complete && (
        <div
          style={{
            marginTop: 32,
            padding: "20px 24px",
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            animation: "fadeInUp 0.5s ease",
          }}
        >
          <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }`}</style>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 0,
              marginBottom: 14,
            }}
          >
            Top Priority — Critical Risk
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: "var(--text)" }}>
                Sunrise Community Health Inc.
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
                Greeley, CO · CFDA 93.224 · Risk Score{" "}
                <span className="num" style={{ color: "var(--red)", fontWeight: 700 }}>
                  9.2 / 10
                </span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
                3 consecutive material weaknesses · 91% burn rate · $142K delinquent debt · 34% headcount decline
              </p>
            </div>
            <Link
              href="/investigate/HRSA-00001"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                background: "var(--brand)",
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
    </div>
  );
}
