import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, Radar, ShieldAlert, Bot, Cpu, FlaskConical,
  FileText, Satellite, Zap, Palette, Check,
  PanelLeftClose, PanelLeftOpen, Menu, X,
} from "lucide-react";
import { useThemeStore, themes, type Theme } from "@/lib/theme-store";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { to: "/",          label: "Command Center",     icon: Activity },
  { to: "/signals",   label: "Signal Monitor",     icon: Radar },
  { to: "/threats",   label: "Threat Engine",      icon: ShieldAlert },
  { to: "/agent",     label: "AI Agent",           icon: Bot },
  { to: "/defense",   label: "Autonomous Defense", icon: Cpu },
  { to: "/simulator", label: "Digital Twin",       icon: FlaskConical },
  { to: "/reports",   label: "Reports",            icon: FileText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, setTheme, hydrate } = useThemeStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="starfield" />
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass border-b">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-4 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/50 hover:bg-secondary/80 transition"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary/50 hover:bg-secondary/80 transition"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg glow-border" style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}>
              <Satellite className="h-5 w-5 text-primary" />
              <span className="absolute inset-0 rounded-lg pulse-glow" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-base sm:text-lg tracking-widest glow-text truncate">ORBITGUARD</div>
              <div className="hidden sm:block text-[10px] font-mono uppercase text-muted-foreground truncate">Autonomous Space Defense</div>
            </div>
          </Link>

          <div className="ml-2 hidden min-w-0 items-center gap-2 rounded-full glass px-3 py-1 text-xs font-mono xl:flex">
            <span className="h-2 w-2 shrink-0 rounded-full pulse-glow" style={{ background: "var(--success)" }} />
            <span className="text-muted-foreground">SYSTEM</span>
            <span>OPERATIONAL</span>
            <span className="mx-2 h-3 w-px bg-border" />
            <span className="text-muted-foreground">UTC</span>
            <ClockUTC />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeSwitcher theme={theme} onSelect={setTheme} />
            <button
              className="hidden lg:flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-destructive hover:bg-destructive/20 transition"
              onClick={() => alert("Emergency Defense Mode activated — All satellites locked down.")}
            >
              <Zap className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Emergency Mode</span><span className="xl:hidden">SOS</span>
            </button>
          </div>
        </div>
      </header>


      {/* Mobile overlay drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 w-72 glass border-r border-border/60 md:hidden flex flex-col"
            >
              <div className="flex h-16 items-center justify-between px-4 border-b border-border/60">
                <div className="font-display tracking-widest glow-text">ORBITGUARD</div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-md border border-border bg-secondary/50"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto flex flex-col gap-1 p-3">
                {NAV.map((n) => {
                  const active = pathname === n.to;
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                        active
                          ? "bg-primary/15 text-foreground glow-border"
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-mono uppercase tracking-wider text-xs">{n.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 border-r border-border/60 glass md:block transition-[width] duration-300 ease-in-out ${collapsed ? "w-16" : "w-60"}`}>
          <nav className="flex flex-col gap-1 p-3">
            {NAV.map((n) => {
              const active = pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  title={collapsed ? n.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? "bg-primary/15 text-foreground glow-border"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="font-mono uppercase tracking-wider text-xs whitespace-nowrap overflow-hidden">{n.label}</span>
                  )}
                  {active && (
                    <motion.span
                      layoutId="active-pill"
                      className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-primary"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          {!collapsed && (
            <div className="mx-3 mt-4 rounded-md border border-border/60 p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Mission</div>
              <div className="mt-1 text-sm">ORBITGUARD-α</div>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full pulse-glow" style={{ background: "var(--success)" }} />
                8 satellites linked
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>

      </div>
    </div>
  );
}

function ClockUTC() {
  const [mounted, setMounted] = useState(false);
  const [t, setT] = useState<string>("--:--:--");
  useEffect(() => {
    setMounted(true);
    const tick = () => setT(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{mounted ? t : "--:--:--"}</span>;
}

function ThemeSwitcher({ theme, onSelect }: { theme: Theme; onSelect: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-mono uppercase hover:bg-secondary/80"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Theme</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg glass glow-border p-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => { onSelect(t.id); setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-secondary/60"
              >
                <div className="flex h-6 w-12 overflow-hidden rounded">
                  {t.swatch.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}
                </div>
                <div className="flex-1 text-sm">{t.label}</div>
                {theme === t.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
