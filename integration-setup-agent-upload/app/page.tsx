import Link from "next/link";
import { DifficultyBadge } from "@/components/Badges";
import CatalogSearch from "@/components/CatalogSearch";
import Generator from "@/components/Generator";
import { catalog, listCurated, listGenerated } from "@/lib/store";
import type { Guide } from "@/lib/types";

export const dynamic = "force-dynamic";

function GuideCard({ g }: { g: Guide }) {
  const a = g.timeline.approval;
  return (
    <Link
      href={`/guides/${g.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 hover:border-accent transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{g.name}</span>
        <DifficultyBadge d={g.verdict.difficulty} />
      </div>
      <p className="mt-2 text-sm text-muted line-clamp-3 flex-1">{g.verdict.headline}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-faint">First connection</dt>
          <dd className="font-medium line-clamp-2">{g.timeline.toFirstConnection.label}</dd>
        </div>
        <div>
          <dt className="text-faint">All users</dt>
          <dd className="font-medium line-clamp-2">{g.timeline.toProduction.label}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted">
        <span className="rounded bg-subtle px-1.5 py-0.5 line-clamp-1">{a.required === "no" ? "No review" : a.name ?? "Review depends"}</span>
        <span className="rounded bg-subtle px-1.5 py-0.5">
          {g.composio.managedOAuth ? "Composio-managed available" : "Bring your own app"}
        </span>
      </div>
    </Link>
  );
}

export default async function Home() {
  const [curated, generated] = await Promise.all([listCurated(), listGenerated(9)]);
  const all = [...curated, ...generated];
  const guideBySlug = Object.fromEntries(
    all.filter((g) => g.composio.toolkitSlug).map((g) => [g.composio.toolkitSlug!, g.slug]),
  );
  const recent = generated.filter((g) => !curated.some((c) => c.slug === g.slug));

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-12 sm:py-16">
        <h1 className="max-w-3xl text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
          Find out what it takes to connect any app to your AI agent.
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Before your users can connect Gmail, Shopify or Workday, you need an OAuth app the provider will approve. This
          agent researches the provider, tests what it can, and tells you how long setup will take (an hour, or six
          weeks?), what will block you, and which steps it can do for you. Every claim is marked as tested, sourced or a
          guess.
        </p>
        <div className="mt-6 max-w-2xl">
          <Generator />
        </div>
      </section>

      <section id="library" className="scroll-mt-20 pb-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Guides</h2>
          <span className="text-sm text-faint">Easiest to hardest</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {curated.map((g) => <GuideCard key={g.slug} g={g} />)}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="pb-12">
          <h2 className="text-xl font-semibold tracking-tight">Recently generated</h2>
          <p className="text-sm text-muted">Written live by the agent. Not yet reviewed by a person.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((g) => <GuideCard key={g.slug} g={g} />)}
          </div>
        </section>
      )}

      <section className="pb-16">
        <h2 className="text-xl font-semibold tracking-tight">Every OAuth app on Composio</h2>
        <p className="mt-1 text-sm text-muted">
          Composio manages the OAuth app for some toolkits. For the other{" "}
          {catalog.filter((t) => !t.composioManaged).length} of {catalog.length}, you register your own, and that&apos;s
          where a guide saves the most time. Pick one to read its guide or generate one.{" "}
          <a className="text-accent" href="https://docs.composio.dev/toolkits/managed-auth" target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
        <div className="mt-4">
          <CatalogSearch catalog={catalog} guides={guideBySlug} />
        </div>
      </section>
    </div>
  );
}
