import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { type ActivityEventType, type ActivitySource, calculateFallbackPoints } from "@/lib/activityScoring";
import { appendRewardEvent, rewardBalance, type RewardSource } from "@/lib/rewardLedger";

interface ActivityInput {
  eventType: ActivityEventType;
  source: ActivitySource;
  idempotencyKey: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  referenceId?: string;
  durationMinutes?: number;
  amount?: number;
  label: string;
  rewardSource: Exclude<RewardSource, "unlock">;
}

interface ActivityResult {
  eventId: string;
  duplicate: boolean;
  awardedPoints: number;
  balance: number;
  xp: number;
  level: number;
  usedLocalFallback: boolean;
}

type ActivityRpcResult = {
  event_id?: string;
  duplicate?: boolean;
  awarded_points?: number;
  balance?: number;
  xp?: number;
  level?: number;
};

type ActivityClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

interface SpendInput {
  idempotencyKey: string;
  points: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export function useActivityEvents() {
  const { user } = useAuth();

  const reportActivity = useCallback(async (input: ActivityInput): Promise<ActivityResult> => {
    const fallbackPoints = calculateFallbackPoints(input.eventType, input.durationMinutes, input.amount);
    const localFallback = (): ActivityResult => {
      const added = fallbackPoints > 0 && appendRewardEvent({
        id: input.idempotencyKey,
        source: input.rewardSource,
        points: fallbackPoints,
        label: input.label,
        createdAt: input.occurredAt || new Date().toISOString(),
      });
      return { eventId: input.idempotencyKey, duplicate: !added, awardedPoints: added ? fallbackPoints : 0, balance: 0, xp: 0, level: 1, usedLocalFallback: true };
    };

    if (!user) return localFallback();
    const client = supabase as unknown as ActivityClient;
    const { data, error } = await client.rpc("record_tabro_activity", {
      p_event_type: input.eventType,
      p_source: input.source,
      p_idempotency_key: input.idempotencyKey,
      p_occurred_at: input.occurredAt || new Date().toISOString(),
      p_metadata: input.metadata || {},
      p_reference_id: input.referenceId || null,
      p_duration_minutes: input.durationMinutes ?? null,
      p_amount: input.amount ?? null,
    });
    if (error) return localFallback();

    const result = (data || {}) as ActivityRpcResult;
    const awardedPoints = Math.max(0, Number(result.awarded_points) || 0);
    if (awardedPoints > 0) appendRewardEvent({
      id: input.idempotencyKey,
      source: input.rewardSource,
      points: awardedPoints,
      label: input.label,
      createdAt: input.occurredAt || new Date().toISOString(),
    });
    return {
      eventId: result.event_id || input.idempotencyKey,
      duplicate: Boolean(result.duplicate),
      awardedPoints,
      balance: Number(result.balance) || 0,
      xp: Number(result.xp) || 0,
      level: Number(result.level) || 1,
      usedLocalFallback: false,
    };
  }, [user]);

  const spendRewardPoints = useCallback(async (input: SpendInput): Promise<boolean> => {
    const points = Math.max(1, Math.round(input.points));
    const localSpend = () => {
      if (rewardBalance() < points) return false;
      return appendRewardEvent({
        id: input.idempotencyKey,
        source: "unlock",
        points: -points,
        label: input.reason,
        createdAt: new Date().toISOString(),
      });
    };
    if (!user) return localSpend();
    const client = supabase as unknown as ActivityClient;
    const { data, error } = await client.rpc("spend_tabro_reward_points", {
      p_idempotency_key: input.idempotencyKey,
      p_points: points,
      p_reason: input.reason,
      p_metadata: input.metadata || {},
    });
    if (error) return localSpend();
    const result = (data || {}) as { duplicate?: boolean; spent_points?: number };
    if (result.duplicate || Number(result.spent_points) <= 0) return false;
    appendRewardEvent({ id: input.idempotencyKey, source: "unlock", points: -points, label: input.reason, createdAt: new Date().toISOString() });
    return true;
  }, [user]);

  return { reportActivity, spendRewardPoints };
}
