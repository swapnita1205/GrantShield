"use client";

import { useEffect, useRef, useState } from "react";

type StepStatus = "waiting" | "running" | "complete";

interface AgentStep {
  step_number: number;
  source: string;
  label: string;
  detail: string;
  status: StepStatus;
  timestamp?: string;
}

interface Summary {
  type: "summary";
  critical?: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  elapsed_seconds: number;
  top_critical?: {
    award_id: string;
    recipient_name: string | null;
    score: number | null;
  } | null;
}

interface AgentFeedProps {
  onComplete?: (summary: Summary) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  usaspending: "var(--blue)",
  fac: "var(--purple)",
  sam: "var(--amber)",
  crustdata: "var(--brand)",
  computed: "#a78bfa",
  synthesis: "var(--brand)",
};

const SOURCE_LABELS: Record<string, string> = {
  usaspending: "USASpending",
  fac: "FAC",
  sam: "SAM.gov",
  crustdata: "Crustdata",
  computed: "Analysis",
  synthesis: "Synthesis",
};

function SourceDot({ source, pulse }: { source: string; pulse: boolean }) {
  const color = SOURCE_COLORS[source] ?? "var(--text-dim)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: 3,
        boxShadow: pulse ? `0 0 8px 3px ${color}` : "none",
        transition: "box-shadow 0.3s ease",
        animation: pulse ? "pulse-dot 1.2s ease-in-out infinite" : "none",
      }}
    />
  );
}

function StepRow({ step, visible }: { step: AgentStep; visible: boolean }) {
  const color = SOURCE_COLORS[step.source] ?? "var(--text-dim)";
  const isRunning = step.status === "running";
  const isDone = step.status === "complete";

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "14px 18px",
        background: "var(--bg-1)",
        border: `1px solid ${isDone ? color + "44" : "var(--border)"}`,
        borderRadius: 8,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-24px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        marginBottom: 10,
      }}
    >
      <SourceDot source={step.source} pulse={isRunning} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color,
              flexShrink: 0,
            }}
          >
            {SOURCE_LABELS[step.source] ?? step.source}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {step.label}
          </span>
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>
            {isRunning && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--brand)",
                    display: "inline-block",
                    animation: "pulse-dot 1.2s ease-in-out infinite",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>
                  Running
                </span>
              </span>
            )}
            {isDone && (
              <span style={{ fontSize: 13, color: "var(--brand)" }}>✓</span>
            )}
          </span>
        </div>
        {isDone && (
          <p
            className="num"
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              margin: 0,
              lineHeight: 1.6,
              wordBreak: "break-word",
            }}
          >
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
}

export function AgentFeed({ onComplete }: AgentFeedProps) {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/investigate?program=93.224");

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "summary") {
        setSummary(data as Summary);
        setDone(true);
        es.close();
        onComplete?.(data as Summary);
        return;
      }

      const incoming = data as AgentStep;

      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step_number === incoming.step_number);
        if (idx === -1) {
          return [...prev, incoming];
        }
        const next = [...prev];
        next[idx] = incoming;
        return next;
      });

      // Trigger slide-in on first appearance
      if (incoming.status === "running") {
        setTimeout(() => {
          setVisibleSet((s) => new Set(s).add(incoming.step_number));
        }, 50);
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [onComplete]);

  // Auto-scroll to newest step
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps.length]);

  return (
    <div style={{ maxWidth: 720, width: "100%" }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text)" }}>
          Investigating CFDA 93.224 — HRSA Community Health Centers
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          {done
            ? `Investigation complete in ${summary?.elapsed_seconds}s`
            : "Agent running across 4 data sources…"}
        </p>
      </div>

      {/* Step rows */}
      <div>
        {steps.map((step) => (
          <StepRow
            key={step.step_number}
            step={step}
            visible={visibleSet.has(step.step_number)}
          />
        ))}
      </div>

      <div ref={bottomRef} />

      {/* Summary card */}
      {done && summary && (
        <div
          style={{
            marginTop: 24,
            padding: "20px 24px",
            background: "var(--bg-1)",
            border: "1px solid var(--brand)",
            borderRadius: 8,
            animation: "fadeIn 0.5s ease",
          }}
        >
          <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginBottom: 16, marginTop: 0 }}>
            INVESTIGATION COMPLETE
          </p>
          <div style={{ display: "flex", gap: 32 }}>
            {typeof summary.critical === "number" && (
              <div>
                <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "#ff8b8e" }}>
                  {summary.critical}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Critical</div>
              </div>
            )}
            <div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--red)" }}>
                {summary.high_risk}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>High Risk</div>
            </div>
            <div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--amber)" }}>
                {summary.medium_risk}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Medium Risk</div>
            </div>
            <div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--brand)" }}>
                {summary.low_risk}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Low Risk</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color: "var(--text)" }}>
                {summary.elapsed_seconds}s
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Elapsed</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 20, marginBottom: 0 }}>
            Select a high-risk grantee below to open the full investigation view.
          </p>
        </div>
      )}
    </div>
  );
}
