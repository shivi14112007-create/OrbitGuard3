// ArmorIQ backend integration (Hackathon: Track 1 "Secure by Default" +
// Track 2 "AI Agent for the Real World").
//
// Uses the official @armoriq/sdk to wrap every sensitive server action with:
//   1. capturePlan / startPlan       — declares intent up front
//   2. session.enforce(...)          — policy gate (allow / block / hold)
//   3. session.report(...)           — signed audit log of the outcome
//
// Configure with project secrets (all optional; without them we degrade to a
// local deny-destructive policy so the app still runs in dev):
//   ARMORIQ_API_KEY     — from platform.armoriq.ai
//   ARMORIQ_USER_ID     — registered user id  (default: "orbitguard-system")
//   ARMORIQ_AGENT_ID    — registered agent id (default: "orbitguard-agent")
//   ARMORIQ_CONTEXT_ID  — optional context id (default: "mission-console")
//
// Docs: https://docs.armoriq.ai/docs
//
// NOTE: this file is server-only (.server.ts). It is never bundled into the
// client. The SDK uses axios + node crypto, both fine on the Workers runtime
// with nodejs_compat.

import {
  ArmorIQClient,
  ArmorIQSession,
  type EnforceResult,
} from "@armoriq/sdk";

export type ArmorAction = {
  /** Stable tool/action name — e.g. "isro.bhuvan.geocode". */
  tool: string;
  /** Free-form natural language describing the intent (used for capturePlan). */
  goal: string;
  /** Structured arguments — bound into the signed intent token. */
  args: Record<string, unknown>;
  /** Logical MCP grouping; defaults to the first segment of `tool`. */
  mcp?: string;
  /** Optional actor email surfaced to ArmorIQ for per-user policies. */
  actor?: string;
};

export type ArmorDecision = {
  allowed: boolean;
  action: "allow" | "block" | "hold";
  reason: string;
  policyId?: string;
  /** True when the decision came from the ArmorIQ platform, not local fallback. */
  remote: boolean;
};

let cachedClient: ArmorIQClient | null | undefined;

function getClient(): ArmorIQClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.ARMORIQ_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return null;
  }
  try {
    cachedClient = new ArmorIQClient({
      apiKey,
      userId: process.env.ARMORIQ_USER_ID ?? "orbitguard-system",
      agentId: process.env.ARMORIQ_AGENT_ID ?? "orbitguard-agent",
      contextId: process.env.ARMORIQ_CONTEXT_ID ?? "mission-console",
    });
  } catch (err) {
    console.warn("[ArmorIQ] client init failed, falling back to local policy", err);
    cachedClient = null;
  }
  return cachedClient;
}

// Local fallback policy — runs only when ARMORIQ_API_KEY is unset or the
// platform call fails. Blocks obviously destructive verbs; allows the rest.
function localDecision(action: ArmorAction): ArmorDecision {
  const t = action.tool.toLowerCase();
  if (/(delete|drop|wipe|destroy|purge|lockdown\.force)/.test(t)) {
    return {
      allowed: false,
      action: "block",
      reason: "Local fallback: destructive action requires ArmorIQ approval",
      policyId: "local.deny.destructive",
      remote: false,
    };
  }
  return {
    allowed: true,
    action: "allow",
    reason: "Local fallback: action permitted",
    policyId: "local.allow.default",
    remote: false,
  };
}

function toDecision(r: EnforceResult): ArmorDecision {
  return {
    allowed: r.allowed,
    action: r.action,
    reason: r.reason ?? (r.allowed ? "Allowed by ArmorIQ policy" : "Blocked by ArmorIQ policy"),
    policyId: r.matchedPolicy,
    remote: true,
  };
}

/**
 * Wrap a server-side action with ArmorIQ plan capture, policy enforcement,
 * and audit reporting. Throws if the action is blocked.
 */
export async function withArmor<T>(
  action: ArmorAction,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const client = getClient();
  const mcp = action.mcp ?? action.tool.split(".")[0] ?? "default";

  // No platform configured — use local fallback only.
  if (!client) {
    const decision = localDecision(action);
    console.info("[ArmorIQ:local]", {
      tool: action.tool,
      decision,
      ts: new Date().toISOString(),
    });
    if (!decision.allowed) throw new Error(`ArmorIQ blocked: ${decision.reason}`);
    return fn();
  }

  let session: ArmorIQSession;
  try {
    session = new ArmorIQSession(client, { defaultMcpName: mcp, llm: "orbitguard-server" });
    await session.startPlan(
      [{ name: action.tool, args: action.args }],
      action.goal,
    );
  } catch (err) {
    // Platform unreachable — degrade to local fallback rather than crash.
    console.warn("[ArmorIQ] startPlan failed, using local fallback", err);
    const decision = localDecision(action);
    if (!decision.allowed) throw new Error(`ArmorIQ blocked: ${decision.reason}`);
    return fn();
  }

  let decision: ArmorDecision;
  try {
    decision = toDecision(await session.enforce(action.tool, action.args));
  } catch (err) {
    console.warn("[ArmorIQ] enforce failed, using local fallback", err);
    decision = localDecision(action);
  }

  console.info("[ArmorIQ:audit]", {
    tool: action.tool,
    decision,
    ts: new Date().toISOString(),
  });

  if (!decision.allowed) {
    await safeReport(session, action, null, {
      status: "failed",
      errorMessage: `policy_${decision.action}: ${decision.reason}`,
      durationMs: Date.now() - start,
    });
    throw new Error(`ArmorIQ blocked: ${decision.reason}`);
  }

  try {
    const result = await fn();
    await safeReport(session, action, sanitize(result), {
      status: "success",
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    await safeReport(session, action, null, {
      status: "error",
      errorMessage: (err as Error).message,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

async function safeReport(
  session: ArmorIQSession,
  action: ArmorAction,
  result: unknown,
  opts: { status: "success" | "failed" | "error"; errorMessage?: string; durationMs: number },
) {
  try {
    await session.report(action.tool, action.args, result, opts);
  } catch (err) {
    console.warn("[ArmorIQ] report failed", err);
  }
}

// Trim large payloads before sending them up to the audit log.
function sanitize(value: unknown): unknown {
  try {
    const s = JSON.stringify(value);
    if (s.length <= 4000) return value;
    return { _truncated: true, preview: s.slice(0, 4000) };
  } catch {
    return { _unserializable: true };
  }
}
