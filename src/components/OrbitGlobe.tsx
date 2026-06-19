import { motion } from "framer-motion";
import { SATELLITES, GROUND_STATIONS } from "@/lib/mock-data";

// Equirectangular projection -> svg coords (viewBox 0 0 720 360)
const proj = (lat: number, lon: number) => ({
  x: ((lon + 180) / 360) * 720,
  y: ((90 - lat) / 180) * 360,
});

export function OrbitGlobe() {
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg cyber-grid">
      <svg viewBox="0 0 720 360" className="absolute inset-0 h-full w-full">
        {/* Grid latitudes */}
        {[60, 120, 180, 240, 300].map((y) => (
          <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="color-mix(in oklab, var(--primary) 18%, transparent)" strokeDasharray="2 6" />
        ))}
        {[120, 240, 360, 480, 600].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="360" stroke="color-mix(in oklab, var(--primary) 18%, transparent)" strokeDasharray="2 6" />
        ))}
        {/* Simplified continents — soft blobs for vibe */}
        <g fill="color-mix(in oklab, var(--primary) 22%, transparent)" stroke="color-mix(in oklab, var(--primary) 60%, transparent)" strokeWidth="0.5">
          <path d="M120,90 Q170,70 200,100 Q230,130 200,170 Q150,200 110,170 Q90,130 120,90 Z" />
          <path d="M340,80 Q420,60 480,100 Q520,140 500,180 Q440,210 380,180 Q330,140 340,80 Z" />
          <path d="M540,90 Q600,80 640,110 Q660,150 620,180 Q580,180 540,150 Z" />
          <path d="M380,220 Q430,210 450,260 Q420,310 380,290 Q360,260 380,220 Z" />
          <path d="M170,220 Q220,210 240,260 Q220,310 180,290 Q150,260 170,220 Z" />
          <path d="M580,250 Q620,240 640,280 Q620,310 580,300 Z" />
        </g>

        {/* Ground stations */}
        {GROUND_STATIONS.map((g) => {
          const { x, y } = proj(g.lat, g.lon);
          return (
            <g key={g.id}>
              <circle cx={x} cy={y} r="4" fill="var(--accent)" />
              <circle cx={x} cy={y} r="10" fill="none" stroke="var(--accent)" strokeOpacity="0.5" className="blink" />
              <text x={x + 8} y={y - 6} fontSize="8" fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">{g.name}</text>
            </g>
          );
        })}

        {/* Orbit arcs + satellites */}
        {SATELLITES.map((s, i) => {
          const { x, y } = proj(s.lat, s.lon);
          const color = s.security === "lockdown" ? "var(--destructive)" :
                        s.security === "alert" ? "var(--warning)" : "var(--success)";
          return (
            <g key={s.id}>
              <ellipse cx="360" cy="180" rx={200 + i * 18} ry={80 + i * 8} fill="none"
                stroke="color-mix(in oklab, var(--primary) 25%, transparent)" strokeWidth="0.7" strokeDasharray="3 5" />
              <circle cx={x} cy={y} r="3.5" fill={color} />
              <circle cx={x} cy={y} r="8" fill="none" stroke={color} strokeOpacity="0.6" className="blink" />
              <text x={x + 8} y={y + 12} fontSize="8" fill="var(--foreground)" fontFamily="ui-monospace, monospace">{s.name}</text>
            </g>
          );
        })}

        {/* Attack lines */}
        {SATELLITES.filter((s) => s.security !== "secure").map((s) => {
          const { x, y } = proj(s.lat, s.lon);
          const g = GROUND_STATIONS[s.name.charCodeAt(0) % GROUND_STATIONS.length];
          const { x: gx, y: gy } = proj(g.lat, g.lon);
          return (
            <line key={s.id + "-atk"} x1={gx} y1={gy} x2={x} y2={y}
              stroke="var(--destructive)" strokeOpacity="0.7" strokeWidth="1" strokeDasharray="4 4">
              <animate attributeName="stroke-dashoffset" from="0" to="16" dur="1s" repeatCount="indefinite" />
            </line>
          );
        })}
      </svg>

      {/* Radar sweep overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
      >
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--primary)" }} />
      </motion.div>
    </div>
  );
}
