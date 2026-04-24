"use client";

import { useCallback, useEffect, useState } from "react";

const REVIEWER = "Sarah Chen, GMS";

export type ReviewRecord = {
  reviewer: string;
  timestamp: string;
  grant_id: string;
  signals_seen: string[];
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
  grantId: string;
  signalLabels: string[];
};

export function InvestigationActions({ grantId, signalLabels }: Props) {
  const [reviewed, setReviewed] = useState<ReviewRecord | null>(null);

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

  const onStub = (label: string) => {
    if (typeof window !== "undefined") {
      window.alert(`Demo: "${label}" is not yet wired. Task 7/9.`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
      }}
    >
      <button type="button" className="btn-portfolio" onClick={() => onStub("Generate corrective action letter")}>
        Generate corrective action letter
      </button>
      <button type="button" className="btn-investigate" style={{ minHeight: 44, padding: "0 16px" }} onClick={() => onStub("Draft IG referral")}>
        Draft IG referral
      </button>
      <button type="button" className="btn-investigate" style={{ minHeight: 44, padding: "0 16px" }} onClick={() => onStub("Request site visit")}>
        Request site visit
      </button>
      <button type="button" className="btn-investigate" style={{ minHeight: 44, padding: "0 16px" }} onClick={() => onStub("Export full report")}>
        Export full report
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
    </div>
  );
}
