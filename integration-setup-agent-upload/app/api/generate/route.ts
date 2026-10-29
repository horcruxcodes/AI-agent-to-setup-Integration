import { investigate, type AgentEvent } from "@/lib/agent";
import { findToolkit, getGuide, slugify } from "@/lib/store";

export const maxDuration = 300;

const CACHE_DAYS = 14;
const recent = new Map<string, number[]>(); // ip -> request timestamps (best effort, per instance)

function rateLimited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  recent.set(ip, [...hits, now]);
  return hits.length >= 10;
}

export async function POST(req: Request) {
  const { app, refresh } = (await req.json().catch(() => ({}))) as { app?: string; refresh?: boolean };
  const input = (app ?? "").trim();
  if (input.length < 2 || input.length > 120) {
    return Response.json({ error: "Enter an app name or website." }, { status: 400 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        // Reuse an existing guide when we have one: curated guides always win,
        // generated ones are reused for a while to save the free model quota.
        const slug = slugify(findToolkit(input)?.name ?? input);
        const existing = await getGuide(slug);
        const fresh =
          existing &&
          (existing.meta.origin === "curated" ||
            Date.now() - Date.parse(existing.meta.createdAt) < CACHE_DAYS * 86_400_000);
        if (existing && fresh && !(refresh && existing.meta.origin === "agent")) {
          emit({
            type: "step",
            id: "cache",
            label: existing.meta.origin === "curated" ? "Found a reviewed guide in the library" : "Found a recent guide",
            status: "done",
            detail: `Generated ${existing.meta.createdAt.slice(0, 10)}`,
          });
          emit({ type: "done", slug });
          return;
        }

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
        if (rateLimited(ip)) {
          emit({ type: "error", message: "You've generated 10 guides this hour. Please try again later." });
          return;
        }

        const guide = await investigate(input, emit);
        emit({ type: "done", slug: guide.slug });
      } catch (e) {
        emit({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
