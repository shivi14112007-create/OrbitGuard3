import { motion } from "framer-motion";
import { type ReactNode } from "react";

export function Panel({
  title, subtitle, action, children, className = "",
}: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-xl glass p-4 md:p-5 ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-display text-sm uppercase tracking-widest text-foreground">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-muted-foreground font-mono">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}

export function StatCard({
  label, value, sub, accent, icon,
}: { label: string; value: ReactNode; sub?: string; accent?: "primary" | "success" | "warning" | "destructive"; icon?: ReactNode }) {
  const color = accent ? `var(--${accent === "primary" ? "primary" : accent})` : "var(--primary)";
  return (
    <div className="relative overflow-hidden rounded-xl glass p-4">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-40" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-3xl glow-text" style={{ color }}>{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {icon && <div className="rounded-md p-2" style={{ background: `color-mix(in oklab, ${color} 20%, transparent)`, color }}>{icon}</div>}
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: "critical" | "high" | "medium" | "low" }) {
  const map = {
    critical: { bg: "var(--destructive)", fg: "var(--destructive-foreground)" },
    high:     { bg: "var(--warning)",     fg: "#1a1a1a" },
    medium:   { bg: "var(--accent)",      fg: "var(--accent-foreground)" },
    low:      { bg: "var(--muted)",       fg: "var(--muted-foreground)" },
  }[severity];
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest" style={{ background: `color-mix(in oklab, ${map.bg} 30%, transparent)`, color: map.bg, border: `1px solid color-mix(in oklab, ${map.bg} 60%, transparent)` }}>
      {severity}
    </span>
  );
}
