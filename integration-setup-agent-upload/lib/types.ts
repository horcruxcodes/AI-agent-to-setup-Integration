// The guide format. Every claim a developer might act on carries an evidence
// label and the sources behind it, so readers can tell what was tested,
// what a provider documents, and what is our inference.

export type Evidence =
  | "tested" // an agent or a human ran a check and saw the result (see probes)
  | "documented" // stated in a provider or Composio source (see sourceIds)
  | "inferred"; // reasoning or community reports; treat as unverified

export type Owner =
  | "agent" // an agent can do this without a human account or decision
  | "you" // the developer must do it (account, legal, payment, judgement)
  | "provider" // waiting on the provider (review, approval, verification)
  | "customer_admin"; // each end customer's admin must act (tenant-level setup)

export type Difficulty = "easy" | "moderate" | "hard" | "very_hard";
export type Confidence = "high" | "medium" | "low";

export interface Backed {
  evidence: Evidence;
  sourceIds: string[];
}

export interface Source {
  id: string; // short id like "s1", referenced by sourceIds
  title: string;
  url: string;
  publisher: "provider" | "composio" | "community" | "other";
}

export interface Estimate extends Backed {
  label: string; // human-readable, e.g. "15–30 minutes" or "2–6 weeks"
  minHours: number; // for sorting and comparison
  maxHours: number;
}

export interface Step extends Backed {
  title: string;
  detail: string; // markdown allowed: short paragraphs, lists, inline code
  owner: Owner;
  phase: "setup" | "test" | "launch"; // setup = get credentials, test = first connection, launch = real users
  time?: string;
  url?: string; // where to do it
}

export interface Gotcha extends Backed {
  title: string;
  detail: string;
  severity: "blocker" | "warning" | "info";
}

export interface Scope extends Backed {
  name: string;
  purpose: string;
  tier: "basic" | "sensitive" | "restricted" | "needs_review";
}

export interface BlockerFix extends Backed {
  symptom: string; // what the developer sees, e.g. an error message or a rejection
  fix: string;
}

// What the developer can read once a user connects, and how to keep it fresh.
export interface DataObject extends Backed {
  name: string; // e.g. "Orders", "Messages"
  description: string; // what it holds, in a few words
  scopes: string[]; // scopes that unlock it
  access: "open" | "needs_review" | "restricted"; // does reading it trigger review or extra approval?
  note: string | null; // e.g. "Customer PII returns null until protected data access is approved"
}

export interface DataAccess {
  objects: DataObject[];
  changes: Backed & {
    webhooks: "yes" | "partial" | "no" | "unknown";
    detail: string; // which events, setup needed, delivery guarantees; or how to poll
  };
  limits: (Backed & { text: string })[]; // rate limits, pagination, history windows, page sizes
  restrictions: (Backed & { text: string })[]; // data-use terms: AI training, storage, caching, retention
}

export interface Probe {
  name: string; // e.g. "OIDC discovery", "Authorize endpoint", "Docs link check"
  target: string; // URL probed
  ok: boolean;
  observed: string; // what actually came back
  checkedAt: string; // ISO timestamp
}

export interface Guide {
  slug: string; // url-safe id, lowercase
  name: string;
  website: string;
  category: string;
  composio: {
    toolkitSlug: string | null;
    managedOAuth: boolean | null; // null = not in Composio's catalog
    note: string; // what this means for the developer
  };
  verdict: {
    difficulty: Difficulty;
    headline: string; // one sentence a developer can repeat to their team
    summary: string; // 2–4 sentences
    confidence: Confidence;
  };
  timeline: {
    toFirstConnection: Estimate; // developer connects their own test account
    toProduction: Estimate; // any user can connect
    activeEffort: Estimate; // hands-on hours, excluding waiting
    approval: Backed & {
      required: "yes" | "no" | "depends";
      name: string | null; // e.g. "Google OAuth verification + CASA assessment"
      trigger: string; // what makes it required
      wait: string;
    };
  };
  prerequisites: (Backed & { text: string })[];
  oauth: Backed & {
    authorizeUrl: string | null;
    tokenUrl: string | null;
    discoveryUrl: string | null;
    pkce: "required" | "supported" | "not_supported" | "unknown";
    refreshTokens: string; // lifetime / rotation behaviour
    redirectUriRules: string;
    devConsoleUrl: string | null;
  };
  steps: Step[];
  scopes: Scope[];
  gotchas: Gotcha[];
  blockers: BlockerFix[];
  dataAccess?: DataAccess; // optional: older guides may not have it
  probes: Probe[];
  sources: Source[];
  unknowns: string[]; // what we could not confirm
  meta: {
    origin: "curated" | "agent";
    model: string | null;
    createdAt: string;
    humanReviewed: boolean;
    reviewNotes: string | null; // what a human checked by hand
  };
}

export interface CatalogEntry {
  name: string;
  slug: string;
  composioManaged: boolean;
  docs: string;
}
