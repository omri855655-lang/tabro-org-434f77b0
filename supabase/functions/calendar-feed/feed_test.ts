import { assert, assertEquals, assertMatch, assertNotMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FEED_MAX_EVENTS, TOKEN_PATTERN, buildFeedBody, buildFeedUrls, feedWindow, generateFeedToken, hashFeedToken, normalizeFieldOptions, parseFeedToken, type FeedRow } from "../_shared/calendarFeed.ts";
import { handleManage, type FeedStore, type SubscriptionRow } from "../calendar-feed-manage/manage.ts";

const off = { include_description: false, include_location: false, include_meeting_url: false };
const row = (over: Partial<FeedRow> = {}): FeedRow => ({
  id: "11111111-1111-4111-8111-111111111111", title: "פגישה עם דנה", start_time: "2026-11-03T08:00:00+00:00", end_time: "2026-11-03T09:00:00+00:00",
  all_day: false, updated_at: "2026-11-01T10:00:00+00:00", description: "קוד כניסה 1234\nלא לשתף", location: "רחוב הרצל 1", meeting_url: "https://meet.example.com/abc", ...over,
});
const now = new Date("2026-11-02T10:00:00Z");

Deno.test("tokens are 256-bit base64url and hashes are stable sha-256 hex", async () => {
  const a = generateFeedToken(), b = generateFeedToken();
  assert(TOKEN_PATTERN.test(a)); assert(a !== b);
  assertEquals((await hashFeedToken(a)).length, 64);
  assertEquals(await hashFeedToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("only /calendar-feed/<43-char token>[.ics] paths are accepted", () => {
  const t = generateFeedToken();
  assertEquals(parseFeedToken(`/functions/v1/calendar-feed/${t}.ics`), t);
  assertEquals(parseFeedToken(`/calendar-feed/${t}`), t);
  for (const bad of ["/calendar-feed/", "/calendar-feed/short.ics", `/calendar-feed/${t}x`, `/calendar-feed/${t}/extra`, `/other/${t}`, "/calendar-feed/00000000-0000-0000-0000-000000000000", `/calendar-feed/${t.slice(0, 42)}!`])
    assertEquals(parseFeedToken(bad), null, bad);
});

Deno.test("default feed is minimal: title, times, UID, stamps only", () => {
  const { text, exported } = buildFeedBody([row()], off, now);
  assertEquals(exported, 1);
  assertMatch(text, /SUMMARY:פגישה עם דנה/); assertMatch(text, /UID:11111111-1111-4111-8111-111111111111@tabro\.org/);
  assertMatch(text, /DTSTART:20261103T080000Z/); assertMatch(text, /LAST-MODIFIED:20261101T100000Z/); assertMatch(text, /DTSTAMP:/);
  assertNotMatch(text, /DESCRIPTION|LOCATION|URL:|CATEGORIES|VALARM|RRULE|EXRULE/);
  assertMatch(text, /X-WR-CALNAME:Tabro/); assertMatch(text, /REFRESH-INTERVAL;VALUE=DURATION:PT60M/);
});

Deno.test("optional fields appear only when each is explicitly opted in", () => {
  const loc = buildFeedBody([row()], { ...off, include_location: true }, now).text;
  assertMatch(loc, /LOCATION:רחוב הרצל 1/); assertNotMatch(loc, /DESCRIPTION|URL:/);
  const all = buildFeedBody([row()], { include_description: true, include_location: true, include_meeting_url: true }, now).text;
  assertMatch(all, /DESCRIPTION:קוד כניסה 1234\\nלא לשתף/); assertMatch(all, /URL:https:\/\/meet\.example\.com\/abc/);
  assertEquals(normalizeFieldOptions({ include_description: "true", include_location: 1, include_meeting_url: true }), { ...off, include_meeting_url: true });
});

Deno.test("reschedules keep the UID; deleted rows simply disappear; invalid rows are counted", () => {
  const before = buildFeedBody([row()], off, now).text, after = buildFeedBody([row({ start_time: "2026-11-04T08:00:00Z", end_time: "2026-11-04T09:00:00Z" })], off, now).text;
  assertEquals(before.match(/UID:.*/)![0], after.match(/UID:.*/)![0]);
  assertEquals(buildFeedBody([], off, now).text.includes("BEGIN:VEVENT"), false);
  const mixed = buildFeedBody([row(), row({ id: "bad", end_time: "2026-11-03T07:00:00Z" })], off, now);
  assertEquals([mixed.exported, mixed.skipped, mixed.truncated], [1, 1, false]);
});

Deno.test("all-day events use exclusive end dates in Israel time across DST end", () => {
  // 2026-10-25 is the Israel DST change; a one-day all-day event stored at local midnight.
  const t = buildFeedBody([row({ all_day: true, start_time: "2026-10-24T21:00:00Z", end_time: "2026-10-25T21:59:00Z" })], off, now).text;
  assertMatch(t, /DTSTART;VALUE=DATE:20261025/); assertMatch(t, /DTEND;VALUE=DATE:20261026/);
});

Deno.test("feed window and truncation are explicit", () => {
  const w = feedWindow(now);
  assertEquals(w.from.toISOString(), "2026-10-26T10:00:00.000Z"); assertEquals(w.to.toISOString(), "2027-05-01T10:00:00.000Z");
  const many = Array.from({ length: FEED_MAX_EVENTS + 1 }, (_, i) => row({ id: `e${i}` }));
  const f = buildFeedBody(many, off, now);
  assertEquals([f.exported, f.truncated], [FEED_MAX_EVENTS, true]); assertMatch(f.text.replace(/\r\n /g, ""), /limit reached/);
});

Deno.test("feed URLs are https + webcal on the backend only", () => {
  const t = generateFeedToken();
  const u = buildFeedUrls("https://example.supabase.co/", t);
  assertEquals(u.https, `https://example.supabase.co/functions/v1/calendar-feed/${t}.ics`);
  assert(u.webcal.startsWith("webcal://example.supabase.co/"));
  let threw = false; try { buildFeedUrls("http://x", t); } catch { threw = true; } assert(threw);
});

// ---- management authorization (in-memory store mirrors the DB's per-user scoping and one-active rule)
function memoryStore() {
  const rows: (SubscriptionRow & { user_id: string; token_hash: string; revoked: boolean })[] = [];
  const store: FeedStore = {
    getActive: async (u) => rows.find(r => r.user_id === u && !r.revoked) ?? null,
    insert: async (u, h, o) => {
      if (rows.some(r => r.user_id === u && !r.revoked)) throw new Error("unique");
      const r = { user_id: u, token_hash: h, revoked: false, ...o, created_at: now.toISOString(), last_fetched_at: null, last_event_count: null, last_skipped_count: null, last_truncated: null };
      rows.push(r); return r;
    },
    revokeActive: async (u) => { rows.filter(r => r.user_id === u).forEach(r => r.revoked = true); },
    updateOptions: async (u, o) => { const r = rows.find(x => x.user_id === u && !x.revoked); if (!r) return null; Object.assign(r, o); return r; },
  };
  return { rows, store };
}
const deps = { generateToken: generateFeedToken, hashToken: hashFeedToken };

Deno.test("creation needs consent, returns raw token once and stores only its hash", async () => {
  const { rows, store } = memoryStore();
  assertEquals((await handleManage("A", { action: "create" }, store, deps)).status, 400);
  const res = await handleManage("A", { action: "create", consent: true }, store, deps);
  assertEquals(res.status, 200);
  const token = res.body.token as string;
  assert(TOKEN_PATTERN.test(token));
  assertEquals(rows[0].token_hash, await hashFeedToken(token));
  assert(!JSON.stringify(rows).includes(token));
  assertEquals(res.body.options, off);
  const status = await handleManage("A", { action: "status" }, store, deps);
  assertEquals(status.body.enabled, true); assertEquals("token" in status.body, false);
  assertEquals((await handleManage("A", { action: "create", consent: true }, store, deps)).status, 409);
});

Deno.test("body user ids are ignored; users cannot read, change or revoke someone else's link", async () => {
  const { rows, store } = memoryStore();
  await handleManage("A", { action: "create", consent: true }, store, deps);
  const asB = await handleManage("B", { action: "status", user_id: "A" }, store, deps);
  assertEquals(asB.body.enabled, false);
  assertEquals((await handleManage("B", { action: "update", user_id: "A", options: { include_description: true } }, store, deps)).status, 404);
  await handleManage("B", { action: "revoke", confirm: true, user_id: "A" }, store, deps);
  assertEquals(rows[0].revoked, false); assertEquals(rows[0].include_description, false);
  assertEquals((await handleManage("", { action: "status" }, store, deps)).status, 401);
  assertEquals((await handleManage("A", { action: "dump" }, store, deps)).status, 400);
});

Deno.test("regenerate and revoke require explicit confirmation; regenerate revokes the old hash", async () => {
  const { rows, store } = memoryStore();
  const first = await handleManage("A", { action: "create", consent: true }, store, deps);
  assertEquals((await handleManage("A", { action: "regenerate", consent: true }, store, deps)).status, 400);
  const second = await handleManage("A", { action: "regenerate", consent: true, confirm: true }, store, deps);
  assert(second.body.token !== first.body.token);
  assertEquals(rows.filter(r => !r.revoked).length, 1);
  assertEquals(rows.find(r => r.revoked)!.token_hash, await hashFeedToken(first.body.token as string));
  assertEquals((await handleManage("A", { action: "revoke" }, store, deps)).status, 400);
  assertEquals((await handleManage("A", { action: "revoke", confirm: true }, store, deps)).body.enabled, false);
  assertEquals(rows.every(r => r.revoked), true);
});

Deno.test("storage failures propagate so the endpoint fails closed", async () => {
  const failing: FeedStore = { getActive: () => Promise.reject(new Error("db")), insert: () => Promise.reject(new Error("db")), revokeActive: () => Promise.reject(new Error("db")), updateOptions: () => Promise.reject(new Error("db")) };
  let threw = false; try { await handleManage("A", { action: "status" }, failing, deps); } catch { threw = true; }
  assert(threw);
});
