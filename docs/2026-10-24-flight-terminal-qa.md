# Flight and terminal visual QA (from da68c8c)

Sandbox-only, software WebGL, fictional fixture (`tests/fixtures/focusImmersive.html?elapsed=N` starts N seconds into a session) plus a temporary fixed-time render probe that was removed afterwards.

Confirmed: exactly one wing window per cabin side (z=0, 2 of 18 windows use the wing feed, 16 use the wing-free terrain feed); the wing stays visible from ground through climb and cruise; no terrain reset.

Fixed:
- Flight clouds were lit spheres 10-22 units up; once the camera climbed they lay on the runway as white discs in every window. Replaced by soft billboard clouds 55-140 units up that move with the terrain and tint with light/weather.
- Taxiway connectors crossed the runway centreline and read as a floating slab; they now start at the runway edge.
- At cruise the terrain had advanced past all detail, leaving bare green; neighbourhood/farmland rows now continue to about z=-1900.
- Terminal: the parked gate aircraft sat at the panorama edge and the jet bridge was outside the view and about 4 units from the fuselage. The aircraft now sits inside the window view and the bridge runs from the facade to its forward door.

Not changed (outside this commit's files): a thin strip of background colour shows where the cabin floor meets the sidewall; window crops overlap heavily so neighbouring windows show similar views; terrain stops advancing after about 5 minutes (forward cap 900).
