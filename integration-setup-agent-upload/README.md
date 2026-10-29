# Integration Setup Agent

**An AI agent that tells you what it takes to connect any app to your product: an hour, or six weeks?**

Before an AI agent's users can connect Gmail, Shopify or Workday, the developer needs an OAuth app the provider will approve. Provider docs show which buttons to click. They rarely say how long approval takes, what gets you rejected, or which parts you must do yourself. This agent researches any app and answers those questions, and shows where every answer comes from.

Each guide answers five questions:

1. **How hard is it?** A difficulty rating and a one-sentence verdict.
2. **How long will it take?** Time to your first test connection, time until any user can connect (including approval waits), and hands-on effort.
3. **What could stop me?** Requirements, scopes that trigger review, costs, terms, and the errors you'll see with how to fix them.
4. **What can an agent do, and where do I take over?** Every step is tagged *Agent*, *You*, *Provider* (waiting on them) or *Customer admin*.
5. **Once connected, what data can my agent read, and how do I keep it in sync?** The main objects, the scope for each and whether it triggers review, webhooks vs polling, sync limits, and what the provider's terms let you do with the data (several ban AI training on it).

Every claim is labelled **Tested**, **Documented** (with source ids) or **Inferred**. Every guide lists what was tested and what couldn't be confirmed.

## What's here

- **7 researched guides**, from easiest to hardest:

  | App | Difficulty | Why it's in the set |
  |---|---|---|
  | GitHub | Easy | No review at all; the only blocker is org owners approving apps |
  | X (Twitter) | Moderate | Nothing to review; the blocker is prepaid credits and policy |
  | Xero | Moderate | Instant credentials, but connection caps and certification tiers |
  | Shopify | Hard | Per-store OAuth; App Store review for public distribution |
  | Gmail | Very hard | Restricted scopes need verification plus a yearly paid CASA assessment |
  | Spotify | Very hard | Production access is closed to most teams |
  | Workday | Very hard | Each customer's admin must register your app in their own tenant |

  Gmail and GitHub are Composio-managed. Their guides cover when you'd still bring your own app: your brand on the consent screen, custom scopes, or your own quota.
- **Live generation for any app.** Enter a name or website. An agent researches the provider, reads the official docs, drafts a guide, tests the endpoints and every source link, and publishes a shareable page in about a minute.
- **The full Composio OAuth catalog** (382 toolkits, 258 of them bring-your-own). Each one links to its guide, or starts generating one.
- **Share and export.** Copy a link, copy the guide as Markdown for a ticket, or print to PDF.

## How the agent works

`lib/agent.ts`:

1. Checks Composio's catalog (`data/catalog.json`, built from [docs.composio.dev/toolkits/managed-auth](https://docs.composio.dev/toolkits/managed-auth)).
2. Finds the docs. Gemini answers a fixed checklist from its own knowledge (who can create apps, endpoints, review triggers, pre-approval limits, costs, gotchas, AI/automation terms) and names the official pages for each. These notes are leads, never sources.
3. Reads and verifies those pages (via Jina Reader). Only pages that load become sources, which filters out made-up URLs. If too few load, it follows links on the official pages that mention OAuth, scopes, review or terms.
4. Drafts the guide in the `Guide` format (`lib/types.ts`), citing only the sources it was given.
5. Tests what it can without an account (`lib/probes.ts`), using fake credentials:
   - fetches the OIDC discovery document
   - checks how the authorize endpoint rejects a bad client
   - checks the token endpoint's error response
   - fetches every source link
6. Enforces the evidence rules in code:
   - Only probes can mark a claim *tested*.
   - A *documented* claim whose sources don't resolve is downgraded to *inferred*.
   - Confidence is capped by the share of claims that are actually backed.
   - Failed checks are listed under *What we couldn't confirm*.

Agents never create accounts, accept terms, enter credentials or submit anything for review.

## What was tested, and what wasn't

- **Tested:** read-only endpoint probes for Google, GitHub, Spotify, X and Xero, and link checks on every source in every guide. Results and timestamps are on each guide under *What we tested*.
  - The GitHub token endpoint returned HTTP 404 to a fake client rather than an OAuth error. That result is recorded as-is.
  - Shopify and Workday OAuth URLs are per store or per tenant, so there was no shared endpoint to probe.
- **Not tested:** a full sign-in end to end with a real app. That needs real developer accounts, which are a human's job. *(Add your own manual test notes here, and set `humanReviewed` / `reviewNotes` in the guides you checked.)*
- **Not tested: approval wait times.** No provider publishes reliable ones. They are ranges from provider statements plus developer reports, and marked accordingly.

## Run it locally (free)

```bash
npm install
cp .env.example .env.local   # add a free Gemini key from https://aistudio.google.com/apikey
npm run dev
```

The researched guides work without any key. Only live generation needs `GEMINI_API_KEY`.

Free-tier notes, found while building this:

- Google Search grounding isn't included in the free tier for current models (it returns 429). The agent reads the docs itself instead. On a key with billing, set `GEMINI_SEARCH=1` to add grounding back.
- New keys can't use older models such as `gemini-2.5-flash`.
- Free models are sometimes slow or briefly unavailable, so each call tries `gemini-3.5-flash`, then the lighter models, with a 50-second timeout each. A typical guide takes 50–80 seconds.

Run the probes yourself:

```bash
node scripts/probe.ts --discovery https://accounts.google.com/.well-known/openid-configuration --authorize https://accounts.google.com/o/oauth2/v2/auth --token https://oauth2.googleapis.com/token
```

## Deploy (free)

1. Push to GitHub, then import the repo in Vercel (Hobby plan).
2. Set `GEMINI_API_KEY` in the Vercel project's environment variables.
3. Optional: to keep live-generated guides durable, create a free Supabase project, run `supabase.sql`, and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Without Supabase, generated guides on Vercel live in `/tmp` and disappear when the instance recycles.

Protecting the free quota:

- Library apps are served from the repo, with no model call.
- Generated guides are cached for 14 days.
- Each IP can generate 10 guides an hour (best effort).

## Getting to 100 guides

The live agent and the researched guides use the same format, so scaling up is a pipeline, not 100 hand-written pages:

1. **Prioritise.** Start with Composio's 258 bring-your-own toolkits, ranked by usage (connections attempted, auth configs created). That's where developers are stuck.
2. **Generate in batches** with the live agent. Run the deeper research agent on providers whose drafts come back with low confidence or many inferred claims.
3. **Review** each guide against a short checklist: endpoints probed, approval path confirmed, at least one manual test of the console flow. Set `humanReviewed`.
4. **Keep them fresh:**
   - Re-run probes and link checks weekly.
   - Re-research when a check fails or a guide is more than 90 days old.
   - Watch provider changelogs, since much of what these guides found changed in 2025–26: GitHub token expiry, Spotify quota, X pricing, Xero tiers.
5. **Learn from usage.** Let developers flag "this was wrong" or "it took me N days" on a guide, and feed that into the time estimates. Real completion times beat published ones.

## Layout

```
app/                 pages: home + library, /guides/[slug], /new (live), /method
app/api/generate     streams agent progress as NDJSON
lib/agent.ts         investigation pipeline
lib/probes.ts        read-only endpoint and link checks
lib/types.ts         the guide format
data/guides/*.json   researched guides
data/catalog.json    Composio OAuth toolkit catalog
```
