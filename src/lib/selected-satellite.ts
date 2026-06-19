// Shared selected-satellite store. Digital Twin writes the selection;
// Defense, Reports, and the AI Agent bridge read from it so every downstream
// action targets the satellite the operator picked.
import { SATELLITES, type Satellite } from "./mock-data";

const KEY = "orbitguard:selected-satellite";
const EVT = "orbitguard:selected-satellite";

export function getSelectedSatellite(): Satellite {
  if (typeof window !== "undefined") {
    try {
      const id = window.localStorage.getItem(KEY);
      const hit = id ? SATELLITES.find((s) => s.id === id) : undefined;
      if (hit) return hit;
    } catch { /* ignore */ }
  }
  return SATELLITES[0];
}

export function setSelectedSatellite(id: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, id); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent<string>(EVT, { detail: id }));
}

export function subscribeSelectedSatellite(cb: (s: Satellite) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getSelectedSatellite());
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
