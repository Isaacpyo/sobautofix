"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { VehicleSession } from "@/types/domain";

const emptySession: VehicleSession = { vehicle: null };
const storageKey = "sob-autofix-vehicle-session";
const changeEvent = "sob-autofix-vehicle-session-change";

type ContextValue = {
  session: VehicleSession;
  updateSession: (next: Partial<VehicleSession>) => void;
  clearVehicle: () => void;
};

const VehicleContext = createContext<ContextValue | null>(null);

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changeEvent, callback); };
}

function getSnapshot() { return window.sessionStorage.getItem(storageKey) || ""; }
function getServerSnapshot() { return ""; }

function parseSession(value: string): VehicleSession {
  if (!value) return emptySession;
  try { return JSON.parse(value) as VehicleSession; } catch { return emptySession; }
}

export function VehicleSessionProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = useMemo(() => parseSession(stored), [stored]);

  const updateSession = useCallback((next: Partial<VehicleSession>) => {
    const merged = { ...parseSession(window.sessionStorage.getItem(storageKey) || ""), ...next };
    window.sessionStorage.setItem(storageKey, JSON.stringify(merged));
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  const clearVehicle = useCallback(() => {
    window.sessionStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  const value = useMemo(() => ({ session, updateSession, clearVehicle }), [session, updateSession, clearVehicle]);
  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicleSession() {
  const value = useContext(VehicleContext);
  if (!value) throw new Error("useVehicleSession must be used inside VehicleSessionProvider");
  return value;
}
