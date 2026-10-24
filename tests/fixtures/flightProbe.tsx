// Temporary sandbox-only QA probe: renders the cabin and terminal at fixed times. Not part of the app.
import * as THREE from 'three';
import { buildFocusEnvironment } from '../../src/components/zoneflow/focusRoomEnvironment';
import { createRoomScenery } from '../../src/components/zoneflow/focusRoomScenery';

const params = new URLSearchParams(location.search);
const graphics = (params.get('graphics') || 'illustrated') as 'illustrated' | 'natural';
const kind = (params.get('kind') || 'plane') as 'plane' | 'business-plane' | 'airport';
const W = 1240, H = 560;
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, antialias: true });
renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
const out = document.getElementById('out')!;
const snap = (label: string, source: HTMLCanvasElement = canvas) => {
  const fig = document.createElement('figure'); const img = document.createElement('img'); img.src = source.toDataURL('image/png');
  const cap = document.createElement('figcaption'); cap.textContent = label; fig.append(img, cap); out.append(fig);
};
const scene = new THREE.Scene();
const cube = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 16, 12);
const mats = new Map<number, THREE.MeshStandardMaterial>();
const mat = (c: number) => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: graphics === 'illustrated' })); return mats.get(c)!; };
const shape = (g: THREE.BufferGeometry) => (p: THREE.Object3D, c: number, at: number[], s: number[]) => { const m = new THREE.Mesh(g, mat(c)); m.position.fromArray(at); m.scale.fromArray(s); p.add(m); return m; };
scene.add(new THREE.HemisphereLight(0xf7efdf, 0x74858b, 1.8)); const sun = new THREE.DirectionalLight(0xffe5be, 2.4); sun.position.set(-5, 10, -5); scene.add(sun);
const env = buildFocusEnvironment(scene, kind, { box: shape(cube), ball: shape(sphere), mat }, graphics, renderer, 'day', true);
const camera = new THREE.PerspectiveCamera(52, W / H, .05, 120);
// Render a render-target texture full-frame so the raw window feeds can be inspected.
const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial()); quadScene.add(quad);
const showTexture = (texture: THREE.Texture, label: string) => { (quad.material as THREE.MeshBasicMaterial).map = texture; (quad.material as THREE.MeshBasicMaterial).needsUpdate = true; renderer.setSize(W, W / 2, false); renderer.render(quadScene, quadCam); snap(label); renderer.setSize(W, H, false); };
const feeds = () => { const found = new Map<THREE.Texture, number>(); scene.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial; if (o instanceof THREE.Mesh && m?.map && (m.map as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) found.set(m.map, (found.get(m.map) || 0) + 1); }); return [...found]; };

if (kind !== 'airport') {
  const states: [string, number, number][] = [['ground (0 s)', 0, 0], ['rolling (20 s)', 20, 20], ['climb (55 s)', 55, 55], ['cruise (90 s, travel 300)', 90, 300]];
  let travelled = 0;
  for (const [label, elapsed, travel] of states) {
    env.update(elapsed, true, false, travel - travelled, 'day', 'clear'); travelled = travel;
    camera.fov = 52; camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(2.2, 2.55, 0); camera.lookAt(-5.8, 2.45, 0); renderer.render(scene, camera); snap(`${kind} left side, ${label}`);
    camera.position.set(-2.5, 2.6, -9); camera.lookAt(-5.8, 2.5, 4); renderer.render(scene, camera); snap(`${kind} along left wall, ${label}`);
    const list = feeds(); list.forEach(([texture, count], i) => showTexture(texture, `feed ${i} used by ${count} windows, ${label}`));
  }
  document.title = `done feeds=${feeds().map(([, c]) => c).join(',')}`;
} else {
  const scenery = createRoomScenery(renderer, env.assetWindows, 'airport', graphics);
  for (const t of [0, 25]) {
    scenery.update(t || .1, 'day', 'clear', true);
    camera.position.set(0, 2.4, 6); camera.lookAt(0, 3.2, -9); renderer.render(scene, camera); snap(`terminal facing windows t=${t}s`);
    camera.position.set(6, 2.4, -2); camera.lookAt(-9, 3, -9); renderer.render(scene, camera); snap(`terminal toward gate side t=${t}s`);
    const map = (env.assetWindows[0].material as THREE.MeshBasicMaterial).map; if (map) showTexture(map, `terminal panorama t=${t}s`);
  }
  document.title = 'done';
}
