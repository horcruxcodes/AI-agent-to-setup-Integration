"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Step = { id: string; label: string; status: "running" | "done" | "warn"; detail?: string };

export default function Generator({ initial = "", autostart = false }: { initial?: string; autostart?: boolean }) {
  const router = useRouter();
  const [app, setApp] = useState(initial);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneSlug, setDoneSlug] = useState<string | null>(null);
  const started = useRef(false);

  async function run(name: string, refresh = false) {
    if (!name.trim() || busy) return;
    setBusy(true);
    setSteps([]);
    setError(null);
    setDoneSlug(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app: name, refresh }),
      });
      if (!res.ok || !res.body) {
        setError((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "step")
            setSteps((prev) => {
              const i = prev.findIndex((s) => s.id === e.id);
              return i < 0 ? [...prev, e] : prev.map((s, k) => (k === i ? e : s));
            });
          else if (e.type === "error") {
            setError(e.message);
            setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "warn" } : s)));
          }
          else if (e.type === "done") {
            setDoneSlug(e.slug);
            router.push(`/guides/${e.slug}`);
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autostart && initial && !started.current) {
      started.current = true;
      run(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(app);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={app}
          onChange={(e) => setApp(e.target.value)}
          placeholder="Any app or website, e.g. Pipedrive or pipedrive.com"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-accent"
          aria-label="App name or website"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || app.trim().length < 2}
          className="rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-white disabled:opacity-50"
        >
          {busy ? "Investigating…" : "Get guide"}
        </button>
      </form>

      {(steps.length > 0 || error) && (
        <ol className="mt-5 space-y-2 rounded-lg border border-border bg-card p-4 text-sm" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id} className="flex gap-3">
              <span
                className="w-4 shrink-0 text-center"
                style={{ color: s.status === "done" ? "var(--tested)" : s.status === "warn" ? "var(--inferred)" : "var(--accent)" }}
              >
                {s.status === "running" ? <span className="inline-block animate-spin">◌</span> : s.status === "done" ? "✓" : "!"}
              </span>
              <span>
                <span className={s.status === "running" ? "font-medium" : ""}>{s.label}</span>
                {s.detail && <span className="block text-xs text-muted">{s.detail}</span>}
              </span>
            </li>
          ))}
          {error && (
            <li className="flex gap-3 text-[var(--vhard)]">
              <span className="w-4 text-center">✗</span>
              <span>{error}</span>
            </li>
          )}
          {doneSlug && <li className="text-xs text-muted pl-7">Opening the guide…</li>}
        </ol>
      )}
      {busy && <p className="mt-2 text-xs text-faint">Usually 30–60 seconds. The agent searches the docs, reads them, drafts the guide, then checks its own work.</p>}
    </div>
  );
}
