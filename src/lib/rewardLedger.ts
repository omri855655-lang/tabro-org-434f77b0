import { safeLocalStorage } from "@/lib/safeLocalStorage";

export type RewardSource = "focus" | "book" | "journey" | "achievement" | "challenge" | "unlock";

export interface RewardLedgerEvent {
  id: string;
  source: RewardSource;
  points: number;
  label: string;
  createdAt: string;
}

export const REWARD_LEDGER_KEY = "zoneflow-reward-ledger-v1";
export const REWARD_CHANGE_EVENT = "zoneflow-rewards-changed";

export function readRewardLedger(): RewardLedgerEvent[] {
  const value = safeLocalStorage.getJSON<unknown>(REWARD_LEDGER_KEY, []);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RewardLedgerEvent => Boolean(
    item && typeof item === "object" && typeof (item as RewardLedgerEvent).id === "string"
      && typeof (item as RewardLedgerEvent).points === "number",
  ));
}

export function appendRewardEvent(event: RewardLedgerEvent): boolean {
  const ledger = readRewardLedger();
  if (ledger.some((item) => item.id === event.id)) return false;
  safeLocalStorage.setJSON(REWARD_LEDGER_KEY, [...ledger, event].slice(-500));
  window.dispatchEvent(new CustomEvent(REWARD_CHANGE_EVENT));
  return true;
}

export function rewardBalance(events = readRewardLedger()): number {
  return Math.max(0, events.reduce((sum, event) => sum + event.points, 0));
}
