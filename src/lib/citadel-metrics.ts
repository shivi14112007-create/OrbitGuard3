// Reactive metrics for the Holographic Data Citadel. Pulls live values from
// the Incident Store + agent-bridge history so each tower reflects the current
// simulation/defense state instead of static constants.
import { useEffect, useState } from "react";
import { SATELLITES } from "./mock-data";
import {
  getCurrentIncident,
  subscribeCurrentIncident,
  type Incident,
} from "./incident-store";
import {
  readIncidentHistory,
  subscribeAgentBridge,
  subscribeAgentBridgeClear,
  type AgentBridgeEvent,
} from "./agent-bridge";

export interface CitadelMetric {
  label: string;
  value: number;   // normalized 0..1 for tower height
  display: string; // text shown on the floating chip
  color: string;
}

export interface CitadelSnapshot {
  metrics: CitadelMetric[];
  threatLabel: "NORMAL" | "ELEVATED" | "CRITICAL";
  activeIncidents: number;
  armorActions: number;
  avgTrust: number;
  avgConfidence: number | null;
}

function isActive(s: AgentBridgeEvent) {
  const o = (s.meta as { outcome?: string })?.outcome;
  return o !== "neutralized";
}

function isApprovedDefense(d: AgentBridgeEvent) {
  const audit = (d.meta as { audit?: { decision?: string } })?.audit;
  return !audit || audit.decision === "approved";
}

export function computeCitadelSnapshot(): CitadelSnapshot {
  const current: Incident | null = getCurrentIncident();
  const history = readIncidentHistory();
  const sims = history.filter((e) => e.kind === "simulation");
  const defs = history.filter((e) => e.kind === "defense");

  const activeSims = sims.filter(isActive);
  const activeIncidents = activeSims.length + (current && current.mitigationStatus !== "neutralized" ? 1 : 0);
  // de-dup: current incident may also be top of sims
  const activeCount = Math.max(
    activeSims.length,
    current && current.mitigationStatus !== "neutralized" ? 1 : 0,
  );

  const armorActions = defs.filter(isApprovedDefense).length;

  // Fleet trust: baseline health per satellite, overridden by current incident.
  const trustBySat = new Map<string, number>();
  for (const s of SATELLITES) trustBySat.set(s.name, s.health);
  if (current) trustBySat.set(current.satellite.name, current.trustScore);
  for (const sim of activeSims) {
    const m = sim.meta as { satellite?: string; trustScore?: number };
    if (m?.satellite && typeof m.trustScore === "number" && !trustBySat.has(m.satellite)) {
      trustBySat.set(m.satellite, m.trustScore);
    } else if (m?.satellite && typeof m.trustScore === "number") {
      trustBySat.set(m.satellite, Math.min(trustBySat.get(m.satellite)!, m.trustScore));
    }
  }
  const trustVals = Array.from(trustBySat.values());
  const avgTrust = trustVals.length ? trustVals.reduce((a, b) => a + b, 0) / trustVals.length : 100;

  // AI confidence: average across active simulated incidents.
  const confVals: number[] = [];
  if (current && current.mitigationStatus !== "neutralized") confVals.push(current.confidence);
  for (const sim of activeSims) {
    const c = (sim.meta as { confidence?: number })?.confidence;
    if (typeof c === "number") confVals.push(c);
  }
  const avgConfidence = confVals.length ? confVals.reduce((a, b) => a + b, 0) / confVals.length : null;

  const threatLabel: CitadelSnapshot["threatLabel"] =
    activeCount > 5 ? "CRITICAL" : activeCount >= 3 ? "ELEVATED" : "NORMAL";
  const threatLevelNorm = Math.min(1, activeCount / 6);

  const metrics: CitadelMetric[] = [
    {
      label: "TRUST SCORE",
      value: Math.max(0.05, avgTrust / 100),
      display: `${Math.round(avgTrust)}`,
      color: "#34d399",
    },
    {
      label: "THREAT LEVEL",
      value: Math.max(0.08, threatLevelNorm),
      display: threatLabel,
      color: "#f43f5e",
    },
    {
      label: "ACTIVE INCIDENTS",
      value: Math.max(0.05, Math.min(1, activeCount / 6)),
      display: `${activeCount}`,
      color: "#facc15",
    },
    {
      label: "ARMORIQ ACTIONS",
      value: Math.max(0.05, Math.min(1, armorActions / 10)),
      display: `${armorActions}`,
      color: "#a78bfa",
    },
    {
      label: "AI CONFIDENCE",
      value: avgConfidence == null ? 0.05 : Math.max(0.1, avgConfidence / 100),
      display: avgConfidence == null ? "--" : `${Math.round(avgConfidence)}`,
      color: "#22d3ee",
    },
  ];

  return { metrics, threatLabel, activeIncidents: activeCount, armorActions, avgTrust, avgConfidence };
}

export function useCitadelMetrics(): CitadelSnapshot {
  const [snap, setSnap] = useState<CitadelSnapshot>(() => computeCitadelSnapshot());
  useEffect(() => {
    const recompute = () => setSnap(computeCitadelSnapshot());
    recompute();
    const offIncident = subscribeCurrentIncident(recompute);
    const offBridge = subscribeAgentBridge(recompute);
    const offClear = subscribeAgentBridgeClear(recompute);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("orbitguard:")) recompute();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      offIncident();
      offBridge();
      offClear();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return snap;
}
