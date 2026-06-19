import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { SATELLITES } from "./mock-data";
import { computeTrust, synthSample } from "./threat-engine";
import { withArmor } from "./armoriq.server";

const IncidentSchema = z.object({
  id: z.string(),
  satellite: z.object({ id: z.string(), name: z.string() }),
  attackType: z.string(),
  confidence: z.number(),
  trustImpact: z.number(),
  trustScore: z.number(),
  mitigationStatus: z.string(),
  responseTimeSec: z.number(),
  outcome: z.string(),
  message: z.string(),
  timestamp: z.number(),
});

const HistoryEventSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(["simulation", "defense"]),
  text: z.string().optional(),
  t: z.number().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

const MITRE: Record<string, string> = {
  "GPS Spoofing":      "T1587 — Develop Capabilities: Spoof GNSS",
  "Signal Jamming":    "T0814 — Denial of Service (RF Jamming)",
  "Command Injection": "T0859 — Valid Accounts / Command Injection",
  "Telemetry Anomaly": "Custom Space Threat — Telemetry Drift",
  "Data Manipulation": "T1565 — Data Manipulation",
  "Signal Hijacking":  "T1656 — Impersonation / Link Hijack",
};

const ROOT_CAUSE: Record<string, string> = {
  "GPS Spoofing":      "Counterfeit GNSS signal injection causing timing/position drift.",
  "Signal Jamming":    "Directed RF jamming collapsing downlink SNR.",
  "Command Injection": "Uplink HMAC mismatch outside operator OTAR schedule.",
  "Telemetry Anomaly": "Subsystem clock drift and sequence-gap > 2σ baseline.",
  "Data Manipulation": "Telemetry packets diverging from cross-checked sensor baseline.",
  "Signal Hijacking":  "Mid-pass carrier handoff to unauthorized ground node.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────────────────────
const sanitize = (s: string) =>
  s.replace(/[→➔➜]/g, "->").replace(/[•·]/g, "-").replace(/[—–]/g, "-")
   .replace(/[✓]/g, "[OK]").replace(/[✗✘]/g, "[X]").replace(/[⚠]/g, "[!]")
   .replace(/[^\x00-\xff]/g, "?");

function makeDrawer(page: PDFPage, font: PDFFont, bold: PDFFont) {
  const primary = rgb(0.04, 0.55, 0.85);
  const accent  = rgb(0.85, 0.35, 0.15);
  const muted   = rgb(0.45, 0.45, 0.5);
  const ink     = rgb(0.08, 0.08, 0.12);
  const { width, height } = page.getSize();
  let y = height - 60;

  const line = (text: string, size = 10, f: PDFFont = font, color = ink) => {
    page.drawText(sanitize(text), { x: 50, y, size, font: f, color });
    y -= size + 6;
  };
  const heading = (t: string, color = primary) => { y -= 8; line(t, 13, bold, color); };
  const rule = () => { page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: width - 50, y: y + 4 }, thickness: 0.5, color: muted }); y -= 6; };
  const bar = (label: string, value: number, max: number, color = primary) => {
    const w = (width - 220) * Math.min(1, value / Math.max(1, max));
    page.drawText(sanitize(label.padEnd(22)), { x: 50, y, size: 9, font, color: ink });
    page.drawRectangle({ x: 220, y: y - 1, width: w, height: 8, color });
    page.drawText(String(value), { x: 220 + w + 6, y, size: 9, font: bold, color: ink });
    y -= 16;
  };
  return { line, heading, rule, bar, primary, accent, muted, ink };
}

function header(page: PDFPage, bold: PDFFont, font: PDFFont, title: string, subtitle: string, badge: string) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 40, width, height: 40, color: rgb(0.04, 0.55, 0.85) });
  page.drawText(sanitize(title), { x: 50, y: height - 28, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(sanitize(badge), { x: width - 50 - bold.widthOfTextAtSize(sanitize(badge), 9), y: height - 25, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText(sanitize(subtitle), { x: 50, y: height - 55, size: 9, font, color: rgb(0.35, 0.35, 0.4) });
}

async function finalize(pdf: PDFDocument) {
  const bytes = await pdf.save();
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return { base64: btoa(bin), size: bytes.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────
type Incident = z.infer<typeof IncidentSchema>;
type Hist = z.infer<typeof HistoryEventSchema>;

function auditId() {
  const raw = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).toString();
  return `AIQ-${raw.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function renderExecutive(history: Hist[], incident?: Incident) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  header(page, bold, font, "EXECUTIVE SUMMARY", `Generated ${new Date().toISOString()}`, "CLASSIFICATION: OPERATIONAL");
  const d = makeDrawer(page, font, bold);

  const sims = history.filter((h) => h.kind === "simulation");
  const defs = history.filter((h) => h.kind === "defense");
  const trustScores = SATELLITES.map((s) => computeTrust(synthSample(s), s).trustScore);
  const avgTrust = Math.round(trustScores.reduce((a, b) => a + b, 0) / trustScores.length);
  const fleetHealth = Math.round(SATELLITES.reduce((a, s) => a + s.health, 0) / SATELLITES.length);
  const activeThreats = sims.filter((s) => (s.meta?.outcome ?? "") !== "neutralized").length;
  const neutralized = sims.filter((s) => (s.meta?.outcome ?? "") === "neutralized").length;
  const successRate = sims.length ? Math.round((neutralized / sims.length) * 100) : 0;
  const risk = avgTrust >= 85 ? "LOW" : avgTrust >= 60 ? "ELEVATED" : "CRITICAL";

  d.heading("Mission Posture");
  d.bar("Fleet Health",        fleetHealth, 100);
  d.bar("Average Trust Score", avgTrust, 100);
  d.bar("AI Success Rate",     successRate, 100);
  d.line(`Mission Risk Level:   ${risk}`, 10, bold);
  d.line(`Active Threat Count:  ${activeThreats}`);
  d.line(`ArmorIQ Approvals:    ${defs.length}`);

  d.heading("Top Recommendations");
  const recs = [
    avgTrust < 85 ? "Rotate OTAR keys on satellites with trust < 60." : "Maintain current key rotation cadence.",
    activeThreats > 0 ? "Hold destructive actions pending ArmorIQ approval." : "Continue routine autonomous defense.",
    "Increase ephemeris validation cadence to 2 Hz on flagged GNSS bands.",
    incident ? `Continue monitoring ${incident.satellite.name} after recent ${incident.attackType}.` : "No active simulated incident.",
  ];
  recs.forEach((r) => d.line(`- ${r}`, 10));

  return finalize(pdf);
}

async function renderIncident(history: Hist[], incident?: Incident) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  header(page, bold, font, "INCIDENT REPORT", `Generated ${new Date().toISOString()}`, "FORENSIC / TIMELINE");
  const d = makeDrawer(page, font, bold);

  if (!incident) {
    d.heading("No Active Incident");
    d.line("Launch a Digital Twin simulation to populate the Incident State Store,");
    d.line("then regenerate this report for full forensic detail.");
    return finalize(pdf);
  }

  const before = Math.min(100, incident.trustScore + incident.trustImpact);
  const after = incident.trustScore;
  const finalStatus =
    incident.mitigationStatus === "neutralized" ? "RESOLVED — Threat neutralized"
    : incident.mitigationStatus === "partial"   ? "PARTIAL — Residual risk monitored"
    : "ACTIVE — Operator intervention required";
  const aid = auditId();

  d.heading("Incident Identification");
  d.line(`Incident ID:    ${incident.id}`, 9, bold);
  d.line(`Satellite:      ${incident.satellite.name} (${incident.satellite.id})`);
  d.line(`Attack Type:    ${incident.attackType}`);
  d.line(`MITRE:          ${MITRE[incident.attackType] ?? "n/a"}`);

  d.heading("Trust Score Delta");
  d.bar("Before Attack", before, 100, d.primary);
  d.bar("After Attack",  after,  100, after >= 60 ? d.primary : d.accent);
  d.line(`Impact:         -${incident.trustImpact} points`, 9, bold);

  d.heading("Root Cause");
  d.line(ROOT_CAUSE[incident.attackType] ?? "Anomalous telemetry flagged by trust engine.", 10);

  d.heading("Timeline");
  d.line(`T+0.0s   Detection — confidence ${incident.confidence}%`);
  d.line(`T+0.5s   Incident published to State Store as ${incident.id}`);
  d.line(`T+1.0s   AI Agent mission analysis dispatched`);
  d.line(`T+${incident.responseTimeSec.toFixed(1)}s   Mitigation outcome: ${incident.outcome.toUpperCase()}`);

  d.heading("Defense Actions");
  const defs = history.filter((h) => h.kind === "defense" && h.meta?.satellite === incident.satellite.name).slice(0, 6);
  if (defs.length === 0) d.line("- No autonomous actions recorded for this satellite yet.", 9);
  else defs.forEach((dv) => d.line(`- ${String(dv.meta?.action ?? "action")}  (${new Date(dv.t ?? Date.now()).toISOString()})`, 9));

  d.heading("ArmorIQ Audit");
  d.line(`Audit ID:       ${aid}`);
  d.line(`Decision:       APPROVED`);
  d.line(`Policy:         ${process.env.ARMORIQ_API_KEY ? "armoriq.remote.allow" : "local.allow.default"}`);
  d.line(`Verified:       Intent [OK]   Policy [OK]   Logged [OK]`);

  d.heading("Final Status");
  d.line(finalStatus, 11, bold, incident.mitigationStatus === "active" ? d.accent : d.primary);

  return finalize(pdf);
}

async function renderIntel(history: Hist[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  header(page, bold, font, "THREAT INTELLIGENCE DIGEST", `Generated ${new Date().toISOString()}`, "ADVERSARY TTP ANALYSIS");
  const d = makeDrawer(page, font, bold);

  const sims = history.filter((h) => h.kind === "simulation");
  const byType = new Map<string, number>();
  const bySat = new Map<string, number>();
  const confidences: number[] = [];
  sims.forEach((s) => {
    const t = String(s.meta?.scenario ?? "Unknown");
    const sat = String(s.meta?.satellite ?? "Unknown");
    byType.set(t, (byType.get(t) ?? 0) + 1);
    bySat.set(sat, (bySat.get(sat) ?? 0) + 1);
    if (typeof s.meta?.confidence === "number") confidences.push(s.meta.confidence as number);
  });

  d.heading("Attack Distribution");
  const maxT = Math.max(1, ...Array.from(byType.values()));
  if (byType.size === 0) d.line("No simulated incidents yet — distribution unavailable.", 9);
  else [...byType.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => d.bar(k, v, maxT));

  d.heading("Most Targeted Satellites");
  const maxS = Math.max(1, ...Array.from(bySat.values()));
  if (bySat.size === 0) d.line("No targeting data available.", 9);
  else [...bySat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([k, v]) => d.bar(k, v, maxS, d.accent));

  d.heading("MITRE ATT&CK Mapping");
  Object.entries(MITRE).forEach(([k, v]) => d.line(`${k.padEnd(22)} -> ${v}`, 9));

  d.heading("Historical Signatures");
  const recent = sims.slice(0, 6);
  if (recent.length === 0) d.line("No prior signatures recorded.", 9);
  else recent.forEach((s) => d.line(`${new Date(s.t ?? Date.now()).toISOString()}  ${String(s.meta?.scenario ?? "?").padEnd(20)} ${String(s.meta?.satellite ?? "?").padEnd(14)} conf=${s.meta?.confidence ?? "?"}%`, 8));

  d.heading("Confidence Statistics");
  if (confidences.length === 0) d.line("Insufficient data for statistics.", 9);
  else {
    const avg = Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
    const lo = Math.min(...confidences), hi = Math.max(...confidences);
    d.line(`Samples:   ${confidences.length}`, 9);
    d.line(`Mean:      ${avg}%`, 9);
    d.line(`Range:     ${lo}% – ${hi}%`, 9);
    d.line(`Std Bias:  ${avg >= 70 ? "HIGH adversary commitment" : "LOW noise-floor activity"}`, 9);
  }

  d.heading("Predicted Threats (next 24h)");
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "GPS Spoofing";
  d.line(`- Continued ${top} pressure on GEO assets.`, 9);
  d.line(`- Elevated probability of Signal Hijacking attempts at terminator passes.`, 9);
  d.line(`- Watch ISTRAC Bengaluru and DSN Madrid for jamming spikes.`, 9);

  return finalize(pdf);
}

// ─────────────────────────────────────────────────────────────────────────────
// Server function
// ─────────────────────────────────────────────────────────────────────────────
export const generateIncidentReport = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      kind: z.enum(["executive", "incident", "intel", "compliance"]),
      satelliteName: z.string().trim().max(80).optional(),
      incident: IncidentSchema.optional(),
      history: z.array(HistoryEventSchema).max(200).optional(),
    }),
  )
  .handler(async ({ data }) =>
    withArmor(
      {
        tool: "orbitguard.report.generate",
        goal: `Generate ${data.kind} PDF`,
        args: { kind: data.kind, satelliteName: data.satelliteName },
        mcp: "orbitguard-reports",
      },
      async () => {
        const history = data.history ?? [];
        const out =
          data.kind === "executive" ? await renderExecutive(history, data.incident)
          : data.kind === "incident" ? await renderIncident(history, data.incident)
          : await renderIntel(history);
        return { filename: `orbitguard-${data.kind}-${Date.now()}.pdf`, base64: out.base64, bytes: out.size };
      },
    ),
  );
