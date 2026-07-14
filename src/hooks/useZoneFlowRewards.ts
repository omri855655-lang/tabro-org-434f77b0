import { useCallback, useEffect, useMemo, useState } from "react";

import { safeLocalStorage } from "@/lib/safeLocalStorage";

export type ZoneFlowRewardSource = "focus" | "book" | "journey" | "achievement" | "challenge" | "unlock";

export interface ZoneFlowRewardEvent {
  id: string;
  source: ZoneFlowRewardSource;
  points: number;
  label: string;
  createdAt: string;
}

const STORAGE_KEY = "zoneflow-reward-ledger-v1";
const CHANGE_EVENT = "zoneflow-rewards-changed";

const readLedger = () => {
  const value = safeLocalStorage.getJSON<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ZoneFlowRewardEvent => Boolean(
    item && typeof item === "object" && typeof (item as ZoneFlowRewardEvent).id === "string"
      && typeof (item as ZoneFlowRewardEvent).points === "number",
  ));
};

const writeLedger = (events: ZoneFlowRewardEvent[]) => {
  safeLocalStorage.setJSON(STORAGE_KEY, events.slice(-500));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export function useZoneFlowRewards() {
  const [events, setEvents] = useState<ZoneFlowRewardEvent[]>(readLedger);

  useEffect(() => {
    const refresh = () => setEvents(readLedger());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const balance = useMemo(() => Math.max(0, events.reduce((sum, event) => sum + event.points, 0)), [events]);

  const award = useCallback((id: string, source: Exclude<ZoneFlowRewardSource, "unlock">, points: number, label: string) => {
    const ledger = readLedger();
    if (ledger.some((event) => event.id === id)) return false;
    const event: ZoneFlowRewardEvent = { id, source, points: Math.max(1, Math.round(points)), label, createdAt: new Date().toISOString() };
    writeLedger([...ledger, event]);
    return true;
  }, []);

  const spend = useCallback((id: string, points: number, label: string) => {
    const ledger = readLedger();
    const amount = Math.max(1, Math.round(points));
    const currentBalance = Math.max(0, ledger.reduce((sum, event) => sum + event.points, 0));
    if (ledger.some((event) => event.id === id) || currentBalance < amount) return false;
    writeLedger([...ledger, { id, source: "unlock", points: -amount, label, createdAt: new Date().toISOString() }]);
    return true;
  }, []);

  return { events, balance, award, spend };
}
