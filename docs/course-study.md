# Course study workspace

## Implemented

- Five selectable assistance modes: weekly planning, difficulties, exam practice,
  assignment planning, enrichment reading. Selecting a mode fills the prompt;
  only Send invokes AI. Existing advisor history, backup and printing remain.
- Per-user/per-course study hours, exam date, difficulties and extra material.
  Preferences persist locally only after Save. They do not sync across devices.
  Current values are included when sending a question, even before local Save.
- PDF/TXT/MD material loading uses the existing syllabus reader. The material
  excerpt is limited to 2,500 characters; the interface discloses this limit.
- New interface labels cover Hebrew, English, Arabic, Spanish, Russian, Chinese.
  This does not imply full translation of the legacy course dashboard.
- Syllabus extraction opens an editable draft, never directly writes lessons.
  Confirmation reads existing lessons scoped to user and course, skips matching
  normalized titles, and appends new rows without deleting progress or dates.
- At most 60 new lessons per draft; durations are estimates, clamped to 5-300.
- Source coverage is explicit: 12,000 syllabus characters and 40 lesson summaries
  enter study context. The advisor must not fabricate sources or requirements.

## Verification and remaining work

The isolated fixture at `/tests/fixtures/courseStudy.html` uses mock AI and local
sample data, not the user's account. It tests the real panel and draft components.
Unit tests cover profile validation, deduplication, source bounds, translations
and the non-destructive save path. A live authenticated database import and real
AI response still need deployment and end-to-end verification.

Recovery verification: 29 focused tests passed; TypeScript, the production build
and lint on the new course modules passed. Browser verification was blocked by
the browser tool's URL access policy; the rebuilt fixture has not been visually
verified in this session. Existing bundle-size warnings remain.

The matching `task-ai-helper` server validation changes must deploy with the web
app: custom advisor prompts and course extraction accept up to 60,000 characters.
Other existing request types keep their previous limits. Authentication and
rate limiting are unchanged. Independent AI requires a configured provider key.

Concurrent imports from separate clients can still race; title deduplication is
client-side, not a database uniqueness guarantee. No schema migration was made.

## Recovery checkpoint (2026-10-26)

The previous temporary checkout was unavailable on resumption before its course
and Android changes were committed. Course work was reconstructed in the persistent
`outputs/tabro-independent` worktree. Nutrition goals and CSV/JSON watch imports
were already committed in c945115 and aa8ee3a. Native Android Health Connect work
from the temporary checkout still requires restoration and device compilation;
it is not a completed or published watch connection. Full platform migration
remains paused. Do not run the paid Lovable agent.
