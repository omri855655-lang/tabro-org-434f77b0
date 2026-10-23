import * as THREE from 'three';

export function buildAircraftExterior(parent:THREE.Group,business:boolean) {
  const root=new THREE.Group();root.name='aircraft-wing-and-engine';parent.add(root);
  const resources:{dispose:()=>void}[]=[];
  const own=<T extends {dispose:()=>void}>(value:T)=>{resources.push(value);return value;};
  const aluminium=own(new THREE.MeshStandardMaterial({color:0xd8dfe1,metalness:.65,roughness:.32,side:THREE.DoubleSide}));
  const dark=own(new THREE.MeshStandardMaterial({color:0x26343e,metalness:.55,roughness:.48}));
  const accent=own(new THREE.MeshStandardMaterial({color:business?0x67524c:0x304b63,metalness:.25,roughness:.4}));
  const shape=new THREE.Shape();shape.moveTo(5,7);shape.lineTo(-5.5,-4.7);shape.lineTo(-5,-6);shape.lineTo(-3.4,-5.8);shape.lineTo(5,3.7);shape.closePath();
  const wingGeometry=own(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:2,bevelSize:.04,bevelThickness:.03,steps:1}));
  wingGeometry.rotateX(Math.PI/2);
  const surface=new THREE.Mesh(wingGeometry,aluminium);root.add(surface);
  const cube=own(new THREE.BoxGeometry(1,1,1));
  const panel=(material:THREE.Material,at:number[],size:number[],rotation=0)=>{
    const mesh=new THREE.Mesh(cube,material);mesh.position.fromArray(at);mesh.scale.fromArray(size);mesh.rotation.y=rotation;root.add(mesh);return mesh;
  };
  panel(accent,[-5.1,.65,-5.2],[.15,1.5,.9],-.3);
  for(let index=0;index<3;index++){
    const x=3.3-index*2.1,z=4.3-index*2.45;
    panel(dark,[x,.025,z],[.025,.018,1.3],-.73);
    panel(aluminium,[x-.3,.04,z+.24],[1.4,.035,.32],-.73);
  }
  panel(aluminium,[1,-.32,2],[.18,.7,1.1]);
  const profile=[new THREE.Vector2(.55,-1.3),new THREE.Vector2(.68,-.8),new THREE.Vector2(.7,.7),new THREE.Vector2(.64,1.15),new THREE.Vector2(.53,1.17),new THREE.Vector2(.51,.65)];
  const nacelleGeometry=own(new THREE.LatheGeometry(profile,40));nacelleGeometry.rotateX(Math.PI/2);
  const engine=new THREE.Mesh(nacelleGeometry,aluminium);engine.position.set(1,-.85,2);root.add(engine);
  const inletGeometry=own(new THREE.TorusGeometry(.585,.06,10,40));
  const inlet=new THREE.Mesh(inletGeometry,aluminium);inlet.position.set(1,-.85,3.16);root.add(inlet);
  const backGeometry=own(new THREE.CircleGeometry(.52,32));
  const back=new THREE.Mesh(backGeometry,dark);back.position.set(1,-.85,2.7);root.add(back);
  const fan=new THREE.Group();fan.position.set(1,-.85,2.76);root.add(fan);
  const bladeGeometry=own(new THREE.BoxGeometry(.06,.38,.025));
  for(let index=0;index<16;index++){
    const angle=index/16*Math.PI*2,blade=new THREE.Mesh(bladeGeometry,aluminium);
    blade.position.set(Math.sin(angle)*.28,Math.cos(angle)*.28,0);blade.rotation.z=-angle+.3;fan.add(blade);
  }
  const hubGeometry=own(new THREE.ConeGeometry(.13,.22,20));hubGeometry.rotateX(Math.PI/2);
  const hub=new THREE.Mesh(hubGeometry,dark);hub.position.set(1,-.85,2.9);root.add(hub);
  return {root,update:(seconds:number)=>{fan.rotation.z=seconds*2;},dispose:()=>{root.removeFromParent();resources.forEach(resource=>resource.dispose());}};
}
