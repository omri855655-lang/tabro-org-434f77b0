import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoomAtmosphere } from '@/lib/focusRoomJourney';

type Builders = { box: (parent: THREE.Object3D, color: number, at: number[], size: number[]) => THREE.Mesh; ball: (parent: THREE.Object3D, color: number, at: number[], size: number[]) => THREE.Mesh };

/** Architectural details stay at the perimeter, outside the six walking/seat paths. */
export function buildRoomCraft(scene: THREE.Scene, kind: RoomAtmosphere, b: Builders, width: number, height: number, front: number, back: number) {
  const root = new THREE.Group(); root.name = `room-craft-${kind}`; scene.add(root);
  const resources: { dispose: () => void }[] = [];
  const plane = kind === 'plane' || kind === 'business-plane', cafe = kind === 'cafe' || kind === 'city-cafe';
  const warm = ['library', 'grand', 'intimate', 'heritage-library', 'cafe'].includes(kind);
  const brass = 0xb29a65, wood = kind === 'heritage-library' ? 0x513523 : 0x77624d;
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe6b4, emissive: 0xffd494, emissiveIntensity: .7, roughness: .4 }); resources.push(glow);
  const metal = new THREE.MeshStandardMaterial({ color: brass, metalness: .65, roughness: .3 }); resources.push(metal);
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xe8dfca, roughness: .24 }); resources.push(ceramic);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 24), torus = new THREE.TorusGeometry(1, .045, 8, 32); resources.push(cylinder, torus);
  const round = (at: number[], size: number[], material: THREE.Material = metal) => {
    const mesh = new THREE.Mesh(cylinder, material); mesh.position.fromArray(at); mesh.scale.fromArray(size); root.add(mesh); return mesh;
  };
  const litBox = (at: number[], size: number[]) => { const mesh = b.box(root, 0xffe6b4, at, size); mesh.material = glow; return mesh; };
  const bookSet = (x: number, y: number, z: number, count = 7) => {
    for (let i = 0; i < count; i++) {
      const color = [0x385c58, 0x8e5744, 0xc2a576, 0x4d5b73][i % 4], bx = x + i * .19;
      b.box(root, color, [bx, y + .3, z], [.15, .55 + i % 3 * .07, .35]);
      for (const dy of [.13, .46]) b.box(root, brass, [bx, y + dy, z + .18], [.11, .014, .008]);
    }
  };
  if (plane) {
    const business = kind === 'business-plane';
    // Cabin-scale seams, air vents, reading-light lenses and carpet edging.
    for (const side of [-1, 1]) {
      for (const y of [.18, 1.2, 3.8]) b.box(root, business ? 0x9e8a70 : 0xbfc7c9, [side * (width - .15), y, .5], [.025, .025, back - front - 1]);
      for (let z = -9; z < 11; z += 2.5) {
        const panel = b.box(root, 0x87969b, [side * 3.1, 4.12, z], [.85, .06, .7]); panel.rotation.z = side * .12;
        for (const dz of [-.18, .18]) { const vent = round([side * 3.1, 4.06, z + dz], [.085, .025, .085]); vent.material = metal; }
        litBox([side * 2.75, 4.03, z], [.08, .02, .16]);
      }
      litBox([side * 1.6, .04, .5], [.025, .01, 22]);
    }
    b.box(root, business ? 0x66594d : 0x405161, [0, .02, 1], [1.5, .025, 22]);
    for (let z = -10; z < 12; z += .32) b.box(root, business ? 0x82715c : 0x62727b, [0, .04, z], [1.45, .006, .012]);
    for (const x of [-5.3, 5.3]) { b.box(root, 0xb9c1c0, [x, 1.8, front + .3], [.7, 3.3, .4]); for (let y = .4; y < 3.4; y += .5) b.box(root, 0x6e7f85, [x, y, front + .52], [.55, .025, .04]); }
  } else if (cafe) {
    // A working coffee bar with cups, grinder, pastry dome and menu slats.
    for (let x = -6.8; x < 7; x += .22) b.box(root, kind === 'city-cafe' ? 0x585a53 : 0x856143, [x, .98, back - 1.58], [.06, 1.7, .04]);
    for (const x of [-4.5, -4, -3.5, -3]) { round([x, 2.2, back - 1.1], [.13, .2, .13], ceramic); round([x, 2.1, back - 1.1], [.2, .025, .2]); }
    b.box(root, 0x334742, [2.5, 2.4, back - 1], [.5, .65, .6]); b.ball(root, 0x7e6452, [2.5, 2.9, back - 1], [.23, .3, .23]);
    round([4, 2.17, back - 1], [.8, .04, .5]);
    for (let i = 0; i < 5; i++) b.ball(root, 0xc19458, [3.5 + i * .23, 2.3, back - 1], [.13, .11, .16]);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe6f1ec, transparent: true, opacity: .2, roughness: .15, depthWrite: false }); resources.push(glass);
    const dome = b.ball(root, 0xffffff, [4, 2.3, back - 1], [.85, .5, .55]); dome.material = glass;
    for (const x of [-4, 0, 4]) { b.box(root, 0x374c41, [x, 3.75, back - .18], [2.8, 1.4, .08]); for (let row = 0; row < 4; row++) b.box(root, 0xb3c2a5, [x, 4.1 - row * .23, back - .24], [1.7 - row % 2 * .4, .025, .015]); }
    if (kind === 'cafe') { bookSet(-6.5, 2.14, back - 1); bookSet(5, 2.14, back - 1); }
  } else if (kind === 'airport') {
    for (const side of [-1, 1]) {
      b.box(root, 0x455d67, [side * 10.5, 1.1, -6], [2.5, 2.2, 1.2]);
      litBox([side * 10.5, 1.5, -5.37], [1.7, .45, .025]);
      for (let z = -7; z < 9; z += 3.2) { b.box(root, 0x9cabb0, [side * 11.7, 3.7, z], [.12, 7.4, .18]); round([side * 8.9, .6, z], [.06, 1.2, .06]); }
    }
    for (const z of [-5, 1, 7]) litBox([0, height - .3, z], [18, .035, .16]);
  } else if (kind === 'office' || kind === 'modern-library') {
    for (let x = -8; x <= 8; x += .6) b.box(root, 0x9caa95, [x, height - .25, 0], [.08, .32, 15]);
    for (const side of [-1, 1]) {
      b.box(root, 0xd0c5ae, [side * (width - .6), 1.1, 3], [.7, 2.2, 5]);
      for (let z = 1; z < 6; z++) { b.box(root, 0x5c7564, [side * (width - .2), 2.8, z], [.2, .5, .6]); }
    }
    if (kind === 'modern-library') bookSet(-4, .1, back - .6, 16);
  } else {
    // Cornices, framed shelf panels and warm sconces anchor each reading room.
    for (const side of [-1, 1]) {
      for (const y of [.18, 1.05, height - .38]) b.box(root, warm ? wood : 0xb1a58d, [side * (width - .18), y, (front + back) / 2], [.15, .14, back - front]);
      for (let z = front + 3; z < back - 1; z += 4) {
        b.box(root, brass, [side * (width - .55), 3.1, z], [.18, .8, .3]);
        litBox([side * (width - .73), 3.3, z], [.2, .4, .24]);
      }
    }
    if (kind === 'intimate') {
      b.box(root, 0xb5a38c, [0, 1.15, back - .5], [4, 2.3, .8]); b.box(root, 0x292d2b, [0, .9, back - .95], [2.8, 1.5, .08]);
      b.box(root, wood, [0, 2.35, back - .55], [4.6, .2, 1]); bookSet(-1.7, 2.45, back - .5, 6);
      litBox([0, .45, back - 1.02], [2, .1, .06]);
    }
    if (kind === 'grand' || kind === 'heritage-library') {
      for (const z of [-5, 4]) { const ring = new THREE.Mesh(torus, metal); ring.position.set(0, 6.1, z); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(1.9); root.add(ring); for (let i = 0; i < 10; i++) litBox([Math.cos(i * Math.PI / 5) * 1.9, 6.2, z + Math.sin(i * Math.PI / 5) * 1.9], [.08, .24, .08]); }
    }
  }
  // Batch static trim by material instead of adding hundreds of draw calls.
  root.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const parts = batches.get(object.material) || [];
    parts.push(object.geometry.clone().applyMatrix4(object.matrixWorld)); batches.set(object.material, parts);
  });
  root.clear();
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (!geometry) continue;
    resources.push(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; root.add(mesh);
  }
  let stopped = false;
  return { dispose() { if (stopped) return; stopped = true; root.removeFromParent(); resources.forEach(resource => resource.dispose()); } };
}
