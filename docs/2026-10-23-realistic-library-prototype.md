# Realistic asset prototype, not published

The user's feedback rejected the procedural room's visual quality. This iteration changes the rendering inputs instead of adding more primitive decorations. The natural/cinematic classic, grand and intimate libraries now load actual textured glTF furniture and book models, HDR image-based lighting and a photographic outdoor window view. The original avatar geometry and controls remain intact. Foreground reading pages now have curved paper geometry and readable page texture instead of six oversized lines.

Assets: 25 checksum-verified local files, 13.9 MB including glTF models, bundled textures and HDR lighting/exterior. Download URLs and CC0 licence are documented in public/focus-assets. Runtime never requests third-party model or texture hosts. Book meshes are merged by material before cloning to reduce draw calls. A procedural fallback remains if assets fail to load; leaving the room disposes imported resources, HDR targets and image textures, including late async completions.

Validation: 179 application tests passed, including bundled asset checksums, budget and local glTF dependency coverage. App TypeScript, lint of new files and production build were checked. Local browser loaded all detailed assets and the new reading surface. Physical iPhone performance is not established.

This is a library review prototype. It is not a completed photorealistic world. Cabin, cafe, architecture, believable exterior parallax and higher-quality ambient animation still need work. Do not report this as a completed site-wide realism upgrade or publish it as such. Review the actual visual result before expanding this approach.
