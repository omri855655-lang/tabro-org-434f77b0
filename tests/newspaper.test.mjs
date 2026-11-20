import assert from "node:assert/strict";
import test from "node:test";
import { buildNewspaper, normalizeEdition, selectEditionArticles } from "../supabase/functions/_shared/newspaper.ts";
import { buildNewspaperEmail } from "../supabase/functions/daily-briefing-email/emailContent.ts";
import { makeDailyBriefing } from "../supabase/functions/_shared/dailyBriefing.ts";

test("the account language overrides a saved edition language and localizes personal guidance", () => {
  const settings = normalizeEdition({ language: "he" }, "fr");
  const report = makeDailyBriefing([], [{
    id: "event", title: "Réunion", start_time: "2026-11-20T08:00:00Z",
    end_time: "2026-11-20T09:00:00Z", location: null, all_day: false,
  }], [], "morning", new Date("2026-11-20T06:00:00Z"), undefined, { language: settings.language });
  const paper = buildNewspaper(report, settings);
  assert.equal(paper.language, "fr");
  assert.match(paper.sections[0].stories[0].body, /Aucun lieu indiqué.*Préparez/u);
  assert.equal(paper.sections[0].stories[0].title, "Réunion");
});

test("newspaper headings and direction follow the chosen language and user data stays escaped", () => {
  const report = { date: "2026-11-20", items: [{ kind: "event", title: "<meeting>", when: "10:00" }] };
  for (const language of ["he", "ar", "en", "fr"]) {
    const settings = normalizeEdition({ language, practice: true, study: "Python", habits: "Water, Walk" });
    const paper = buildNewspaper(report, settings);
    assert.equal(paper.dir, ["en", "fr"].includes(language) ? "ltr" : "rtl");
    assert.equal(paper.sections.length, 3);
    const email = buildNewspaperEmail(paper, { test: false, pdfAttached: false, unsubscribeUrl: null });
    assert.ok(email.html.includes(`lang="${language}" dir="${paper.dir}"`));
    assert.ok(email.html.includes("&lt;meeting&gt;"));
    assert.ok(email.text.includes("Python"));
  }
});

test("news links use HTTPS and topic matches are prioritized without duplicates", () => {
  const articles = selectEditionArticles([
    { title: "Music", source: "One", link: "https://example.com/music" },
    { title: "Energy progress", source: "Two", link: "https://example.com/energy" },
    { title: "Duplicate", source: "Two", link: "https://example.com/energy" },
    { title: "Bad", source: "Three", link: "javascript:alert(1)" },
  ], "energy");
  assert.deepEqual(articles.map(article => article.title), ["Energy progress", "Music"]);
});
