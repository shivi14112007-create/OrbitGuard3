import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/Panel";
import { FileText, Download, Maximize2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DataCitadelSafe } from "@/components/DataCitadelSafe";
import { generateIncidentReport } from "@/lib/reports.functions";
import { getSelectedSatellite } from "@/lib/selected-satellite";
import { getCurrentIncident } from "@/lib/incident-store";
import { readIncidentHistory } from "@/lib/agent-bridge";
import { useCitadelMetrics } from "@/lib/citadel-metrics";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — OrbitGuard" }] }),
  component: Reports,
});

type ReportKind = "executive" | "incident" | "intel";

const REPORTS: { name: string; kind: ReportKind; desc: string; size: string }[] = [
  { name: "Executive Summary",            kind: "executive",  desc: "Weekly mission posture briefing for command staff.", size: "1.2 MB" },
  { name: "Incident Report — Sentinel-4", kind: "incident",   desc: "Full forensic timeline, IOCs, mitigations.",        size: "3.4 MB" },
  { name: "Threat Intelligence Digest",   kind: "intel",      desc: "Adversary TTPs and prediction confidence.",          size: "2.1 MB" },
];


function Reports() {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const generate = useServerFn(generateIncidentReport);
  const citadel = useCitadelMetrics();

  async function download(kind: ReportKind, name: string) {
    setBusy(kind);
    try {
      const incident = getCurrentIncident() ?? undefined;
      const history = readIncidentHistory();
      const target = incident?.satellite.name ?? getSelectedSatellite().name;
      const res = await generate({ data: { kind, satelliteName: target, incident, history } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${name} generated`, { description: `${(res.bytes / 1024).toFixed(1)} KB · ArmorIQ-audited` });
    } catch (err) {
      toast.error(`Report failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Deliverables</div>
        <h1 className="font-display text-3xl glow-text">Reports & Analytics</h1>
      </header>

      <Panel
        title="Holographic Data Citadel"
        subtitle="3D metric towers · orbit to inspect · scroll to zoom"
        className="overflow-hidden"
      >
        <div className={`relative w-full overflow-hidden rounded-lg border border-primary/20 bg-[#02030a] ${expanded ? "h-[78vh]" : "h-[420px] sm:h-[480px] lg:h-[540px]"}`}>
          <DataCitadelSafe />
          <div className="pointer-events-none absolute left-3 top-3 rounded border border-primary/30 bg-background/55 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-primary/80 backdrop-blur">
            CITADEL · {citadel.metrics.length} TOWERS LIVE · {citadel.threatLabel}
          </div>
          <div className="pointer-events-none absolute right-3 top-3 rounded border border-accent/30 bg-background/55 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-accent backdrop-blur">
            HOLO-SYNC · 60Hz
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-background/70 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary backdrop-blur hover:bg-primary/15"
          >
            <Maximize2 className="h-3 w-3" /> {expanded ? "Compact" : "Expand"}
          </button>
        </div>
      </Panel>

      <Panel title="Available Reports">
        <div className="grid gap-3 md:grid-cols-2">
          {REPORTS.map((r) => (
            <div key={r.name} className="flex items-start gap-3 rounded-md border border-border/60 bg-secondary/30 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-display text-sm">{r.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{r.desc}</div>
                <div className="mt-2 text-[10px] font-mono text-muted-foreground">{r.size} · PDF / TXT</div>
              </div>
              <button disabled={busy === r.kind} onClick={() => download(r.kind, r.name)} className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60">
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
