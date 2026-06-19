// Single Incident State Store — the ONLY source of truth for the currently
// active simulated incident. Threat Engine, AI Agent, Autonomous Defense and
// Reports all read from here so every module stays synchronized.
import type { Satellite, ThreatType } from "./mock-data";
import type { SimResult, SimOutcome } from "./simulation-dynamics";

export type MitigationStatus = "neutralized" | "partial" | "active";

export interface Incident {
  id: string;
  satellite: { id: string; name: string };
  attackType: ThreatType | string;
  confidence: number;        // 0..100
  trustImpact: number;       // points subtracted from baseline
  trustScore: number;        // resulting trust score after impact
  mitigationStatus: MitigationStatus;
  responseTimeSec: number;
  outcome: SimOutcome;
  message: string;
  timestamp: number;
}

const KEY = "orbitguard:current-incident";
const EVT = "orbitguard:current-incident";

function outcomeToMitigation(o: SimOutcome): MitigationStatus {
  return o === "neutralized" ? "neutralized" : o === "partial" ? "partial" : "active";
}

let counter = 0;
export function buildIncident(
  attackType: string,
  sat: Satellite,
  sim: SimResult,
  baselineTrust: number,
): Incident {
  counter += 1;
  const trustScore = Math.max(0, Math.min(100, baselineTrust - sim.trustDecrease));
  return {
    id: `INC-${Date.now().toString(36)}-${counter}`,
    satellite: { id: sat.id, name: sat.name },
    attackType,
    confidence: sim.confidence,
    trustImpact: sim.trustDecrease,
    trustScore,
    mitigationStatus: outcomeToMitigation(sim.outcome),
    responseTimeSec: sim.responseTimeSec,
    outcome: sim.outcome,
    message: sim.message,
    timestamp: Date.now(),
  };
}

export function setCurrentIncident(inc: Incident) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(inc)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent<Incident>(EVT, { detail: inc }));
}

export function getCurrentIncident(): Incident | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Incident) : null;
  } catch { return null; }
}

export function clearCurrentIncident() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent<Incident | null>(EVT, { detail: null }));
}

export function subscribeCurrentIncident(cb: (i: Incident | null) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<Incident | null>).detail ?? getCurrentIncident());
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}

// ─── Per-attack countermeasure recommendations ─────────────────────────────
// Each attack type maps to a small, relevant subset — never all actions.
export const RECOMMENDED_ACTIONS: Record<string, string[]> = {
  "GPS Spoofing":      ["Channel Isolation", "Emergency Encryption"],
  "Signal Jamming":    ["Signal Re-routing", "Frequency Hopping"],
  "Command Injection": ["Lockdown Mode", "Emergency Encryption"],
  "Telemetry Anomaly": ["Human Review"],
  "Data Manipulation": ["Rollback Checkpoint"],
  "Signal Hijacking":  ["Channel Isolation", "Signal Re-routing"],
};

export function recommendedActionsFor(attackType: string): string[] {
  return RECOMMENDED_ACTIONS[attackType] ?? ["Channel Isolation"];
}
