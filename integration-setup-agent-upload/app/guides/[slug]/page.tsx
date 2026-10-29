import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DifficultyBadge, EvidenceTag, OwnerTag } from "@/components/Badges";
import GuideActions from "@/components/GuideActions";
import Md from "@/components/Md";
import { DIFFICULTY, EVIDENCE, OWNER, PHASE } from "@/lib/format";
import { catalog, getGuide } from "@/lib/store";
import type { DataAccess, Estimate, Guide, Owner } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const g = await getGuide((await params).slug);
  if (!g) return { title: "Guide not found" };
  return {
    title: `${g.name} OAuth app setup`,
    description: `${DIFFICULTY[g.verdict.difficulty].label}. ${g.verdict.headline}`,
  };
}

function Section({ id, title, children, hint }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {hint && <p className="text-sm text-muted mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, e, sub }: { label: string; e: Estimate; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-[15px] font-semibold leading-snug">{e.label}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      <div className="mt-2">
        <EvidenceTag b={e} />
      </div>
    </div>
  );
}

function OwnerSplit({ g }: { g: Guide }) {
  const counts = g.steps.reduce<Record<string, number>>((m, s) => ({ ...m, [s.owner]: (m[s.owner] ?? 0) + 1 }), {});
  const total = g.steps.length || 1;
  const colors: Record<Owner, string> = {
    agent: "var(--accent)",
    you: "var(--fg)",
    provider: "var(--faint)",
    customer_admin: "var(--hard)",
  };
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-subtle" role="img" aria-label="Share of steps by owner">
        {(Object.keys(OWNER) as Owner[]).map((o) =>
          counts[o] ? <div key={o} style={{ width: `${(counts[o] / total) * 100}%`, background: colors[o] }} /> : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(Object.keys(OWNER) as Owner[])
          .filter((o) => counts[o])
          .map((o) => (
            <span key={o} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: colors[o] }} />
              {OWNER[o].label}: {counts[o]} step{counts[o] > 1 ? "s" : ""}
            </span>
          ))}
      </div>
    </div>
  );
}

const ACCESS = {
  open: { label: "Standard scope", color: "var(--easy)", soft: "var(--easy-soft)" },
  needs_review: { label: "Triggers review", color: "var(--hard)", soft: "var(--hard-soft)" },
  restricted: { label: "Restricted", color: "var(--vhard)", soft: "var(--vhard-soft)" },
} as const;

const WEBHOOKS = {
  yes: "Webhooks available",
  partial: "Webhooks for some events",
  no: "No webhooks: poll for changes",
  unknown: "Webhook support unclear",
} as const;

function DataAccessSection({ d, toolkitDocs }: { d: DataAccess; toolkitDocs: string | null }) {
  return (
    <Section
      id="data"
      title="Data access & sync"
      hint="Once a user connects: what your agent can read, and how to keep it up to date."
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs text-faint">
            <tr>
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium">Scopes</th>
              <th className="p-3 font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {d.objects.map((o, i) => {
              const a = ACCESS[o.access] ?? ACCESS.open;
              return (
                <tr key={i} className="border-t border-border align-top bg-card">
                  <td className="p-3">
                    <div className="font-medium">{o.name}</div>
                    <div className="text-muted">{o.description}</div>
                    {o.note && <Md text={o.note} className="mt-1 text-xs text-muted" />}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {o.scopes.map((sc) => <code key={sc}>{sc}</code>)}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: a.color, background: a.soft }}>
                      {a.label}
                    </span>
                    <div className="mt-1.5"><EvidenceTag b={o} /></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {WEBHOOKS[d.changes.webhooks] ?? WEBHOOKS.unknown} <EvidenceTag b={d.changes} />
          </div>
          <Md text={d.changes.detail} className="mt-1 text-muted" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="font-medium">Sync limits</div>
          <ul className="mt-1 space-y-1.5 text-muted">
            {d.limits.map((l, i) => (
              <li key={i}>
                <Md text={l.text} /> <EvidenceTag b={l} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {d.restrictions.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--hard)]/30 bg-[var(--hard-soft)] p-4 text-sm">
          <div className="font-medium">What you&apos;re allowed to do with the data</div>
          <ul className="mt-1 space-y-1.5">
            {d.restrictions.map((r, i) => (
              <li key={i}>
                <Md text={r.text} /> <EvidenceTag b={r} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {toolkitDocs && (
        <p className="mt-3 text-sm text-muted">
          For every tool and trigger Composio offers for this app, see the{" "}
          <a href={toolkitDocs} target="_blank" rel="noreferrer" className="text-accent">Composio toolkit reference ↗</a>
        </p>
      )}
    </Section>
  );
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const g = await getGuide((await params).slug);
  if (!g) notFound();

  const a = g.timeline.approval;
  const blockers = g.gotchas.filter((x) => x.severity === "blocker");
  const others = g.gotchas.filter((x) => x.severity !== "blocker");
  const endpointProbes = g.probes.filter((p) => p.name !== "Source link check");
  const linkProbes = g.probes.filter((p) => p.name === "Source link check");
  const dataClaims = g.dataAccess
    ? [...g.dataAccess.objects, g.dataAccess.changes, ...g.dataAccess.limits, ...g.dataAccess.restrictions]
    : [];
  const evidenceCounts = [...g.steps, ...g.gotchas, ...g.blockers, ...g.prerequisites, ...g.scopes, ...dataClaims].reduce<Record<string, number>>(
    (m, x) => ({ ...m, [x.evidence]: (m[x.evidence] ?? 0) + 1 }),
    {},
  );
  const agentSteps = g.steps.filter((s) => s.owner === "agent");
  const toolkitDocs = catalog.find((t) => t.slug === g.composio.toolkitSlug)?.docs ?? null;
  const humanSteps = g.steps.filter((s) => s.owner !== "agent");

  return (
    <article className="mx-auto max-w-5xl px-4 py-8">
      <div className="text-sm text-muted no-print">
        <Link href="/#library" className="hover:text-fg">← Library</Link>
      </div>

      {/* Header */}
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{g.name}</h1>
            <DifficultyBadge d={g.verdict.difficulty} size="lg" />
          </div>
          <p className="mt-3 text-lg leading-snug">{g.verdict.headline}</p>
          <p className="mt-2 text-muted">{g.verdict.summary}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
            <span>
              {g.meta.origin === "curated" ? "Researched by an agent" : `Generated live by ${g.meta.model}`} ·{" "}
              {g.meta.createdAt.slice(0, 10)}
            </span>
            <span>{g.meta.humanReviewed ? "Human-reviewed" : "Not yet reviewed by a person"}</span>
            <span>Confidence: {g.verdict.confidence}</span>
            {g.website && (
              <a href={g.website} className="hover:text-accent" target="_blank" rel="noreferrer">
                {g.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <GuideActions guide={g} />
      </div>

      {g.meta.origin === "agent" && (
        <div className="mt-5 rounded-lg border border-[var(--inferred)]/40 bg-[var(--inferred-soft)] px-4 py-3 text-sm">
          An agent wrote this guide just now from public sources and its own checks. Nobody has reviewed it. Claims marked{" "}
          <b>Inferred</b> are unverified.
        </div>
      )}

      {/* At a glance */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="First test connection" e={g.timeline.toFirstConnection} sub="You connect your own account" />
        <Stat label="Open to all users" e={g.timeline.toProduction} sub="Includes approval waits" />
        <Stat label="Hands-on effort" e={g.timeline.activeEffort} sub="Excludes waiting" />
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-faint">Approval</div>
          <div className="mt-1 text-[15px] font-semibold leading-snug">
            {a.required === "no" ? "None needed" : a.name ?? (a.required === "yes" ? "Required" : "Depends")}
          </div>
          <div className="text-xs text-muted mt-1 line-clamp-4">
            {a.required !== "no" && <>Wait: {a.wait} </>}
            {a.required === "no" && a.trigger}
          </div>
          {a.required !== "no" && (
            <a href="#approval" className="no-print text-xs text-accent">Details ↓</a>
          )}
          <div className="mt-2">
            <EvidenceTag b={a} />
          </div>
        </div>
      </div>

      {/* Composio + who does what */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-accent-soft/60 p-4 text-sm">
          <div className="font-medium">
            Composio:{" "}
            {g.composio.managedOAuth === true
              ? "managed OAuth available"
              : g.composio.managedOAuth === false
                ? "bring your own OAuth app"
                : "not in the OAuth catalog"}
            {g.composio.toolkitSlug && <code className="ml-2">{g.composio.toolkitSlug}</code>}
          </div>
          <p className="mt-1 text-muted">{g.composio.note}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="font-medium">Who does what</div>
          <div className="mt-2">
            <OwnerSplit g={g} />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_220px]">
        <div className="space-y-10 min-w-0">
          {blockers.length > 0 && (
            <Section id="blockers" title="What could stop you" hint="Check these before you start.">
              <ul className="space-y-2">
                {blockers.map((x, i) => (
                  <li key={i} className="rounded-lg border border-[var(--vhard)]/30 bg-[var(--vhard-soft)] p-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {x.title} <EvidenceTag b={x} />
                    </div>
                    <Md text={x.detail} className="mt-1 text-sm" />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {a.required !== "no" && (
            <Section id="approval" title="Approval">
              <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
                <div className="font-medium">{a.name ?? "Provider review"}</div>
                <div><span className="text-faint">When it&apos;s needed: </span>{a.trigger}</div>
                <div><span className="text-faint">How long: </span>{a.wait}</div>
                <EvidenceTag b={a} />
              </div>
            </Section>
          )}

          {g.prerequisites.length > 0 && (
            <Section id="before" title="Before you start">
              <ul className="space-y-1.5 text-sm">
                {g.prerequisites.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-faint">☐</span>
                    <span>
                      {p.text} <EvidenceTag b={p} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section id="steps" title="Steps" hint="In order, from nothing to real users connecting.">
            <div className="space-y-6">
              {(Object.keys(PHASE) as (keyof typeof PHASE)[]).map((ph) => {
                const steps = g.steps.filter((s) => s.phase === ph);
                if (!steps.length) return null;
                return (
                  <div key={ph}>
                    <div className="text-xs font-medium uppercase tracking-wide text-faint">
                      {PHASE[ph].label} · <span className="normal-case tracking-normal">{PHASE[ph].help}</span>
                    </div>
                    <ol className="mt-2 space-y-3">
                      {steps.map((s, i) => (
                        <li key={i} className="rounded-lg border border-border bg-card p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{s.title}</span>
                            <OwnerTag o={s.owner} />
                            {s.time && <span className="text-xs text-faint">{s.time}</span>}
                            <span className="flex-1" />
                            <EvidenceTag b={s} />
                          </div>
                          <Md text={s.detail} className="mt-2 text-sm text-muted [&_strong]:text-fg" />
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent break-all">
                              {s.url.replace(/^https?:\/\//, "")} ↗
                            </a>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section id="agent" title="What an agent can do, and where you take over">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-accent">◆ An agent can</div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
                  {agentSteps.map((s, i) => <li key={i}>{s.title}</li>)}
                  <li>Re-check endpoints and sources (see “What we tested”)</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium">● You (or others) must</div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
                  {humanSteps.map((s, i) => (
                    <li key={i}>
                      {s.title} <span className="text-faint">({OWNER[s.owner]?.label})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {g.dataAccess && <DataAccessSection d={g.dataAccess} toolkitDocs={toolkitDocs} />}

          {others.length > 0 && (
            <Section id="gotchas" title="Gotchas" hint="Things that cost people days.">
              <ul className="space-y-2">
                {others.map((x, i) => (
                  <li key={i} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span
                        className="text-[11px] uppercase tracking-wide"
                        style={{ color: x.severity === "warning" ? "var(--hard)" : "var(--faint)" }}
                      >
                        {x.severity}
                      </span>
                      {x.title} <EvidenceTag b={x} />
                    </div>
                    <Md text={x.detail} className="mt-1 text-sm text-muted" />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {g.blockers.length > 0 && (
            <Section id="stuck" title="If you get stuck" hint="What you'll see, and what to do.">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-subtle text-left text-xs text-faint">
                    <tr>
                      <th className="p-3 font-medium w-2/5">You see</th>
                      <th className="p-3 font-medium">Do this</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.blockers.map((b, i) => (
                      <tr key={i} className="border-t border-border align-top bg-card">
                        <td className="p-3"><Md text={b.symptom} /></td>
                        <td className="p-3 text-muted">
                          <Md text={b.fix} />
                          <div className="mt-1"><EvidenceTag b={b} /></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {g.scopes.length > 0 && (
            <Section id="scopes" title="Scopes">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-subtle text-left text-xs text-faint">
                    <tr>
                      <th className="p-3 font-medium">Scope</th>
                      <th className="p-3 font-medium">For</th>
                      <th className="p-3 font-medium">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.scopes.map((s, i) => (
                      <tr key={i} className="border-t border-border align-top bg-card">
                        <td className="p-3"><code>{s.name}</code></td>
                        <td className="p-3 text-muted">{s.purpose}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={s.tier === "basic" ? "text-muted" : "font-medium text-[var(--hard)]"}>
                            {s.tier.replace("_", " ")}
                          </span>
                          <div className="mt-1"><EvidenceTag b={s} /></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section id="oauth" title="OAuth reference">
            <dl className="rounded-lg border border-border bg-card p-4 text-sm grid gap-x-4 gap-y-2 sm:grid-cols-[160px_1fr]">
              {(
                [
                  ["Developer console", g.oauth.devConsoleUrl],
                  ["Authorize URL", g.oauth.authorizeUrl],
                  ["Token URL", g.oauth.tokenUrl],
                  ["Discovery", g.oauth.discoveryUrl],
                  ["PKCE", g.oauth.pkce.replace("_", " ")],
                  ["Refresh tokens", g.oauth.refreshTokens],
                  ["Redirect URIs", g.oauth.redirectUriRules],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-faint">{k}</dt>
                    <dd className="min-w-0 break-words">{/^https?:/.test(v!) ? <code>{v}</code> : <Md text={v!} />}</dd>
                  </div>
                ))}
            </dl>
            <div className="mt-2"><EvidenceTag b={g.oauth} /></div>
          </Section>

          <Section id="tested" title="What we tested" hint="Read-only checks with fake credentials. Nothing was created or submitted.">
            {endpointProbes.length === 0 && <p className="text-sm text-muted">No endpoint checks were possible for this provider.</p>}
            <ul className="space-y-2 text-sm">
              {endpointProbes.map((p, i) => (
                <li key={i} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span style={{ color: p.ok ? "var(--tested)" : "var(--vhard)" }}>{p.ok ? "✓" : "✗"}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-faint">{p.checkedAt.slice(0, 10)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted break-all"><code>{p.target}</code></div>
                  <div className="mt-1 text-xs text-muted break-words">{p.observed}</div>
                </li>
              ))}
            </ul>
            {linkProbes.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                Source links: {linkProbes.filter((p) => p.ok).length} of {linkProbes.length} resolved when checked.
              </p>
            )}
          </Section>

          {g.unknowns.length > 0 && (
            <Section id="unknowns" title="What we couldn't confirm">
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                {g.unknowns.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </Section>
          )}

          <Section id="sources" title="Sources">
            <ol className="space-y-1.5 text-sm">
              {g.sources.map((s) => {
                const probe = linkProbes.find((p) => p.target === s.url);
                return (
                  <li key={s.id} id={`src-${s.id}`} className="scroll-mt-20 flex gap-2">
                    <span className="font-mono text-faint w-8 shrink-0">[{s.id}]</span>
                    <span className="min-w-0">
                      <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-accent">{s.title}</a>
                      <span className="text-faint"> · {s.publisher}</span>
                      {probe && !probe.ok && <span className="text-[var(--vhard)]"> · link failed</span>}
                      <div className="text-xs text-faint break-all">{s.url}</div>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>
        </div>

        {/* Side rail */}
        <aside className="hidden lg:block no-print">
          <div className="sticky top-20 space-y-6 text-sm">
            <nav className="space-y-1">
              {[
                ["blockers", "What could stop you", blockers.length],
                ["approval", "Approval", a.required !== "no" ? 1 : 0],
                ["steps", "Steps", 1],
                ["agent", "Agent vs you", 1],
                ["data", "Data access & sync", g.dataAccess ? 1 : 0],
                ["gotchas", "Gotchas", others.length],
                ["stuck", "If you get stuck", g.blockers.length],
                ["scopes", "Scopes", g.scopes.length],
                ["oauth", "OAuth reference", 1],
                ["tested", "What we tested", 1],
                ["unknowns", "Not confirmed", g.unknowns.length],
                ["sources", "Sources", 1],
              ]
                .filter(([, , n]) => n)
                .map(([id, label]) => (
                  <a key={id as string} href={`#${id}`} className="block text-muted hover:text-fg">{label}</a>
                ))}
            </nav>
            <div>
              <div className="text-xs uppercase tracking-wide text-faint">Evidence in this guide</div>
              <ul className="mt-2 space-y-2">
                {(Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).map((k) => (
                  <li key={k}>
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: EVIDENCE[k].color, background: EVIDENCE[k].soft }}>
                      {EVIDENCE[k].label}
                    </span>{" "}
                    <span className="text-faint">
                      {k === "tested"
                        ? `${g.probes.filter((p) => p.ok).length} checks passed`
                        : `${evidenceCounts[k] ?? 0} claims`}
                    </span>
                    <div className="text-xs text-muted mt-0.5">{EVIDENCE[k].help}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
