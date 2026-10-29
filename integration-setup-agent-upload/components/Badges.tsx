import { DIFFICULTY, EVIDENCE, OWNER } from "@/lib/format";
import type { Backed, Difficulty, Owner } from "@/lib/types";

export function DifficultyBadge({ d, size = "sm" }: { d: Difficulty; size?: "sm" | "lg" }) {
  const s = DIFFICULTY[d] ?? DIFFICULTY.moderate;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
      style={{ color: s.color, background: s.soft }}
    >
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

// Evidence label plus links to the sources behind the claim.
export function EvidenceTag({ b }: { b: Backed }) {
  const e = EVIDENCE[b.evidence] ?? EVIDENCE.inferred;
  return (
    <span className="inline-flex items-center gap-1 align-middle text-[11px] leading-none whitespace-nowrap">
      <span title={e.help} className="rounded px-1.5 py-1 font-medium" style={{ color: e.color, background: e.soft }}>
        {e.label}
      </span>
      {b.sourceIds?.map((id) => (
        <a key={id} href={`#src-${id}`} className="text-faint hover:text-accent font-mono">
          [{id}]
        </a>
      ))}
    </span>
  );
}

export function OwnerTag({ o }: { o: Owner }) {
  const x = OWNER[o] ?? OWNER.you;
  const tone =
    o === "agent"
      ? "bg-accent-soft text-accent"
      : o === "provider"
        ? "bg-subtle text-muted"
        : o === "customer_admin"
          ? "text-[var(--hard)] bg-[var(--hard-soft)]"
          : "bg-fg text-bg";
  return (
    <span title={x.help} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
      <span aria-hidden>{x.icon}</span>
      {x.label}
    </span>
  );
}
