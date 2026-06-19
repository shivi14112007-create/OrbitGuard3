import { create } from "zustand";

export type Theme = "cosmic" | "nebula" | "solar" | "deep" | "void";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  hydrate: () => void;
}

export const themes: { id: Theme; label: string; swatch: string[] }[] = [
  { id: "cosmic", label: "Cosmic Blue", swatch: ["#0b1a3a", "#22d3ee", "#3b82f6"] },
  { id: "nebula", label: "Nebula Purple", swatch: ["#2a0a3a", "#c026d3", "#ec4899"] },
  { id: "solar", label: "Solar Gold", swatch: ["#0f0a05", "#f97316", "#fbbf24"] },
  { id: "deep", label: "Deep Space", swatch: ["#020807", "#10b981", "#34d399"] },
  { id: "void", label: "Void B&W", swatch: ["#050505", "#9ca3af", "#e5e7eb"] },
];

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "cosmic",
  setTheme: (t) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem("orbitguard-theme", t); } catch {}
    }
    set({ theme: t });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const saved = (localStorage.getItem("orbitguard-theme") as Theme) || "cosmic";
      document.documentElement.setAttribute("data-theme", saved);
      set({ theme: saved });
    } catch {
      document.documentElement.setAttribute("data-theme", "cosmic");
    }
  },
}));
