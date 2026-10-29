// Export a guide as Markdown so it can be pasted into a ticket, PR or doc.

import { DIFFICULTY, EVIDENCE, OWNER, PHASE } from "./format";
import type { Backed, Guide } from "./types";

const ev = (b: Backed) => `_${EVIDENCE[b.evidence]?.label ?? b.evidence}${b.sourceIds.length ? ` ${b.sourceIds.map((s) => `[${s}]`).join("")}` : ""}_`;

export function guideToMarkdown(g: Guide, url: string): string {
  const L: string[] = [];
  L.push(`# ${g.name}: OAuth app setup guide`, "");
  L.push(`**Difficulty:** ${DIFFICULTY[g.verdict.difficulty].label} · **Confidence:** ${g.verdict.confidence} · ${url}`, "");
  L.push(`> ${g.verdict.headline}`, "", g.verdict.summary, "");
  L.push("## At a glance", "");
  L.push(`| | Estimate | Evidence |`, `|---|---|---|`);
  L.push(`| First test connection | ${g.timeline.toFirstConnection.label} | ${ev(g.timeline.toFirstConnection)} |`);
  L.push(`| Open to all users | ${g.timeline.toProduction.label} | ${ev(g.timeline.toProduction)} |`);
  L.push(`| Hands-on effort | ${g.timeline.activeEffort.label} | ${ev(g.timeline.activeEffort)} |`);
  const a = g.timeline.approval;
  L.push(`| Approval | ${a.required === "no" ? "Not required" : `${a.name ?? "Required"} (${a.wait})`} | ${ev(a)} |`, "");
  L.push(`**Composio:** ${g.composio.note}`, "");
  if (g.prerequisites.length) {
    L.push("## Before you start", "");
    g.prerequisites.forEach((p) => L.push(`- ${p.text} ${ev(p)}`));
    L.push("");
  }
  L.push("## Steps", "");
  (Object.keys(PHASE) as (keyof typeof PHASE)[]).forEach((ph) => {
    const steps = g.steps.filter((s) => s.phase === ph);
    if (!steps.length) return;
    L.push(`### ${PHASE[ph].label}`, "");
    steps.forEach((s, i) => {
      L.push(`${i + 1}. **${s.title}** (${OWNER[s.owner]?.label ?? s.owner}${s.time ? `, ${s.time}` : ""}) ${ev(s)}`);
      s.detail.split("\n").forEach((line) => L.push(`   ${line}`));
      if (s.url) L.push(`   ${s.url}`);
    });
    L.push("");
  });
  if (g.dataAccess) {
    const d = g.dataAccess;
    const access = { open: "Standard scope", needs_review: "Triggers review", restricted: "Restricted" };
    L.push("## Data access & sync", "", "| Data | Scopes | Access | Notes |", "|---|---|---|---|");
    d.objects.forEach((o) =>
      L.push(`| ${o.name}: ${o.description} | ${o.scopes.map((s) => `\`${s}\``).join(", ")} | ${access[o.access] ?? o.access} | ${(o.note ?? "").replace(/\|/g, "\\|")} ${ev(o)} |`),
    );
    L.push("", `**Changes (webhooks: ${d.changes.webhooks}):** ${d.changes.detail} ${ev(d.changes)}`, "");
    if (d.limits.length) {
      L.push("**Sync limits:**");
      d.limits.forEach((x) => L.push(`- ${x.text} ${ev(x)}`));
      L.push("");
    }
    if (d.restrictions.length) {
      L.push("**What you're allowed to do with the data:**");
      d.restrictions.forEach((x) => L.push(`- ${x.text} ${ev(x)}`));
      L.push("");
    }
  }
  if (g.gotchas.length) {
    L.push("## Gotchas", "");
    g.gotchas.forEach((x) => L.push(`- **${x.severity.toUpperCase()}: ${x.title}** ${x.detail} ${ev(x)}`));
    L.push("");
  }
  if (g.blockers.length) {
    L.push("## If you get stuck", "", "| You see | Do this |", "|---|---|");
    g.blockers.forEach((b) => L.push(`| ${b.symptom.replace(/\|/g, "\\|")} | ${b.fix.replace(/\|/g, "\\|")} |`));
    L.push("");
  }
  if (g.unknowns.length) {
    L.push("## Not confirmed", "");
    g.unknowns.forEach((u) => L.push(`- ${u}`));
    L.push("");
  }
  L.push("## Sources", "");
  g.sources.forEach((s) => L.push(`- [${s.id}] ${s.title}: ${s.url}`));
  L.push("", `_${g.meta.origin === "curated" ? "Researched" : "Generated live"} ${g.meta.createdAt.slice(0, 10)}${g.meta.humanReviewed ? ", human-reviewed" : ", not human-reviewed"}._`);
  return L.join("\n");
}
