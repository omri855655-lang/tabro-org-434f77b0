# Selectable room designs

Adds modern library, city cafe and business-class cabin variants alongside the existing classic libraries, country cafe and standard cabin. Both aircraft variants use forward-facing navigation and the same timer routes. Existing avatar meshes and activity controls are unchanged. Standard seating adds empty neighbouring passenger seats; business seating adds privacy shells and side controls.

Natural, illustrated and cinematic rendering profiles apply to separately cached environment materials. The illustrated profile omits surface bump and wood textures; the cinematic profile adds local light and smoother finishes. The profile preference is saved locally and the map fallback remains available.

Middle aircraft windows render an actual separate Three.js exterior scene with wing, winglet, engine, terrain and clouds into a 512x256 target. Other windows retain lightweight sky views. Exterior updates are throttled to four per second, pause with the timer and use the existing reduced-motion preference. Generated geometry, textures, render target and environment materials are disposed on environment changes.

Validation: 177 application tests, application TypeScript and Vite build passed. Local browser checks covered the modern library, business cabin, visual profile switching and console errors (none captured). Physical-device performance and two-account interaction were not tested. These remain stylized real-time 3D environments, not photorealistic scanned interiors.
