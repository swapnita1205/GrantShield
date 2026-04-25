/**
 * Task 4 — Portfolio dashboard: Server Component, Supabase with JSON fallback, wires
 * `lib/dashboard-aggregates.ts` + `GrantsTable`, CTA to `/agent` (Task 6).
 */
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { GrantsTable } from "@/components/GrantsTable";
import {
  buildGrantRows,
  buildRecentAlerts,
  buildSixMonthRiskTrend,
  computeMetrics,
  computeRiskBuckets,
  loadPortfolio,
  sourceClass,
} from "@/lib/dashboard-aggregates";
import type { AlertDot } from "@/lib/dashboard-aggregates";
import { loadPortfolioFromSupabase } from "@/lib/db/queries";
import type { PortfolioGrant } from "@/lib/types";

// Server Component: render on demand so fresh Supabase rows show up without a rebuild.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function dotColor(d: AlertDot): string {
  if (d === "red") return "var(--red)";
  if (d === "amber") return "var(--amber)";
  return "var(--blue)";
}

function riskScoreColor(score: number): string {
  if (score >= 6) return "var(--red)";
  if (score >= 3) return "var(--amber)";
  return "var(--brand)";
}

async function loadPortfolioServer(): Promise<PortfolioGrant[]> {
  // Supabase is the production path; fall back to bundled JSON so the UI still
  // renders if env vars are missing or the DB is unreachable.
  try {
    const rows = await loadPortfolioFromSupabase();
    if (rows.length === 0) {
      console.warn("page: Supabase returned 0 grants — falling back to data/portfolio.json");
      return loadPortfolio();
    }
    return rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`page: Supabase read failed (${msg}) — falling back to data/portfolio.json`);
    return loadPortfolio();
  }
}

export default async function HomePage() {
  const portfolio = await loadPortfolioServer();
  const metrics = computeMetrics(portfolio);
  const buckets = computeRiskBuckets(portfolio);
  const alerts = buildRecentAlerts(portfolio, 6);
  const trend = buildSixMonthRiskTrend(portfolio, new Date());
  const tableRows = buildGrantRows(portfolio);

  const distMax = Math.max(buckets.high, buckets.medium, buckets.low, 1);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image
            src="/grant_logo.png"
            alt="GrantShield"
            width={32}
            height={32}
            priority
            style={{ objectFit: "contain" }}
          />
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "#ffffff",
            }}
          >
            grantshield
          </div>
        </div>
      </header>

      <main style={{ padding: "20px 28px 40px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <Metric
            label="Active Grants"
            value={metrics.activeGrants}
            subtitle={metrics.activeSubtitle}
            valueTone="default"
          />
          <Metric
            label="Portfolio Value"
            value={metrics.portfolioValueLabel}
            subtitle={metrics.disbursedLabel + " disbursed"}
            valueTone="default"
          />
          <Metric
            label="Risk Score"
            value={metrics.riskScore.toFixed(1) + "/10"}
            subtitle={metrics.riskSubtitle}
            valueTone="custom"
            customColor={riskScoreColor(metrics.riskScore)}
          />
          <Metric
            label="Open Findings"
            value={metrics.openFindings}
            subtitle={metrics.findingsSubtitle}
            valueTone="danger"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gap: 16,
            marginBottom: 20,
            alignItems: "stretch",
          }}
        >
          <section
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-1)",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)" }}>
              Alerts
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {alerts.map((a, i) => (
                <li
                  key={a.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "10px 1fr",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{ width: 8, height: 8, borderRadius: 999, background: dotColor(a.dot), marginTop: 4 }}
                  />
                  <div>
                    <p style={{ margin: "0 0 6px", color: "var(--text)" }}>{a.text}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>
                      <span className={sourceClass(a.source)} style={{ fontWeight: 600 }}>
                        {a.source}
                      </span>{" "}
                      · <span className="num">{a.timestamp}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-1)",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)" }}>
              Risk distribution
            </h2>
            <StackBar label="High" value={buckets.high} max={distMax} tone="red" sublabel="incl. critical" />
            <div style={{ height: 8 }} />
            <StackBar label="Medium" value={buckets.medium} max={distMax} tone="amber" />
            <div style={{ height: 8 }} />
            <StackBar label="Low" value={buckets.low} max={distMax} tone="low" />
            <div style={{ height: 16 }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)" }}>
              6-mo. trend (synthetic, mean score)
            </h3>
            <TrendChart points={trend} />
          </section>
        </div>

        <div style={{ marginBottom: 20 }}>
          <GrantsTable rows={tableRows} />
        </div>

        <div>
          <Link href="/agent" className="btn-portfolio" prefetch>
            Investigate Portfolio
          </Link>
        </div>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  subtitle,
  valueTone,
  customColor,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  valueTone: "default" | "danger" | "custom";
  customColor?: string;
}) {
  const vStyle: CSSProperties = { fontSize: 26, fontWeight: 600, fontFamily: "var(--mono)" };
  if (valueTone === "danger") vStyle.color = "var(--red)";
  if (valueTone === "custom" && customColor) vStyle.color = customColor;
  if (valueTone === "default") vStyle.color = "var(--text)";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-1)",
        borderRadius: 4,
        padding: "16px 18px",
      }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)", marginBottom: 6 }}>
        {label}
      </div>
      <div className="num" style={vStyle}>
        {value}
      </div>
      <div className="num" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.4 }}>
        {subtitle}
      </div>
    </div>
  );
}

function StackBar({
  label,
  value,
  max,
  tone,
  sublabel,
}: {
  label: string;
  value: number;
  max: number;
  tone: "red" | "amber" | "low";
  sublabel?: string;
}) {
  const pct = Math.round((value / max) * 100);
  const fill =
    tone === "red" ? "linear-gradient(90deg, #3a1a1c, #e5484d55)" : tone === "amber" ? "linear-gradient(90deg, #2a2010, #e8a31744)" : "linear-gradient(90deg, #0f1f1a, #0f6e56)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "var(--text-dim)" }}>
        <span>
          {label} {sublabel ? <span style={{ fontSize: 11, opacity: 0.7 }}> ({sublabel})</span> : null}
        </span>
        <span className="num" style={{ color: "var(--text)" }}>{value}</span>
      </div>
      <div style={{ height: 8, background: "#242833", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: fill }} />
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: { label: string; value: number }[] }) {
  const w = 360;
  const h = 132;
  const labelRowH = 20;
  const padTop = 14;
  const padBottom = labelRowH + 4;
  const innerLeft = 32;
  const innerRight = 32;
  const chartBottom = h - padBottom;
  const n = points.length;
  const denom = Math.max(1, n - 1);

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.1, max - min);

  const plotTop = padTop;
  const plotBottom = chartBottom;
  const plotH = plotBottom - plotTop;

  const toX = (i: number) => innerLeft + (i / denom) * (w - innerLeft - innerRight);
  const toY = (v: number) => plotBottom - ((v - min) / span) * plotH;

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(" ");

  const labelY = h - 6;

  return (
    <div className="num" style={{ color: "var(--text-dim)", padding: "0 4px" }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%" }}>
        <line x1={innerLeft} y1={chartBottom} x2={w - innerRight} y2={chartBottom} stroke="#2c3140" />
        {points.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === n - 1;
          let anchor: "start" | "middle" | "end" = "middle";
          let x = toX(i);
          if (isFirst) {
            anchor = "start";
            x = innerLeft;
          } else if (isLast) {
            anchor = "end";
            x = w - innerRight;
          }
          return (
            <text
              key={`${p.label}-${i}`}
              x={x}
              y={labelY}
              textAnchor={anchor}
              fill="#6b7080"
              fontSize="9"
              style={{ fontFamily: "var(--mono)" }}
            >
              {p.label}
            </text>
          );
        })}
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="1.5" />
        {points.map((p, i) => (
          <circle key={p.label + i} cx={toX(i)} cy={toY(p.value)} r="2.2" fill="var(--text)" />
        ))}
      </svg>
    </div>
  );
}
