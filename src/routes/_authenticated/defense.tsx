import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/Panel";
import { AUTONOMOUS_ACTIONS } from "@/lib/mock-data";
import { Shuffle, KeyRound, ShieldCheck, Zap, CheckCircle2, Clock, Radio, Lock, RotateCcw, Eye, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { executeCountermeasure } from "@/lib/defense.functions";
import { pushDefenseExplanation } from "@/lib/agent-bridge";
import { getSelectedSatellite } from "@/lib/selected-satellite";
import { getCurrentIncident, subscribeCurrentIncident, recommendedActionsFor, type Incident } from "@/lib/incident-store";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/defense")({
  head: () => ({ meta: [{ title: "Autonomous Defense — OrbitGuard" }] }),
  component: Defense,
});

type ActionName =
  | "Channel Isolation"
  | "Emergency Encryption"
  | "Signal Re-routing"
  | "Frequency Hopping"
  | "Lockdown Mode"
  | "Rollback Checkpoint"
  | "Human Review";

const CATALOG: Record<ActionName, { icon: typeof Shuffle; desc: string }> = {
  "Channel Isolation":    { icon: Shuffle,     desc: "Quarantine compromised RF channels and reroute traffic." },
  "Emergency Encryption": { icon: KeyRound,    desc: "Rotate OTAR keys and force AES-256 channel re-key." },
  "Signal Re-routing":    { icon: ShieldCheck, desc: "Fail over to alternate ground station with redundant path." },
  "Frequency Hopping":    { icon: Radio,       desc: "Engage spread-spectrum hop sequence to evade the jammer." },
  "Lockdown Mode":        { icon: Lock,        desc: "Halt command execution bus-wide pending operator triage." },
  "Rollback Checkpoint":  { icon: RotateCcw,   desc: "Restore last signed telemetry checkpoint." },
  "Human Review":         { icon: Eye,         desc: "Escalate ambiguous anomaly to operator review." },
};

function Defense() {
  const [running, setRunning] = useState<string | null>(null);
  const [incident, setIncident] = useState<Incident | null>(() => getCurrentIncident());
  const execute = useServerFn(executeCountermeasure);

  useEffect(() => subscribeCurrentIncident((i) => setIncident(i)), []);

  const targetName = incident?.satellite.name ?? getSelectedSatellite().name;
  const recommended = (incident
    ? recommendedActionsFor(incident.attackType)
    : []) as ActionName[];

  async function trigger(name: ActionName) {
    setRunning(name);
    try {
      const res = await execute({
        data: { action: name, satelliteName: targetName, reason: `Operator-initiated ${name} on ${targetName}` },
      });
      toast.success(`${res.action} applied to ${res.satellite}`, {
        description: `${res.approval} · Audit ${res.audit.id} · ${res.audit.decision.toUpperCase()}`,
      });
      pushDefenseExplanation(
        name,
        targetName,
        `Operator-initiated ${name} on ${targetName}${incident ? ` in response to ${incident.attackType}` : ""}`,
        res.audit,
      );
    } catch (err) {
      toast.error(`Blocked: ${(err as Error).message}`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Response Layer</div>
        <h1 className="font-display text-3xl glow-text">Autonomous Defense Center</h1>
      </header>

      {!incident && (
        <Panel title="Awaiting Incident" subtitle="Launch a Digital Twin simulation to populate countermeasures">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" />
            No active incident in the state store. Countermeasure recommendations are tailored to the current attack type.
          </div>
        </Panel>
      )}

      {incident && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {recommended.map((name) => {
            const meta = CATALOG[name];
            if (!meta) return null;
            const Icon = meta.icon;
            const active = running === name;
            return (
              <motion.button key={name} onClick={() => trigger(name)} whileHover={{ y: -2 }}
                className={`relative overflow-hidden rounded-xl glass p-4 text-left ${active ? "glow-border pulse-glow" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
                  <div className="font-display text-sm uppercase tracking-widest">{name}</div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{meta.desc}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{incident.attackType} · {incident.satellite.name}</span>
                  {active ? (
                    <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
                      <Zap className="h-3.5 w-3.5" /> running…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> ready</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <Panel title="Recent Autonomous Actions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-2 py-2">ID</th><th>Action</th><th>Satellite</th><th>Execution</th><th>Confidence</th><th>Status</th></tr>
            </thead>
            <tbody>
              {AUTONOMOUS_ACTIONS.map((a) => (
                <tr key={a.id} className="border-t border-border/40">
                  <td className="px-2 py-2 font-mono text-xs">{a.id}</td>
                  <td>{a.action}</td>
                  <td>{a.satellite}</td>
                  <td className="font-mono text-xs"><Clock className="mr-1 inline h-3 w-3 text-muted-foreground" />{a.time}</td>
                  <td className="font-mono text-xs">{a.confidence}%</td>
                  <td>
                    <span className="rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest"
                      style={{
                        background: a.status === "success" ? "color-mix(in oklab, var(--success) 25%, transparent)" : "color-mix(in oklab, var(--warning) 25%, transparent)",
                        color: a.status === "success" ? "var(--success)" : "var(--warning)",
                      }}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
