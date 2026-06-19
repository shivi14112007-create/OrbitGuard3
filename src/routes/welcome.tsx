import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldCheck, Radar, ArrowRight, Cpu, Palette, Rocket, Satellite, Brain, Globe2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { SpaceSceneSafe } from "@/components/SpaceSceneSafe";
import { useThemeStore, themes, type Theme } from "@/lib/theme-store";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "OrbitGuard — Autonomous AI Defense for Space" },
      { name: "description", content: "OrbitGuard is an autonomous AI defense platform protecting satellites, signals and space assets from cyber threats." },
      { property: "og:title", content: "OrbitGuard — Autonomous Space Defense" },
      { property: "og:description", content: "AI-powered cyber defense for satellite constellations." },
    ],
  }),
  component: Welcome,
});

function ThemePicker() {
  const { theme, setTheme, hydrate } = useThemeStore();
  const [open, setOpen] = useState(false);
  useEffect(() => { hydrate(); }, [hydrate]);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-background/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary backdrop-blur hover:bg-primary/15"
        aria-label="Change theme"
      >
        <Palette className="h-3.5 w-3.5" /> Theme
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id as Theme); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-primary/10 ${theme === t.id ? "bg-primary/15 text-primary" : "text-foreground"}`}
            >
              <span className="font-mono uppercase tracking-widest">{t.label}</span>
              <span className="flex gap-1">
                {t.swatch.map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full border border-border/60" style={{ background: c }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
} as const;

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay }}
      variants={FADE_UP}
    >
      {children}
    </motion.div>
  );
}

function Welcome() {
  const navigate = useNavigate();

  function handleLaunch() {
    navigate({ to: "/" });
  }

  const features = [
    { icon: Radar, title: "Signal Intel", body: "Continuous RF spectrum scanning detects spoofing, jamming and anomalous uplinks across every band." },
    { icon: ShieldCheck, title: "AI Defense Mesh", body: "Autonomous agents quarantine compromised links in milliseconds — long before a human operator could react." },
    { icon: Cpu, title: "Digital Twin Sim", body: "Run live attack simulations against a mirrored constellation to harden posture without touching real assets." },
    { icon: Brain, title: "Predictive Models", body: "Composite risk scores forecast threat windows 24h ahead with rolling 7-day model confidence." },
    { icon: Globe2, title: "Ground Link Ops", body: "Unified visibility across every ground station, with bandwidth, latency and posture in one pane." },
    { icon: Zap, title: "Rapid Response", body: "One-click cipher rotation, orbital handoff and defensive maneuvers wired into the command center." },
  ];

  const stats = [
    { v: "8", l: "Linked Satellites" },
    { v: "98.6%", l: "AI Action Success" },
    { v: "<12ms", l: "Threat Quarantine" },
    { v: "24/7", l: "Autonomous Ops" },
  ];

  return (
    <div className="relative min-h-screen bg-[#02030a] text-foreground">
      {/* Fixed 3D scene background */}
      <div className="fixed inset-0 z-0">
        <SpaceSceneSafe />
      </div>
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,3,10,0.55) 0%, rgba(2,3,10,0.35) 30%, rgba(2,3,10,0.7) 100%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-2 font-display tracking-[0.3em] text-primary glow-text">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary pulse-glow" />
          <span className="truncate">ORBITGUARD</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full pulse-glow" style={{ background: "var(--success)" }} />
            Operational
          </div>
          <ThemePicker />
        </div>
      </header>

      {/* Scrollable content */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* HERO */}
        <section className="flex min-h-[calc(100vh-96px)] flex-col items-center justify-center py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-primary backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full pulse-glow bg-primary" />
            Mission ORBITGUARD-α · Live
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="mt-6 font-display text-5xl leading-tight tracking-[0.18em] glow-text sm:text-6xl lg:text-7xl"
          >
            ORBITGUARD
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.35em] text-primary/80 sm:text-xs"
          >
            Autonomous AI Defense · Satellites · Signals · Space
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-6 max-w-2xl text-sm leading-relaxed text-foreground/85 sm:text-base"
          >
            A NASA-grade space command center powered by autonomous AI agents —
            detecting, predicting and neutralizing cyber threats across orbital
            infrastructure in real time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-10 flex flex-col items-center gap-2 text-[10px] font-mono uppercase tracking-[0.35em] text-muted-foreground"
          >
            <span>Scroll to explore</span>
            <motion.span
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="h-6 w-px bg-primary/60"
            />
          </motion.div>
        </section>

        {/* OVERVIEW */}
        <section className="py-20">
          <Reveal className="mx-auto max-w-3xl text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/80">01 · Overview</div>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-wider glow-text sm:text-4xl">
              A unified command center for the orbital frontier
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-foreground/80 sm:text-base">
              OrbitGuard fuses live telemetry, signal intelligence and autonomous AI
              response into a single mission console. Every satellite, every ground
              link, every threat — observed, scored and neutralized in real time.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.l} delay={i * 0.08}>
                <div className="rounded-xl border border-primary/20 bg-background/60 p-5 text-center backdrop-blur">
                  <div className="font-display text-3xl text-primary glow-text">{s.v}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CAPABILITIES */}
        <section className="py-20">
          <Reveal className="mx-auto max-w-3xl text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/80">02 · Capabilities</div>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-wider glow-text sm:text-4xl">
              Six systems. One autonomous shield.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={(i % 3) * 0.1}>
                <div className="group h-full rounded-2xl border border-primary/20 bg-background/60 p-6 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-primary/60">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 font-display text-lg tracking-wider">{title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20">
          <Reveal className="mx-auto max-w-3xl text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/80">03 · How it works</div>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-wider glow-text sm:text-4xl">
              From signal to response — autonomously.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Observe", b: "Continuous RF + telemetry ingest across the constellation." },
              { n: "02", t: "Decide", b: "AI models score risk, confidence and predicted attack windows." },
              { n: "03", t: "Act", b: "Quarantine, rotate cipher, hand off orbit — all in milliseconds." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.12}>
                <div className="relative h-full rounded-2xl border border-primary/20 bg-background/60 p-6 backdrop-blur-xl">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Step {s.n}</div>
                  <div className="mt-2 font-display text-xl tracking-wider">{s.t}</div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75">{s.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* LAUNCH CTA */}
        <section className="py-24">
          <Reveal>
            <div className="mx-auto max-w-3xl rounded-3xl border border-primary/30 bg-background/70 p-10 text-center backdrop-blur-xl">
              <Satellite className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-4 font-display text-3xl leading-tight tracking-wider glow-text sm:text-4xl">
                Ready for launch?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground/80 sm:text-base">
                Enter the live command center and take control of the orbital fleet.
              </p>

              <button
                type="button"
                onClick={handleLaunch}
                className="group mt-8 inline-flex items-center gap-3 rounded-full border border-primary/60 bg-primary/20 px-8 py-4 font-mono text-sm uppercase tracking-[0.3em] text-primary glow-border transition-all hover:bg-primary/30 hover:scale-[1.02]"
              >
                <Rocket className="h-5 w-5" />
                Click to Start
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Opens the live launch &amp; command console
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="pb-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          ORBITGUARD-α · Autonomous Defense Network
        </footer>
      </main>
    </div>
  );
}
