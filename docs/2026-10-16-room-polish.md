# Room polish - 2026-10-16

- Recovered the committed, published source after the temporary checkout was
  cleared. Continued in a separate managed worktree; the original checkout's
  unrelated local changes were preserved.
- Compact Together header, with all eight avatar choices and display-name
  editing retained in a keyboard-accessible collapsed profile panel.
- Fixed selected activity hover contrast (dark green on a light green surface).
- Removed the initial invented 90 focus minutes and hardcoded challenge totals.
  Challenge cards now explicitly show personal counters, not a worldwide ranking.
- Measured focus minutes count only completed sessions during this component
  visit. Manual minute reporting remains separate and awards no points.
- Progress-panel start/pause now uses the same session lifecycle as the room,
  rather than toggling timer state without a planned end time.
- New profile, progress and challenge text covers all six supported languages.

Validation: 54 frontend tests pass; app TypeScript and production build pass.
Local browser checks cover profile expansion, all avatar choices, activity
contrast, phone-width layout, and Arabic RTL controls. The account on the live
site requires sign-in again, so local checks are not an authenticated live test.

American Express is still unresolved. No new authenticated sync was attempted
and no credentials were requested or inspected. The most recent deployment is
worker revision 00018-qd5 with safe block-page/origin checks. The prior
credential-free cloud probe returned 403 at the official login page and 404 at
the proposed old www mirror; see 2026-10-15-focus-room-world.md. Do not mark the
connection working or claim this is an OTP/password fix.
