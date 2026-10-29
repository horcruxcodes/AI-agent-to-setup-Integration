import { EVIDENCE, OWNER } from "@/lib/format";

export const metadata = { title: "How it works" };

export default function Method() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-10 text-[15px] leading-relaxed">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How the agent works, and how far to trust it</h1>
        <p className="mt-3 text-muted">
          Provider docs show you which buttons to click. They rarely tell you whether the whole process takes an hour or
          six weeks, what will get you rejected, or which parts you have to do yourself. This agent answers those
          questions, and shows where every answer comes from.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">The agent&apos;s pipeline</h2>
        <ol className="mt-3 list-decimal pl-5 space-y-2 text-muted">
          <li><b className="text-fg">Check Composio&apos;s catalog.</b> If Composio already manages an OAuth app, the developer may not need this guide at all, and the guide says so.</li>
          <li><b className="text-fg">Find the provider&apos;s developer docs.</b> Gemini (free tier) answers a fixed checklist from what it knows (who can create an app, endpoints, scopes needing review, approval process, limits before approval, costs, gotchas, terms affecting AI agents) and names the official pages that cover each one. Its notes are treated as leads, never as sources.</li>
          <li><b className="text-fg">Read and verify those pages.</b> Only pages that actually load become sources, which filters out any URL the model made up. If too few load, the agent follows links on the official pages that mention OAuth, scopes, review or terms, the way a person would browse the docs.</li>
          <li><b className="text-fg">Draft the guide</b> in a fixed format. The model may only cite sources it was given, by id.</li>
          <li><b className="text-fg">Test what can be tested without an account:</b> the OAuth discovery document, the authorize and token endpoints (with fake credentials, to confirm they exist and how they reject bad clients), and every source link.</li>
          <li><b className="text-fg">Enforce the evidence rules in code.</b> A claim marked documented whose sources don&apos;t resolve is downgraded to inferred. Only probes can mark something tested. Confidence is capped by the share of claims that are actually backed, and failed checks go into &ldquo;What we couldn&apos;t confirm&rdquo;.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Evidence labels</h2>
        <ul className="mt-3 space-y-2">
          {(Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).map((k) => (
            <li key={k}>
              <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ color: EVIDENCE[k].color, background: EVIDENCE[k].soft }}>
                {EVIDENCE[k].label}
              </span>{" "}
              <span className="text-muted">{EVIDENCE[k].help}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Who does each step</h2>
        <ul className="mt-3 space-y-1.5 text-muted">
          {(Object.keys(OWNER) as (keyof typeof OWNER)[]).map((k) => (
            <li key={k}>
              <b className="text-fg">{OWNER[k].icon} {OWNER[k].label}:</b> {OWNER[k].help}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-muted">
          Agents don&apos;t create accounts, accept terms, enter credentials or submit for review. Those steps carry legal and
          account risk, so they belong to a person.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Two kinds of guide</h2>
        <p className="mt-2 text-muted">
          <b className="text-fg">Researched guides</b> were built by a research agent with more time and tools, then
          checked. <b className="text-fg">Generated guides</b> come from the live pipeline above in about a minute,
          carry a &ldquo;not reviewed&rdquo; banner, and are cached for 14 days.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Known limits</h2>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
          <li>Time estimates for approvals are ranges built from provider statements and developer reports. Reviews vary.</li>
          <li>Probes confirm that endpoints exist, not that a full sign-in works. That needs a real app and account.</li>
          <li>Per-tenant providers (Workday, Shopify stores) have no shared endpoint to test.</li>
          <li>Providers change their rules. Every guide shows when it was generated.</li>
        </ul>
      </section>
    </div>
  );
}
