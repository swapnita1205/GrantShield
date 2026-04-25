"use client";

import { useCallback, useEffect, useState } from "react";
import type { PortfolioGrant } from "@/lib/types";

const REVIEWER = "Grants Management Specialist";

export type ReviewRecord = {
  reviewer: string;
  timestamp: string;
  grant_id: string;
  signals_seen: string[];
};

type LetterType = "corrective_action" | "ig_referral" | "site_visit" | "full_report";

type LetterResponse = {
  type: LetterType;
  subject: string;
  filename: string;
  body: string;
};

function storageKey(grantId: string): string {
  return `grantshield:review:${grantId}`;
}

function formatReviewedLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Reviewed";
  const line = d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Reviewed — ${line}`;
}

type Props = {
  grant: PortfolioGrant;
};

export function InvestigationActions({ grant }: Props) {
  const grantId = grant.grant.award_id;
  const signalLabels = grant.risk.signals.map((s) => s.label);
  const [reviewed, setReviewed] = useState<ReviewRecord | null>(null);
  const [pending, setPending] = useState<LetterType | null>(null);
  const [doc, setDoc] = useState<LetterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey(grantId)) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as ReviewRecord;
        if (parsed && parsed.grant_id === grantId && parsed.timestamp) {
          setReviewed(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [grantId]);

  const onMarkReviewed = useCallback(() => {
    const rec: ReviewRecord = {
      reviewer: REVIEWER,
      timestamp: new Date().toISOString(),
      grant_id: grantId,
      signals_seen: signalLabels,
    };
    try {
      localStorage.setItem(storageKey(grantId), JSON.stringify(rec));
    } catch {
      // private mode, etc.
    }
    setReviewed(rec);
  }, [grantId, signalLabels]);

  const generate = useCallback(
    async (type: LetterType) => {
      setPending(type);
      setError(null);
      setDoc(null);
      try {
        const res = await fetch("/api/letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant, type }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LetterResponse;
        setDoc(json);
      } catch (e) {
        setError(String(e));
      } finally {
        setPending(null);
      }
    },
    [grant],
  );

  const downloadDoc = useCallback(() => {
    if (!doc) return;
    const blob = new Blob([doc.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [doc]);

  const buttonLabel = (type: LetterType, base: string) =>
    pending === type ? `${base.split(" ")[0]}…` : base;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
      }}
    >
      <button
        type="button"
        className="btn-portfolio"
        disabled={pending !== null}
        onClick={() => generate("corrective_action")}
      >
        {buttonLabel("corrective_action", "Generate corrective action letter")}
      </button>
      <button
        type="button"
        className="btn-investigate"
        style={{ minHeight: 44, padding: "0 16px" }}
        disabled={pending !== null}
        onClick={() => generate("ig_referral")}
      >
        {buttonLabel("ig_referral", "Draft IG referral")}
      </button>
      <button
        type="button"
        className="btn-investigate"
        style={{ minHeight: 44, padding: "0 16px" }}
        disabled={pending !== null}
        onClick={() => generate("site_visit")}
      >
        {buttonLabel("site_visit", "Request site visit")}
      </button>
      <button
        type="button"
        className="btn-investigate"
        style={{ minHeight: 44, padding: "0 16px" }}
        disabled={pending !== null}
        onClick={() => generate("full_report")}
      >
        {buttonLabel("full_report", "Export full report")}
      </button>
      {reviewed ? (
        <p className="num mark-reviewed-banner" style={{ margin: 0 }}>
          {formatReviewedLine(reviewed.timestamp)}
        </p>
      ) : (
        <button type="button" className="btn-mark-reviewed" onClick={onMarkReviewed}>
          Mark as reviewed
        </button>
      )}

      {error && (
        <p style={{ color: "var(--red, #e5484d)", fontSize: 13, margin: 0, flexBasis: "100%" }}>
          Failed to generate document: {error}
        </p>
      )}

      {doc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={doc.subject}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDoc(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "min(880px, 100%)",
              maxHeight: "85vh",
              background: "var(--bg-1, #12141a)",
              border: "1px solid var(--border, #242833)",
              borderRadius: 4,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border, #242833)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    letterSpacing: 0.12,
                    textTransform: "uppercase",
                    color: "var(--text-dim, #8b90a0)",
                  }}
                >
                  Generated document
                </p>
                <h3 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600 }}>{doc.subject}</h3>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-investigate" onClick={downloadDoc}>
                  Download .txt
                </button>
                <button
                  type="button"
                  className="btn-investigate"
                  onClick={() => setDoc(null)}
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
            </div>
            <pre
              className="num"
              style={{
                margin: 0,
                padding: "18px 22px",
                overflow: "auto",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--text, #e8eaef)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'JetBrains Mono', monospace",
              }}
            >
              {doc.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
