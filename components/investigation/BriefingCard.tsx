"use client";

import { useEffect, useState } from "react";
import type { PortfolioGrant } from "@/lib/types";

type BriefingResponse = {
  briefing: string;
  recommended_action: string;
  source: "cache" | "claude" | "fallback";
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: BriefingResponse }
  | { kind: "error"; message: string };

export function BriefingCard({ grant, initial }: { grant: PortfolioGrant; initial: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant }),
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as BriefingResponse;
        setState({ kind: "ready", data: json });
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        setState({ kind: "error", message: String(err) });
      }
    })();
    return () => ctl.abort();
  }, [grant]);

  const sourceLabel =
    state.kind === "ready"
      ? state.data.source === "cache"
        ? "demo cache"
        : state.data.source === "claude"
          ? "Claude"
          : "deterministic summary"
      : null;

  return (
    <>
      <h2
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.12,
          color: "var(--text-dim)",
          margin: "0 0 12px",
        }}
      >
        AI risk briefing
        {sourceLabel && (
          <span
            className="num"
            style={{ marginLeft: 8, color: "var(--text-dim)", fontWeight: 400, textTransform: "none" }}
          >
            ({sourceLabel})
          </span>
        )}
      </h2>
      <div
        style={{
          border: "1px solid #2a3142",
          background: "linear-gradient(180deg, #141821 0%, #11141a 100%)",
          borderRadius: 4,
          padding: "18px 20px",
          marginBottom: 16,
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--text)",
          minHeight: 80,
        }}
      >
        {state.kind === "loading" && (
          <p style={{ margin: 0, color: "var(--text-dim)", fontStyle: "italic" }}>
            Composing briefing from cross-source evidence…
          </p>
        )}
        {state.kind === "ready" && <p style={{ margin: 0 }}>{state.data.briefing}</p>}
        {state.kind === "error" && <p style={{ margin: 0 }}>{initial}</p>}
      </div>
      {state.kind === "ready" && (
        <div
          style={{
            borderLeft: "3px solid var(--amber, #d4a017)",
            padding: "10px 16px",
            marginBottom: 28,
            background: "rgba(232, 163, 23, 0.06)",
            fontSize: 13,
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.12,
              textTransform: "uppercase",
              color: "var(--amber, #d4a017)",
              marginRight: 8,
            }}
          >
            Recommended action
          </span>
          {state.data.recommended_action}
        </div>
      )}
    </>
  );
}
