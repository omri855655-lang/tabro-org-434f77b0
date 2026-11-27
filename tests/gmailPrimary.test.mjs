import assert from "node:assert/strict";
import test from "node:test";
import { syncGmailConnection } from "../supabase/functions/_shared/gmailSync.ts";
import { GMAIL_PRIMARY_QUERY, isPrimaryInboxMail } from "../supabase/functions/_shared/gmailPrimary.ts";

test("Gmail Primary sync excludes updates and promotions, retaining action metadata", async () => {
  const saved = [];
  const store = { from: () => ({ upsert: async row => { saved.push(row); return { error: null }; } }) };
  const messages = {
    personal01: ["INBOX", "CATEGORY_PERSONAL"],
    marketing01: ["INBOX", "CATEGORY_PROMOTIONS"],
    update01: ["INBOX", "CATEGORY_UPDATES"],
  };
  const fakeFetch = async value => {
    const url = new URL(value);
    if (url.pathname.endsWith("/messages")) {
      assert.equal(url.searchParams.get("q"), `newer_than:90d ${GMAIL_PRIMARY_QUERY}`);
      return Response.json({ messages: Object.keys(messages).map(id => ({ id })) });
    }
    const id = url.pathname.split("/").at(-1);
    return Response.json({
      labelIds: messages[id], internalDate: "1795600000000",
      payload: { headers: [{ name: "Subject", value: "Invoice" }] },
    });
  };
  const result = await syncGmailConnection(store, { id: "connection", user_id: "user", access_token: "fixture", refresh_token: "fixture", settings: {} },
    { query: `newer_than:90d ${GMAIL_PRIMARY_QUERY}`, maxResults: 100, onlyNew: false }, { fetch: fakeFetch });
  assert.ok(result.ok);
  assert.deepEqual(result.newMessageIds, ["personal01"]);
  assert.equal(saved[0].suggested_action.type, "add_expense");
  assert.equal(isPrimaryInboxMail(saved[0]), true);
  assert.equal(isPrimaryInboxMail({ suggested_action: null }), false);
});
