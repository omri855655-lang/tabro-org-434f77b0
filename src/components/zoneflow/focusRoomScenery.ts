import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import type { RoomAtmosphere, RoomGraphics } from '@/lib/focusRoomJourney';
import { resolveRoomDaylight, type RoomDaylight, type RoomWeather } from '@/lib/focusAtmosphere';
import { sceneryTravel, type SceneryPreset } from '@/lib/focusScenerySettings';

/** Parked gate aircraft placement (the taxiing model scaled down) and its forward door, which the jet bridge meets. */
export const GATE = { x: -22, z: -10, scale: .8 };
export function gateDoor() {
  // Model: fuselage radius 1.1 centred at y=3; forward door 5 units behind the nose (model x=-8).
  return { x: GATE.x - 5 * GATE.scale, y: 3 * GATE.scale, z: GATE.z + 1.1 * GATE.scale };
}

/** One panoramic outdoor pass shared by the windows, with per-window crops. */
export function createRoomScenery(renderer: THREE.WebGLRenderer, windows: THREE.Mesh[], kind: RoomAtmosphere, graphics: RoomGraphics, preset: SceneryPreset = 'auto') {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 3, .1, 220);
  camera.position.set(0, 5, 14); camera.lookAt(0, 5, -30);
  const width = Math.min(graphics === 'illustrated' ? 768 : 1536, renderer.capabilities.maxTextureSize);
  const target = new THREE.WebGLRenderTarget(width, Math.round(width / 3));
  const resources = new Set<{ dispose: () => void }>([target]);
  const cube = new THREE.BoxGeometry(), sphere = new THREE.SphereGeometry(1, 16, 12);
  resources.add(cube); resources.add(sphere);
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const material = (color: number) => {
    if (!materials.has(color)) { const m = new THREE.MeshStandardMaterial({ color, roughness: .85 }); materials.set(color, m); resources.add(m); }
    return materials.get(color)!;
  };
  const mesh = (geometry: THREE.BufferGeometry, color: number, at: number[], size: number[], parent: THREE.Object3D = scene) => {
    const object = new THREE.Mesh(geometry, material(color)); object.position.fromArray(at); object.scale.fromArray(size); parent.add(object); return object;
  };
  const box = (color: number, at: number[], size: number[], parent?: THREE.Object3D) => mesh(cube, color, at, size, parent);
  const hemisphere = new THREE.HemisphereLight(0xeaf4ff, 0x637960, 2);
  const sun = new THREE.DirectionalLight(0xffebce, 2.5); sun.position.set(-20, 30, 15); scene.add(hemisphere, sun);
  const airport = kind === 'airport';
  const urban = !airport && (preset !== 'auto' || ['city-cafe', 'office', 'modern-library'].includes(kind));
  const high = !airport && preset.endsWith('-high'), tokyo = !airport && preset.startsWith('tokyo');
  const historic = !urban && ['heritage-library', 'grand', 'monastery-library'].includes(kind);
  const eyeHeight = high ? 24 : 5;
  camera.position.y = eyeHeight;
  if (high) {
    // Shift the frame down instead of tilting the camera, so towers stay vertical from a high floor.
    camera.fov = 74; camera.aspect = 3 / 1.236; camera.setViewOffset(3000, 1236, 0, 236, 3000, 1000);
  }
  camera.lookAt(0, eyeHeight, -30);
  scene.name = `living-scenery-${airport ? 'airport' : preset}`;
  // The wide panorama reaches far to the sides; the ground must extend into the fog so no edge shows.
  const ground = box(urban || airport ? 0x8e9596 : 0x657c55, [0, -.3, -150], [700, .5, 420]);
  const streetZ = high ? -36 : -6;
  if (urban) {
    box(0x515a60, [0, .01, streetZ], [400, .04, 9]);
    for (let x = -196; x < 200; x += 7) box(0xe9e0c6, [x, .04, streetZ], [3, .02, .12]);
    // Pavements, a kerb and lamp posts give the street-level foreground real detail.
    box(0xb9b6ac, [0, .03, streetZ + 9.2], [400, .06, 9.5]); box(0xd8d4c8, [0, .09, streetZ + 4.6], [400, .14, .25]);
    box(0xb9b6ac, [0, .03, streetZ - 6.6], [400, .06, 4.2]);
    for (let x = -60; x <= 60; x += 15) { box(0x3d474c, [x, 2.2, streetZ + 5.1], [.14, 4.4, .14]); box(0x3d474c, [x + .45, 4.35, streetZ + 5.1], [1, .1, .14]); }
    if (high) for (const x of [-72, -28, 28, 72]) box(0x515a60, [x, .02, -70], [5, .04, 60]);
  } else if (!airport) box(0xc5baa0, [0, .01, -10], [5, .04, 90]);
  // Layered silhouettes create depth beyond the garden or street.
  if (!urban && !airport) for (let i = 0; i < 9; i++) mesh(sphere, 0x6f8d8c, [(i - 4) * 24, -6, -92 - i % 3 * 9], [27, 19 + i % 4 * 3, 12]);
  const lit = new THREE.MeshStandardMaterial({ color: 0xd6c7a4, emissive: 0xffc778, emissiveIntensity: 0 }); resources.add(lit);
  const windowGeometry = new THREE.BoxGeometry(.65, 1.05, .04); resources.add(windowGeometry);
  const windowMatrices: THREE.Matrix4[] = [];
  const facadeColors = tokyo ? [0xc9cbc6, 0xb4b9bb, 0xd8d2c4, 0xa9b0b4] : [0xb9b1a1, 0xcbb99d, 0xa7b2af, 0xbda99a];
  if (urban || historic) {
    // City rows fill the whole panorama width; the historic row stays a short quadrangle.
    const count = urban ? 25 : 11;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 8, z = historic ? -44 : high ? -46 - i % 3 * 7 : -23 - i % 3 * 3, h = historic ? 11 : high ? 10 + (i * 13) % 23 : 9 + i % 4 * 2; // high floors look over most nearby roofs
      box(historic ? [0xb9b1a1, 0xcbb99d, 0xa7b2af, 0xbda99a][i % 4] : facadeColors[i % 4], [x, h / 2, z], [7.6, h, 5]);
      for (const y of [1.2, h - .5, h + .15]) box(0xe1d5bd, [x, y, z + 2.65], [8, .22, .38]);
      if (historic) { const roof = new THREE.ConeGeometry(5.8, 3.5, 4); resources.add(roof); const m = mesh(roof, 0x4d6265, [x, h + 1.6, z], [1, 1, 1]); m.rotation.y = Math.PI / 4; }
      if (urban) {
        // Shop fronts sit on each facade rather than floating in front of the row.
        box(tokyo ? 0x786978 : 0x516b5e, [x, 2.55, z + 2.95], [6.4, .3, .9]);
        box(0x3f5059, [x, 1.25, z + 2.56], [5.6, 1.9, .06]);
        if (tokyo) box([0xc8574b, 0xd9ab3c, 0x4c84b4][i % 3], [x + 3.25, Math.min(h - 1.5, 5.5), z + 2.8], [.5, Math.min(5, h * .45), .22]);
      }
      for (let row = 0; row < Math.floor(h / 2.4); row++) for (let col = -2; col <= 2; col++) {
        const y = 2 + row * 2.4, wx = x + col * 1.25;
        if (urban && row === 0) continue;
        box(0x52636a, [wx, y, z + 2.54], [.9, 1.4, .06]);
        windowMatrices.push(new THREE.Matrix4().makeTranslation(wx, y, z + 2.59));
      }
    }
  }
  if (urban) {
    // Distant towers sit behind the street facades, with a different silhouette for each city.
    for (let i = 0; i < 39; i++) {
      const x = (i - 19) * 8, h = 17 + (i * 17) % 37, z = -90 - i % 3 * 8;
      box(tokyo ? 0x899aa6 : 0x9d9b93, [x, h / 2, z], [6, h, 6]);
      for (let y = 4; y < h; y += 3) box(0x5b7280, [x, y, z + 3.05], [5.3, .65, .04]);
      if (i % 4 === 0) { box(0x98a6ad, [x, h + 2, z], [3.6, 4, 3.6]); box(0x647783, [x, h + 6, z], [.18, 5, .18]); }
    }
    if (tokyo) {
      // A lattice tower that rises clearly above the skyline from both street and high floor.
      for (const side of [-1, 1]) { const leg = box(0xbc6450, [8 + side * 2.4, 20, -80], [.8, 40, .8]); leg.rotation.z = side * .1; }
      for (const y of [10, 21, 31]) box(0xe6bda0, [8, y, -80], [7.2 - y * .17, .7, 1.4]);
      box(0xc8c7bd, [8, 46, -80], [.35, 12, .35]);
    }
  }
  if (windowMatrices.length) { const lights = new THREE.InstancedMesh(windowGeometry, lit, windowMatrices.length); windowMatrices.forEach((m, i) => lights.setMatrixAt(i, m)); lights.computeBoundingSphere(); scene.add(lights); resources.add(lights); }
  const trees = new THREE.Group(); scene.add(trees);
  if (!airport) {
    const leafGeometry = new THREE.IcosahedronGeometry(1, 2); resources.add(leafGeometry);
    const leaves = new THREE.InstancedMesh(leafGeometry, material(0x52754e), 96);
    const trunks = new THREE.InstancedMesh(cube, material(0x685648), 24);
    const transform = new THREE.Object3D();
    for (let i = 0; i < 24; i++) {
      const x = (i % 12 - 5.5) * 7 + Math.sin(i * 3) * 2, z = high ? -15 - Math.floor(i / 12) * 12 : -18 - Math.floor(i / 12) * 25;
      transform.position.set(x, 3, z); transform.scale.set(.32, 6, .32); transform.updateMatrix(); trunks.setMatrixAt(i, transform.matrix);
      for (let j = 0; j < 4; j++) { transform.position.set(x + Math.sin(j * 2) * 1.1, 5.3 + j * .65, z + Math.cos(j * 2)); transform.scale.set(1.8 + i % 3 * .25, 2.2, 1.8); transform.updateMatrix(); leaves.setMatrixAt(i * 4 + j, transform.matrix); }
    }
    leaves.computeBoundingSphere(); trunks.computeBoundingSphere(); trees.add(leaves, trunks); resources.add(leaves); resources.add(trunks);
  }
  const transit = new THREE.Group(); scene.add(transit);
  if (airport) {
    box(0x59636b, [0, .01, -23], [180, .04, 16]);
    for (let x = -80; x < 80; x += 9) box(0xf4e7b3, [x, .06, -23], [4, .02, .2]);
    mesh(sphere, 0xe9ece6, [0, 3, 0], [8, 1.1, 1.1], transit);
    const wing = box(0xb4bdc0, [0, 2.7, 0], [3.8, .2, 14], transit); wing.rotation.y = .24;
    const tail = box(0x385e67, [6, 4.4, 0], [2, 3, .25], transit); tail.rotation.z = -.25;
    for (let x = -5; x < 5; x += .6) box(0x334f61, [x, 3.4, 1], [.23, .24, .04], transit);
    transit.position.set(-12, 0, -24);
  } else if (urban) {
    box(0x496779, [0, .6, 0], [3.2, 1, 1.4], transit); box(0x748d99, [0, 1.3, 0], [1.7, .7, 1.25], transit); transit.position.z = streetZ;
  }
  const traffic: THREE.Group[] = [], walkers: THREE.Group[] = [];
  if (urban) {
    transit.visible = false;
    for (let i = 0; i < 8; i++) {
      const car = new THREE.Group(); car.name = `street-car-${i}`; scene.add(car); traffic.push(car);
      box(i % 3 === 0 ? (tokyo ? 0xe8e9e1 : 0xd4a638) : [0x496779, 0xa05748, 0xdee0d7][i % 3], [0, .6, 0], [3.2, .8, 1.35], car);
      box(0x516c7b, [0, 1.15, 0], [1.6, .6, 1.15], car);
      for (const x of [-1, 1]) for (const z of [-.65, .65]) mesh(sphere, 0x293236, [x, .35, z], [.34, .34, .18], car);
    }
    for (let i = 0; i < 12; i++) {
      const person = new THREE.Group(); person.name = `street-walker-${i}`; scene.add(person); walkers.push(person);
      mesh(sphere, 0xc4a38b, [0, 1.6, 0], [.18, .2, .18], person);
      box([0x44505b, 0x776358, 0x81958a][i % 3], [0, 1, 0], [.4, .8, .27], person);
      for (const x of [-.12, .12]) box(0x424853, [x, .35, 0], [.14, .7, .16], person);
    }
  }
  let departure: THREE.Group | undefined;
  if (airport) {
    // A second aircraft climbs beyond the runway while the near aircraft taxis.
    departure = transit.clone(true); departure.name = 'departing-aircraft'; scene.add(departure);
    transit.name = 'taxiing-aircraft';
    for (const plane of [transit, departure]) {
      for (const z of [-2.5, 2.5]) mesh(sphere, 0x536671, [-1, 2.1, z], [1.2, .45, .45], plane);
      for (const x of [-4, 2]) mesh(sphere, 0x283439, [x, 1.4, .7], [.35, .35, .25], plane);
    }
    // Parked at the gate inside the window panorama; the jet bridge runs from the terminal facade to the forward door.
    const parked = transit.clone(true); parked.name = 'parked-gate-aircraft'; parked.position.set(GATE.x, 0, GATE.z); parked.scale.setScalar(GATE.scale); scene.add(parked);
    box(0xa7b0af, [-42, .02, -7], [56, .04, 18]);
    for (let x = -60; x < -15; x += 10) box(0xd5c48c, [x, .06, -9], [.12, .03, 12]);
    const door = gateDoor(), bridgeFront = door.z + .05, bridgeBack = 9, bridgeLength = bridgeBack - bridgeFront;
    const bridge = box(0xadbabd, [door.x, door.y, (bridgeFront + bridgeBack) / 2], [2.2, 2.2, bridgeLength]); bridge.name = 'gate-jet-bridge';
    box(0x536f7e, [door.x + 1.12, door.y + .3, (bridgeFront + bridgeBack) / 2], [.04, .7, bridgeLength - 2]);
    box(0x9aa7aa, [door.x, door.y, bridgeFront + .8], [3, 2.6, 1.6]);
    for (const z of [bridgeFront + 3, bridgeFront + 11]) box(0x7c8c90, [door.x, (door.y - 1.1) / 2, z], [.4, door.y - 1.1, .4]);
    box(0xe1dfcf, [-17, .9, -4], [3.4, 1.5, 1.4]);
    box(0x526e7b, [-18.1, 1.3, -3.28], [.7, .6, .03]);
    box(0x59636b, [0, .02, -57], [350, .04, 10]);
    for (let x = -168; x < 175; x += 12) box(0xf4e7b3, [x, .06, -57], [5, .02, .18]);
    for (let x = -80; x <= 80; x += 8) {
      box(0xc4d1ac, [x, .15, -31], [.2, .2, .2]); box(0xc4d1ac, [x, .15, -15], [.2, .2, .2]);
    }
    box(0xa5b2b6, [36, 6, -65], [9, 12, 9]); box(0x426372, [36, 13, -65], [13, 3, 12]);
    for (let i = 0; i < 5; i++) box(0xaeb8b9, [-48 + i * 18, 3, -76], [15, 6, 12]);
  }
  // Soft billboard cumulus: lit spheres read as floating discs through the windows.
  const cloudPixels = new Uint8Array(128 * 64 * 4);
  const puffs = [[.3, .62, .2], [.5, .5, .27], [.7, .6, .21], [.42, .68, .17], [.6, .7, .16]];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127, v = y / 63;
    let density = 0;
    for (const [px, py, r] of puffs) density += Math.exp(-(((u - px) * 1.9) ** 2 + (v - py) ** 2) / (r * r * .5));
    const alpha = Math.min(1, Math.max(0, density - .35) * 1.4) * Math.min(1, (1 - v) * 4);
    const shade = 255 - Math.round(Math.max(0, v - .55) * 70);
    cloudPixels.set([shade, shade, Math.min(255, shade + 4), Math.round(alpha * 235)], (y * 128 + x) * 4);
  }
  const cloudTexture = new THREE.DataTexture(cloudPixels, 128, 64); cloudTexture.flipY = true; cloudTexture.colorSpace = THREE.SRGBColorSpace; cloudTexture.magFilter = THREE.LinearFilter; cloudTexture.needsUpdate = true;
  const cloudMaterial = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, depthWrite: false, fog: true });
  resources.add(cloudTexture); resources.add(cloudMaterial);
  const clouds = new THREE.Group(); clouds.position.y = high ? 26 : 0; scene.add(clouds);
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Sprite(cloudMaterial);
    cloud.position.set((i % 6 - 2.5) * 34 + Math.sin(i * 5) * 9, 24 + (i * 7) % 3 * 5, -70 - Math.floor(i / 6) * 34);
    cloud.scale.set(34 + (i * 13) % 4 * 6, 12 + (i * 5) % 3 * 3, 1); clouds.add(cloud);
  }
  const rainPositions = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) rainPositions.set([Math.sin(i * 31) * 50, i % 25, -8 - (i * 17) % 55], i * 3);
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.PointsMaterial({ color: 0xcadce6, size: .08, transparent: true, opacity: .6, depthWrite: false });
  const rain = new THREE.Points(rainGeometry, rainMaterial); scene.add(rain); resources.add(rainGeometry); resources.add(rainMaterial);
  const starPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) starPositions.set([Math.sin(i * 12.9898) * 120, 22 + Math.abs(Math.sin(i * 78.233)) * 50, -150 + Math.cos(i * 3.7) * 10], i * 3);
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.4, sizeAttenuation: false, fog: false });
  const stars = new THREE.Points(starGeometry, starMaterial); stars.visible = false; scene.add(stars); resources.add(starGeometry); resources.add(starMaterial);
  // A small vertical gradient replaces the flat colour sky for sunset, night and rain.
  const skyPixels = new Uint8Array(64 * 4);
  const skyTexture = new THREE.DataTexture(skyPixels, 1, 64); skyTexture.colorSpace = THREE.SRGBColorSpace; skyTexture.magFilter = THREE.LinearFilter; resources.add(skyTexture);
  const paintSky = ([top, middle, horizon]: number[]) => {
    const a = new THREE.Color(), b = new THREE.Color();
    for (let row = 0; row < 64; row++) {
      const v = row / 63;
      const raw = THREE.LinearSRGBColorSpace; // keep raw sRGB bytes; the texture itself is tagged sRGB
      if (v < .45) a.setHex(horizon, raw); else if (v < .7) a.setHex(horizon, raw).lerp(b.setHex(middle, raw), (v - .45) / .25); else a.setHex(middle, raw).lerp(b.setHex(top, raw), (v - .7) / .3);
      skyPixels.set([Math.round(a.r * 255), Math.round(a.g * 255), Math.round(a.b * 255), 255], row * 4);
    }
    skyTexture.needsUpdate = true;
  };
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const object of [...scene.children]) {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) || object === ground) continue;
    object.updateMatrixWorld(); const parts = batches.get(object.material) || [];
    parts.push(object.geometry.clone().applyMatrix4(object.matrixWorld)); batches.set(object.material, parts); scene.remove(object);
  }
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (geometry) { resources.add(geometry); scene.add(new THREE.Mesh(geometry, material)); }
  }
  const restores: (() => void)[] = [];
  const targetAspect = target.width / target.height;
  windows.forEach((window, index) => {
    // Cropped UVs share one render-target texture without copying GPU pixels.
    const original = window.geometry, geometry = original.clone(), uv = geometry.getAttribute('uv');
    const slice = 1 / Math.max(1, windows.length);
    // Crop to the window's own proportions so tall arches are not stretched vertically.
    if (!original.boundingBox) original.computeBoundingBox();
    const box = original.boundingBox!, aspect = Math.max(.05, ((box.max.x - box.min.x) * Math.abs(window.scale.x)) / Math.max(.001, (box.max.y - box.min.y) * Math.abs(window.scale.y)));
    let uSpan = Math.min(slice, aspect / targetAspect), vSpan = Math.min(1, uSpan * targetAspect / aspect);
    if (!Number.isFinite(uSpan) || !Number.isFinite(vSpan)) { uSpan = slice; vSpan = 1; }
    const u0 = (index + .5) * slice - uSpan / 2, v0 = (1 - vSpan) * .5;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * uSpan, v0 + uv.getY(i) * vSpan);
    const previous = window.material, m = new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false });
    window.geometry = geometry; window.material = m; resources.add(geometry); resources.add(m);
    restores.push(() => { window.geometry = original; window.material = previous; });
  });
  let previousKey = '', last = -1, clock = 0, lastMotionClock = 0, stopped = false;
  let distantLandscape: THREE.DataTexture | undefined;
  if (!urban && !airport && graphics !== 'illustrated') new RGBELoader().loadAsync('/focus-assets/forest_slope.hdr').then(texture => {
    if (stopped) { texture.dispose(); return; }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    resources.add(texture); distantLandscape = texture; previousKey = '';
  }).catch(() => { /* The layered geometry remains usable when the local HDR is unavailable. */ });
  return {
    update(dt: number, daylight: RoomDaylight, weather: RoomWeather, moving: boolean) {
      if (stopped) return;
      if (moving) clock += Math.min(dt, .1);
      const phase = resolveRoomDaylight(daylight), key = `${phase}:${weather}`;
      const step = Math.floor(clock * (graphics === 'illustrated' ? 8 : 12));
      if (key === previousKey && step === last) return;
      previousKey = key; last = step;
      const motionClock = moving ? clock : lastMotionClock;
      const night = phase === 'night', sunset = phase === 'sunset', wet = weather === 'rain';
      const sky = night ? 0x1b2a47 : wet ? 0xa9b4ba : sunset ? 0xf0b98a : 0xcfe2ea;
      // The forest HDR suits clear daylight only; other moods need a visible sky so the windows change with them.
      paintSky(night ? [0x050b1a, 0x13213b, sky] : wet ? [0x6f7e89, 0x95a3ab, sky] : sunset ? [0x46507f, 0xd98d72, sky] : [0x5f9bd0, 0x9fc6e2, sky]);
      scene.background = distantLandscape && !night && !sunset && !wet ? distantLandscape : skyTexture; scene.backgroundIntensity = .9;
      scene.fog = new THREE.Fog(sky, wet ? 35 : 65, 170);
      stars.visible = night && !wet;
      hemisphere.intensity = night ? .16 : wet ? 1.2 : sunset ? 1.3 : 2; hemisphere.color.set(night ? 0x6f86b0 : sunset ? 0xffd9b8 : 0xeaf4ff);
      sun.intensity = night ? .18 : wet ? .6 : sunset ? 2 : 2.5; sun.color.set(night ? 0x8eb8ea : sunset ? 0xff9f5a : 0xffedcc);
      sun.position.set(-20, night ? 30 : sunset ? 7 : 30, 15);
      lit.emissiveIntensity = night ? 1.6 : sunset ? .6 : 0;
      (ground.material as THREE.MeshStandardMaterial).roughness = wet ? .28 : .85;
      trees.rotation.z = Math.sin(motionClock * .28) * .006;
      clouds.position.x = Math.sin(motionClock * .012) * 10;
      cloudMaterial.color.set(night ? 0x56627c : wet ? 0xaab4bb : sunset ? 0xffcfae : 0xffffff); cloudMaterial.opacity = night ? .5 : wet ? .95 : .9;
      if (airport) {
        transit.position.x = -sceneryTravel(motionClock, 1.8, 60);
        if (departure) {
          const progress = ((motionClock + 12) % 80) / 80;
          departure.position.set(160 - progress * 320, Math.max(0, progress - .38) * 40, -48);
          departure.rotation.z = progress > .38 ? -.08 : 0;
        }
      }
      traffic.forEach((car, i) => { const direction = i % 2 ? -1 : 1; car.position.set(direction * sceneryTravel(motionClock, 4 + i % 3, i * 23), 0, streetZ + (i % 2 ? -2 : 2)); });
      walkers.forEach((person, i) => { person.position.set((i % 2 ? -1 : 1) * sceneryTravel(motionClock, .65, i * 16), 0, streetZ - 5.8 - i % 2 * 1.2); person.rotation.z = Math.sin(motionClock * 5 + i) * .025; });
      rain.visible = wet; rain.position.y = -(motionClock * 6 % 4);
      lastMotionClock = motionClock;
      const previous = renderer.getRenderTarget();
      try { renderer.setRenderTarget(target); renderer.render(scene, camera); }
      finally { renderer.setRenderTarget(previous); }
    },
    dispose() { if (stopped) return; stopped = true; restores.forEach(restore => restore()); resources.forEach(resource => resource.dispose()); scene.clear(); },
  };
}
