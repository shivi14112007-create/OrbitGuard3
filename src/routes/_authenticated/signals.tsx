import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { Panel } from "@/components/Panel";
import { SATELLITES } from "@/lib/mock-data";
import { motion } from "framer-motion";
import { AlertTriangle, Radio } from "lucide-react";
import {
  getCurrentIncident,
  subscribeCurrentIncident,
  type Incident,
} from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({ meta: [{ title: "Signal Monitor — OrbitGuard" }, { name: "description", content: "Live waveform and spectrum analysis of satellite communications." }] }),
  component: Signals,
});

// ── Spectrum bands: 32 bins spanning 1.20–2.75 GHz (step 0.05 GHz). ───────
const SPECTRUM_BINS = 32;
const SPECTRUM_START = 1.2;
const SPECTRUM_STEP = 0.05;
function freqAt(i: number) { return SPECTRUM_START + i * SPECTRUM_STEP; }
function bandLabel(i: number) { return `${freqAt(i).toFixed(2)} GHz`; }
function binNear(ghz: number) {
  return Math.max(0, Math.min(SPECTRUM_BINS - 1, Math.round((ghz - SPECTRUM_START) / SPECTRUM_STEP)));
}

type SpecPoint = { band: string; power: number };
type WavePoint = { t: number; v: number };

function spectrumFor(attack: string | undefined, tick: number): SpecPoint[] {
  return Array.from({ length: SPECTRUM_BINS }, (_, i) => {
    const f = freqAt(i);
    let power = 18 + Math.sin(i * 0.6 + tick * 0.05) * 4 + Math.random() * 6;
    switch (attack) {
      case "GPS Spoofing": {
        // sharp spike near 1.575 GHz (GPS L1)
        const d = Math.abs(f - 1.575);
        power += 75 * Math.exp(-(d * d) / 0.0008) + Math.random() * 4;
        break;
      }
      case "Signal Jamming": {
        // broadband noise across the entire 1.2–2.8 GHz span
        power += 45 + Math.random() * 25;
        break;
      }
      case "Signal Hijacking": {
        // narrow carrier peak at a deterministic in-band frequency (~2.4 GHz)
        const carrier = 2.4;
        const d = Math.abs(f - carrier);
        power += 80 * Math.exp(-(d * d) / 0.0004);
        break;
      }
      case "Telemetry Anomaly": {
        // intermittent bursts — random bins flare every few ticks
        if (((i * 7 + tick) % 11) === 0) power += 35 + Math.random() * 20;
        break;
      }
      case "Command Injection": {
        // uplink band perturbation around 2.05 GHz
        const d = Math.abs(f - 2.05);
        power += 40 * Math.exp(-(d * d) / 0.002);
        break;
      }
      case "Data Manipulation": {
        // mild noise floor lift
        power += 12 + Math.random() * 6;
        break;
      }
      default:
        break;
    }
    return { band: bandLabel(i), power: Math.round(Math.max(5, Math.min(120, power))) };
  });
}

function nextWaveSample(prevT: number, attack: string | undefined): WavePoint {
  const t = prevT + 1;
  let v = Math.sin(t / 4) * 35 + Math.sin(t / 9) * 12;
  switch (attack) {
    case "GPS Spoofing":
      // spoof beat tone overlaid on carrier
      v += Math.sin(t / 1.7) * 25 + (Math.random() > 0.85 ? 35 : 0);
      break;
    case "Signal Jamming":
      // heavy broadband noise
      v += (Math.random() - 0.5) * 110;
      break;
    case "Signal Hijacking":
      // dominant unauthorised narrow carrier
      v = Math.sin(t / 2.2) * 70 + (Math.random() - 0.5) * 8;
      break;
    case "Telemetry Anomaly":
      // mostly quiet with intermittent spikes
      v += Math.random() > 0.9 ? (Math.random() * 90 - 45) : (Math.random() - 0.5) * 6;
      break;
    case "Command Injection":
      v += (Math.random() > 0.8 ? 55 : 0);
      break;
    case "Data Manipulation":
      v += (Math.random() - 0.5) * 20;
      break;
    default:
      v += (Math.random() - 0.5) * 8;
  }
  return { t, v: Math.round(v * 10) / 10 };
}

function seedWave(attack: string | undefined): WavePoint[] {
  let prev = 0;
  const arr: WavePoint[] = [];
  for (let i = 0; i < 80; i++) {
    const s = nextWaveSample(prev, attack);
    arr.push(s);
    prev = s.t;
  }
  return arr;
}

function rssiFor(satName: string, attack: string | undefined, attackedSat?: string) {
  const base = 55 + ((satName.charCodeAt(satName.length - 1) * 7) % 35);
  if (attackedSat && satName === attackedSat) {
    if (attack === "Signal Jamming") return Math.max(15, base - 35);
    if (attack === "Signal Hijacking") return Math.max(20, base - 25);
    if (attack === "GPS Spoofing") return Math.max(30, base - 15);
    if (attack === "Telemetry Anomaly") return Math.max(35, base - 10);
    return Math.max(25, base - 20);
  }
  return base;
}

function Signals() {
  const [incident, setIncident] = useState<Incident | null>(() => getCurrentIncident());
  useEffect(() => subscribeCurrentIncident(setIncident), []);
  const attack = incident?.mitigationStatus !== "neutralized" ? incident?.attackType : undefined;
  const attackedSat = incident?.mitigationStatus !== "neutralized" ? incident?.satellite.name : undefined;

  const [wave, setWave] = useState<WavePoint[]>(() => seedWave(attack));
  const [tick, setTick] = useState(0);

  // Reseed waveform whenever the active attack changes so the trace reflects
  // the new threat immediately instead of bleeding old samples through.
  useEffect(() => { setWave(seedWave(attack)); }, [attack]);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
      setWave((w) => w.slice(1).concat(nextWaveSample(w[w.length - 1].t, attack)));
    }, 250);
    return () => clearInterval(id);
  }, [attack]);

  const spectrum = useMemo(() => spectrumFor(attack, tick), [attack, tick]);
  const anomaly = !!attack || wave.some((p) => Math.abs(p.v) > 80);
  const downlinkSat = attackedSat ?? "Helios-1";

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Realtime</div>
        <h1 className="font-display text-3xl glow-text">Live Signal Monitoring</h1>
      </header>

      <Panel title="Waveform" subtitle={`L-Band downlink · ${downlinkSat}${attack ? ` · ${attack}` : ""}`}
        action={anomaly && (
          <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-md border border-destructive/50 bg-destructive/15 px-2 py-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Interference detected
          </motion.span>
        )}
      >
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={wave}>
              <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Spectrum Analyzer" subtitle="1.2–2.8 GHz">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={spectrum}>
                <XAxis dataKey="band" stroke="var(--muted-foreground)" fontSize={9} interval={3} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="power" radius={[4, 4, 0, 0]}>
                  {spectrum.map((s, i) => (
                    <Cell key={i} fill={s.power > 80 ? "var(--destructive)" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Signal Strength" subtitle="Per satellite RSSI">
          <ul className="space-y-3">
            {SATELLITES.slice(0, 6).map((s) => {
              const rssi = rssiFor(s.name, attack, attackedSat);
              return (
                <li key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-primary" /> {s.name}</span>
                    <span className="text-muted-foreground">{rssi} dBm</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
                    <div className="h-full rounded-full" style={{ width: `${rssi}%`, background: rssi < 55 ? "var(--destructive)" : "var(--primary)" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
