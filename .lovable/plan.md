## Goal

Keep the entire OrbitGuard UI (3D globe, holograms, glassmorphism, animations, sidebar, colors, fonts, spacing, layout) exactly as it is today. Only upgrade the data pipeline and agent intelligence so it behaves like a real SatSecOps console.

## What changes

### 1. NASA data layer (`src/lib/nasa.server.ts` + `nasa.functions.ts`)
- Server function `fetchSatellites()` calls NASA TLE API (`https://tle.ivanstanojevic.me/api/tle` — NASA-published TLE mirror, no key) and propagates positions with `satellite.js` (already orbital-math, pure JS, Worker-safe).
- Returns the same `Satellite` shape `mock-data.ts` exports (id, name, orbit class derived from mean motion, lat/lon, health/power/temperature synthesised from telemetry deltas) so existing components keep rendering unchanged.
- Second server fn `fetchMissionMeta(id)` hits NASA's `https://images-api.nasa.gov/search?q=<name>` for mission blurb used by Agent + Reports.
- 30 s React Query cache; positions refreshed client-side every 10 s via `useQuery`.

### 2. Signal + threat engine (`src/lib/threat-engine.ts`)
- Pure TS module. Given a satellite's recent samples (frequency, packet rate, timing), produces:
  - `trustScore` 0-100 (weighted: frequency consistency 30, timing drift 25, orbital match 25, command legitimacy 20)
  - `state`: normal | suspicious | compromised
  - `threats[]` with type, confidence, severity, target, and `reasons[]` (explainable-AI bullets)
- Drives the existing Signals, Threats, Defense, and Globe panels — no JSX changes, just swap their data source from static mock arrays to a `useLiveTelemetry()` hook that combines NASA positions + simulated RF samples seeded from real orbital data.

### 3. ArmorIQ countermeasures (`src/lib/armoriq.functions.ts`)
- New server fns `proposeMitigation`, `approveMitigation`, `executeMitigation` — each wrapped in the existing `withArmor()` (Track 1 + 2 compliant: capturePlan → enforce → report).
- Defense page's existing buttons call these instead of local state. Audit log panel reads from a new `armoriq_audit` table (RLS: owner read).

### 4. AI Security Agent (`src/lib/agent.functions.ts`)
- Server fn `askAgent({ messages, context })` using Lovable AI Gateway (`google/gemini-2.5-flash`, free during promo) with tools:
  - `get_satellite_status`, `get_recent_threats`, `explain_threat`, `recommend_mitigation`, `request_armoriq_approval`, `generate_incident_summary`.
- Existing Agent page chat UI stays; only the submit handler swaps to `useServerFn(askAgent)` + streaming via `toUIMessageStreamResponse`.

### 5. Reports (`src/lib/reports.functions.ts`)
- Server fn `generateIncidentReport(threatId)` builds a PDF (pdf-lib, Worker-safe) with Attack Summary, Severity, Trust Scores, ArmorIQ logs, Countermeasures, AI Recommendations. Returns base64; existing "Download" button triggers blob download.

### 6. Database (single migration)
- `armoriq_audit` (id, user_id, tool, decision, payload jsonb, created_at) — RLS owner read, service_role full, plus GRANTs.
- `incident_reports` (id, user_id, threat_id, pdf bytea, summary text, created_at) — same RLS pattern.

### 7. Secret
- Request `NASA_API_KEY` via `add_secret` (optional — TLE mirror needs none, but NASA images API benefits from one to lift rate limits).
- `ARMORIQ_API_KEY` already documented; prompt only if user wants live platform vs local fallback.

## What does NOT change
- Every file in `src/components/` (OrbitGlobe, DataCitadel3D, SpaceScene, Panel, all glassmorphism / hologram styles).
- `src/styles.css`, Tailwind tokens, fonts.
- Sidebar in `AppShell.tsx`.
- All route JSX bodies — only the data hooks they call get repointed.

## Open questions
1. Use the keyless NASA TLE mirror only, or also wire NASA's official `api.nasa.gov` (needs `NASA_API_KEY`) for mission imagery?
2. Run ArmorIQ in **local fallback** (no key, deny-destructive policy) or request `ARMORIQ_API_KEY` now for the full platform flow?
