import * as THREE from 'three';

type Builders={box:(parent:THREE.Object3D,color:number,at:number[],size:number[])=>THREE.Mesh};
export function buildHistoricalLibrary(scene:THREE.Scene,b:Builders,monastery:boolean,front:number,back:number,surfaces:{floor:THREE.Mesh;walls:THREE.Mesh[]}) {
  const root=new THREE.Group();root.name=monastery?'stone-monastery-library':'historic-wood-library';scene.add(root);
  const resources:{dispose:()=>void}[]=[],restores:(()=>void)[]=[];
  if(monastery){
    const pixels=new Uint8Array(128*128*4);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const edge=y%32<2||(x+(Math.floor(y/32)%2)*32)%64<2;
      // Warm, slightly darker limestone so the hall does not wash out to white under bounce light.
      const value=edge?104:166+((x*13+y*7)%19);
      const offset=(y*128+x)*4;pixels.set([value,value-12,value-32,255],offset);
    }
    const texture=new THREE.DataTexture(pixels,128,128);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);texture.needsUpdate=true;
    const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.035,roughness:.97});resources.push(texture,material);
    for(const mesh of [surfaces.floor,...surfaces.walls]){const previous=mesh.material;restores.push(()=>{mesh.material=previous;});mesh.material=material;}
    const arch=new THREE.Shape();arch.moveTo(-9.2,5);arch.absellipse(0,5,9.2,4.4,Math.PI,0,true,0);arch.lineTo(8.78,5);arch.absellipse(0,5,8.78,3.98,0,Math.PI,false,0);arch.closePath();
    const geometry=new THREE.ExtrudeGeometry(arch,{depth:.4,bevelEnabled:false,curveSegments:32});resources.push(geometry);
    for(const z of [front+1,(front+back)/2,back-4]){
      const rib=new THREE.Mesh(geometry,material);rib.position.z=z;root.add(rib);
      for(const x of [-9,9]){
        b.box(root,0xbeb198,[x,2.5,z],[.65,5,.7]);b.box(root,0xd0c2a8,[x,4.9,z],[1,.25,1]);b.box(root,0x9a8b70,[x,.17,z],[1,.34,1]);
        const lamp=b.box(root,0xf9d591,[x*.94,3.2,z+.2],[.2,.4,.2]);
        const glow=new THREE.MeshStandardMaterial({color:0xffdda0,emissive:0xffb955,emissiveIntensity:1.1});lamp.material=glow;resources.push(glow);
        const light=new THREE.PointLight(0xffd69a,14,9,2);light.position.set(x*.9,3.3,z+.4);root.add(light);
      }
    }
  }else{
    // Coffered ceiling, carved cornices and shelf ladders distinguish the wood hall.
    for(let z=front+.5;z<back;z+=2.4){b.box(root,0x4b3023,[0,9.65,z],[19,.3,.22]);for(const x of [-6,-3,0,3,6])b.box(root,0x765239,[x,9.8,z+1.1],[.18,.2,2.1]);}
    for(const side of [-1,1]){
      for(const y of [.25,4.5,8.7])b.box(root,0x59402b,[side*9.22,y,(front+back)/2],[.14,.13,back-front]);
      const ladder=new THREE.Group();ladder.position.set(side*9.4,0,2.2);ladder.rotation.z=-side*.09;root.add(ladder);
      for(const x of [-.35,.35])b.box(ladder,0x533c27,[x,2.4,0],[.075,4.8,.1]);
      for(let y=.3;y<4.7;y+=.4)b.box(ladder,0xb39a63,[0,y,.02],[.75,.055,.15]);
    }
  }
  return {dispose:()=>{restores.forEach(restore=>restore());root.removeFromParent();resources.forEach(resource=>resource.dispose());}};
}
