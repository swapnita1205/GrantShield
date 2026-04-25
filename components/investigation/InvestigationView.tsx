import Link from "next/link";
import { BriefingCard } from "@/components/investigation/BriefingCard";
import { EvidenceIcon } from "@/components/investigation/EvidenceIcon";
import { InvestigationActions } from "@/components/investigation/InvestigationActions";
import { getInvestigationBriefing } from "@/lib/investigation-briefing";
import { buildEvidenceBySource, SOURCE_EVIDENCE_COLORS, type EvidenceSourceKey } from "@/lib/investigation-evidence";
import { formatUsd, periodRemainingPct, riskBadgeLabel } from "@/lib/investigation-data";
import { getTimelineForInvestigationPage, timelineDotColor } from "@/lib/investigation-timeline";
import { getOigPriorFinding } from "@/lib/oig-prior-findings";
import type { PortfolioGrant } from "@/lib/types";

const SOURCE_ORDER: EvidenceSourceKey[] = ["USASpending", "FAC", "SAM", "Crustdata"];

function sourcePillStyle(src: string): { border: string; color: string; bg: string } {
  const s = src as EvidenceSourceKey;
  const c = SOURCE_EVIDENCE_COLORS[s] ?? SOURCE_EVIDENCE_COLORS.USASpending;
  return {
    border: `1px solid ${c.dot}88`,
    color: c.dot,
    bg: `${c.dot}18`,
  };
}

function fmtDate(d: string): string {
  const t = new Date(d + (d.length <= 10 ? "T12:00:00Z" : ""));
  if (Number.isNaN(t.getTime())) return d;
  return t.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function InvestigationView({ grant }: { grant: PortfolioGrant }) {
  const g = grant.grant;
  const evidence = buildEvidenceBySource(grant);
  const briefing = getInvestigationBriefing(grant);
  const timeline = getTimelineForInvestigationPage(grant, 7);
  const badge = riskBadgeLabel(grant.risk.level, grant.risk.total);
  const pr = periodRemainingPct(g.time_elapsed_pct);
  const badgeBg =
    badge.tone === "red" ? "linear-gradient(160deg, #3a1a1c 0%, #2a1214 100%)" : badge.tone === "amber" ? "linear-gradient(160deg, #2a2010, #1a1508)" : "linear-gradient(160deg, #0f1f1a, #0a1814)";
  const oig = getOigPriorFinding(g.recipient_uei);

  const fmtUsdCompact = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.00$/, "")}M` : `$${n.toLocaleString("en-US")}`;
  const oigDate = oig
    ? new Date(oig.issued_date + "T12:00:00Z").toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--text)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 28px 48px" }}>
        <p style={{ margin: "0 0 20px" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--brand)", fontSize: 14, fontWeight: 500 }}>
            <span aria-hidden>←</span> Back to portfolio
          </Link>
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(200px, 260px)",
            gap: 24,
            alignItems: "start",
            marginBottom: 24,
            paddingBottom: 24,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 12px", lineHeight: 1.2 }}>{g.recipient_name}</h1>
            <p className="num" style={{ margin: "0 0 8px", color: "var(--text-dim)", fontSize: 14, lineHeight: 1.5 }}>
              {g.city}, {g.state} · UEI {g.recipient_uei} · CFDA {g.cfda_number} · Grant {g.award_id}
            </p>
            <p className="num" style={{ margin: 0, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.5 }}>
              {formatUsd(g.award_amount)} · {g.start_date} to {g.end_date} · {pr.toFixed(0)}% period remaining
            </p>
          </div>
          <div
            style={{
              background: badgeBg,
              border: "1px solid",
              borderColor: badge.tone === "red" ? "#5c2024" : badge.tone === "amber" ? "#4a3b18" : "#135236",
              borderRadius: 8,
              padding: "18px 20px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)", marginBottom: 4 }}>
              Composite risk
            </div>
            <div
              className="num"
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: badge.tone === "red" ? "#ff8b8e" : badge.tone === "amber" ? "#f0c14a" : "#4ade9a",
              }}
            >
              {badge.title} – {badge.sub}
            </div>
          </div>
        </div>

        {oig && (
          <div
            style={{
              border: "1px solid #5c2024",
              background: "linear-gradient(180deg, rgba(58, 26, 28, 0.55) 0%, rgba(31, 14, 16, 0.6) 100%)",
              borderRadius: 4,
              padding: "16px 20px",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span
                className="num"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.12,
                  textTransform: "uppercase",
                  color: "#ff8b8e",
                  background: "rgba(255,139,142,0.12)",
                  border: "1px solid rgba(255,139,142,0.4)",
                  padding: "3px 8px",
                  borderRadius: 3,
                }}
              >
                Prior OIG audit on file
              </span>
              <span className="num" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Report {oig.report_number} · Issued {oigDate}
              </span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>
              <strong style={{ color: "#ff8b8e" }}>HHS OIG</strong> previously cited{" "}
              <strong>{oig.recipient_name}</strong> for non-compliance with federal grant
              requirements ({oig.period_audited}). OIG recommended recovery of{" "}
              <span className="num" style={{ color: "#ff8b8e", fontWeight: 700 }}>
                {fmtUsdCompact(oig.refund_or_recovery_recommended_usd)}
              </span>{" "}
              in unallowable + inadequately documented costs. HRSA{" "}
              {oig.hrsa_response === "concurred"
                ? "concurred with the recommendations"
                : oig.hrsa_response.replace(/_/g, " ")}
              .
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
              {oig.findings.slice(0, 3).map((f, i) => (
                <li key={i} style={{ color: "var(--text)", marginBottom: 4 }}>
                  {f}
                </li>
              ))}
            </ul>
            <p style={{ margin: 0, fontSize: 12 }}>
              <a
                href={oig.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--brand)", textDecoration: "underline" }}
              >
                Read the full report on oig.hhs.gov →
              </a>
            </p>
          </div>
        )}

        <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)", margin: "0 0 12px" }}>
          Source evidence
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {SOURCE_ORDER.map((key) => {
            const col = SOURCE_EVIDENCE_COLORS[key];
            const items = evidence[key];
            return (
              <div
                key={key}
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-1)",
                  borderRadius: 4,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: col.dot }} />
                  {col.label}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {items.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "20px 1fr",
                        gap: 8,
                        alignItems: "start",
                        marginBottom: i < items.length - 1 ? 10 : 0,
                      }}
                    >
                      <EvidenceIcon kind={item.icon} />
                      <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)", margin: "0 0 12px" }}>
          Entity timeline
        </h2>
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-1)",
            borderRadius: 4,
            padding: "16px 20px 8px 24px",
            marginBottom: 28,
            position: "relative",
          }}
        >
          {timeline.length === 0 && <p style={{ color: "var(--text-dim)", margin: 0 }}>No timeline events in export.</p>}
          <div
            style={{
              borderLeft: "2px solid #2c3140",
              marginLeft: 5,
              paddingLeft: 0,
            }}
          >
            {timeline.map((ev, i) => (
              <div
                key={`${ev.date}-${i}`}
                style={{
                  position: "relative",
                  paddingLeft: 20,
                  paddingBottom: i < timeline.length - 1 ? 20 : 4,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -7,
                    top: 2,
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: timelineDotColor(ev.severity),
                    boxShadow: "0 0 0 2px var(--bg-1)",
                  }}
                />
                <div className="num" style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 6 }}>
                  {fmtDate(ev.date)}
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.5 }}>{ev.description}</p>
                <span
                  className="num"
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    padding: "2px 8px",
                    ...sourcePillStyle(ev.source),
                  }}
                >
                  {ev.source}
                </span>
              </div>
            ))}
          </div>
        </div>

        <BriefingCard grant={grant} initial={briefing.text} />

        <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.12, color: "var(--text-dim)", margin: "0 0 12px" }}>Actions</h2>
        <InvestigationActions grant={grant} />
      </div>
    </div>
  );
}
