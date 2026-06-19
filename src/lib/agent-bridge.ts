// Client-side event bus that wires Threat Engine + Digital Twin + Autonomous
// Defense outputs into the AI Agent conversation and Incident History.
import type { Satellite } from "./mock-data";
import { computeTrust, synthSample, type TrustReport } from "./threat-engine";
import type { SimResult } from "./simulation-dynamics";
import { RECOMMENDED_ACTIONS } from "./incident-store";

export type AgentBridgeEvent = {
  id: string;
  kind: "simulation" | "defense";
  text: string;
  t: number;
  meta: Record<string, unknown>;
};

let incidentCounter = 0;
function nextIncidentId(kind: AgentBridgeEvent["kind"]) {
  incidentCounter += 1;
  return `INC-${kind === "simulation" ? "SIM" : "DEF"}-${Date.now().toString(36)}-${incidentCounter}`;
}

const EVT = "orbitguard:agent-bridge";
const CLEAR_EVT = "orbitguard:agent-bridge-clear";
const HISTORY_KEY = "orbitguard:incident-history";
const ROOT_CAUSE: Record<string, string> = {
  "GPS Spoofing":      "Detected timing and positioning anomalies consistent with counterfeit GNSS signals.",
  "Signal Jamming":    "Downlink RSSI collapse and broadband noise floor elevation consistent with directed RF jamming.",
  "Command Injection": "Uplink HMAC mismatch with commands outside the operator's OTAR key schedule.",
  "Data Manipulation": "Telemetry packets diverging from cross-checked star-tracker and IMU baselines.",
  "Signal Hijacking":  "Carrier handoff to an unauthorized ground node mid-pass.",
  "Telemetry Anomaly": "Subsystem clock drift and sequence-number gaps beyond 2σ baseline.",
};
const IMPACT: Record<string, string> = {
  "GPS Spoofing":      "Navigation accuracy degradation and mission telemetry uncertainty.",
  "Signal Jamming":    "Loss of downlink throughput and degraded command acknowledgement.",
  "Command Injection": "Risk of unauthorized subsystem state change and policy violation.",
  "Data Manipulation": "Decision-grade telemetry compromised; downstream analytics unreliable.",
  "Signal Hijacking":  "Mission control loses authoritative link until ground re-auth.",
  "Telemetry Anomaly": "Reduced operator confidence in subsystem state.",
};

export function pushSimulationAnalysis(scenario: string, satellite: Satellite, sim?: SimResult) {
  const report: TrustReport = computeTrust(synthSample(satellite), satellite);
  const primary = report.threats.find((t) => t.type === scenario) ?? report.threats[0];
  const confidence = sim?.confidence ?? primary?.confidence ?? Math.max(60, 100 - report.trustScore);
  const trustScore = sim
    ? Math.max(0, Math.min(100, report.trustScore - sim.trustDecrease))
    : report.trustScore;
  const recommended = RECOMMENDED_ACTIONS[scenario] ?? ["Channel Isolation"];
  const outcomeLine = sim
    ? `Outcome:\n${sim.message}\n\nResponse Time:\n${sim.responseTimeSec}s\n\nTrust Decrease:\n-${sim.trustDecrease}\n`
    : "";

  const text =
`MISSION CONTROL ANALYSIS

Threat:
${scenario}

Affected Asset:
${satellite.name}

Trust Score:
${trustScore}/100

Confidence:
${confidence}%

${outcomeLine}Active Threats:
${scenario}

Root Cause:
${ROOT_CAUSE[scenario] ?? "Anomalous telemetry pattern flagged by trust engine."}

Operational Impact:
${IMPACT[scenario] ?? "Degraded mission assurance pending mitigation."}

Recommended Actions:
- ${recommended.join("\n- ")}`;

  // Replace any prior simulation analysis — only one active at a time.
  clearSimulationHistory();
  emit({
    id: nextIncidentId("simulation"),
    kind: "simulation",
    text,
    t: Date.now(),
    meta: {
      scenario,
      satellite: satellite.name,
      trustScore,
      confidence,
      responseTimeSec: sim?.responseTimeSec,
      trustDecrease: sim?.trustDecrease,
      outcome: sim?.outcome,
      message: sim?.message,
      recommended,
    },
  });
}

export interface ArmorAudit {
  id: string;
  timestamp: string;
  decision: "approved" | "blocked";
  policyId?: string;
  intentVerified?: boolean;
  policyEnforced?: boolean;
  auditLogged?: boolean;
}

export function pushDefenseExplanation(action: string, satelliteName: string, reason?: string, audit?: ArmorAudit) {
  const rationale: Record<string, string> = {
    "Channel Isolation":    "Quarantining the compromised RF channel removes the adversary's injection vector while preserving redundant links.",
    "Emergency Encryption": "OTAR re-key + AES-256 rotation invalidates any captured authenticator and forecloses replay attacks.",
    "Signal Re-routing":    "Failing over to an alternate ground station bypasses the jammed/spoofed path and restores command authority.",
    "Satellite Lockdown":   "Locking the bus prevents further unauthorized state change while ground performs forensic review.",
    "Lockdown Mode":        "Bus-level lockdown halts command execution while operators triage the injection vector.",
    "Frequency Hopping":    "Spread-spectrum hop sequence outpaces the jammer's reactive bandwidth.",
    "Rollback Checkpoint":  "Restoring the last signed telemetry checkpoint reverses in-flight data tampering.",
    "Human Review":         "Anomaly is ambiguous — escalating to operator review prevents premature automated response.",
  };
  const why = rationale[action] ?? "Selected per ArmorIQ-approved playbook for the detected threat class.";
  const auditBlock = audit
    ? `\nArmorIQ:\n✓ Intent Verified\n✓ Policy Enforced\n✓ Audit Logged\nAudit ID: ${audit.id}\nTimestamp: ${audit.timestamp}\nDecision: ${audit.decision.toUpperCase()}\nPolicy: ${audit.policyId ?? "n/a"}\n`
    : "";
  const text =
`DEFENSE ACTION EXPLAINED

Action:
${action}

Target:
${satelliteName}

Why this action:
${why}
${auditBlock}
${reason ? `Trigger:\n${reason}` : ""}`.trim();

  emit({ id: nextIncidentId("defense"), kind: "defense", text, t: Date.now(), meta: { action, satellite: satelliteName, reason, audit } });
}

function emit(evt: AgentBridgeEvent) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const list: AgentBridgeEvent[] = raw ? JSON.parse(raw) : [];
    list.unshift(evt);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  } catch { /* ignore quota */ }
  window.dispatchEvent(new CustomEvent<AgentBridgeEvent>(EVT, { detail: evt }));
}

// Remove every prior simulation analysis so a fresh one is the only active
// mission analysis in both history storage and the Agent panel.
export function clearSimulationHistory() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const list: AgentBridgeEvent[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((e) => e.kind !== "simulation");
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(CLEAR_EVT, { detail: { kind: "simulation" } }));
}

export function subscribeAgentBridge(cb: (evt: AgentBridgeEvent) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<AgentBridgeEvent>).detail);
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}

export function subscribeAgentBridgeClear(cb: (kind: AgentBridgeEvent["kind"]) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ kind: AgentBridgeEvent["kind"] }>).detail;
    if (detail?.kind) cb(detail.kind);
  };
  window.addEventListener(CLEAR_EVT, handler);
  return () => window.removeEventListener(CLEAR_EVT, handler);
}

export function readIncidentHistory(): AgentBridgeEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as AgentBridgeEvent[]) : [];
  } catch { return []; }
}
