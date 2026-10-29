// Safe, read-only checks an agent can run against a provider without an
// account. They send obviously fake credentials, so they can only confirm
// that endpoints exist and how they reject bad input; they never create or
// change anything.

import type { Probe } from "./types";

const UA = "oauth-setup-guide-probe/0.1 (+read-only check; fake credentials)";
const FAKE_CLIENT = "oauth-guide-probe-invalid-client";
const FAKE_REDIRECT = "https://example.com/oauth/callback";

async function get(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { "user-agent": UA, ...(init.headers || {}) },
    signal: AbortSignal.timeout(10_000),
  });
}

function snippet(text: string, n = 220) {
  return text.replace(/\s+/g, " ").trim().slice(0, n);
}

function now() {
  return new Date().toISOString();
}

export async function probeDiscovery(url: string): Promise<Probe> {
  const base = { name: "OIDC / OAuth discovery document", target: url, checkedAt: now() };
  try {
    const res = await get(url);
    if (!res.ok) return { ...base, ok: false, observed: `HTTP ${res.status}` };
    const doc = await res.json();
    const pkce = doc.code_challenge_methods_supported;
    return {
      ...base,
      ok: true,
      observed:
        `HTTP 200. authorization_endpoint=${doc.authorization_endpoint ?? "—"}; ` +
        `token_endpoint=${doc.token_endpoint ?? "—"}; ` +
        `PKCE methods=${Array.isArray(pkce) ? pkce.join(",") : "not advertised"}`,
    };
  } catch (e) {
    return { ...base, ok: false, observed: `Request failed: ${(e as Error).message}` };
  }
}

export async function probeAuthorize(authorizeUrl: string): Promise<Probe> {
  const u = new URL(authorizeUrl);
  u.searchParams.set("client_id", FAKE_CLIENT);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", FAKE_REDIRECT);
  u.searchParams.set("state", "probe");
  const base = { name: "Authorize endpoint (fake client_id)", target: authorizeUrl, checkedAt: now() };
  try {
    const res = await get(u.toString(), { redirect: "manual" });
    const loc = res.headers.get("location");
    const body = loc ? "" : snippet(await res.text());
    // A live endpoint rejects the fake client or bounces to a login page.
    // A 404 or DNS failure means the URL is wrong.
    const ok = res.status !== 404 && res.status < 500;
    const where = loc ? ` → redirects to ${new URL(loc, u).host}${new URL(loc, u).pathname}` : "";
    const err = /invalid[_ ]client|client[_ ]id|unauthori[sz]ed_client|invalid_request/i.exec(body + (loc ?? ""));
    return {
      ...base,
      ok,
      observed: `HTTP ${res.status}${where}${err ? `; mentions "${err[0]}"` : ""}`,
    };
  } catch (e) {
    return { ...base, ok: false, observed: `Request failed: ${(e as Error).message}` };
  }
}

export async function probeToken(tokenUrl: string): Promise<Probe> {
  const base = { name: "Token endpoint (fake code + client)", target: tokenUrl, checkedAt: now() };
  try {
    const res = await get(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: "invalid",
        client_id: FAKE_CLIENT,
        client_secret: "invalid",
        redirect_uri: FAKE_REDIRECT,
      }),
    });
    const body = snippet(await res.text(), 160);
    // RFC 6749 says a bad client should get 400/401 with an "error" field.
    const ok = res.status === 400 || res.status === 401 || res.status === 403;
    return { ...base, ok, observed: `HTTP ${res.status}: ${body || "(empty body)"}` };
  } catch (e) {
    return { ...base, ok: false, observed: `Request failed: ${(e as Error).message}` };
  }
}

export async function probeLink(url: string): Promise<Probe> {
  const base = { name: "Source link check", target: url, checkedAt: now() };
  try {
    const res = await get(url, { redirect: "follow" });
    // Many docs sites block bots with 403/429; that still means the page exists.
    const ok = res.ok || res.status === 403 || res.status === 429;
    return { ...base, ok, observed: `HTTP ${res.status}${res.redirected ? ` (redirected to ${res.url})` : ""}` };
  } catch (e) {
    return { ...base, ok: false, observed: `Request failed: ${(e as Error).message}` };
  }
}

export async function runEndpointProbes(o: {
  authorizeUrl: string | null;
  tokenUrl: string | null;
  discoveryUrl: string | null;
}): Promise<Probe[]> {
  const jobs: Promise<Probe>[] = [];
  if (o.discoveryUrl) jobs.push(probeDiscovery(o.discoveryUrl));
  if (o.authorizeUrl) jobs.push(probeAuthorize(o.authorizeUrl));
  if (o.tokenUrl) jobs.push(probeToken(o.tokenUrl));
  return Promise.all(jobs);
}
