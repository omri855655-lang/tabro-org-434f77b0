import * as THREE from 'three';

// Aircraft face -X. Keep the original fuselage dimensions and gate-door position
// so scenery movement and the terminal's jet bridge continue to line up.
export function buildAirportAircraft(parent: THREE.Group, resources: Set<{ dispose(): void }>) {
  const root = new THREE.Group(); root.name = 'airport-airframe'; parent.add(root);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xeceee9, roughness: .36, metalness: .12, clearcoat: .3 });
  const wingPaint = new THREE.MeshStandardMaterial({ color: 0xbcc6cb, roughness: .48, metalness: .48 });
  const livery = new THREE.MeshStandardMaterial({ color: 0x355f70, roughness: .44, metalness: .15 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x243f52, roughness: .2, metalness: .48 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x252b31, roughness: .92 });
  const red = new THREE.MeshBasicMaterial({ color: 0xff5445 });
  const green = new THREE.MeshBasicMaterial({ color: 0x65e7ad });
  [paint, wingPaint, livery, glass, rubber, red, green].forEach(item => resources.add(item));
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const tyre = new THREE.CylinderGeometry(.4, .4, .22, 12); tyre.rotateX(Math.PI / 2);
  const intake = new THREE.CylinderGeometry(.31, .31, .025, 18); intake.rotateZ(Math.PI / 2);
  [sphere, box, tyre, intake].forEach(item => resources.add(item));
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, at: number[], scale = [1, 1, 1]) => {
    const item = new THREE.Mesh(geometry, material); item.name = name;
    item.position.fromArray(at); item.scale.fromArray(scale); root.add(item); return item;
  };
  const surface = (name: string, points: number[][], height: number, material: THREE.Material, thickness = .12) => {
    const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 }); resources.add(geometry);
    const item = mesh(name, geometry, material, [0, height, 0]); item.rotation.x = Math.PI / 2; return item;
  };
  mesh('fuselage', sphere, paint, [0, 3, 0], [8, 1.1, 1.1]);
  mesh('belly-livery', sphere, livery, [.7, 2.67, 0], [6.6, .75, 1.02]);
  for (const side of [-1, 1]) {
    surface(`main-wing-${side}`, [[-1.6, side * .7], [2.6, side * .7], [3.7, side * 7.5], [2.1, side * 7.5]], 2.75, wingPaint);
    surface(`tailplane-${side}`, [[4.5, side * .4], [6.8, side * .4], [7.1, side * 3], [6.2, side * 3]], 3.15, wingPaint, .08);
    mesh(`winglet-${side}`, box, livery, [2.9, 3.05, side * 7.45], [1.6, .65, .08]).rotation.z = -.18;
    mesh(`navigation-light-${side}`, sphere, side < 0 ? red : green, [2.3, 2.83, side * 7.55], [.09, .06, .08]);
    mesh(`engine-${side}`, sphere, paint, [.1, 1.97, side * 2.65], [1.25, .47, .47]);
    mesh(`engine-intake-${side}`, intake, rubber, [-1.03, 1.97, side * 2.65]);
    mesh(`engine-hub-${side}`, sphere, wingPaint, [-1.06, 1.97, side * 2.65], [.12, .12, .12]);
    mesh(`engine-pylon-${side}`, box, wingPaint, [.4, 2.47, side * 2.65], [.8, .48, .12]);
    for (let i = 0; i < 16; i++) {
      const x = -5.2 + i * .6;
      const radius = 1.1 * Math.sqrt(1 - (x / 8) ** 2);
      mesh(`cabin-window-${side}-${i}`, sphere, glass, [x, 3.36, side * (radius - .04)], [.12, .16, .035]);
    }
    mesh(`cockpit-${side}`, box, glass, [-6.53, 3.45, side * .54], [.85, .3, .045]).rotation.y = side * .46;
    mesh(`cockpit-front-${side}`, box, glass, [-7.04, 3.43, side * .29], [.34, .27, .045]).rotation.y = side * .78;
    mesh(`door-${side}`, box, wingPaint, [-5, 3.02, side * .88], [.38, 1.03, .025]);
  }
  const fin = new THREE.Shape(); fin.moveTo(4.5, 3.5); fin.lineTo(6.7, 3.5); fin.lineTo(6.6, 6.25); fin.lineTo(5.8, 6.25); fin.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: .15, bevelEnabled: false }); resources.add(finGeometry);
  mesh('vertical-tail', finGeometry, livery, [0, 0, -.075]);
  for (const [x, z] of [[-5, 0], [1.2, -.8], [1.2, .8]]) {
    mesh(`gear-strut-${x}-${z}`, box, wingPaint, [x, 1.25, z], [.1, 1.8, .1]);
    for (const offset of [-.15, .15]) mesh(`wheel-${x}-${z}-${offset}`, tyre, rubber, [x, .45, z + offset]);
  }
  return root;
}
