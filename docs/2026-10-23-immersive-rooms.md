# Immersive focus rooms

Preserves the established avatar model and adds an eye-level camera, follow camera and the existing map fallback. Shared presence uses current session data on reconnect, deduplicates tabs and discards malformed display payloads. Channel membership policies remain unchanged.

Atmospheres are personal visual preferences inside the selected shared room: classic, grand and intimate libraries, aircraft, airport terminal, cafe and office. The grand library adds upper galleries and shelving; the intimate room adds lounge seating and floor lamps. Existing six desk positions and movement paths remain intact.

Aircraft routes use curated focus durations, explicitly labelled as approximate rather than live schedules. Barcelona–London is 135 minutes. The route duration writes to the existing focus timer only before a session starts. During the first 90 elapsed focus seconds the runway drops out of view and clouds descend to suggest ascent; cloud movement pauses with the timer and respects reduced motion. Reset allows route changes. This is an initial stylized cabin experience, not a flight simulator.

Validation: 176 Node tests passed, application TypeScript passed and production build passed. Browser fixture verified seated first-person and follow views, grand library and airport rendering, and route application producing a 135-minute running timer. Fixture peers are explicitly fictional; no cloud records or live focus sessions were written during fixture verification. Two-account realtime behaviour and physical iPhone performance were not verified in this pass.
