// The live investigation agent. Given an app name or website it:
//   1. checks Composio's catalog (does Composio already manage OAuth?)
//   2. asks the model where the provider documents OAuth (portal, auth docs,
//      review, scopes, terms, pricing), plus its own background notes
//   3. fetches those pages; only pages that actually load become sources,
//      which also filters out any URL the model made up
//   4. drafts a guide in our format, citing only the sources it was given
//   5. tests what it can: OAuth endpoints with fake credentials, every source link
//   6. downgrades any claim its evidence doesn't support, then saves the guide
// Each stage reports progress so the UI can show the work as it happens.

import { generate, parseJson, resolveRedirect, MODEL } from "./gemini";

// Google Search grounding is not included in the Gemini free tier for current
// models. Set GEMINI_SEARCH=1 on a key with billing to add it back.
const USE_SEARCH = process.env.GEMINI_SEARCH === "1";
import { probeLink, runEndpointProbes } from "./probes";
import { findToolkit, slugify, saveGenerated } from "./store";
import type { Backed, Evidence, Guide, Probe, Source } from "./types";

export type AgentEvent =
  | { type: "step"; id: string; label: string; status: "running" | "done" | "warn"; detail?: string }
  | { type: "done"; slug: string }
  | { type: "error"; message: string };

type Emit = (e: AgentEvent) => void;

const STEPS = {
  catalog: "Check Composio's OAuth catalog",
  research: "Find the provider's developer docs",
  read: "Read and verify the official pages",
  draft: "Draft the guide",
  probe: "Test endpoints and check every source link",
  save: "Publish a shareable guide",
} as const;

const RESEARCH_SYSTEM = `You are an integrations engineer researching how a developer registers their own OAuth 2.0 app with a SaaS provider so their AI agent's users can connect accounts. Be precise and current. Prefer the provider's official developer documentation. If something is not documented, say "not documented" rather than guessing.`;

const researchPrompt = (app: string) => `Research OAuth app registration for: ${app}

Answer each item in short bullet notes, and give the official URL that supports it:
1. Official website and developer portal / console URL where OAuth apps are created.
2. Who can create an app (any user, paid plan, partner programme, business verification, tenant admin?).
3. OAuth details: authorize URL, token URL, OIDC discovery URL if any, PKCE support, access/refresh token lifetimes, redirect URI rules (HTTPS, localhost, wildcards, count).
4. Scopes: which common scopes exist, and which need extra review or approval.
5. App review / approval / verification: is it needed to let any user connect? What triggers it, what must be submitted (privacy policy, video, security assessment), and how long it takes.
6. Limits before approval: test-user caps, connection limits, development-mode restrictions.
7. Costs: paid API tiers or fees needed for OAuth access.
8. Known gotchas and common errors developers hit, with the error text if known.
9. Anything in the developer terms that restricts AI agents, automation, or model training.
10. Data an agent can read once connected: the main objects, the scope for each, and which need review. How to learn about changes (webhooks or polling), rate limits and pagination for syncing.
Then list the official URLs where each answer is documented.

Return JSON: {"notes": string (your bullet notes for items 1-9, mark anything you are unsure of with "(unsure)"), "urls": [{"url": string, "title": string, "covers": string}] (4-8 official pages, most important first: the developer docs home page, then the OAuth/auth guide, app creation, app review or verification, scopes, webhooks, rate limits, developer terms, API pricing if relevant)}`;

const GUIDE_SHAPE = `{
  "name": string, "website": string, "category": string,
  "verdict": { "difficulty": "easy"|"moderate"|"hard"|"very_hard", "headline": string (one sentence), "summary": string (2-4 sentences), "confidence": "high"|"medium"|"low" },
  "timeline": {
    "toFirstConnection": Estimate,   // developer connects their own test account
    "toProduction": Estimate,        // any user can connect
    "activeEffort": Estimate,        // hands-on hours excluding waits
    "approval": { "required": "yes"|"no"|"depends", "name": string|null, "trigger": string, "wait": string, ...Backed }
  },
  "prerequisites": [{ "text": string, ...Backed }],
  "oauth": { "authorizeUrl": string|null, "tokenUrl": string|null, "discoveryUrl": string|null, "pkce": "required"|"supported"|"not_supported"|"unknown", "refreshTokens": string, "redirectUriRules": string, "devConsoleUrl": string|null, ...Backed },
  "steps": [{ "title": string, "detail": string (markdown ok), "owner": "agent"|"you"|"provider"|"customer_admin", "phase": "setup"|"test"|"launch", "time": string, "url": string|null, ...Backed }],
  "scopes": [{ "name": string, "purpose": string, "tier": "basic"|"sensitive"|"restricted"|"needs_review", ...Backed }],
  "gotchas": [{ "title": string, "detail": string, "severity": "blocker"|"warning"|"info", ...Backed }],
  "blockers": [{ "symptom": string, "fix": string, ...Backed }],
  "dataAccess": {
    "objects": [{ "name": string, "description": string, "scopes": [string], "access": "open"|"needs_review"|"restricted", "note": string|null, ...Backed }],  // 3-6 objects an AI agent most needs
    "changes": { "webhooks": "yes"|"partial"|"no"|"unknown", "detail": string, ...Backed },
    "limits": [{ "text": string, ...Backed }],        // rate limits, pagination, history windows
    "restrictions": [{ "text": string, ...Backed }]   // data-use terms: AI training, storage, caching
  },
  "unknowns": [string]
}
Estimate = { "label": string like "15–30 minutes", "minHours": number, "maxHours": number, ...Backed }
Backed = "evidence": "documented"|"inferred", "sourceIds": [source ids from the list, e.g. "s2"]`;

const draftPrompt = (app: string, notes: string, docs: string, sources: Source[], managed: boolean | null) => `Write an OAuth app setup guide for "${app}" as JSON with exactly this shape:
${GUIDE_SHAPE}

Rules:
- Use evidence "documented" ONLY when the OFFICIAL PAGE EXCERPTS for a cited source id state it. Otherwise "inferred". Never invent source ids.
- Owners: "agent" = an AI agent could do it without an account or decision (reading docs, filling config values, testing endpoints). "you" = the developer must (accounts, legal, payment, submitting for review). "provider" = waiting on the provider. "customer_admin" = each customer's admin must act.
- Steps go from zero to production, in order, 5–10 steps. Include this Composio step in setup: "In the Composio dashboard: Create Auth Config → ${app} → OAuth2 → use your own credentials. Paste the client ID and secret, and copy the redirect URI the dashboard shows into the provider's app settings (always copy it from the dashboard; don't type it from memory)."${
  managed ? ` Composio already manages an OAuth app for this toolkit, so note in the summary that this guide is for developers who want their own branding, scopes or quota.` : ""
}
- Separate time to first test connection from time to production. Be honest about wide ranges.
- Gotchas: the non-obvious things that cost days. Blockers: the symptom a developer sees → what to do.
- Put anything you could not confirm in "unknowns". Lower "confidence" if most claims are inferred.
- Short, plain sentences. No marketing language.

SOURCES (cite by id):
${sources.map((s) => `${s.id}: ${s.title} — ${s.url}`).join("\n")}

BACKGROUND NOTES (from model knowledge, NOT a source; anything only supported here is "inferred"):
${notes}

OFFICIAL PAGE EXCERPTS:
${docs || "(none could be read)"}`;

const APPROVAL_DEFAULTS = { required: "depends", name: null, trigger: "", wait: "Unknown" } as const;
const CHANGES_DEFAULTS = { webhooks: "unknown", detail: "" } as const;
const OAUTH_DEFAULTS = {
  authorizeUrl: null,
  tokenUrl: null,
  discoveryUrl: null,
  pkce: "unknown",
  refreshTokens: "",
  redirectUriRules: "",
  devConsoleUrl: null,
} as const;

// What makes a docs link worth following, weighted.
const LINK_HINTS: [RegExp, number][] = [
  [/oauth|authenticat|authoriz/, 5],
  [/scope|permission/, 3],
  [/review|verif|approv|publish|submit|marketplace|listing|distribut/, 3],
  [/terms|policy|guideline|requirement/, 2],
  [/webhook|event|notification|subscri/, 2],
  [/rate.?limit|pricing|quota/, 2],
  [/quickstart|getting.?started|create.+(app|integration)/, 2],
];

const URL_RE = /https?:\/\/[^\s)\]>"'`,]+/g;

async function readPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { accept: "text/plain", "x-return-format": "markdown" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Jina answers 200 even when the target page is missing or blocked.
    if (/Target URL returned error (4|5)\d\d|Warning: This page maybe not yet fully loaded|requiring CAPTCHA/i.test(text.slice(0, 1500)) && text.length < 2000) return null;
    if (/Target URL returned error 404/i.test(text.slice(0, 600))) return null;
    return text.slice(0, 9_000);
  } catch {
    return null;
  }
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const EVIDENCE: Evidence[] = ["tested", "documented", "inferred"];

// Make sure a claim's evidence is backed by sources that exist and resolve.
function fixBacked<T extends Partial<Backed>>(x: T, live: Set<string>): T & Backed {
  const sourceIds = (x.sourceIds ?? []).filter((id) => live.has(id));
  let evidence: Evidence = EVIDENCE.includes(x.evidence as Evidence) ? (x.evidence as Evidence) : "inferred";
  if (evidence === "tested") evidence = "documented"; // only probes may claim "tested"
  if (evidence === "documented" && sourceIds.length === 0) evidence = "inferred";
  return { ...x, evidence, sourceIds };
}

export async function investigate(input: string, emit: Emit): Promise<Guide> {
  const app = input.trim().slice(0, 120);

  // 1. Composio catalog
  emit({ type: "step", id: "catalog", label: STEPS.catalog, status: "running" });
  const toolkit = findToolkit(app);
  emit({
    type: "step",
    id: "catalog",
    label: STEPS.catalog,
    status: "done",
    detail: toolkit
      ? `${toolkit.name} (${toolkit.slug}): ${toolkit.composioManaged ? "Composio already manages an OAuth app" : "you need your own OAuth app"}`
      : "Not in Composio's OAuth catalog yet",
  });

  // 2. Find the docs: model knowledge for where to look (and grounded search when enabled)
  emit({ type: "step", id: "research", label: STEPS.research, status: "running" });
  const research = await generate({ prompt: researchPrompt(app), system: RESEARCH_SYSTEM, search: USE_SEARCH, json: !USE_SEARCH });
  let notes = research.text;
  let suggested: { title: string; url: string }[] = [];
  try {
    const r = parseJson<{ notes?: string; urls?: { url: string; title?: string }[] }>(research.text);
    notes = r.notes ?? notes;
    suggested = (r.urls ?? []).filter((u) => /^https?:\/\//.test(u.url)).map((u) => ({ title: u.title ?? hostOf(u.url), url: u.url }));
  } catch {
    // grounded mode returns prose; fall back to URLs mentioned in it
  }
  const grounded = await Promise.all(
    research.groundingSources.slice(0, 10).map(async (s) => ({ title: s.title, url: await resolveRedirect(s.uri) })),
  );
  const mentioned = [...new Set(notes.match(URL_RE) ?? [])].map((u) => ({ title: hostOf(u), url: u.replace(/[.;:]+$/, "") }));
  const seen = new Set<string>();
  const candidates = [...suggested, ...grounded, ...mentioned].filter((c) => {
    if (seen.has(c.url) || c.url.includes("grounding-api-redirect")) return false;
    seen.add(c.url);
    return true;
  });
  emit({
    type: "step",
    id: "research",
    label: STEPS.research,
    status: candidates.length ? "done" : "warn",
    detail: `${candidates.length} candidate pages`,
  });

  // 3. Read them. A page only becomes a source if it actually loads.
  emit({ type: "step", id: "read", label: STEPS.read, status: "running" });
  const toRead = candidates.filter((c) => !/stackoverflow|reddit|medium\.com|youtube/i.test(c.url)).slice(0, 6);
  const pages = await Promise.all(toRead.map(async (c) => ({ ...c, text: await readPage(c.url) })));
  const readOk = pages.filter((p) => p.text && p.text.length > 400);

  // Model-suggested URLs are often slightly wrong. Follow links on the
  // official pages that did load, the way a person would browse the docs.
  if (readOk.length < 4) {
    const have = new Set(pages.map((p) => p.url.replace(/\/$/, "")));
    const hosts = new Set(readOk.map((p) => hostOf(p.url)));
    const linkRe = /\[([^\]]{2,80})\]\((https?:\/\/[^)\s]+)\)/g;
    const scored: { title: string; url: string; score: number }[] = [];
    for (const p of readOk) {
      for (const m of p.text!.matchAll(linkRe)) {
        const url = m[2].split("#")[0].replace(/\/$/, "");
        if (!hosts.has(hostOf(url)) || have.has(url)) continue;
        const hay = `${m[1]} ${url}`.toLowerCase();
        const score = LINK_HINTS.reduce((n, [re, w]) => n + (re.test(hay) ? w : 0), 0);
        if (score > 0) {
          have.add(url);
          scored.push({ title: m[1], url, score });
        }
      }
    }
    const follow = scored.sort((x, y) => y.score - x.score).slice(0, 5 - readOk.length);
    const more = await Promise.all(follow.map(async (c) => ({ ...c, text: await readPage(c.url) })));
    readOk.push(...more.filter((p) => p.text && p.text.length > 400));
  }
  emit({
    type: "step",
    id: "read",
    label: STEPS.read,
    status: readOk.length ? "done" : "warn",
    detail: readOk.length
      ? `${readOk.length} of ${toRead.length} pages loaded (${[...new Set(readOk.map((p) => hostOf(p.url)))].join(", ")})`
      : "No official pages could be read; the guide will be marked low confidence",
  });

  const sources: Source[] = readOk.map((c, i) => {
    const h = hostOf(c.url);
    return {
      id: `s${i + 1}`,
      title: c.title || h,
      url: c.url,
      publisher: h.includes("composio") ? "composio" : "provider",
    };
  });
  const idByUrl = new Map(sources.map((s) => [s.url, s.id]));
  const docs = readOk.map((p) => `--- ${idByUrl.get(p.url) ?? "?"} ${p.url}\n${p.text}`).join("\n\n");

  // 4. Draft
  emit({ type: "step", id: "draft", label: STEPS.draft, status: "running" });
  const draft = await generate({
    prompt: draftPrompt(app, notes, docs, sources, toolkit?.composioManaged ?? null),
    json: true,
  });
  const g = parseJson<Partial<Guide>>(draft.text);
  emit({ type: "step", id: "draft", label: STEPS.draft, status: "done", detail: `${g.steps?.length ?? 0} steps, ${g.gotchas?.length ?? 0} gotchas` });

  // 5. Test what we can
  emit({ type: "step", id: "probe", label: STEPS.probe, status: "running" });
  const oauthIn = g.oauth ?? ({} as Guide["oauth"]);
  const [endpointProbes, linkProbes] = await Promise.all([
    runEndpointProbes({
      authorizeUrl: oauthIn.authorizeUrl?.includes("{") ? null : oauthIn.authorizeUrl ?? null,
      tokenUrl: oauthIn.tokenUrl?.includes("{") ? null : oauthIn.tokenUrl ?? null,
      discoveryUrl: oauthIn.discoveryUrl ?? null,
    }),
    Promise.all(sources.map((s) => probeLink(s.url))),
  ]);
  const live = new Set(sources.filter((_, i) => linkProbes[i].ok).map((s) => s.id));
  const deadLinks = sources.length - live.size;
  const endpointsOk = endpointProbes.length > 0 && endpointProbes.every((p) => p.ok);
  emit({
    type: "step",
    id: "probe",
    label: STEPS.probe,
    status: endpointsOk && deadLinks === 0 ? "done" : "warn",
    detail:
      `${endpointProbes.filter((p) => p.ok).length}/${endpointProbes.length} endpoint checks passed; ` +
      `${live.size}/${sources.length} source links resolve` +
      (deadLinks ? ` (claims citing broken links were marked inferred)` : ""),
  });

  // 6. Assemble, enforcing evidence rules
  const name = g.name || toolkit?.name || app;
  const unknowns = [...(g.unknowns ?? [])];
  if (!endpointProbes.length) unknowns.push("OAuth endpoints could not be tested (none found, or they are per-tenant).");
  for (const p of endpointProbes.filter((p) => !p.ok)) unknowns.push(`${p.name} check failed for ${p.target}: ${p.observed}`);

  const oauth = fixBacked(oauthIn, live);
  if (endpointsOk) oauth.evidence = "tested";

  const tl = g.timeline ?? ({} as Guide["timeline"]);
  const est = (e?: Partial<Guide["timeline"]["toProduction"]>) =>
    fixBacked({ label: e?.label ?? "Unknown", minHours: Number(e?.minHours) || 0, maxHours: Number(e?.maxHours) || 0, ...e }, live);

  const guide: Guide = {
    slug: slugify(toolkit?.name ?? name),
    name,
    website: g.website ?? "",
    category: g.category ?? "",
    composio: {
      toolkitSlug: toolkit?.slug ?? null,
      managedOAuth: toolkit ? toolkit.composioManaged : null,
      note: toolkit
        ? toolkit.composioManaged
          ? "Composio already provides a managed OAuth app for this toolkit. Use your own app only when you need your brand on the consent screen, custom scopes or your own rate-limit quota."
          : "Composio does not provide a managed OAuth app here, so you need to register your own and add it as a custom auth config."
        : "This app isn't in Composio's OAuth catalog yet. You'd register your own OAuth app; check Composio's toolkits for support.",
    },
    verdict: {
      difficulty: g.verdict?.difficulty ?? "moderate",
      headline: g.verdict?.headline ?? "",
      summary: g.verdict?.summary ?? "",
      confidence: g.verdict?.confidence ?? "low",
    },
    timeline: {
      toFirstConnection: est(tl.toFirstConnection),
      toProduction: est(tl.toProduction),
      activeEffort: est(tl.activeEffort),
      approval: fixBacked({ ...APPROVAL_DEFAULTS, ...tl.approval }, live),
    },
    prerequisites: (g.prerequisites ?? []).map((x) => fixBacked(x, live)),
    oauth: { ...OAUTH_DEFAULTS, ...oauth },
    steps: (g.steps ?? []).map((x) => fixBacked(x, live)),
    scopes: (g.scopes ?? []).map((x) => fixBacked(x, live)),
    gotchas: (g.gotchas ?? []).map((x) => fixBacked(x, live)),
    blockers: (g.blockers ?? []).map((x) => fixBacked(x, live)),
    dataAccess: g.dataAccess
      ? {
          objects: (g.dataAccess.objects ?? []).map((o) =>
            fixBacked({ ...o, scopes: o.scopes ?? [], note: o.note ?? null, access: o.access ?? "open" }, live),
          ),
          changes: fixBacked({ ...CHANGES_DEFAULTS, ...g.dataAccess.changes }, live),
          limits: (g.dataAccess.limits ?? []).map((x) => fixBacked(x, live)),
          restrictions: (g.dataAccess.restrictions ?? []).map((x) => fixBacked(x, live)),
        }
      : undefined,
    probes: [...endpointProbes, ...linkProbes] as Probe[],
    sources,
    unknowns,
    meta: {
      origin: "agent",
      model: MODEL,
      createdAt: new Date().toISOString(),
      humanReviewed: false,
      reviewNotes: null,
    },
  };

  // Confidence can't exceed the evidence: cap it by the share of claims backed
  // by a page the agent actually read or a check it actually ran.
  const claims = [
    ...guide.steps,
    ...guide.gotchas,
    ...guide.blockers,
    ...guide.prerequisites,
    ...guide.scopes,
    ...(guide.dataAccess?.objects ?? []),
  ];
  const backed = claims.filter((c) => c.evidence !== "inferred").length / Math.max(claims.length, 1);
  const cap = backed >= 0.6 ? "high" : backed >= 0.3 ? "medium" : "low";
  const rank = { low: 0, medium: 1, high: 2 } as const;
  if (rank[guide.verdict.confidence] > rank[cap]) guide.verdict.confidence = cap;
  if (backed < 0.3) {
    guide.unknowns.unshift(
      `Only ${Math.round(backed * 100)}% of claims are backed by a page the agent could read; most of this guide is unverified.`,
    );
  }

  emit({ type: "step", id: "save", label: STEPS.save, status: "running" });
  await saveGenerated(guide);
  emit({ type: "step", id: "save", label: STEPS.save, status: "done", detail: `/guides/${guide.slug}` });
  return guide;
}
