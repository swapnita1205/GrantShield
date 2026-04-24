import type { EvidenceSeverityUi } from "@/lib/investigation-evidence";

export function EvidenceIcon({ kind }: { kind: EvidenceSeverityUi }) {
  const s = 16;
  if (kind === "critical") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ color: "#f97316", flexShrink: 0 }}>
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    );
  }
  if (kind === "warning") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: "var(--amber)", flexShrink: 0 }} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7V12l3.5 2" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: "var(--brand)", flexShrink: 0 }} stroke="currentColor" strokeWidth="2">
      <path d="M5 12l3 3 7-7" strokeLinecap="round" />
    </svg>
  );
}
