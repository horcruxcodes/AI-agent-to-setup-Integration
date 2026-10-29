// Where guides live.
// - Curated guides: JSON files in data/guides, committed with the code.
// - Generated guides: Supabase (free tier) when configured, otherwise local
//   files, which is fine for local development but not durable on Vercel.

import { promises as fs } from "fs";
import path from "path";
import catalogData from "@/data/catalog.json";
import type { CatalogEntry, Guide } from "./types";

const CURATED_DIR = path.join(process.cwd(), "data", "guides");
const LOCAL_DIR = process.env.VERCEL
  ? path.join("/tmp", "generated-guides")
  : path.join(process.cwd(), ".data", "generated");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const catalog: CatalogEntry[] = catalogData.toolkits;

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(com|io|dev|ai|app|co|net|org)(\/.*)?$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Match a user's input ("Google Sheets", "sheets.google.com", "XERO") to a
// Composio toolkit, so the guide can say whether Composio manages OAuth.
export function findToolkit(input: string): CatalogEntry | null {
  const q = slugify(input).replace(/-/g, "");
  if (!q) return null;
  return (
    catalog.find((t) => t.slug.toLowerCase().replace(/_/g, "") === q) ??
    catalog.find((t) => slugify(t.name).replace(/-/g, "") === q) ??
    null
  );
}

export async function listCurated(): Promise<Guide[]> {
  const files = (await fs.readdir(CURATED_DIR)).filter((f) => f.endsWith(".json"));
  const guides = await Promise.all(
    files.map(async (f) => JSON.parse(await fs.readFile(path.join(CURATED_DIR, f), "utf8")) as Guide),
  );
  const order = { easy: 0, moderate: 1, hard: 2, very_hard: 3 };
  return guides.sort((a, b) => order[a.verdict.difficulty] - order[b.verdict.difficulty]);
}

async function readCurated(slug: string): Promise<Guide | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(CURATED_DIR, `${slug}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function supabase(pathAndQuery: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY!,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res;
}

export async function readGenerated(slug: string): Promise<Guide | null> {
  if (useSupabase) {
    const res = await supabase(`guides?slug=eq.${encodeURIComponent(slug)}&select=data`);
    const rows = (await res.json()) as { data: Guide }[];
    return rows[0]?.data ?? null;
  }
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, `${slug}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function saveGenerated(guide: Guide) {
  if (useSupabase) {
    await supabase("guides?on_conflict=slug", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ slug: guide.slug, data: guide, created_at: guide.meta.createdAt }),
    });
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, `${guide.slug}.json`), JSON.stringify(guide, null, 2));
}

export async function listGenerated(limit = 12): Promise<Guide[]> {
  if (useSupabase) {
    const res = await supabase(`guides?select=data&order=created_at.desc&limit=${limit}`);
    return ((await res.json()) as { data: Guide }[]).map((r) => r.data);
  }
  try {
    const files = (await fs.readdir(LOCAL_DIR)).filter((f) => f.endsWith(".json"));
    const guides = await Promise.all(
      files.map(async (f) => JSON.parse(await fs.readFile(path.join(LOCAL_DIR, f), "utf8")) as Guide),
    );
    return guides.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt)).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getGuide(slug: string): Promise<Guide | null> {
  return (await readCurated(slug)) ?? (await readGenerated(slug));
}
