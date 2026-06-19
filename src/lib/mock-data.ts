export type ThreatType =
  | "GPS Spoofing"
  | "Signal Jamming"
  | "Command Injection"
  | "Telemetry Anomaly"
  | "Data Manipulation"
  | "Signal Hijacking";

export type Severity = "critical" | "high" | "medium" | "low";

export interface Satellite {
  id: string;
  name: string;
  orbit: "LEO" | "MEO" | "GEO";
  health: number;
  power: number;
  temperature: number;
  security: "secure" | "alert" | "lockdown";
  lat: number;
  lon: number;
}

export interface ThreatEvent {
  id: string;
  type: ThreatType;
  severity: Severity;
  satellite: string;
  timestamp: number;
  status: "detected" | "mitigated" | "investigating";
  confidence: number;
}

export const SATELLITES: Satellite[] = [
  { id: "OG-101", name: "Helios-1",   orbit: "LEO", health: 96, power: 88, temperature: -12, security: "secure",   lat: 12,  lon: -45 },
  { id: "OG-102", name: "Aegis-2",    orbit: "LEO", health: 88, power: 76, temperature: -8,  security: "alert",    lat: -22, lon: 88 },
  { id: "OG-103", name: "Vanguard-3", orbit: "MEO", health: 94, power: 91, temperature: -15, security: "secure",   lat: 40,  lon: 12 },
  { id: "OG-104", name: "Sentinel-4", orbit: "GEO", health: 72, power: 64, temperature: -3,  security: "lockdown", lat: 8,   lon: 145 },
  { id: "OG-105", name: "Orion-5",    orbit: "LEO", health: 98, power: 94, temperature: -10, security: "secure",   lat: -34, lon: -60 },
  { id: "OG-106", name: "Atlas-6",    orbit: "MEO", health: 90, power: 82, temperature: -11, security: "secure",   lat: 55,  lon: 30 },
  { id: "OG-107", name: "Polaris-7",  orbit: "GEO", health: 84, power: 79, temperature: -6,  security: "alert",    lat: 0,   lon: -120 },
  { id: "OG-108", name: "Nova-8",     orbit: "LEO", health: 99, power: 96, temperature: -14, security: "secure",   lat: 28,  lon: 75 },
];

export const THREAT_TYPES: ThreatType[] = [
  "GPS Spoofing", "Signal Jamming", "Command Injection",
  "Telemetry Anomaly", "Data Manipulation", "Signal Hijacking",
];

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

// Seeded PRNG for deterministic SSR-safe mock data
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let counter = 1000;
const seedRng = seededRandom(42);

export function makeThreat(now = Date.now()): ThreatEvent {
  const sat = SATELLITES[Math.floor(Math.random() * SATELLITES.length)];
  return {
    id: `EV-${++counter}`,
    type: THREAT_TYPES[Math.floor(Math.random() * THREAT_TYPES.length)],
    severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
    satellite: sat.name,
    timestamp: now - Math.floor(Math.random() * 60_000),
    status: (["detected", "mitigated", "investigating"] as const)[Math.floor(Math.random() * 3)],
    confidence: 70 + Math.floor(Math.random() * 30),
  };
}

function makeDeterministicThreat(seedOffset: number): ThreatEvent {
  const sat = SATELLITES[Math.floor(seedRng() * SATELLITES.length)];
  return {
    id: `EV-${1001 + seedOffset}`,
    type: THREAT_TYPES[Math.floor(seedRng() * THREAT_TYPES.length)],
    severity: SEVERITIES[Math.floor(seedRng() * SEVERITIES.length)],
    satellite: sat.name,
    timestamp: Date.now() - Math.floor(seedRng() * 60_000),
    status: (["detected", "mitigated", "investigating"] as const)[Math.floor(seedRng() * 3)],
    confidence: 70 + Math.floor(seedRng() * 30),
  };
}

export const INITIAL_THREATS: ThreatEvent[] = Array.from({ length: 14 }, (_, i) => makeDeterministicThreat(i));

export const GROUND_STATIONS = [
  { id: "GS-NA", name: "Goldstone",   lat: 35,  lon: -116 },
  { id: "GS-EU", name: "Madrid",      lat: 40,  lon: -3 },
  { id: "GS-AS", name: "Canberra",    lat: -35, lon: 149 },
  { id: "GS-AF", name: "Hartebeesthoek", lat: -25, lon: 27 },
];

export const ATTACK_TIMELINE = [
  { time: "T-72h", type: "Signal Jamming",   sat: "Sentinel-4", outcome: "Mitigated by frequency hop", severity: "high" as Severity },
  { time: "T-58h", type: "GPS Spoofing",     sat: "Aegis-2",    outcome: "Channel isolated, encrypted relay", severity: "critical" as Severity },
  { time: "T-41h", type: "Command Injection", sat: "Polaris-7", outcome: "Command quarantined", severity: "high" as Severity },
  { time: "T-22h", type: "Telemetry Anomaly", sat: "Helios-1",  outcome: "AI-verified false positive", severity: "low" as Severity },
  { time: "T-09h", type: "Data Manipulation", sat: "Sentinel-4", outcome: "Rollback to checkpoint", severity: "critical" as Severity },
  { time: "T-02h", type: "Signal Hijacking", sat: "Vanguard-3", outcome: "Re-routing active", severity: "medium" as Severity },
];

export const PREDICTIVE_24H = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  risk: Math.round(30 + Math.sin(i / 3) * 18 + ((i * 7) % 13)),
  anomalies: Math.round(2 + Math.sin(i / 2) * 2 + ((i * 3) % 4)),
}));

export const PREDICTIVE_7D = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],
  spoofing: 5 + ((i * 11) % 12),
  jamming: 3 + ((i * 7) % 10),
  injection: 1 + ((i * 5) % 6),
}));

export const SIGNAL_WAVE = Array.from({ length: 80 }, (_, i) => ({
  t: i,
  v: Math.sin(i / 4) * 40 + Math.sin(i / 9) * 20 + (i > 50 && i < 60 ? ((i * 13) % 60) : ((i * 3) % 8)),
}));

export const SPECTRUM = Array.from({ length: 32 }, (_, i) => ({
  band: `${(1.2 + i * 0.05).toFixed(2)} GHz`,
  power: Math.round(20 + ((i * 17) % 60) + (i > 22 && i < 26 ? 30 : 0)),
}));

export const RADAR_DIM = [
  { metric: "Spoofing",   value: 78 },
  { metric: "Jamming",    value: 64 },
  { metric: "Injection",  value: 42 },
  { metric: "Telemetry",  value: 55 },
  { metric: "Hijacking",  value: 38 },
  { metric: "Manipulation", value: 70 },
];

export const AUTONOMOUS_ACTIONS = [
  { id: "AX-01", action: "Channel Isolation",    satellite: "Sentinel-4", time: "12s",  confidence: 98, status: "success" },
  { id: "AX-02", action: "Signal Re-routing",    satellite: "Vanguard-3", time: "8s",   confidence: 94, status: "success" },
  { id: "AX-03", action: "Emergency Encryption", satellite: "Aegis-2",    time: "21s",  confidence: 91, status: "success" },
  { id: "AX-04", action: "Satellite Lockdown",   satellite: "Sentinel-4", time: "4s",   confidence: 99, status: "success" },
  { id: "AX-05", action: "Beacon Re-sync",       satellite: "Polaris-7",  time: "16s",  confidence: 87, status: "pending" },
];

export const severityColor = (s: Severity) => ({
  critical: "var(--destructive)",
  high: "var(--warning)",
  medium: "var(--accent)",
  low: "var(--muted-foreground)",
}[s]);
