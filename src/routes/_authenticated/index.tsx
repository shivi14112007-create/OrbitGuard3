import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Satellite, ShieldAlert, Activity, Target, Cpu, Radio, Globe2, Zap,
  Gauge as GaugeIcon, Brain, Signal, Layers, ArrowUpRight, Maximize2,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar, CartesianGrid,
} from "recharts";
import { Panel, StatCard, SeverityBadge } from "@/components/Panel";
import { SpaceSceneSafe } from "@/components/SpaceSceneSafe";
import {
  INITIAL_THREATS, SATELLITES, type ThreatEvent,
} from "@/lib/mock-data";
import { readIncidentHistory, subscribeAgentBridge, type AgentBridgeEvent } from "@/lib/agent-bridge";
import { getCurrentIncident, subscribeCurrentIncident, type Incident } from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Command Center — OrbitGuard" },
      { name: "description", content: "Live situational awareness for the OrbitGuard satellite fleet." },
    ],
  }),
  component: Dashboard,
});

function useCounter(target: number, ms = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function Dashboard() {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      if (!localStorage.getItem("orbitguard-welcomed")) {
        localStorage.setItem("orbitguard-welcomed", "1");
        navigate({ to: "/welcome", replace: true });
      }
    } catch {}
  }, [navigate]);

  const accuracyTarget = 98;
  const accuracy = useCounter(accuracyTarget);
  const uptime = useCounter(999);
  const [history, setHistory] = useState<AgentBridgeEvent[]>(() => readIncidentHistory());
  const [incident, setIncident] = useState<Incident | null>(() => getCurrentIncident());
  const [sceneFull, setSceneFull] = useState(false);

  useEffect(() => {
    const off1 = subscribeAgentBridge(() => setHistory(readIncidentHistory()));
    const off2 = subscribeCurrentIncident((i) => { setIncident(i); setHistory(readIncidentHistory()); });
    return () => { off1(); off2(); };
  }, []);

  const sims = history.filter((h) => h.kind === "simulation");
  const defs = history.filter((h) => h.kind === "defense");
  const sats = useCounter(SATELLITES.length);
  const threats = useCounter(sims.length);
  const actions = useCounter(defs.length);
  const successCount = sims.filter((s) => (s.meta as Record<string, unknown>).outcome === "neutralized").length;
  const detectionAcc = sims.length ? Math.round((successCount / sims.length) * 100) : accuracyTarget;
  const threatLevel: { label: string; tier: string; accent: "success" | "warning" | "destructive" } =
    sims.length <= 2 ? { label: "NORMAL",   tier: "Tier-0 nominal",  accent: "success" } :
    sims.length <= 5 ? { label: "ELEVATED", tier: "Tier-2 advisory", accent: "warning" } :
                       { label: "CRITICAL", tier: "Tier-3 alert",    accent: "destructive" };

  // Derive a live threat feed from the incident store; fall back to seeded
  // events before the first simulation runs.
  const feed: ThreatEvent[] = sims.length
    ? sims.slice(0, 24).map((s, idx): ThreatEvent => {
        const m = s.meta as Record<string, unknown>;
        const outcome = (m.outcome as string) ?? "active";
        return {
          id: s.id,
          type: (m.scenario as ThreatEvent["type"]) ?? "GPS Spoofing",
          satellite: (m.satellite as string) ?? "—",
          severity: outcome === "neutralized" ? "low" : outcome === "partial" ? "medium" : "critical",
          confidence: Math.round((m.confidence as number) ?? 0),
          status: outcome === "neutralized" ? "mitigated" : outcome === "persists" ? "detected" : "investigating",
          timestamp: s.t,
        };
      })
    : INITIAL_THREATS;
  void incident;


  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">Mission Control · Orbital Layer</div>
          <h1 className="mt-1 truncate font-display text-2xl sm:text-3xl lg:text-4xl glow-text">Command Center</h1>
        </div>
        <div className="hidden sm:flex shrink-0 items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1">
            <span className="h-2 w-2 rounded-full pulse-glow" style={{ background: "var(--success)" }} />
            Telemetry locked
          </span>
        </div>
      </header>

      {/* Connected Services */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">Connected Services</span>
        {[
          { name: "NASA API",     tone: "var(--primary)" },
          { name: "ArmorIQ SDK",  tone: "var(--accent)" },
          { name: "Gemini",       tone: "var(--success)" },
          { name: "satellite.js", tone: "var(--warning)" },
        ].map((s) => (
          <span key={s.name}
            className="inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest"
            style={{ color: s.tone, borderColor: `color-mix(in oklab, ${s.tone} 40%, transparent)` }}>
            <span className="h-1.5 w-1.5 rounded-full pulse-glow" style={{ background: s.tone }} />
            {s.name}
          </span>
        ))}
      </div>

      {/* HERO: 3D space scene */}
      <Panel
        title="Live 3D Orbital View"
        subtitle="Real-time satellite constellation · drag to rotate · scroll to zoom"
        className="overflow-hidden"
      >
        <div className={`relative w-full overflow-hidden rounded-lg border border-primary/20 bg-[#02030a] ${sceneFull ? "h-[78vh]" : "h-[420px] sm:h-[480px] lg:h-[560px]"}`}>
          <SpaceSceneSafe />
          {/* HUD overlays — pointer-events-none to never block scene controls */}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary/80">
            <div className="rounded border border-primary/30 bg-background/55 px-2 py-1 backdrop-blur">
              FLEET · {SATELLITES.length} LINKED
            </div>
            <div className="rounded border border-success/30 bg-background/55 px-2 py-1 text-[color:var(--success)] backdrop-blur">
              UPLINK NOMINAL
            </div>
          </div>
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded border border-primary/30 bg-background/55 px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full pulse-glow bg-primary" />
            Telemetry · 1.2 Gb/s
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/60 bg-background/55 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
            Drag · Zoom · Auto-orbit
          </div>
          <button
            onClick={() => setSceneFull((v) => !v)}
            className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-background/70 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary backdrop-blur hover:bg-primary/15"
          >
            <Maximize2 className="h-3 w-3" /> {sceneFull ? "Compact" : "Expand"}
          </button>
        </div>
      </Panel>

      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active Satellites" value={sats} sub="8 / 8 nominal" icon={<Satellite className="h-4 w-4" />} accent="primary" />
        <StatCard label="Threats / 24h" value={threats} sub={`${sims.length} incidents in store`} icon={<ShieldAlert className="h-4 w-4" />} accent="warning" />
        <StatCard label="Threat Level" value={threatLevel.label} sub={threatLevel.tier} icon={<Activity className="h-4 w-4" />} accent={threatLevel.accent} />
        <StatCard label="Detection Acc." value={`${sims.length ? detectionAcc : accuracy}%`} sub={sims.length ? `${successCount}/${sims.length} neutralized` : "Rolling 7-day"} icon={<Target className="h-4 w-4" />} accent="success" />
        <StatCard label="AI Actions" value={actions} sub="ArmorIQ-approved" icon={<Cpu className="h-4 w-4" />} accent="primary" />
        <StatCard label="Uptime (h)" value={uptime} sub="Mission α start" icon={<GaugeIcon className="h-4 w-4" />} accent="success" />
      </div>

      {/* Threat feed + Subsystems */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Live Threat Feed" subtitle="Auto-refreshing every 3.5s">
          <div className="max-h-96 overflow-y-auto pr-1">
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {feed.map((t) => (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/50 bg-secondary/30 px-3 py-2"
                  >
                    <Radio className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm">{t.type}</span>
                        <SeverityBadge severity={t.severity} />
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-mono text-muted-foreground" suppressHydrationWarning>
                        {t.satellite} · {new Date(t.timestamp).toISOString().slice(11, 19)} UTC · conf {t.confidence}%
                      </div>
                    </div>
                    <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest"
                      style={{
                        background: t.status === "mitigated" ? "color-mix(in oklab, var(--success) 25%, transparent)" :
                                    t.status === "investigating" ? "color-mix(in oklab, var(--warning) 25%, transparent)" :
                                    "color-mix(in oklab, var(--destructive) 25%, transparent)",
                        color: t.status === "mitigated" ? "var(--success)" :
                               t.status === "investigating" ? "var(--warning)" : "var(--destructive)",
                      }}>
                      {t.status}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </Panel>

        <Panel title="Subsystems" subtitle="Realtime health">
          <div className="grid gap-3">
            <Bar2 label="Power" pct={92} icon={<Zap className="h-3.5 w-3.5" />} color="var(--success)" />
            <Bar2 label="Thermal" pct={71} icon={<Activity className="h-3.5 w-3.5" />} color="var(--warning)" />
            <Bar2 label="Comms" pct={88} icon={<Signal className="h-3.5 w-3.5" />} color="var(--primary)" />
            <Bar2 label="AI Inference" pct={96} icon={<Brain className="h-3.5 w-3.5" />} color="var(--accent)" />
            <Bar2 label="Ground Link" pct={64} icon={<Globe2 className="h-3.5 w-3.5" />} color="var(--warning)" />
            <Bar2 label="Defense Mesh" pct={83} icon={<Layers className="h-3.5 w-3.5" />} color="var(--success)" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="font-display text-lg" style={{ color }}>{value}</span>
      </div>
      <div className="h-20">
        <ResponsiveContainer>
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value }]} startAngle={180} endAngle={0}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }} dataKey="value" cornerRadius={6} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Bar2({ label, pct, icon, color }: { label: string; pct: number; icon: React.ReactNode; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5" style={{ color }}>{icon}{label}</span>
        <span className="font-display text-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
      </div>
    </div>
  );
}
