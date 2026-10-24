# Living scenery update

The existing room and avatar mechanics remain in place. Personal scenery settings add New York-inspired and Tokyo-inspired high-floor or street-level views. These are designed procedural scenes, not faithful city reconstructions, photographs, live feeds or a completed photorealistic mode. Airport and aircraft keep their own exterior scenes regardless of the saved city setting.

Reading rooms can replace front windows with bookshelves. The setting does not remove windows from cafes, offices or aircraft. Outdoor render targets are not created when there are no windows.

City exteriors include layered buildings, a distinct Tokyo-inspired tower silhouette, shop fronts, two traffic lanes and pedestrians. The terminal includes a taxiing aircraft, another aircraft climbing beyond the runway, engines, runway edge markers, hangars and a control tower. Movement wraps outside the central view instead of reversing direction. Dynamic views render at eight updates per second in illustrated mode and twelve in detailed modes; hidden-tab and reduced-motion handling remain in place. Lighting changes preserve frozen motion positions.

New labels are present in all six app languages. Preferences are local to the browser, not shared room design changes. Timer, avatar identity, seat and participant presence remain controlled by their existing parent state.

Tests cover city elevations, traffic motion, freeze behavior, airport isolation from city presets, aircraft movement, preference validation and translations. Browser visual QA, actual device performance and production publication must be recorded separately; automated checks alone do not establish visual realism.
