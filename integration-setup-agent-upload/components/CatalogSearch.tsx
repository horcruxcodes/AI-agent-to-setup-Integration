"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogEntry } from "@/lib/types";

// Every OAuth toolkit in Composio's catalog. Apps with a guide link to it;
// the rest start a live investigation.
export default function CatalogSearch({ catalog, guides }: { catalog: CatalogEntry[]; guides: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "byo" | "managed">("byo");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalog.filter(
      (t) =>
        (filter === "all" || (filter === "managed") === t.composioManaged) &&
        (!s || t.name.toLowerCase().includes(s) || t.slug.toLowerCase().includes(s)),
    );
  }, [catalog, q, filter]);
  const byo = catalog.filter((t) => !t.composioManaged).length;

  const tab = (k: typeof filter, label: string) => (
    <button
      onClick={() => setFilter(k)}
      className={`rounded-md px-2.5 py-1 ${filter === k ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${catalog.length} OAuth toolkits`}
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
          aria-label="Search toolkits"
        />
        <div className="flex gap-1 text-sm">
          {tab("byo", `Bring your own (${byo})`)}
          {tab("managed", `Composio-managed (${catalog.length - byo})`)}
          {tab("all", "All")}
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        {rows.slice(0, 120).map((t) => {
          const slug = guides[t.slug];
          return (
            <li key={t.slug} className="flex items-center gap-2 border-b border-border py-1.5">
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              {slug ? (
                <Link href={`/guides/${slug}`} className="text-xs font-medium text-accent">Guide →</Link>
              ) : (
                <Link href={`/new?app=${encodeURIComponent(t.name)}`} className="text-xs text-muted hover:text-accent">
                  Generate
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 120 && <p className="mt-2 text-xs text-faint">Showing 120 of {rows.length}. Search to narrow down.</p>}
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Not in the catalog.{" "}
          <Link className="text-accent" href={`/new?app=${encodeURIComponent(q)}`}>Generate a guide for “{q}” →</Link>
        </p>
      )}
    </div>
  );
}
