import type { Difficulty, Evidence, Owner } from "./types";

export const DIFFICULTY: Record<Difficulty, { label: string; color: string; soft: string }> = {
  easy: { label: "Easy", color: "var(--easy)", soft: "var(--easy-soft)" },
  moderate: { label: "Moderate", color: "var(--moderate)", soft: "var(--moderate-soft)" },
  hard: { label: "Hard", color: "var(--hard)", soft: "var(--hard-soft)" },
  very_hard: { label: "Very hard", color: "var(--vhard)", soft: "var(--vhard-soft)" },
};

export const EVIDENCE: Record<Evidence, { label: string; color: string; soft: string; help: string }> = {
  tested: {
    label: "Tested",
    color: "var(--tested)",
    soft: "var(--tested-soft)",
    help: "An agent or a person ran a check and saw this result.",
  },
  documented: {
    label: "Documented",
    color: "var(--documented)",
    soft: "var(--documented-soft)",
    help: "Stated in the cited provider or Composio source.",
  },
  inferred: {
    label: "Inferred",
    color: "var(--inferred)",
    soft: "var(--inferred-soft)",
    help: "Our reasoning or community reports. Verify before relying on it.",
  },
};

export const OWNER: Record<Owner, { label: string; icon: string; help: string }> = {
  agent: { label: "Agent can do", icon: "◆", help: "An agent can do this without your account or a decision." },
  you: { label: "You", icon: "●", help: "Needs you: an account, a legal or payment step, or a judgement call." },
  provider: { label: "Provider", icon: "◷", help: "You're waiting on the provider (review, approval, verification)." },
  customer_admin: { label: "Customer admin", icon: "▲", help: "Each customer's admin has to act in their own account." },
};

export const PHASE = {
  setup: { label: "Get credentials", help: "Register the app and get a client ID and secret." },
  test: { label: "First test connection", help: "Connect your own account end to end." },
  launch: { label: "Open to real users", help: "Anything needed before any user can connect." },
} as const;
