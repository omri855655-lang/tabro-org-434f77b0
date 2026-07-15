import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { appendRewardEvent, readRewardLedger, REWARD_CHANGE_EVENT, rewardBalance, type RewardLedgerEvent, type RewardSource } from "@/lib/rewardLedger";

export type ZoneFlowRewardSource = RewardSource;
export type ZoneFlowRewardEvent = RewardLedgerEvent;

type RewardHistoryRow = {
  id: string;
  points: number;
  reason: string;
  created_at: string;
  tabro_activity_events?: { source?: string; event_type?: string; idempotency_key?: string } | null;
};

type RewardHistoryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        limit: (count: number) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

const historySource = (row: RewardHistoryRow): ZoneFlowRewardSource => {
  if (row.points < 0) return "unlock";
  const source = row.tabro_activity_events?.source;
  const eventType = row.tabro_activity_events?.event_type || "";
  if (source === "books") return "book";
  if (source === "challenges") return eventType === "achievement_unlocked" ? "achievement" : "challenge";
  if (source === "zoneflow_mind") return eventType === "achievement_unlocked" ? "achievement" : "journey";
  return "focus";
};

export function useZoneFlowRewards() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ZoneFlowRewardEvent[]>(readRewardLedger);

  useEffect(() => {
    const refresh = () => setEvents(readRewardLedger());
    window.addEventListener(REWARD_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(REWARD_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadServerHistory = async () => {
      const client = supabase as unknown as RewardHistoryClient;
      const { data, error } = await client.from("tabro_reward_ledger")
        .select("id,points,reason,created_at,tabro_activity_events(source,event_type,idempotency_key)")
        .order("created_at", { ascending: false }).limit(500);
      if (error || !Array.isArray(data)) return;
      [...data].reverse().forEach((value) => {
        const row = value as RewardHistoryRow;
        appendRewardEvent({
          id: row.tabro_activity_events?.idempotency_key || `server:${row.id}`,
          source: historySource(row),
          points: row.points,
          label: row.reason,
          createdAt: row.created_at,
        });
      });
    };
    void loadServerHistory();
  }, [user]);

  const balance = useMemo(() => rewardBalance(events), [events]);

  const award = useCallback((id: string, source: Exclude<ZoneFlowRewardSource, "unlock">, points: number, label: string) => {
    return appendRewardEvent({ id, source, points: Math.max(1, Math.round(points)), label, createdAt: new Date().toISOString() });
  }, []);

  const spend = useCallback((id: string, points: number, label: string) => {
    const ledger = readRewardLedger();
    const amount = Math.max(1, Math.round(points));
    const currentBalance = Math.max(0, ledger.reduce((sum, event) => sum + event.points, 0));
    if (ledger.some((event) => event.id === id) || currentBalance < amount) return false;
    return appendRewardEvent({ id, source: "unlock", points: -amount, label, createdAt: new Date().toISOString() });
  }, []);

  return { events, balance, award, spend };
}
