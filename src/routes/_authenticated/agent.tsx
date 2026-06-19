import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Volume2, User } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Panel } from "@/components/Panel";
import { askSecurityAgent } from "@/lib/agent.functions";
import { subscribeAgentBridge, subscribeAgentBridgeClear, readIncidentHistory } from "@/lib/agent-bridge";
import { getCurrentIncident, subscribeCurrentIncident } from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/agent")({
  head: () => ({ meta: [{ title: "AI Security Agent — OrbitGuard" }] }),
  component: Agent,
});

type Msg = { role: "user" | "ai"; text: string; t: number; kind?: "simulation" | "defense" | "chat" };

const SUGGESTIONS = [
  "What happened in the last incident?",
  "Why was Sentinel-4 flagged?",
  "Suggest mitigation for GPS spoofing.",
  "Generate an incident report.",
];

function Agent() {
  const ask = useServerFn(askSecurityAgent);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "OrbitGuard Copilot online. I can analyze incidents, explain anomalies, suggest mitigations, or generate reports.", t: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  // Show only the latest mission analysis (one active simulation) + defense
  // explanations. Past simulations are not replayed.
  useEffect(() => {
    const inc = getCurrentIncident();
    const sim = readIncidentHistory().find((h) => h.kind === "simulation");
    if (sim && (!inc || Math.abs(sim.t - inc.timestamp) < 60_000)) {
      setMessages((m) => [...m, { role: "ai", text: sim.text, t: sim.t, kind: "simulation" }]);
    }
    const offBridge = subscribeAgentBridge((evt) => {
      setMessages((m) => {
        // Simulation events replace any prior simulation analysis.
        const base = evt.kind === "simulation" ? m.filter((x) => x.kind !== "simulation") : m;
        return [...base, { role: "ai", text: evt.text, t: evt.t, kind: evt.kind }];
      });
    });
    const offClear = subscribeAgentBridgeClear((kind) => {
      setMessages((m) => m.filter((x) => x.kind !== kind));
    });
    const offInc = subscribeCurrentIncident((i) => {
      if (!i) setMessages((m) => m.filter((x) => x.kind !== "simulation"));
    });
    return () => { offBridge(); offClear(); offInc(); };
  }, []);

  async function send(q?: string) {
    const text = (q ?? input).trim();
    if (!text || thinking) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", text, t: Date.now() }];
    setMessages(next);
    setThinking(true);
    try {
      const history = next.map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));
      const res = await ask({ data: { messages: history } });
      setMessages((m) => [...m, { role: "ai", text: res.text, t: Date.now() }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: `Agent error: ${(err as Error).message}`, t: Date.now() }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Mission Copilot</div>
        <h1 className="font-display text-3xl glow-text">AI Security Agent</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Conversation" subtitle="Context: last 24h fleet telemetry">
          <div className="flex h-[480px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                    {m.role === "ai" && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"><Bot className="h-4 w-4" /></div>}
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border/60 bg-secondary/40"}`}>
                      {m.text}
                    </div>
                    {m.role === "user" && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary"><User className="h-4 w-4" /></div>}
                  </motion.div>
                ))}
                {thinking && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary"><Bot className="h-4 w-4" /></div>
                    <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm">
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary blink" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary blink" style={{ animationDelay: "0.2s" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary blink" style={{ animationDelay: "0.4s" }} />
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={endRef} />
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask the copilot…"
                className="flex-1 rounded-md border border-border bg-input/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button onClick={() => send()} className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Quick Prompts">
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="w-full rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-left text-sm hover:bg-secondary/60">
                  {s}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Voice Assistant">
            <button
              onClick={async () => {
                const utter = typeof window !== "undefined" && "speechSynthesis" in window
                  ? new SpeechSynthesisUtterance("")
                  : null;
                const q = "Analyze the latest threat.";
                await send(q);
                if (utter) {
                  const last = messages[messages.length - 1];
                  utter.text = (last?.text ?? "Analyzing").replace(/\n+/g, ". ");
                  utter.lang = "en-US";
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(utter);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-sm font-mono uppercase tracking-widest text-primary hover:bg-primary/20"
            >
              <Volume2 className="h-4 w-4" /> Analyze Threat
            </button>
            <p className="mt-2 text-xs text-muted-foreground">Tap to vocalize a mission-control briefing.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
