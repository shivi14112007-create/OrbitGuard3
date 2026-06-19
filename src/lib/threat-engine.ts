// Pure threat-engine — no IO. Used on server and client.
import type { Satellite, ThreatType, Severity } from "./mock-data";

export type TrustState = "normal" | "suspicious" | "compromised";

export interface ThreatReason {
  label: string;
  weight: number; // 0-1 contribution to the threat score
}

export interface DetectedThreat {
  type: ThreatType;
  confidence: number; // 0-100
  severity: Severity;
  target: string;
  reasons: string[];
}

export interface TelemetrySample {
  satelliteId: string;
  freqDeviationPct: number;     // |delta f| / f0 * 100
  timingDriftMs: number;        // packet timing drift
  packetLossPct: number;
  orbitalResidualKm: number;    // predicted vs observed
  unknownCommands: number;      // count in last window
  signalPowerDbm: number;
}

export interface TrustReport {
  satelliteId: string;
  trustScore: number;          // 0..100
  state: TrustState;
  factors: { label: string; score: number }[];
  threats: DetectedThreat[];
}

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

export function computeTrust(sample: TelemetrySample, sat: Satellite): TrustReport {
  const freqScore   = clamp(100 - sample.freqDeviationPct * 12);
  const timingScore = clamp(100 - Math.abs(sample.timingDriftMs) * 2);
  const orbitScore  = clamp(100 - sample.orbitalResidualKm * 8);
  const cmdScore    = clamp(100 - sample.unknownCommands * 25);
  const lossScore   = clamp(100 - sample.packetLossPct * 5);

  // Weighted trust score (telemetry baseline)
  let trustScore = Math.round(
    freqScore * 0.28 + timingScore * 0.22 + orbitScore * 0.22 +
    cmdScore * 0.18 + lossScore * 0.10,
  );

  const threats: DetectedThreat[] = [];

  if (sample.freqDeviationPct > 3) {
    threats.push({
      type: "GPS Spoofing",
      confidence: Math.round(60 + sample.freqDeviationPct * 4),
      severity: sample.freqDeviationPct > 6 ? "critical" : "high",
      target: sat.name,
      reasons: [
        `Frequency deviation ${sample.freqDeviationPct.toFixed(2)}% above baseline`,
        `Orbital residual ${sample.orbitalResidualKm.toFixed(2)} km vs predicted ephemeris`,
        sample.timingDriftMs > 4 ? `Timing drift ${sample.timingDriftMs.toFixed(1)} ms (PNT desync)` : "Carrier phase incoherent with star-tracker fix",
      ],
    });
  }
  if (sample.signalPowerDbm < -110 || sample.packetLossPct > 12) {
    threats.push({
      type: "Signal Jamming",
      confidence: Math.round(55 + sample.packetLossPct * 2),
      severity: sample.packetLossPct > 25 ? "critical" : "high",
      target: sat.name,
      reasons: [
        `Downlink RSSI ${sample.signalPowerDbm.toFixed(1)} dBm (SNR collapse)`,
        `Packet loss ${sample.packetLossPct.toFixed(1)}% over rolling 60 s`,
        "Broadband noise floor +14 dB above quiet baseline",
      ],
    });
  }
  if (sample.unknownCommands > 0) {
    threats.push({
      type: "Command Injection",
      confidence: Math.round(70 + sample.unknownCommands * 8),
      severity: sample.unknownCommands > 2 ? "critical" : "medium",
      target: sat.name,
      reasons: [
        `${sample.unknownCommands} command(s) outside operator key schedule`,
        "Uplink HMAC mismatch — adversary-mimicked authenticator",
        "No matching OTAR rotation window",
      ],
    });
  }
  if (Math.abs(sample.timingDriftMs) > 6 && sample.freqDeviationPct < 2) {
    threats.push({
      type: "Telemetry Anomaly",
      confidence: Math.round(50 + Math.abs(sample.timingDriftMs) * 3),
      severity: "medium",
      target: sat.name,
      reasons: [
        `Timing drift ${sample.timingDriftMs.toFixed(1)} ms across sequential packets`,
        "Subsystem clock drift exceeds 2σ baseline",
      ],
    });
  }

  // ─── Confidence-band trust clamp ────────────────────────────────────────
  // Confidence < 40% → Trust 85-100
  // Confidence 40-70% → Trust 60-85
  // Confidence > 70%  → Trust 20-60
  if (threats.length) {
    const topConf = Math.max(...threats.map((t) => t.confidence));
    const band: [number, number] =
      topConf < 40 ? [85, 100] : topConf <= 70 ? [60, 85] : [20, 60];
    trustScore = Math.round(Math.max(band[0], Math.min(band[1], trustScore)));

    // GPS Spoofing dynamic penalty based on confidence + affected systems.
    const spoof = threats.find((t) => t.type === "GPS Spoofing");
    if (spoof) {
      const affected =
        (sample.freqDeviationPct > 3 ? 1 : 0) +    // PNT
        (sample.orbitalResidualKm > 1 ? 1 : 0) +   // Orbit
        (Math.abs(sample.timingDriftMs) > 4 ? 1 : 0); // Timing
      const penalty = Math.round((spoof.confidence - 40) * 0.25 + affected * 5);
      trustScore = clamp(trustScore - Math.max(0, penalty), band[0] - 10, band[1]);
    }
    trustScore = clamp(trustScore);
  }

  // Trust → state thresholds:
  //   ≥ 85 NORMAL · 60–84 SUSPICIOUS · < 60 COMPROMISED
  const state: TrustState =
    trustScore >= 85 ? "normal" : trustScore >= 60 ? "suspicious" : "compromised";

  return {
    satelliteId: sample.satelliteId,
    trustScore,
    state,
    factors: [
      { label: "Frequency consistency", score: freqScore },
      { label: "Timing drift", score: timingScore },
      { label: "Orbital match", score: orbitScore },
      { label: "Command legitimacy", score: cmdScore },
      { label: "Packet integrity", score: lossScore },
    ],
    threats,
  };
}

// Deterministic synthetic telemetry seeded from satellite id + minute bucket.
// Lets the UI show realistic, slowly-evolving values that still occasionally spike.
export function synthSample(sat: Satellite, now = Date.now()): TelemetrySample {
  // 5-second bucket so the Threat Engine refresh tick produces fresh values.
  const bucket = Math.floor(now / 5_000);
  let s = (sat.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + bucket) >>> 0;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  const stress =
    sat.security === "lockdown" ? 1
    : sat.security === "alert" ? 0.5
    : 0.05;

  return {
    satelliteId: sat.id,
    freqDeviationPct: rng() * 1.2 + stress * (rng() * 6 + 2),
    timingDriftMs: (rng() - 0.5) * 3 + stress * (rng() * 8),
    packetLossPct: rng() * 3 + stress * rng() * 25,
    orbitalResidualKm: rng() * 0.4 + stress * rng() * 3,
    unknownCommands: stress > 0.4 && rng() > 0.55 ? Math.ceil(rng() * 3) : 0,
    signalPowerDbm: -85 - rng() * 10 - stress * 25,
  };
}
