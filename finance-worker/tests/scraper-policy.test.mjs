import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { SCRAPERS } from "@sergienko4/israeli-bank-scrapers";

import {
  CLOUD_PROVIDER_IDS,
  credentialsForScraper,
} from "../src/scraper-policy.mjs";

test("every exposed cloud provider is supported by the hardened scraper", () => {
  assert.deepEqual(
    CLOUD_PROVIDER_IDS.filter((provider) => !SCRAPERS[provider]),
    [],
  );
});

test("the Edge Function provider list matches the worker contract", () => {
  const source = fs.readFileSync(
    new URL("../../supabase/functions/finance-scraper-connect/index.ts", import.meta.url),
    "utf8",
  );
  const providerBlock = source.match(/const providers = \{([\s\S]*?)\n\} as const;/)?.[1] || "";
  const edgeProviders = [...providerBlock.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
  assert.deepEqual(edgeProviders.sort(), [...CLOUD_PROVIDER_IDS].sort());
});

test("every provider form requests the fields expected by its scraper", () => {
  const source = fs.readFileSync(
    new URL("../../supabase/functions/finance-scraper-connect/index.ts", import.meta.url),
    "utf8",
  );
  const providerBlock = source.match(/const providers = \{([\s\S]*?)\n\} as const;/)?.[1] || "";
  const edgeFields = Object.fromEntries(
    [...providerBlock.matchAll(/^\s{2}(\w+): \{ name: "[^"]+", fields: \[([^\]]+)\]/gm)]
      .map((match) => [match[1], [...match[2].matchAll(/"([^"]+)"/g)].map((field) => field[1])]),
  );

  for (const provider of CLOUD_PROVIDER_IDS) {
    const scraperFields = SCRAPERS[provider].loginFields.map((field) => (
      provider === "yahav" && field === "num" ? "username" : field
    ));
    assert.deepEqual(edgeFields[provider], scraperFields, `${provider} credential fields`);
  }
});

test("Yahav credentials are translated without changing the other providers", () => {
  assert.deepEqual(
    credentialsForScraper("yahav", { username: "123", nationalID: "456", password: "secret" }),
    { num: "123", nationalID: "456", password: "secret" },
  );
  const visaCal = { username: "name", password: "secret" };
  assert.equal(credentialsForScraper("visaCal", visaCal), visaCal);
});
