import * as THREE from 'three';

type CabinBuilders = {
  box: (parent: THREE.Object3D, color: number, at: number[], size: number[]) => THREE.Mesh;
};

// Cabin architecture is independent of avatars and the logical seating grid.
export function buildAircraftCabin(scene: THREE.Scene, b: CabinBuilders, business: boolean, front: number, back: number, width: number) {
  const resources: {dispose: () => void}[] = [];
  const root = new THREE.Group();root.name = 'aircraft-cabin-detail';scene.add(root);
  const shellMaterial = new THREE.MeshStandardMaterial({color:0xe7e6df,roughness:.64,side:THREE.DoubleSide});
  const metalMaterial = new THREE.MeshStandardMaterial({color:0xb9c2c7,metalness:.68,roughness:.3});
  const glowMaterial = new THREE.MeshStandardMaterial({color:0xffe7bc,emissive:0xffd49a,emissiveIntensity:.65,roughness:.5});
  resources.push(shellMaterial,metalMaterial,glowMaterial);
  const extrude = (shape: THREE.Shape, depth: number, material: THREE.Material) => {
    const geometry = new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:20});
    resources.push(geometry);const mesh = new THREE.Mesh(geometry,material);root.add(mesh);return mesh;
  };
  const roof = new THREE.Shape();
  roof.moveTo(-width,2.7);roof.absellipse(0,2.7,width,2.4,Math.PI,0,true,0);
  roof.lineTo(width,2.82);roof.absellipse(0,2.82,width-.12,2.16,0,Math.PI,false,0);roof.closePath();
  const shell=extrude(roof,back-front,shellMaterial);shell.position.z=front;

  const ringGeometry=new THREE.TorusGeometry(.075,.019,6,12);
  resources.push(ringGeometry);
  for(const side of [-1,1]) {
    // Rounded cross-section instead of a solid rectangular overhead box.
    const binProfile=new THREE.Shape();binProfile.moveTo(3.86,4.38);binProfile.lineTo(5.48,4.38);
    binProfile.lineTo(5.48,3.8);binProfile.quadraticCurveTo(4.2,3.35,3.86,3.88);binProfile.closePath();
    for(let z=front+.8;z<=back-2.42;z+=2.5) {
      const bin=extrude(binProfile,2.42,shellMaterial);bin.scale.x=side;bin.position.z=z;
      b.box(root,0x8b969a,[side*4.13,3.81,z+1.2],[.2,.045,.27]);
      const service=b.box(root,0xcdd1cc,[side*3.65,3.55,z+1.2],[.52,.06,1.5]);service.name='overhead-service-panel';
      for(const dz of [-.35,.35]){
        const vent=new THREE.Mesh(ringGeometry,metalMaterial);vent.position.set(side*3.65,3.51,z+1.2+dz);vent.rotation.x=Math.PI/2;root.add(vent);
      }
      const readingLight=b.box(root,0xffe6bc,[side*3.65,3.51,z+1.2],[.13,.02,.15]);readingLight.material=glowMaterial;
      // Sidewall panel seams leave the existing windows and seat coordinates intact.
      b.box(root,0xc6cbc8,[side*(width-.13),1.4,z],[.025,2.6,.015]);
    }
    const strip=b.box(root,0xffe7bc,[side*3.88,4.37,(front+back)/2],[.045,.035,back-front-1]);strip.material=glowMaterial;
    const lowerStrip=b.box(root,0xb9c2c7,[side*(width-.13),.3,(front+back)/2],[.035,.12,back-front]);lowerStrip.material=metalMaterial;
  }
  const seamPoints=Array.from({length:21},(_,index)=>{
    const angle=.55+index/20*(Math.PI-1.1);
    return new THREE.Vector3(Math.cos(angle)*(width-.17),2.78+Math.sin(angle)*2.12,0);
  });
  const seamGeometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints),20,.012,4,false);
  resources.push(seamGeometry);
  for(let z=front+1;z<back;z+=2.5) {
    const seam=new THREE.Mesh(seamGeometry,metalMaterial);seam.position.z=z;seam.name='ceiling-panel-seam';root.add(seam);
  }
  // A compact galley at the front provides a recognizable cabin end wall.
  for(const x of [-4.2,4.2]) {
    b.box(root,0xb5bebc,[x,1.1,front+.5],[1.65,2.2,.65]);
    b.box(root,business?0x897664:0x7b8c95,[x,2.5,front+.48],[1.65,.5,.7]);
    for(const y of [.4,1.05,1.7]) {
      b.box(root,0xdde0d9,[x,y,front+.87],[1.45,.56,.025]);
      b.box(root,0x738187,[x+.42,y,front+.9],[.3,.045,.04]);
    }
  }
  return {root,dispose:()=>{root.removeFromParent();resources.forEach(resource=>resource.dispose());}};
}
