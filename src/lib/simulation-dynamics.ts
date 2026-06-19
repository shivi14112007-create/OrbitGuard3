// Dynamic simulation generator — produces randomized but rule-bound
// outcomes for each Digital Twin run. Pure, deterministic-per-call.

export type SimOutcome = "neutralized" | "partial" | "persists";

export interface SimResult {
  scenario: string;
  confidence: number;     // 45..99
  responseTimeSec: number; // 2..15 (one decimal)
  trustDecrease: number;  // per-scenario band
  outcome: SimOutcome;
  message: string;        // ✓ / ⚠ / ✗ formatted line
}

const TRUST_BANDS: Record<string, [number, number]> = {
  "GPS Spoofing":      [15, 35],
  "Signal Jamming":    [10, 25],
  "Command Injection": [30, 60],
  "Telemetry Anomaly": [5, 20],
  "Data Manipulation": [25, 50],
  "Signal Hijacking":  [20, 45],
};

function randInt(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
function randFloat(lo: number, hi: number, decimals = 1) {
  const v = Math.random() * (hi - lo) + lo;
  const m = 10 ** decimals;
  return Math.round(v * m) / m;
}

export function generateSimResult(scenario: string): SimResult {
  const confidence = randInt(45, 99);
  const responseTimeSec = randFloat(2, 15, 1);
  const [lo, hi] = TRUST_BANDS[scenario] ?? [10, 30];
  const trustDecrease = randInt(lo, hi);

  let outcome: SimOutcome;
  let glyph: string;
  let verb: string;
  if (confidence > 85) {
    outcome = "neutralized";
    glyph = "✓";
    verb = "neutralized";
  } else if (confidence >= 60) {
    outcome = "partial";
    glyph = "⚠";
    verb = "partially mitigated";
  } else {
    outcome = "persists";
    glyph = "✗";
    verb = `still active after`;
  }

  const message =
    outcome === "persists"
      ? `${glyph} ${scenario} ${verb} ${responseTimeSec}s with ${confidence}% confidence.`
      : `${glyph} ${scenario} ${verb} in ${responseTimeSec}s with ${confidence}% confidence.`;

  return { scenario, confidence, responseTimeSec, trustDecrease, outcome, message };
}
