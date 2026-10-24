# Living scenery update

The existing room and avatar mechanics remain in place. Personal scenery settings add New York-inspired and Tokyo-inspired high-floor or street-level views. These are designed procedural scenes, not faithful city reconstructions, photographs, live feeds or a completed photorealistic mode. Airport and aircraft keep their own exterior scenes regardless of the saved city setting.

Reading rooms can replace front windows with bookshelves. The setting does not remove windows from cafes, offices or aircraft. Outdoor render targets are not created when there are no windows.

City exteriors include layered buildings, a distinct Tokyo-inspired tower silhouette, shop fronts, two traffic lanes and pedestrians. The terminal includes a taxiing aircraft, another aircraft climbing beyond the runway, engines, runway edge markers, hangars and a control tower. Movement wraps outside the central view instead of reversing direction. Dynamic views render at eight updates per second in illustrated mode and twelve in detailed modes; hidden-tab and reduced-motion handling remain in place. Lighting changes preserve frozen motion positions.

New labels are present in all six app languages. Preferences are local to the browser, not shared room design changes. Timer, avatar identity, seat and participant presence remain controlled by their existing parent state.

Tests cover city elevations, traffic motion, freeze behavior, airport isolation from city presets, aircraft movement, preference validation and translations. Browser visual QA, actual device performance and production publication must be recorded separately; automated checks alone do not establish visual realism.

## Sandbox visual QA (aa1a450)

Checked in the sandbox browser with the fictional `tests/fixtures/focusImmersive.html` only (software WebGL, illustrated style; one natural sample attempted). Fixes:
- Rounded window glass showed a strip of sky along its bottom edge (bevel UVs of the rounded box); windows now use flat rounded glass with clean 0..1 UVs.
- High floors tilted the camera down, so towers leaned; the frame is now shifted down with a level camera. Nearby roofs are lower so the view looks over the city, and a boulevard with traffic is visible below.
- The ground ended inside the wide panorama (sky visible under its edge in outer windows); it now extends into the fog. City rows and distant towers span the full panorama width.
- Shop fronts floated in front of the facades; they now sit on each facade. Street level has pavements, a kerb and lamp posts. Tokyo-inspired views have lighter facades, vertical signs and a taller lattice tower so they read differently from New York-inspired views.
- The library windows checkbox is larger on phones.

Limits: software WebGL advances the scenery clock slowly, so terminal motion was verified by rendering the shared outdoor view at fixed scenery times rather than by waiting 30 real seconds. No physical phone or GPU was tested.
