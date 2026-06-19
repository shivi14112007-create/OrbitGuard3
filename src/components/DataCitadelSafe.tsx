import { Component, type ReactNode, Suspense, lazy } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

const DataCitadel3D = lazy(() =>
  import("./DataCitadel3D").then((m) => ({ default: m.DataCitadel3D })),
);

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#02030a] text-primary">
      <Loader2 className="h-8 w-8 animate-spin" />
      <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        Compiling holographic citadel…
      </div>
    </div>
  );
}

function StaticFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#02030a]">
      <div className="grid h-28 w-28 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
        <AlertTriangle className="h-6 w-6" />
      </div>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.warn("[DataCitadel] failed:", err); }
  render() {
    if (this.state.hasError) return <StaticFallback />;
    return this.props.children;
  }
}

export function DataCitadelSafe() {
  return (
    <Boundary>
      <Suspense fallback={<LoadingFallback />}>
        <DataCitadel3D />
      </Suspense>
    </Boundary>
  );
}
