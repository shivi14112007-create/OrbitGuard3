import { Component, type ReactNode, Suspense, lazy } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

const SpaceScene = lazy(() =>
  import("./SpaceScene").then((m) => ({ default: m.SpaceScene })),
);

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#02030a] text-primary">
      <Loader2 className="h-8 w-8 animate-spin" />
      <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        Initializing orbital telemetry…
      </div>
    </div>
  );
}

function StaticFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#02030a]">
      <div className="starfield" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 50%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 grid h-40 w-40 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-primary/10 backdrop-blur">
        <AlertTriangle className="h-6 w-6 text-primary" />
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        3D scene unavailable · fallback view active
      </div>
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[SpaceScene] failed to initialize:", err);
  }
  render() {
    if (this.state.hasError) return <StaticFallback />;
    return this.props.children;
  }
}

export function SpaceSceneSafe() {
  return (
    <SceneErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <SpaceScene />
      </Suspense>
    </SceneErrorBoundary>
  );
}
