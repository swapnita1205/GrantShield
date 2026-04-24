/**
 * Task 4 — High-risk grant inventory: client-side sort, row navigation to `/investigate/[award_id]`.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { GrantTableRow } from "@/lib/dashboard-aggregates";

type SortKey = "risk" | "name" | "amount" | "burn";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function pillClass(level: GrantTableRow["riskLevel"]): string {
  if (level === "critical" || level === "high") return "pill pill--high";
  if (level === "medium") return "pill pill--medium";
  return "pill pill--low";
}

function pillLabel(level: GrantTableRow["riskLevel"]): string {
  if (level === "critical" || level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

export function GrantsTable({ rows }: { rows: GrantTableRow[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "risk",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const copy = [...rows];
    const { key, dir } = sort;
    const m = dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (key === "risk") return (a.riskTotal - b.riskTotal) * m;
      if (key === "name") return a.recipient_name.localeCompare(b.recipient_name) * m;
      if (key === "amount") return (a.award_amount - b.award_amount) * m;
      if (key === "burn") return (a.burn_rate_pct - b.burn_rate_pct) * m;
      return 0;
    });
    return copy;
  }, [rows, sort]);

  const top10ByRisk = useMemo(() => {
    return [...rows].sort((a, b) => b.riskTotal - a.riskTotal).slice(0, 10);
  }, [rows]);

  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    if (showAll) return sorted;
    const copy = [...top10ByRisk];
    const m = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sort.key === "risk") return (a.riskTotal - b.riskTotal) * m;
      if (sort.key === "name") return a.recipient_name.localeCompare(b.recipient_name) * m;
      if (sort.key === "amount") return (a.award_amount - b.award_amount) * m;
      if (sort.key === "burn") return (a.burn_rate_pct - b.burn_rate_pct) * m;
      return 0;
    });
    return copy;
  }, [showAll, sort, sorted, top10ByRisk]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-dim)" }}>
          High-risk grant inventory
        </h2>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="btn-investigate"
        >
          {showAll ? "Top 10 by risk" : "Show all grants"}
        </button>
      </div>
      <div
        className="gs-scroll"
        role="region"
        aria-label="High-risk grant inventory"
        style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-1)" }}
      >
        <table
          aria-label="Grants, sortable by grantee, award, risk, and burn"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ background: "var(--bg-2)", textAlign: "left", color: "var(--text-dim)" }}>
              <th style={{ padding: "10px 12px" }}>
                <SortBtn label="Grantee" active={sort.key === "name"} onClick={() => setSort(toggle("name", sort))} />
              </th>
              <th style={{ padding: "10px 12px" }} className="num">
                <SortBtn label="Award" active={sort.key === "amount"} onClick={() => setSort(toggle("amount", sort))} />
              </th>
              <th style={{ padding: "10px 12px" }}>
                <SortBtn label="Risk" active={sort.key === "risk"} onClick={() => setSort(toggle("risk", sort))} />
              </th>
              <th style={{ padding: "10px 12px" }}>
                <SortBtn label="Burn" active={sort.key === "burn"} onClick={() => setSort(toggle("burn", sort))} />
              </th>
              <th style={{ padding: "10px 12px" }}>Findings</th>
              <th style={{ padding: "10px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.award_id}
                className="row-click"
                onClick={() => router.push(`/investigate/${encodeURIComponent(r.award_id)}`)}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.recipient_name}</td>
                <td style={{ padding: "10px 12px" }} className="num">
                  {fmtUsd(r.award_amount)}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span className={pillClass(r.riskLevel)}>{pillLabel(r.riskLevel)}</span>
                </td>
                <td style={{ padding: "10px 12px", minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#242833",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, r.burn_rate_pct))}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #1e5c4a, #0f6e56)",
                        }}
                      />
                    </div>
                    <span className="num" style={{ minWidth: 40, textAlign: "right" }}>
                      {r.burn_rate_pct.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="num" style={{ padding: "10px 12px" }}>
                  {r.materialWeaknesses} MW · {r.significantDeficiencies} SD
                </td>
                <td style={{ padding: "10px 12px" }} onClick={(e) => e.stopPropagation()}>
                  <Link href={`/investigate/${encodeURIComponent(r.award_id)}`} className="btn-investigate">
                    Investigate
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toggle(key: SortKey, cur: { key: SortKey; dir: "asc" | "desc" }): { key: SortKey; dir: "asc" | "desc" } {
  if (cur.key === key) {
    return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: key === "name" || key === "amount" || key === "burn" ? "asc" : "desc" };
}

function SortBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        color: active ? "var(--text)" : "var(--text-dim)",
        font: "inherit",
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
      }}
    >
      {label}
      {active ? "  ↕" : ""}
    </button>
  );
}
