import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Continuous scenery, not a short ground tile that jumps back during takeoff. */
export function buildFlightLandscape(parent: THREE.Object3D) {
  const root = new THREE.Group(); root.name = 'continuous-flight-landscape'; parent.add(root);
  const cube = new THREE.BoxGeometry(), parts = new Map<number, THREE.BufferGeometry[]>();
  const transform = new THREE.Object3D();
  const box = (color: number, at: number[], size: number[]) => {
    transform.position.fromArray(at); transform.scale.fromArray(size); transform.updateMatrix();
    const group = parts.get(color) || []; group.push(cube.clone().applyMatrix4(transform.matrix)); parts.set(color, group);
  };
  box(0x647961, [0, -2.8, -600], [3200, 1, 3200]);
  box(0x365e70, [-620, -2.2, -600], [900, .05, 3200]);
  box(0xa9ae9d, [-163, -2.12, -600], [14, .06, 3200]);
  box(0x444d50, [0, -2.05, -300], [14, .08, 1000]);
  for (let z = -780; z < 200; z += 20) box(0xe5e0cd, [0, -1.98, z], [.35, .02, 8]);
  for (const x of [-6.4, 6.4]) box(0xe5e0cd, [x, -1.98, -300], [.12, .02, 1000]);
  for (let i = 0; i < 6; i++) for (const side of [-1, 1]) box(0xe5e0cd, [side * (1.4 + i * .7), -1.98, -20], [.3, .02, 16]);
  box(0x737e7e, [54, -2.03, -150], [70, .08, 290]);
  box(0x626e70, [22, -2.01, -150], [8, .1, 420]);
  for (const z of [-250, -130, -10]) box(0x737e7e, [12, -2.01, z], [26, .1, 9]);
  box(0xabb6b6, [95, 3, -150], [20, 10, 270]);
  box(0x547481, [84.9, 4.5, -150], [.1, 5, 260]);
  for (let z = -260; z < -20; z += 30) {
    box(0x8d9e9f, [71, 1.5, z], [30, 3, 4]);
    box(0xc6bd92, [60, -1.95, z], [30, .02, .18]);
  }
  for (let i = 0; i < 5; i++) box(0x939d98, [140 + i * 24, 2, -320], [20, 8, 32]);
  box(0xb7b6aa, [130, 12, -50], [7, 28, 7]); box(0x426a7c, [130, 27, -50], [14, 5, 12]);
  // An urban grid, green courtyards and agricultural parcels continue beyond the airport.
  for (let col = 0; col < 7; col++) box(0x555e5a, [150 + col * 80, -2.05, -400], [6, .05, 1300]);
  for (let row = 0; row < 13; row++) {
    const z = 180 - row * 90;
    box(0x555e5a, [420, -2.05, z], [570, .05, 8]);
    for (let col = 0; col < 7; col++) {
      const x = 180 + col * 80, seed = row * 11 + col;
      if (seed % 5 === 0) { box(0x77906b, [x, -2, z - 40], [45, .05, 55]); continue; }
      for (let j = 0; j < 3; j++) {
        const h = 5 + (seed * 7 + j * 11) % 27;
        box([0x9b9c90, 0xafaa99, 0x879899][seed % 3], [x + (j - 1) * 16, h / 2 - 2, z - 40], [12, h, 28]);
        box(0x637679, [x + (j - 1) * 16, h - 1.8, z - 40], [10, .3, 25]);
      }
    }
    for (let col = 0; col < 3; col++) box((row + col) % 2 ? 0x8b9367 : 0x8d8262, [-45 - col * 36, -2.05, z], [31, .04, 82]);
  }
  const resources: { dispose(): void }[] = [cube];
  for (const [color, geometries] of parts) {
    const geometry = mergeGeometries(geometries); geometries.forEach(item => item.dispose());
    if (!geometry) continue;
    const material = new THREE.MeshStandardMaterial({ color, roughness: .9 });
    resources.push(geometry, material); root.add(new THREE.Mesh(geometry, material));
  }
  let disposed = false;
  return { root, dispose() { if (disposed) return; disposed = true; root.removeFromParent(); resources.forEach(item => item.dispose()); } };
}

export function flightLandscapePose(lift: number, travel: number) {
  const climb = THREE.MathUtils.clamp(Number.isFinite(lift) ? lift : 0, 0, 1);
  return { altitude: climb * 85, forward: Math.min(900, Math.max(0, Number.isFinite(travel) ? travel : 0) * 3), lookDown: 2 + climb * 12 };
}

export function isWingWindow(z: number) { return Math.abs(z) < 1; }
