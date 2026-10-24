import * as THREE from 'three';
import { isFlightAtmosphere, type RoomAtmosphere, type RoomGraphics } from '@/lib/focusRoomJourney';
import { buildAircraftCabin } from './focusAircraftCabin';
import { buildAircraftExterior } from './focusAircraftExterior';
import { buildHistoricalLibrary } from './focusHistoricalLibrary';
import type { FocusFlightTime } from '@/lib/focusFlightTime';
import { buildRoomCraft } from './focusRoomCraft';
import type { RoomDaylight, RoomWeather } from '@/lib/focusAtmosphere';

type Build = {
  box: (parent: THREE.Object3D, color: number, at: number[], size: number[]) => THREE.Mesh;
  ball: (parent: THREE.Object3D, color: number, at: number[], size: number[]) => THREE.Mesh;
  mat: (color: number) => THREE.MeshStandardMaterial;
};

export function buildFocusEnvironment(scene: THREE.Scene, kind: RoomAtmosphere, b: Build, graphics: RoomGraphics = 'natural', renderer?: THREE.WebGLRenderer, flightTime: FocusFlightTime = 'day') {
  const {box, ball, mat} = b;
  const monastery=kind==='monastery-library',historic=kind==='heritage-library'||monastery;
  const plane = isFlightAtmosphere(kind), business = kind === 'business-plane', airport = kind === 'airport', grand = kind === 'grand'||historic;
  let night=plane&&flightTime==='night';
  let golden=false, rain=false;
  const cozy = kind === 'intimate', city = kind === 'city-cafe', modern = kind === 'modern-library', cafe = kind === 'cafe'||city, office = kind === 'office';
  const width = plane ? 5.8 : cozy ? 8 : airport ? 12 : 10;
  const height = plane ? 5 : grand ? 10 : cozy ? 4.5 : airport ? 8 : 6.4;
  const front = plane ? -12 : grand ? -12 : -9;
  const back = plane ? 13 : 10;
  const wall = business ? 0xd0c4ad : plane ? 0xe7e7df : cozy ? 0xbaa185 : city ? 0x9da5a2 : cafe ? 0xc0a692 : office||modern ? 0xd4ddd9 : 0xe0d6be;
  const wood = historic?0x513726:modern ? 0xd1c5ac : cozy ? 0x76513d : grand ? 0x795640 : 0xaa815b;
  const accent = business ? 0x67524c : plane ? 0x293e55 : airport ? 0x355e6e : city ? 0x303f45 : cafe ? 0x755244 : modern ? 0x6c8b81 : 0x395c4c;
  const disposables: {dispose: () => void}[] = [];
  const bookBatches = new Map<number,THREE.Matrix4[]>();
  const assetShelves:THREE.Group[]=[], bookPlaceholders:THREE.Object3D[]=[];
  const assetWindows:THREE.Mesh[]=[];
  scene.background = new THREE.Color(night?0x101e35:plane || airport ? 0xaac7d7 : wall);
  scene.fog = new THREE.Fog(scene.background, 28, 65);
  const ground = box(scene, plane ? 0x3b4c5b : airport ? 0xb8c6c8 : office ? 0x8c9790 : 0xb29471, [0,-.12,(front+back)/2], [width*2,.2,back-front]);
  ground.receiveShadow = true;
  if(!plane&&!airport&&!office&&graphics!=='illustrated'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#bfa27c';ctx.fillRect(0,0,512,512);
    for(let row=0;row<8;row++){ctx.fillStyle=row%2?'#b49670':'#c3a77e';ctx.fillRect(0,row*64,512,63);ctx.fillStyle='#8d765b';ctx.fillRect(row%2*256,row*64,1,64);for(let i=0;i<14;i++){ctx.strokeStyle='rgba(103,75,47,.12)';ctx.beginPath();ctx.moveTo(0,row*64+i*4);ctx.bezierCurveTo(150,row*64+i*4+7,320,row*64+i*4-7,512,row*64+i*4);ctx.stroke();}}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,5);
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.65});ground.material=material;disposables.push(texture,material);
  }
  if (!plane&&!monastery) for(let z=front;z<back;z+=airport?2:.65) box(scene, airport?0x9aaeb2:0x96795b,[0,-.009,z],[width*2,.008,.012]);
  const assetWalls = [
    box(scene, wall, [-width,height/2,(front+back)/2],[.2,height,back-front]),
    box(scene, wall, [width,height/2,(front+back)/2],[.2,height,back-front]),
    box(scene, wall, [0,height/2,front],[width*2,height,.2]),
    box(scene, wall, [0,height/2,back],[width*2,height,.2]),
  ];

  const label = (text:string, at:number[], size:number[], color='#e6d8ba', background='#263f42') => {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=background;ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.font='500 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64,480);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture});disposables.push(texture,material);
    const mesh=box(scene,0xffffff,at,size);mesh.material=material;return mesh;
  };
  // Window views stay on window surfaces, never floating across cabin walls.
  const skyCanvas=document.createElement('canvas');skyCanvas.width=512;skyCanvas.height=256;
  const skyContext=skyCanvas.getContext('2d')!;
  const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
  const skyMaterial=new THREE.MeshBasicMaterial({map:skyTexture});disposables.push(skyTexture,skyMaterial);
  const flightView=plane&&renderer?new THREE.Scene():null;
  const flightCamera=new THREE.PerspectiveCamera(58,2,.1,160);
  const wing=new THREE.Group(), terrain=new THREE.Group();
  let exterior:ReturnType<typeof buildAircraftExterior>|undefined;
  let flightTarget:THREE.WebGLRenderTarget|undefined,wingMaterial:THREE.MeshBasicMaterial|undefined;
  if(flightView){
    flightView.background=new THREE.Color(night?0x101e35:0xb5d3e2);flightView.fog=new THREE.Fog(night?0x101e35:0xb5d3e2,40,110);
    flightView.add(new THREE.HemisphereLight(night?0x7596bc:0xffffff,0x71867a,night?.4:2.4));const light=new THREE.DirectionalLight(night?0x96bce7:0xffefcf,night?.7:2);light.position.set(-5,15,8);flightView.add(light);
    flightView.add(wing,terrain);
    exterior=buildAircraftExterior(wing,business);disposables.push(exterior);
    box(terrain,0x789579,[0,-2,-20],[100,.2,100]);box(terrain,0x6e7a7d,[0,-1.8,0],[7,.05,90]);
    for(let z=-45;z<45;z+=7)box(terrain,0xf0ead8,[0,-1.75,z],[.2,.02,3]);
    for(let i=0;i<24;i++)box(terrain,i%2?0x9dba90:0x94a87a,[(i%4-1.5)*19,-1.8,-40+Math.floor(i/4)*15],[17,.04,13]);
    for(let i=0;i<15;i++)ball(flightView,0xf3f5ef,[Math.sin(i*7)*25,10+i%4*4,-30+i*3],[5,1.1,3]);
    const viewWidth=Math.min(1024,renderer!.capabilities.maxTextureSize);
    flightTarget=new THREE.WebGLRenderTarget(viewWidth,viewWidth/2);flightTarget.texture.colorSpace=THREE.SRGBColorSpace;wingMaterial=new THREE.MeshBasicMaterial({map:flightTarget.texture});disposables.push(flightTarget,wingMaterial);
  }
  const renderFlight=(lift:number,travel:number)=>{
    if(!renderer||!flightView||!flightTarget)return;
    exterior?.update(travel);
    flightCamera.position.set(0,3+lift*18,8);flightCamera.lookAt(-1,1+lift*18,-3);wing.position.y=lift*18;wing.rotation.z=Math.sin(travel*.12)*.012*lift;terrain.position.z=travel%40;
    const target=renderer.getRenderTarget();renderer.setRenderTarget(flightTarget);renderer.render(flightView,flightCamera);renderer.setRenderTarget(target);
  };
  renderFlight(0,0);
  const paintSky=(lift:number,travel:number)=>{
    const ctx=skyContext,gradient=ctx.createLinearGradient(0,0,0,256);gradient.addColorStop(0,night?'#08152e':rain?'#708b9c':golden?'#958baf':'#75a7cb');gradient.addColorStop(.7,night?'#203d60':golden?'#edb68e':'#dae8e9');gradient.addColorStop(1,night?'#49546a':golden?'#e8a76f':'#e7dec8');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
    if(night){ctx.fillStyle='#d6e1ed';for(let i=0;i<45;i++)ctx.fillRect((i*139)%512,(i*47)%125,1,1);}
    if(!plane&&!airport){
      ctx.fillStyle='#9eaa8e';ctx.fillRect(0,155,512,101);
      for(let i=0;i<9;i++){const x=i*66-10;ctx.fillStyle=cafe||office?'#b4b7ac':'#6f8d77';ctx.fillRect(x,100+i%3*18,42,110);ctx.fillStyle=cafe||office?'#e1dfc7':'#8ca68a';if(cafe||office){for(let row=0;row<4;row++)ctx.fillRect(x+8,115+row*20,24,8);}else{ctx.beginPath();ctx.ellipse(x+20,105+i%3*18,36,50,0,0,Math.PI*2);ctx.fill();}}
    }else if(lift<.9){ctx.fillStyle=night?'#26363d':'#74918c';ctx.fillRect(0,150+lift*105,512,110);ctx.fillStyle=night?'#182431':'#53636a';ctx.fillRect(0,184+lift*90,512,72);ctx.fillStyle='#f1e9cf';for(let x=-100;x<600;x+=110)ctx.fillRect((x+travel*50)%650-50,218+lift*90,55,5);}
    ctx.fillStyle=night?'rgba(166,185,210,.25)':'rgba(255,255,255,.85)';for(let i=0;i<5;i++){const x=(i*133+travel*6)%670-80,y=70+i%2*28+lift*70;ctx.beginPath();ctx.ellipse(x,y,60,17,0,0,Math.PI*2);ctx.fill();}skyTexture.needsUpdate=true;
  };paintSky(0,0);
  const window=(x:number,y:number,z:number,w:number,h:number,side=0)=>{
    const root=new THREE.Group();root.position.set(x,y,z);root.rotation.y=side;scene.add(root);
    if(plane){
      const shape=new THREE.Shape();const r=.35,hw=w/2,hh=h/2;shape.moveTo(-hw+r,-hh);shape.lineTo(hw-r,-hh);shape.quadraticCurveTo(hw,-hh,hw,-hh+r);shape.lineTo(hw,hh-r);shape.quadraticCurveTo(hw,hh,hw-r,hh);shape.lineTo(-hw+r,hh);shape.quadraticCurveTo(-hw,hh,-hw,hh-r);shape.lineTo(-hw,-hh+r);shape.quadraticCurveTo(-hw,-hh,-hw+r,-hh);
      // Crop the 2:1 sky/wing views to the window's proportions so clouds stay wide instead of becoming round dots;
      // the crop slides along the cabin so neighbouring windows show a continuous panorama.
      const span=Math.min(1,(w/h)/2),u0=THREE.MathUtils.clamp((z-front)/(back-front),0,1)*(1-span);
      const geometry=new THREE.ShapeGeometry(shape);const uv=geometry.getAttribute('uv'),position=geometry.getAttribute('position');for(let i=0;i<uv.count;i++)uv.setXY(i,u0+(position.getX(i)+hw)/w*span,(position.getY(i)+hh)/h);disposables.push(geometry);
      const surround=new THREE.Mesh(geometry,mat(0xe0e1da));surround.scale.set(1.4,1.3,1);root.add(surround);
      const rim=new THREE.Mesh(geometry,mat(0x9aa9b0));rim.scale.set(1.18,1.14,1);rim.position.z=.025;root.add(rim);
      const inner=new THREE.Mesh(geometry,mat(0x3b515c));inner.scale.set(1.06,1.06,1);inner.position.z=.045;root.add(inner);
      const view=new THREE.Mesh(geometry,Math.abs(z)<3&&wingMaterial?wingMaterial:skyMaterial);view.position.z=.065;root.add(view);
      box(root,0xd4d9d4,[0,-h/2-.07,.08],[w*.85,.08,.13]);
    }else if(grand){
      const arch=new THREE.Shape(),half=w/2,bottom=-h/2,spring=h/2-half;
      arch.moveTo(-half,bottom);arch.lineTo(half,bottom);arch.lineTo(half,spring);arch.absarc(0,spring,half,0,Math.PI,false);arch.closePath();
      const geometry=new THREE.ShapeGeometry(arch,32);disposables.push(geometry);
      const uv=geometry.getAttribute('uv'),position=geometry.getAttribute('position');
      for(let i=0;i<uv.count;i++)uv.setXY(i,(position.getX(i)+half)/w,(position.getY(i)+h/2)/h);
      const frame=new THREE.Mesh(geometry,mat(0x79684a));frame.scale.set(1.08,1.04,1);root.add(frame);
      const view=new THREE.Mesh(geometry,skyMaterial);view.position.z=.04;root.add(view);assetWindows.push(view);
      for(const dx of [-w/4,0,w/4])box(root,0x947a4c,[dx,-half/2,.1],[.045,h-half,.08]);
      for(const dy of [-h/4,spring])box(root,0x947a4c,[0,dy,.1],[w,.055,.08]);
    }else{
      box(root,accent,[0,0,0],[w+.16,h+.16,.12]);const view=box(root,0xffffff,[0,0,.08],[w,h,.04]);view.material=skyMaterial;assetWindows.push(view);
      box(root,accent,[0,0,.12],[.045,h,.04]);
    }
  };
  if(!plane){
    box(scene,wall,[0,height,(front+back)/2],[width*2,.15,back-front]);
    if(grand){box(scene,0xd1e1dc,[0,height-.1,-1],[8,.06,17]);for(let z=-9;z<9;z+=3)box(scene,wood,[0,height-.2,z],[width*2,.18,.2]);}
  }
  if(graphics==='cinematic'){
    for(const x of [-4,4]){const light=new THREE.PointLight(plane?0xc2d8ff:0xffc88a,12,15,2);light.position.set(x,3.7,1);scene.add(light);}
  }
  const plant=(x:number,z:number,scale=1)=>{
    const root=new THREE.Group();root.position.set(x,0,z);root.scale.setScalar(scale);scene.add(root);
    box(root,0xaa7959,[0,.35,0],[.65,.7,.65]);box(root,0x695542,[0,1.2,0],[.055,1.8,.055]);
    for(let i=0;i<7;i++){const leaf=ball(root,i%2?0x5b7852:0x82946c,[Math.sin(i*2)*.4,1.3+i*.17,Math.cos(i*2)*.3],[.24,.65,.15]);leaf.rotation.z=Math.sin(i*2)*.8;}
  };
  const shelf=(x:number,z:number,rotation:number,tall=4.2)=>{
    const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=rotation;scene.add(root);
    root.userData.shelfHeight=tall;
    assetShelves.push(root);
    box(root,wood,[0,tall/2,0],[3.5,tall,.35]);
    for(let row=0;row<Math.floor(tall/.8);row++){
      box(root,0xc8ac7e,[0,.35+row*.8,.26],[3.55,.09,.6]);
      for(let i=0;i<13;i++){
        const color=[0x758e7b,0xb39060,0x5f727d,0x925d50,0xd3c49d][(i*3+row)%5];
        const local=new THREE.Matrix4().compose(new THREE.Vector3(-1.5+i*.245,.67+row*.8,.28),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),i%7===0?.12:0),new THREE.Vector3(.16,.48+(i%3)*.05,.32));
        root.updateWorldMatrix(true,false);const matrices=bookBatches.get(color)||[];matrices.push(root.matrixWorld.clone().multiply(local));bookBatches.set(color,matrices);
      }
    }
  };
  if(plane){
    const cabin=buildAircraftCabin(scene,{box},business,front,back,width);disposables.push(cabin);
    for(const side of [-1,1]){
      for(let z=-10;z<12;z+=2.5)window(side*(width-.11),2.65,z,1.1,1.5,-side*Math.PI/2);
      box(scene,0xb4a789,[side*1.42,.008,.5],[.08,.012,24]);
    }
    box(scene,0xc3d0d3,[0,2.3,front+.15],[2.2,4.5,.12]);box(scene,0x344e61,[0,2.6,front+.24],[1.7,1.1,.1]);
    label(business?'ZONEFLOW BUSINESS':'ZONEFLOW AIR',[0,3.9,front+.34],[3,.55,.03]);label('EXIT',[3.5,3.7,front+.2],[.8,.3,.03],'#e4f1dc','#426355');
    for(const x of [-2.8,0,2.8])for(const z of [-8.5,-5.8]){
      box(scene,accent,[x,.7,z],[1.4,.24,1.4]);const seat=box(scene,accent,[x,1.45,z+.65],[1.4,1.5,.24]);seat.rotation.x=-.08;box(scene,0xd9d3c2,[x,1.95,z+.48],[.75,.35,.1]);
    }
  }else if(airport){
    for(let x=-10;x<=10;x+=4)window(x,3.6,front+.2,3.8,6.6);
    for(const x of [-8,8]){box(scene,0xb3c0c2,[x,4,.5],[.25,8,19]);label(x<0?'A12  →':'A14  →',[x,4.1,-5],[2.7,.9,.15]);plant(x,7,1.4);}
    for(const side of [-1,1])for(let z=2;z<=8;z+=2){box(scene,0x506875,[side*9,.65,z],[2.8,.22,1]);box(scene,0x506875,[side*9,1.1,z+.45],[2.8,.9,.15]);}
    label('DEPARTURES  /  ZONEFLOW',[0,5.8,front+.4],[7,1,.08]);
    const aircraft=new THREE.Group();aircraft.position.set(4,1.6,front+.5);scene.add(aircraft);
    ball(aircraft,0xf2eee2,[0,0,0],[3.5,.35,.18]);const wing=box(aircraft,0x778b9a,[0,-.15,.05],[2,.15,.12]);wing.rotation.z=-.3;const tail=box(aircraft,0x33546b,[2.8,.5,0],[.65,1.1,.1]);tail.rotation.z=-.25;
    for(let x=-2;x<2.5;x+=.3)box(aircraft,0x466579,[x,.05,.2],[.12,.1,.02]);
  }else if(cafe){
    for(const x of [-6,0,6])window(x,3,front+.2,4.5,4.5);
    box(scene,0x6a4a39,[0,1,back-.8],[15,2,1.5]);box(scene,0xd6bf9a,[0,2.05,back-.8],[15.5,.15,1.7]);
    box(scene,0x455456,[-3,2.6,back-1],[2,1,1]);for(const x of [-3.5,-2.5])box(scene,0xc9cac0,[x,2.5,back-1.55],[.3,.15,.25]);
    // Sign sits above the glazing so the pendant lamps never cover it from the default camera.
    label(city?'CITY COFFEE':'SLOW COFFEE',[0,5.8,front+.3],[4.4,.8,.08],'#e9ddbf',city?'#303f45':'#745441');
    if(city){for(const x of [-7,7])for(let z=-7;z<9;z+=2)box(scene,0xb0aaa0,[x,3,z],[.3,6,.3]);for(let i=0;i<7;i++)box(scene,0x404e52,[-6+i*2,5.6,0],[.08,.08,18]);}
    for(const x of [-7,7]){plant(x,-5,1.2);box(scene,0x8b6553,[x,1,5],[1.5,2,5]);}
    for(const x of [-5.2,0,5.2]){box(scene,0x4b3930,[x,4.8,0],[.03,2,.03]);ball(scene,0xd7aa6c,[x,3.8,0],[.6,.25,.6]);}
    if(!city){for(let z=-7;z<9;z+=3)box(scene,0x6d4c37,[0,5.8,z],[width*2,.35,.3]);for(const side of [-1,1])shelf(side*(width-.35),4,-side*Math.PI/2,3.5);}
  }else if(office){
    for(let x=-7.5;x<=7.5;x+=5)window(x,3.4,front+.2,4.7,5);
    box(scene,0xf3eee0,[0,3,back-.2],[8,3,.1]);for(let i=0;i<5;i++)box(scene,0x9cafa0,[-2+i,3+(i%2)*.4,back-.28],[.7,.6,.03]);
    for(const x of [-6,0,6])box(scene,0xf4eddc,[x,5.7,.5],[.08,.08,15]);
    for(const x of [-8,8]){plant(x,-6);box(scene,0x698777,[x,.8,7],[2,1.6,2]);}
  }else{
    const count=cozy?2:3;for(let i=0;i<count;i++)window((i-(count-1)/2)*(cozy?6:6.4),cozy?2.8:grand?4.8:3.4,front+.2,cozy?3.4:4.4,cozy?3:grand?7.8:4.8);
    for(const side of [-1,1])for(let z=-6;z<9;z+=3.7)shelf(side*(width-.35),z,-side*Math.PI/2,monastery?5:cozy?3.5:grand?8.5:modern?3:5);
    if(modern){
      for(const z of [-5,1,7])box(scene,0xf4f1de,[0,height-.3,z],[15,.06,.15]);
      for(const x of [-7,7]){box(scene,0x8aa89c,[x,.7,7],[2.4,1.4,2]);plant(x,-6,1.5);}
      label('READ  /  CREATE  /  DISCOVER',[0,4.7,front+.3],[6,.5,.04],'#3f6255','#e4e8da');
    }
    if(!monastery)box(scene,cozy?0x866c58:0x536d58,[0,.012,3],[cozy?12:15,.02,10]);
    if(grand&&!monastery){
      for(const side of [-1,1]){box(scene,wood,[side*8.5,5.4,-.5],[2.6,.24,21]);for(let z=-10;z<10;z+=.7)box(scene,0xc2a66c,[side*7.2,5.95,z],[.045,1.1,.045]);box(scene,0xc2a66c,[side*7.2,6.5,-.5],[.08,.08,21]);}
      for(const x of [-7,7])for(const z of [-9,0,9]){box(scene,0xc5b598,[x,4,z],[.35,8,.35]);box(scene,0x8d7956,[x,7.9,z],[.8,.2,.8]);}
      for(const z of [-4,5]){box(scene,0x9c8250,[0,7,z],[.03,3,.03]);for(const x of [-1.5,0,1.5]){box(scene,0x9c8250,[x,5.5,z],[.07,.7,.07]);ball(scene,0xffe5ad,[x,5.85,z],[.26,.16,.26]);}box(scene,0x9c8250,[0,5.3,z],[3.2,.06,.06]);const lamp=new THREE.PointLight(0xffdb9b,22,13,2);lamp.position.set(0,5.6,z);scene.add(lamp);}
    }else if(cozy){
      box(scene,wood,[0,4.5,0],[width*2,.18,20]);for(const x of [-6.5,6.5]){box(scene,0x916d59,[x,.55,8],[2.1,1.1,1.4]);box(scene,0xc1a582,[x,1.1,8.6],[2.1,1.2,.3]);ball(scene,0xf9dfad,[x,2.8,6.5],[.55,.3,.55]);box(scene,0x605747,[x,1.4,6.5],[.045,2.8,.045]);}
    }
    for(const x of [-width+1.2,width-1.2])plant(x,-7,cozy?.8:1.3);
  }
  if(historic)disposables.push(buildHistoricalLibrary(scene,{box},monastery,front,back,{floor:ground,walls:assetWalls}));
  disposables.push(buildRoomCraft(scene,kind,{box,ball},width,height,front,back));
  if(bookBatches.size){
    // Thousands of book spines share five draw calls in the large reading hall.
    const geometry=new THREE.BoxGeometry(1,1,1);disposables.push(geometry);
    for(const [color,matrices] of bookBatches){const mesh=new THREE.InstancedMesh(geometry,mat(color),matrices.length);matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);disposables.push(mesh);bookPlaceholders.push(mesh);}
  }
  let painted=-1,travel=0,lastTravel=-1,weatherKey='';
  return {ground, width, front, back, assetWalls, assetShelves, bookPlaceholders, assetWindows, dispose:()=>disposables.forEach(item=>item.dispose()), update:(elapsed:number,running:boolean,reduced:boolean,dt:number,phase:Exclude<RoomDaylight,'auto'>='day',weather:RoomWeather='clear')=>{
    const key=`${phase}:${weather}`;
    if(key!==weatherKey){
      weatherKey=key;night=phase==='night';golden=phase==='sunset';rain=weather==='rain';painted=-1;
      if(flightView){const sky=night?0x101e35:rain?0x8d9eac:golden?0xd4ab96:0xb5d3e2;flightView.background=new THREE.Color(sky);flightView.fog=new THREE.Fog(sky,rain?22:40,110);flightView.traverse(object=>{if(object instanceof THREE.HemisphereLight)object.intensity=night?.45:rain?1.2:2.4;if(object instanceof THREE.DirectionalLight){object.intensity=night?.7:rain?.8:2;object.color.set(night?0x96bce7:golden?0xffbf8c:0xffefcf);}});}
    }
    if(!plane)return;if(running&&!reduced)travel+=dt;const step=Math.floor(elapsed*2);
    if(step!==painted||Math.floor(travel*4)!==lastTravel){const lift=Math.min(1,elapsed/90);paintSky(lift,travel);renderFlight(lift,travel);painted=step;lastTravel=Math.floor(travel*4);}
  }};
}

export function buildFocusStation(parent:THREE.Group, kind:RoomAtmosphere, b:Pick<Build,'box'|'ball'>) {
  const {box,ball}=b, plane=isFlightAtmosphere(kind), business=kind==='business-plane', cafe=kind==='cafe'||kind==='city-cafe', airport=kind==='airport', office=kind==='office';
  const wood=kind==='modern-library'?0xd4d9c9:kind==='city-cafe'?0x77695d:kind==='intimate'?0x79523c:kind==='grand'?0x8e6948:0xb3916c;
  const accent=business?0x67524c:plane?0x304b63:airport?0x526d7a:0x435d4b;
  const top=cafe?ball(parent,wood,[0,1.12,1.25],[1.6,.09,1.25]):box(parent,plane?0xd6d5c6:airport?0xb5cdd0:wood,[0,1.12,plane?1:1.25],[plane?2.05:3.9,.12,plane?1.65:2.3]);
  if(plane){
    box(parent,accent,[0,.58,0],[1.65,.23,1.4]);const back=box(parent,accent,[0,1.15,-.65],[1.65,1.2,.27]);back.rotation.x=.08;
    box(parent,business?0x8f7b70:0x526d84,[0,.73,-.02],[1.5,.13,1.24]);
    box(parent,business?0x8f7b70:0x526d84,[0,1.25,-.46],[1.47,.9,.09]);
    box(parent,0xd6d2c0,[0,1.68,-.43],[1.1,.3,.09]);
    for(const x of [-.62,.62])box(parent,business?0xb5a18d:0x8197a5,[x,1.23,-.4],[.012,.75,.009]);
    box(parent,0x2e414d,[0,.24,-.2],[1.2,.08,.65]);
    for(const x of [-.93,.93]){box(parent,0xbac2be,[x,.95,0],[.2,.15,1.5]);box(parent,accent,[x,.5,-.15],[.18,.8,1.2]);}
    box(parent,0xa4afa9,[0,.7,.9],[.12,.8,.12]);
    if(business){
      for(const x of [-1.05,1.05])box(parent,0xc2b59f,[x,1.2,-.05],[.15,1.5,1.7]);
      box(parent,0x3c4d57,[.98,1.7,.5],[.06,.45,.6]);box(parent,0xc6dfdb,[.94,1.7,.5],[.02,.32,.45]);
      box(parent,0x8f7760,[-1.07,1.05,.35],[.23,.07,.7]);
      box(parent,0xe3d7bd,[-1.07,1.25,-.45],[.025,.28,.3]);
    }else if(Math.abs(parent.position.x)>.1){
      // Decorative neighbours face forward, outboard of the logical seats.
      const side=parent.position.x<0?1:-1;
      box(parent,accent,[side*1.15,.58,0],[.65,.23,1.35]);box(parent,accent,[side*1.15,1.15,-.65],[.65,1.2,.27]);box(parent,0xd6d2c0,[side*1.15,1.58,-.49],[.45,.25,.08]);
    }
  }else{
    for(const x of [-1.5,1.5])for(const z of [.3,2.2])box(parent,accent,[x,.5,z],[.09,1,.09]);
    box(parent,accent,[0,.58,-.14],[1.08,.15,.9]);box(parent,accent,[0,1.05,-.55],[1.08,1,.12]);
    for(const x of [-.43,.43])for(const z of [-.5,.15])box(parent,wood,[x,.28,z],[.09,.55,.09]);
    if(!airport&&!cafe&&!office){box(parent,accent,[-1.45,1.75,1.9],[.05,1.1,.05]);ball(parent,accent,[-1.45,2.3,1.9],[.4,.14,.26]);ball(parent,0xffe6ad,[-1.45,2.2,1.9],[.3,.025,.2]);}
    if(kind==='intimate'){for(const x of [-1.86,1.86])box(parent,wood,[x,1.45,1.3],[.08,.6,2.3]);}
    if(office){box(parent,0x82978b,[-1.85,1.6,1.25],[.08,1,2.3]);box(parent,0x82978b,[0,1.6,2.35],[3.8,1,.08]);}
    if(cafe){ball(parent,0x788d65,[1.05,1.4,1.75],[.22,.22,.22]);box(parent,0xb28d6c,[1.05,1.25,1.75],[.22,.25,.22]);}
  }
  if(!plane)box(parent,0xf2e7d2,[1.3,1.35,.9],[.22,.32,.22]);
  return top;
}
