// Pure management logic for the private calendar subscription. The caller has
// already verified the JWT and passes the server-derived user id; nothing in the
// request body can choose the owner.
import { FEED_DAYS_AHEAD, FEED_DAYS_BACK, FEED_MAX_EVENTS, normalizeFieldOptions, type FeedFieldOptions } from "../_shared/calendarFeed.ts";

export interface SubscriptionRow extends FeedFieldOptions {
  created_at: string;
  last_fetched_at: string | null;
  last_event_count: number | null;
  last_skipped_count: number | null;
  last_truncated: boolean | null;
}

/** Every method is scoped to `userId` and must throw on any storage error (fail closed). */
export interface FeedStore {
  getActive(userId: string): Promise<SubscriptionRow | null>;
  insert(userId: string, tokenHash: string, options: FeedFieldOptions): Promise<SubscriptionRow>;
  revokeActive(userId: string): Promise<void>;
  updateOptions(userId: string, options: FeedFieldOptions): Promise<SubscriptionRow | null>;
}

export interface ManageDeps { generateToken(): string; hashToken(token: string): Promise<string> }
export interface ManageResult { status: number; body: Record<string, unknown> }

const ACTIONS = new Set(["status", "create", "regenerate", "update", "revoke"]);
const scope = { daysBack: FEED_DAYS_BACK, daysAhead: FEED_DAYS_AHEAD, maxEvents: FEED_MAX_EVENTS };

function view(row: SubscriptionRow | null) {
  if (!row) return { enabled: false, scope };
  return {
    enabled: true, scope,
    options: { include_description: row.include_description, include_location: row.include_location, include_meeting_url: row.include_meeting_url },
    createdAt: row.created_at, lastFetchedAt: row.last_fetched_at, lastEventCount: row.last_event_count,
    lastSkippedCount: row.last_skipped_count, lastTruncated: row.last_truncated,
  };
}

export async function handleManage(userId: string, body: unknown, store: FeedStore, deps: ManageDeps): Promise<ManageResult> {
  if (!userId) return { status: 401, body: { error: "unauthorized" } };
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const action = typeof input.action === "string" ? input.action : "";
  if (!ACTIONS.has(action)) return { status: 400, body: { error: "invalid_action" } };
  const options = normalizeFieldOptions(input.options);

  if (action === "status") return { status: 200, body: view(await store.getActive(userId)) };

  if (action === "create" || action === "regenerate") {
    if (input.consent !== true) return { status: 400, body: { error: "consent_required" } };
    const existing = await store.getActive(userId);
    if (action === "create" && existing) return { status: 409, body: { error: "already_enabled" } };
    if (action === "regenerate") {
      if (input.confirm !== true) return { status: 400, body: { error: "confirm_required" } };
      if (!existing) return { status: 404, body: { error: "not_enabled" } };
      await store.revokeActive(userId);
    }
    const token = deps.generateToken();
    const row = await store.insert(userId, await deps.hashToken(token), options);
    // The raw token leaves the server only here and is never stored.
    return { status: 200, body: { ...view(row), token } };
  }

  if (action === "update") {
    const row = await store.updateOptions(userId, options);
    return row ? { status: 200, body: view(row) } : { status: 404, body: { error: "not_enabled" } };
  }

  // revoke
  if (input.confirm !== true) return { status: 400, body: { error: "confirm_required" } };
  await store.revokeActive(userId);
  return { status: 200, body: view(null) };
}
