// Minimal client for the Gemini API free tier, using plain fetch.
// Docs: https://ai.google.dev/gemini-api/docs

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Free-tier models are sometimes slow or briefly unavailable, so each call
// tries these in order with a short timeout. GEMINI_MODEL goes first if set.
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];
export const MODEL = MODELS[0];
const PER_CALL_MS = 50_000;

interface GroundingChunk {
  web?: { uri: string; title?: string };
}

export interface GeminiResult {
  text: string;
  groundingSources: { title: string; uri: string }[];
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function generate(opts: {
  prompt: string;
  system?: string;
  search?: boolean; // ground the answer with Google Search
  json?: boolean; // ask for a JSON response
  temperature?: number;
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("Live generation is not set up on this deployment (GEMINI_API_KEY is missing). The researched guides still work.", 500);

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.search) body.tools = [{ google_search: {} }];

  let res: Response | null = null;
  let lastError = "";
  for (const model of MODELS) {
    try {
      const r = await fetch(`${API}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PER_CALL_MS),
      });
      if (r.ok) {
        res = r;
        break;
      }
      // 400 means our request is wrong; another model won't fix that.
      const detail = await r.text();
      if (r.status === 400) throw new GeminiError(`Gemini error 400: ${detail.slice(0, 300)}`, 400);
      lastError = r.status === 429 ? "quota" : `${model} returned ${r.status}`;
    } catch (e) {
      if (e instanceof GeminiError) throw e;
      lastError = `${model} timed out`;
    }
  }
  if (!res) {
    throw new GeminiError(
      lastError === "quota"
        ? "The free Gemini quota is used up for the moment. Try again in a minute."
        : `The free Gemini models are busy right now (${lastError}). Try again in a minute.`,
      503,
    );
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const chunks: GroundingChunk[] = cand?.groundingMetadata?.groundingChunks ?? [];
  const groundingSources = chunks
    .filter((c) => c.web?.uri)
    .map((c) => ({ title: c.web!.title ?? c.web!.uri, uri: c.web!.uri }));
  return { text, groundingSources };
}

// Google Search grounding returns redirect links. Follow one hop to get the
// real page URL so sources are readable and link-checkable.
export async function resolveRedirect(uri: string): Promise<string> {
  if (!uri.includes("grounding-api-redirect")) return uri;
  try {
    const res = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
    return res.headers.get("location") ?? uri;
  } catch {
    return uri;
  }
}

// Strip a model's JSON response down to the JSON itself.
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model did not return JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
