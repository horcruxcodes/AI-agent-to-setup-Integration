"use client";

import { useState } from "react";
import { guideToMarkdown } from "@/lib/markdown";
import type { Guide } from "@/lib/types";

export default function GuideActions({ guide }: { guide: Guide }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (what: "link" | "md") => {
    const url = window.location.href.split("#")[0];
    await navigator.clipboard.writeText(what === "link" ? url : guideToMarkdown(guide, url));
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };
  const btn = "rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-subtle";
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button className={btn} onClick={() => copy("link")}>{copied === "link" ? "Link copied" : "Copy link"}</button>
      <button className={btn} onClick={() => copy("md")}>{copied === "md" ? "Markdown copied" : "Copy as Markdown"}</button>
      <button className={btn} onClick={() => window.print()}>Print / PDF</button>
    </div>
  );
}
