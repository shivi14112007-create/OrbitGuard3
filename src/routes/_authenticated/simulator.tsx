import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "@/components/Panel";
import { Play, Crosshair, Radio, Brain, ShieldCheck, RotateCcw } from "lucide-react";
import { SATELLITES } from "@/lib/mock-data";
import { pushSimulationAnalysis } from "@/lib/agent-bridge";
import { getSelectedSatellite, setSelectedSatellite } from "@/lib/selected-satellite";
import { generateSimResult, type SimResult } from "@/lib/simulation-dynamics";
import { buildIncident, setCurrentIncident } from "@/lib/incident-store";
import { computeTrust, synthSample } from "@/lib/threat-engine";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({ meta: [{ title: "Digital Twin Simulator — OrbitGuard" }] }),
  component: Sim,
});

const STAGES = [
  { key: "attack",   label: "Attack",     icon: Crosshair,  color: "var(--destructive)" },
  { key: "detect",   label: "Detection",  icon: Radio,      color: "var(--warning)" },
  { key: "analyze",  label: "AI Analysis",icon: Brain,      color: "var(--accent)" },
  { key: "respond",  label: "Response",   icon: ShieldCheck,color: "var(--primary)" },
  { key: "recover",  label: "Recovery",   icon: RotateCcw,  color: "var(--success)" },
] as const;

function Sim() {
  const [attack, setAttack] = useState<string>("GPS Spoofing");
  const [satelliteId, setSatelliteId] = useState<string>(() => getSelectedSatellite().id);
  const [stage, setStage] = useState(-1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  const selected = SATELLITES.find((s) => s.id === satelliteId) ?? SATELLITES[0];

  function onSelectSatellite(id: string) {
    setSatelliteId(id);
    setSelectedSatellite(id);
  }

  function launch() {
    const sim = generateSimResult(attack);
    setResult(null);
    setRunning(true);
    setStage(0);
    const totalMs = sim.responseTimeSec * 1000;
    const step = totalMs / STAGES.length;
    STAGES.forEach((_, i) => setTimeout(() => setStage(i), i * step));
    setTimeout(() => {
      setRunning(false);
      setResult(sim);
    }, totalMs);
    setSelectedSatellite(selected.id);

    // Single source of truth: build the incident and publish it. Every other
    // module (Threat Engine, AI Agent, Defense, Reports) reads from the store.
    const baseline = computeTrust(synthSample(selected), selected).trustScore;
    const incident = buildIncident(attack, selected, sim, baseline);
    setCurrentIncident(incident);

    pushSimulationAnalysis(attack, selected, sim);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Sandbox</div>
          <h1 className="font-display text-3xl glow-text">Digital Twin Simulator</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Satellite</label>
          <select value={satelliteId} onChange={(e) => onSelectSatellite(e.target.value)}
            className="rounded-md border border-border bg-input/60 px-3 py-2 text-sm">
            {SATELLITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Attack</label>
          <select value={attack} onChange={(e) => setAttack(e.target.value)}
            className="rounded-md border border-border bg-input/60 px-3 py-2 text-sm">
            {["GPS Spoofing","Signal Jamming","Command Injection","Telemetry Anomaly","Data Manipulation","Signal Hijacking"].map((a) => <option key={a}>{a}</option>)}
          </select>
          <button onClick={launch} disabled={running}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-mono uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60">
            <Play className="h-4 w-4" /> Launch Simulation
          </button>
        </div>
      </header>

      <Panel title={`Mission Twin · ${selected.name}`} subtitle="Synthetic environment · safe-to-attack">
        <div className="relative grid place-items-center overflow-hidden rounded-lg cyber-grid p-10">
          <div className="relative h-64 w-64">
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-32 w-32 rounded-full"
                style={{ background: "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--primary) 70%, transparent), transparent 60%), radial-gradient(circle at 70% 60%, color-mix(in oklab, var(--accent) 60%, transparent), transparent 70%), color-mix(in oklab, var(--primary) 30%, var(--background))",
                  boxShadow: "0 0 80px -10px var(--glow), inset 0 0 40px color-mix(in oklab, var(--primary) 30%, transparent)" }} />
            </div>
            <div className="absolute inset-0 rounded-full border border-primary/40" />
            <div className="orbit-rotate absolute inset-0">
              <div className="absolute -top-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded bg-primary text-primary-foreground glow-border">
                <Radio className="h-3 w-3" />
              </div>
            </div>
            {stage >= 0 && stage < 1 && (
              <motion.div className="absolute inset-0 rounded-full border-2 border-destructive"
                initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.9, repeat: Infinity }} />
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const active = stage >= i;
            return (
              <motion.div key={s.key} animate={{ opacity: active ? 1 : 0.4, scale: stage === i ? 1.03 : 1 }}
                className={`rounded-md border p-3 ${stage === i ? "glow-border" : "border-border/60"} bg-secondary/30`}>
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded" style={{ background: `color-mix(in oklab, ${s.color} 25%, transparent)`, color: s.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="font-display text-xs uppercase tracking-widest">{s.label}</div>
                </div>
                <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                  {active ? "COMPLETE" : "PENDING"}
                </div>
              </motion.div>
            );
          })}
        </div>

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-4 rounded-md p-3 text-sm"
            style={{
              borderWidth: 1, borderStyle: "solid",
              borderColor: `color-mix(in oklab, var(--${result.outcome === "neutralized" ? "success" : result.outcome === "partial" ? "warning" : "destructive"}) 40%, transparent)`,
              background: `color-mix(in oklab, var(--${result.outcome === "neutralized" ? "success" : result.outcome === "partial" ? "warning" : "destructive"}) 12%, transparent)`,
            }}>
            {result.message} Trust impact: -{result.trustDecrease} on {selected.name}.
          </motion.div>
        )}
      </Panel>
    </div>
  );
}
