# Focus room visual QA and refinements (from 4ede58f)

Sandbox-only QA using `tests/fixtures/focusImmersive.html` (fictional peers, no accounts, no cloud writes), software WebGL (SwiftShader).

Fixes:
- Window clouds were lit spheres that read as floating discs; replaced with soft billboard cumulus tinted per mood.
- Windows now crop the shared exterior render to their own proportions (tall arches were stretched ~1.8x); aircraft windows crop the 2:1 sky/wing view and slide along the cabin so clouds stay wide.
- Sunset, night and rain now paint a gradient sky (stars at night) instead of the clear-day forest HDR, so windows visibly change with the chosen mood; night exterior lighting is darker.
- Ceilings in the aircraft, airport, office and modern rooms were almost black because nothing lit them from below; a locally generated bounce-light map now lights every room.
- Portrait phones use a wider camera (about 64° horizontal) so the room is not cropped to the centre aisle.
- Cafe signs moved above the glazing so pendant lamps no longer cover them; airport partitions lightened; monastery limestone warmed.

Verified: all 12 atmospheres at 1440x900 (natural) and 390x844 (3D game style), cinematic and natural samples, day/sunset/night/rain switching, quiet view hide/show keeping the same 3D canvas, camera angle and running timer, on-screen and arrow-key camera control, tap-to-sit and tap-to-walk, no horizontal overflow.

Limits: software WebGL renders natural mode at roughly 0.3 fps at 1440 px, so screenshots prove correctness, not performance. Physical iPhone performance and two-account realtime were not tested.
