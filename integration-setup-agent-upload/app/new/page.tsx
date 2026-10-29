import Generator from "@/components/Generator";

export const metadata = { title: "Get a guide for any app" };

export default async function NewGuide({ searchParams }: PageProps<"/new">) {
  const app = (await searchParams).app;
  const initial = typeof app === "string" ? app : "";
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Get a guide for any app</h1>
      <p className="mt-2 text-muted">
        Enter any app, even one Composio doesn&apos;t support yet. An agent reads the provider&apos;s developer docs,
        drafts the guide, then checks the OAuth endpoints and every link it cites. In about a minute you get a page you
        can share, with each claim marked as tested, sourced or a guess.
      </p>
      <div className="mt-6">
        <Generator initial={initial} autostart={Boolean(initial)} />
      </div>
    </div>
  );
}
