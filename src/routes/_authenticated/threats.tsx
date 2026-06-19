import { createFileRoute } from "@tanstack/react-router";
import { Panel, SeverityBadge } from "@/components/Panel";
import { INITIAL_THREATS, THREAT_TYPES, SATELLITES, ATTACK_TIMELINE, RADAR_DIM, type ThreatType } from "@/lib/mock-data";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Brain, Radio, AlertTriangle } from "lucide-react";
import { computeTrust, synthSample } from "@/lib/threat-engine";
import { getCurrentIncident, subscribeCurrentIncident, type Incident } from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/threats")({
  head: () => ({ meta: [{ title: "Threat Engine — OrbitGuard" }] }),
  component: Threats,
});

const EXPLAIN: Record<ThreatType, string> = {
  "GPS Spoofing": "Adversary transmitting counterfeit GNSS signals to mislead satellite positioning. AI cross-checks ephemeris drift and timing residuals.",
  "Signal Jamming": "Broadband RF interference suppressing legitimate downlink. Model detected SNR collapse exceeding 3σ.",
  "Command Injection": "Unauthorized command pattern detected on uplink channel. Signature does not match operator key schedule.",
  "Telemetry Anomaly": "Subsystem telemetry deviates from learned baseline behavior. Likely sensor drift or covert manipulation.",
  "Data Manipulation": "Downlinked payload checksum mismatch. Possible in-flight tampering or storage corruption.",
  "Signal Hijacking": "Carrier wave overridden by external transmitter mimicking legitimate uplink schedule.",
};

// MITRE ATT&CK mapping (ICS / Enterprise) per threat class.
const MITRE: Record<ThreatType, string> = {
  "GPS Spoofing":      "ATT&CK · T1587",
  "Signal Jamming":    "ATT&CK · T0814",
  "Command Injection": "ATT&CK · T0859",
  "Telemetry Anomaly": "Custom Space Threat",
  "Data Manipulation": "ATT&CK · T1565",
  "Signal Hijacking":  "ATT&CK · T1656",
};

const GROUND_STATIONS = ["ISTRAC Bengaluru", "DSN Madrid", "White Sands"] as const;
function groundStationFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GROUND_STATIONS[h % GROUND_STATIONS.length];
}

const SPOOFING_SIGNATURES = [
  { id: "SIG-GPS-014", name: "GNSS L1 carrier mimic",       source: "MITRE / CSpO",  first: "2024-11", hits: 38, severity: "high" },
  { id: "SIG-GPS-027", name: "Ephemeris drift injector",    source: "ESA SatCERT",   first: "2025-02", hits: 21, severity: "critical" },
  { id: "SIG-GPS-031", name: "Doppler-shift replay",        source: "NASA SCaN",     first: "2025-04", hits: 17, severity: "medium" },
  { id: "SIG-GPS-044", name: "PRN code spoof — Block IIF",  source: "USSF SDA",      first: "2025-08", hits: 9,  severity: "high" },
  { id: "SIG-GPS-052", name: "Time-of-week desync",         source: "ISRO ISTRAC",   first: "2026-01", hits: 5,  severity: "medium" },
];

function computeLiveTrust() {
  return SATELLITES.map((s) => ({ sat: s, ...computeTrust(synthSample(s), s) }));
}

function Threats() {
  const [sel, setSel] = useState<ThreatType>("GPS Spoofing");
  const [liveTrust, setLiveTrust] = useState(() => computeLiveTrust());
  const [tick, setTick] = useState(0);
  const [incident, setIncident] = useState<Incident | null>(() => getCurrentIncident());

  // Refresh Threat Engine every 5 seconds: confidence, trust score, event
  // counts, and timeline derivatives all recompute from fresh telemetry.
  useEffect(() => {
    const id = setInterval(() => {
      setLiveTrust(computeLiveTrust());
      setTick((t) => t + 1);
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  // Single source of truth: subscribe to the incident store and re-render.
  useEffect(() => subscribeCurrentIncident((i) => setIncident(i)), []);

  // Overlay the active incident on the live trust readout for its satellite.
  const trustWithIncident = liveTrust.map((r) => {
    if (!incident || incident.satellite.id !== r.satelliteId) return r;
    const state =
      incident.trustScore >= 85 ? ("normal" as const)
      : incident.trustScore >= 60 ? ("suspicious" as const)
      : ("compromised" as const);
    const incidentThreat = {
      type: incident.attackType as ThreatType,
      confidence: incident.confidence,
      severity: incident.confidence >= 85 ? ("critical" as const) : ("high" as const),
      target: incident.satellite.name,
      reasons: [`Simulated ${incident.attackType}`, incident.message],
    };
    return { ...r, trustScore: incident.trustScore, state, threats: [incidentThreat, ...r.threats] };
  });

  const liveDetections = trustWithIncident.flatMap((r) =>
    r.threats.map((t, i) => ({
      id: `LIVE-${r.satelliteId}-${i}`,
      type: t.type,
      satellite: r.sat.name,
      severity: t.severity,
      confidence: t.confidence,
      reasons: t.reasons,
      trustScore: r.trustScore,
      state: r.state,
    })),
  );

  // Per-vector live event counts derived from current detections.
  const eventCounts: Record<string, number> = {};
  for (const d of liveDetections) eventCounts[d.type] = (eventCounts[d.type] ?? 0) + 1;
  void tick; // referenced so React knows we depend on the interval

  // Top-confidence detection for the currently selected vector (drives pills).
  const selDetections = liveDetections.filter((d) => d.type === sel);
  const selTop = selDetections.reduce<typeof selDetections[number] | null>(
    (best, d) => (!best || d.confidence > best.confidence ? d : best),
    null,
  );
  const selConfidence = selTop?.confidence ?? 0;
  const selAffected = selDetections.length;
  const selStation = selTop ? groundStationFor(selTop.satellite) : groundStationFor(sel);


  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">AI Models · Intelligence · Forensics</div>
        <h1 className="font-display text-3xl glow-text">Threat Detection Engine</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Attack Profile" subtitle="6-vector signature radar">
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={RADAR_DIM}>
                <PolarGrid stroke="color-mix(in oklab, var(--primary) 30%, transparent)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Attack Categories" subtitle="Tap a vector to inspect">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {THREAT_TYPES.map((t) => (
              <button key={t} onClick={() => setSel(t)}
                className={`group rounded-md border p-3 text-left transition ${sel === t ? "border-primary bg-primary/10 glow-border" : "border-border/60 hover:bg-secondary/40"}`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <span className="text-sm">{t}</span>
                </div>
                <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  events: {eventCounts[t] ?? 0}
                </div>
              </button>
            ))}
          </div>

          <motion.div key={sel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-md border border-border/60 bg-secondary/30 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
                <Brain className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Explainable AI · {sel}</div>
                <p className="mt-1 text-sm leading-relaxed">{EXPLAIN[sel]}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Pill k="Confidence" v={`${selConfidence}%`} />
                  <Pill k="Impact" v="High" />
                  <Pill k="Affected" v={`${selAffected} system${selAffected === 1 ? "" : "s"}`} />
                  <Pill k="MITRE" v={MITRE[sel]} />
                  <Pill k="Ground Station" v={selStation} />
                </div>
              </div>
            </div>
          </motion.div>
        </Panel>
      </div>

      <Panel title="Satellite Trust Score" subtitle="Per-asset trust computed by the threat engine">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trustWithIncident.map((r) => {
            const tone = r.state === "normal" ? "var(--success)" : r.state === "suspicious" ? "var(--warning)" : "var(--destructive)";
            return (
              <div key={r.satelliteId} className="rounded-md border border-border/60 bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-display text-sm truncate">{r.sat.name}</div>
                  <span className="rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest"
                    style={{ background: `color-mix(in oklab, ${tone} 22%, transparent)`, color: tone }}>{r.state}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-3xl" style={{ color: tone }}>{r.trustScore}</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">/ 100</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/60">
                  <div className="h-full rounded-full" style={{ width: `${r.trustScore}%`, background: tone, boxShadow: `0 0 10px ${tone}` }} />
                </div>
                <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {r.threats.length} active threat{r.threats.length === 1 ? "" : "s"}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Recent Detections" subtitle="Explainable-AI threat engine · live trust scoring">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Event</th><th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Satellite</th><th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Confidence</th><th className="px-2 py-2">Trust</th>
                <th className="px-2 py-2">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {liveDetections.slice(0, 8).map((t) => (
                <tr key={t.id} className="border-t border-border/40 align-top">
                  <td className="px-2 py-2 font-mono text-xs">{t.id}</td>
                  <td className="px-2 py-2">{t.type}</td>
                  <td className="px-2 py-2">{t.satellite}</td>
                  <td className="px-2 py-2"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-2 py-2 font-mono text-xs">{t.confidence}%</td>
                  <td className="px-2 py-2 font-mono text-xs">{t.trustScore}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {t.reasons.map((r, i) => <div key={i}>✓ {r}</div>)}
                  </td>
                </tr>
              ))}
              {INITIAL_THREATS.slice(0, 4).map((t) => (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="px-2 py-2 font-mono text-xs">{t.id}</td>
                  <td className="px-2 py-2">{t.type}</td>
                  <td className="px-2 py-2">{t.satellite}</td>
                  <td className="px-2 py-2"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-2 py-2 font-mono text-xs">{t.confidence}%</td>
                  <td className="px-2 py-2 font-mono text-xs">—</td>
                  <td className="px-2 py-2 text-xs uppercase text-muted-foreground">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Historical Spoofing Signatures" subtitle="Curated GNSS/RF signature database">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-2 py-2">ID</th><th>Signature</th><th>Source</th><th>First Seen</th><th>Hits</th><th>Severity</th></tr>
            </thead>
            <tbody>
              {SPOOFING_SIGNATURES.map((s) => (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="px-2 py-2 font-mono text-xs"><Radio className="mr-1 inline h-3 w-3 text-primary" />{s.id}</td>
                  <td className="px-2 py-2">{s.name}</td>
                  <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{s.source}</td>
                  <td className="px-2 py-2 font-mono text-xs">{s.first}</td>
                  <td className="px-2 py-2 font-mono text-xs">{s.hits}</td>
                  <td className="px-2 py-2"><SeverityBadge severity={s.severity as any} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Incident Timeline" subtitle="Last 72 hours · forensic chain of events">
        <ol className="relative ml-3 space-y-6 border-l border-border/60 pl-6">
          {incident && (
            <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
              <span className="absolute -left-[7px] grid h-3.5 w-3.5 place-items-center rounded-full bg-primary glow-border" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">T-now</span>
                <span className="font-display text-sm">{incident.attackType}</span>
                <SeverityBadge severity={incident.confidence >= 85 ? "critical" : "high"} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">· {incident.satellite.name}</span>
              </div>
              <div className="mt-2 rounded-md border border-border/60 bg-secondary/30 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{incident.message} (trust impact -{incident.trustImpact}, status {incident.mitigationStatus})</span>
              </div>
            </motion.li>
          )}
          {ATTACK_TIMELINE.map((e, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <span className="absolute -left-[7px] grid h-3.5 w-3.5 place-items-center rounded-full bg-primary glow-border" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{e.time}</span>
                <span className="font-display text-sm">{e.type}</span>
                <SeverityBadge severity={e.severity} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">· {e.sat}</span>
              </div>
              <div className="mt-2 rounded-md border border-border/60 bg-secondary/30 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{e.outcome}</span>
              </div>
            </motion.li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function Pill({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded border border-border/60 bg-background/40 px-2 py-1 font-mono">
      <span className="text-muted-foreground">{k}</span> <span className="text-foreground">{v}</span>
    </span>
  );
}
