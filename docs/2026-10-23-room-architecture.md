# Distinct room architecture

Replaced the shared library shell with purpose-built environments. The aircraft uses a narrower coordinate transform, curved fuselage, overhead bins, side windows with normalized UVs, two aisles, forward-facing passenger seats and tray tables. The existing six logical seats, avatar meshes, activities, controls and presence payloads are preserved. Walking uses forward-facing tray obstacles in the aircraft and the existing opposed layout elsewhere.

The grand library has a tall reading hall, full-height bookcases, galleries, columns and skylight beams. The intimate library has a lower timber ceiling, study dividers, lounge chairs and warm finishes. The cafe has round tables, counter, coffee machine and pendant fixtures. The office has workstation partitions, linear ceiling lights and a whiteboard. The airport has a broad glazed frontage, gate signs, departures board and lounge seating.

Added reusable rounded furniture geometry, procedural wood flooring, avatar contact shadows and window-bound scenery. Textures, geometry and materials are disposed when changing environments. Window animation is throttled, follows elapsed focus time, pauses with the timer and respects reduced motion. No external scene assets or new user-data transmissions.

Routes expanded from 4 to 22, all within the existing supported 45–180 minute session range. These are curated focus-session lengths and remain explicitly labelled as estimates, not live airline schedules.

Validation: all 177 tests passed, including an added navigation regression covering all aircraft seat-to-seat paths. App TypeScript and production build passed. Local browser checks covered aircraft eye/follow views, seating and original avatar rendering, and contrasting cafe/library scenes. This does not establish physical-device performance or two-account multiplayer verification.
