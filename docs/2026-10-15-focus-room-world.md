# Focus room world and Amex follow-up

## Room design

The public FocusTown landing page was inspected for the relationship between
characters and physical furniture. Its web application requires a new profile;
no account was created. No FocusTown code, art, audio or characters were copied.

Replace the photo overlay with original SVG room geometry: six fixed desks,
chairs, lamps, books, plants, and coordinated avatar placement. The same scene
coordinates drive presence and furniture. Foreground table surfaces occlude the
seated character naturally. Activities place a laptop, notebook or open book on
the table. Walking, blinking and activity animation respect reduced motion.

Controls no longer overlap the world. All six seats have accessible buttons;
pointer selection also works on the table itself. Starting focus chooses an
available real desk, not an arbitrary seated position. All seats and controls
stay visible on a 390px phone; 150% zoom allows inspection. This is an original
2.5D illustration, not a full 3D engine or a claim of FocusTown feature parity.

## Amex investigation

2026-10-15, credential-free HTTP probe in me-west1, build
310e9b9f-b912-40e7-adb9-582f4d5da1d7:

- Official he.americanexpress.co.il/personalarea/login/: HTTP 403, block page,
  no password form markup.
- Suggested www.americanexpress.co.il/personalarea/Login mirror: HTTP 404,
  no password form markup. Do not switch to a broken mirror based on an old comment.

This corroborates the earlier real browser form-load failure, but the HTTP probe
is not a new authenticated browser synchronization. Existing credentials were
not read, modified or sent in this probe. No imported Amex accounts are verified.

The worker now distinguishes institution block pages from unavailable form markup,
stops before submitting credentials on HTTP 403/429, and refuses unrelated-origin
redirects. Only fixed error codes are returned; page text/request references are
never included. These are diagnostic and safety repairs, NOT a working Amex login.
No CAPTCHA solver, proxy rotation, security-interstitial bypass or extracted
session token was added. CSV/XLSX import remains available while provider access
is unresolved.

## Remaining scope

Full Outlook-style calendar workflows, voice interaction, all legacy-screen
translations and an authenticated Amex import are not completed by this change.
