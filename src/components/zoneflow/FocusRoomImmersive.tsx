import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ArrowDown, ArrowUp, RotateCcw, RotateCw } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { focusRoomViewCopy } from '@/lib/focusRoomViewCopy';
import { FOCUS_SEATS, planFocusWalk, safeFloorPosition } from '@/lib/focusRoom';
import type { FocusRoomParticipant, FocusRoomScene } from './FocusRoomInterior';
import { isFlightAtmosphere, type RoomAtmosphere, type RoomGraphics } from '@/lib/focusRoomJourney';
import { buildFocusEnvironment, buildFocusStation } from './focusRoomEnvironment';
import { attachRoomAssets } from './focusRoomAssets';
import type { FocusFlightTime } from '@/lib/focusFlightTime';
import { decodeAvatar, AVATAR_SKINS, AVATAR_HAIR, AVATAR_PANTS } from '@/lib/focusAvatar';
import { sceneryTargets, roomLifeCopy } from '@/lib/focusRoomLife';
import { createRoomScenery } from './focusRoomScenery';
import { resolveRoomDaylight, roomPixelRatio, type RoomDaylight, type RoomWeather } from '@/lib/focusAtmosphere';

type Position = { x: number; y: number };
interface Props {
  scene: FocusRoomScene; participants: FocusRoomParticipant[]; mode: 'overview' | 'eye' | 'follow';
  onMove: (position: Position) => void; onSeat: (position: typeof FOCUS_SEATS[number]) => void;
  onUnavailable: () => void;
  atmosphere?: RoomAtmosphere; elapsed?: number; started?: boolean; running?: boolean;
  graphics?: RoomGraphics;
  scenery?: boolean;
  flightTime?: FocusFlightTime;
  daylight?: RoomDaylight;
  weather?: RoomWeather;
}
const SHIRTS = [0x589f95, 0xcd8975, 0xc6a15c, 0x839c68, 0xa49bbf, 0x7b9ebf, 0x9aa96b, 0xcc9baa];
const SKINS = [0xe9b38d, 0xc08b65, 0x875b43, 0xf1c6a3];

export default function FocusRoomImmersive(props: Props) {
  const { lang } = useLanguage(), copy = focusRoomViewCopy[lang];
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const controls = useRef<{ turn: (amount: number) => void; step: (amount: number) => void }>();
  const [ready, setReady] = useState(false);
  const [assetState,setAssetState]=useState('');
  useEffect(() => { latest.current = props; });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); }
    catch { latest.current.onUnavailable(); return; }
    renderer.setPixelRatio(roomPixelRatio(window.devicePixelRatio, element.clientWidth, element.clientHeight, props.graphics !== 'illustrated'));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    canvas.setAttribute('aria-hidden', 'true');
    element.appendChild(canvas);
    const scene = new THREE.Scene();
    const atmosphere = props.atmosphere || props.scene;
    const flying = isFlightAtmosphere(atmosphere);
    const night=flying&&props.flightTime==='night';
    const graphics = props.graphics || 'natural';
    const xScale = flying ? .105 : atmosphere === 'intimate' ? .16 : .2;
    const zScale = flying ? .32 : .22;
    const layout = flying ? 'forward' : true;
    const world = (p: Position) => new THREE.Vector3((p.x-50)*xScale,0,(p.y-28)*zScale-5.5);
    const floor = (v: THREE.Vector3) => safeFloorPosition({x:v.x/xScale+50,y:(v.z+5.5)/zScale+28},layout);
    const trim = flying ? 0x304b63 : 0x34594a;
    scene.background = new THREE.Color(0xeee4cf);
    scene.fog = new THREE.Fog(0xeee4cf, 20, 40);
    const camera = new THREE.PerspectiveCamera(62, 1, .08, 60);
    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const environmentMaterials = new Map<number, THREE.MeshStandardMaterial>();
    const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=128;
    const grain=grainCanvas.getContext('2d')!;grain.fillStyle='#888';grain.fillRect(0,0,128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x+=2){const value=110+((x*37+y*17+x*y)%45);grain.fillStyle=`rgb(${value},${value},${value})`;grain.fillRect(x,y,2,1);}
    const grainTexture=new THREE.CanvasTexture(grainCanvas);grainTexture.wrapS=grainTexture.wrapT=THREE.RepeatWrapping;grainTexture.repeat.set(3,3);
    const environmentMat=(color:number)=>{
      if(!environmentMaterials.has(color))environmentMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:graphics==='illustrated'?1:graphics==='cinematic'?.48:.72,metalness:graphics==='cinematic'?.08:0,flatShading:graphics==='illustrated',bumpMap:graphics==='illustrated'?null:grainTexture,bumpScale:.015}));
      return environmentMaterials.get(color)!;
    };
    const cube = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 24, 18);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
    const roundedCube = new RoundedBoxGeometry(1,1,1,3,.08);
    const mat = (color: number) => {
      if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .78 }));
      return materials.get(color)!;
    };
    const shape = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, at: number[], size: number[]) => {
      const mesh = new THREE.Mesh(geometry, mat(color));
      mesh.position.set(at[0], at[1], at[2]); mesh.scale.set(size[0], size[1], size[2]); parent.add(mesh); return mesh;
    };
    const box = (parent: THREE.Object3D, color: number, at: number[], size: number[]) => shape(parent, cube, color, at, size);
    const ball = (parent: THREE.Object3D, color: number, at: number[], size: number[]) => shape(parent, sphere, color, at, size);
    const roundedBox = (parent: THREE.Object3D, color: number, at: number[], size: number[]) => shape(parent, roundedCube, color, at, size);
    const envBox=(parent:THREE.Object3D,color:number,at:number[],size:number[])=>{const mesh=roundedBox(parent,color,at,size);mesh.material=environmentMat(color);return mesh;};
    const envBall=(parent:THREE.Object3D,color:number,at:number[],size:number[])=>{const mesh=ball(parent,color,at,size);mesh.material=environmentMat(color);return mesh;};
    const ambient = new THREE.HemisphereLight(night?0x8badd5:0xf7efdf, 0x74858b, night?.65:flying?1.8:.85); scene.add(ambient);
    const sun = new THREE.DirectionalLight(night?0xa0bfe9:0xffe5be, night?.35:flying?2.4:1.65); sun.position.set(-5, 10, -5); scene.add(sun);
    if(night)for(const z of [-6,1,8]){const lamp=new THREE.PointLight(0xffdfb1,9,10,2);lamp.position.set(0,3.2,z);scene.add(lamp);}
    sun.castShadow = true; const shadowSize = graphics === 'cinematic' && element.clientWidth > 800 ? 2048 : 1024; sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 18, bottom: -15, near: .5, far: 45 });
    sun.shadow.bias = -.001;
    const environment = buildFocusEnvironment(scene, atmosphere, {box:envBox,ball:envBall,mat:environmentMat}, graphics, renderer, props.flightTime);
    const ground = environment.ground;
    const outdoors = !flying && environment.assetWindows.length ? createRoomScenery(renderer, environment.assetWindows, atmosphere, graphics) : null;
    const targets: THREE.Object3D[] = [ground];
    const paperCanvas=document.createElement('canvas');paperCanvas.width=512;paperCanvas.height=768;
    const paper=paperCanvas.getContext('2d')!;const paperShade=paper.createLinearGradient(0,0,512,0);paperShade.addColorStop(0,'#c7bdab');paperShade.addColorStop(.08,'#f0eadb');paperShade.addColorStop(1,'#e7e1d0');paper.fillStyle=paperShade;paper.fillRect(0,0,512,768);
    paper.textAlign='center';paper.fillStyle='#57534a';paper.font='20px Georgia';paper.fillText('THE ART OF FOCUS',256,85);
    paper.textAlign='left';paper.font='14px Georgia';
    const sentences=['A quiet place leaves room for a clear thought.','Notice one detail and give it your full attention.','Let each small step become a steady rhythm.','There is time to read, to learn, and to begin again.'];
    for(let line=0;line<25;line++)paper.fillText(sentences[line%sentences.length],45,145+line*20,420);
    paper.textAlign='center';paper.font='12px Georgia';paper.fillText('24',256,715);
    const paperTexture=new THREE.CanvasTexture(paperCanvas);paperTexture.colorSpace=THREE.SRGBColorSpace;paperTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    paperTexture.center.set(.5,.5);paperTexture.rotation=Math.PI;
    const paperMaterial=new THREE.MeshStandardMaterial({map:paperTexture,roughness:.95});
    const paperGeometry=new THREE.PlaneGeometry(.67,.94,16,1);paperGeometry.rotateX(-Math.PI/2);
    const vertices=paperGeometry.getAttribute('position');for(let i=0;i<vertices.count;i++)vertices.setY(i,.012*Math.sin((vertices.getX(i)+.335)/.67*Math.PI));paperGeometry.computeVertexNormals();
    const assetStations:{root:THREE.Group;furniture:THREE.Object3D[]}[]=[];
    const deskProps: { computer: THREE.Group; book: THREE.Group; notebook: THREE.Group; pencil: THREE.Mesh; page: THREE.Mesh }[] = [];
    FOCUS_SEATS.forEach((seat, index) => {
      const desk = new THREE.Group(); desk.position.copy(world(seat)); scene.add(desk);
      if (flying || index >= 3) desk.rotation.y = Math.PI;
      const top = buildFocusStation(desk, atmosphere, {box:envBox,ball:envBall});
      top.userData.seat = index; targets.push(top);
      assetStations.push({root:desk,furniture:[...desk.children]});
      const computer = new THREE.Group(), book = new THREE.Group(), notebook = new THREE.Group(); desk.add(computer, book, notebook);
      box(computer, 0x455354, [0, 1.25, .95], [1.25, .08, .8]);
      box(computer, 0x455354, [0, 1.65, 1.38], [1.25, .85, .08]);
      box(computer, 0xa2cec0, [0, 1.65, 1.33], [1.1, .7, .02]);
      for (let i = 0; i < 4; i++) box(computer, 0xe5f0d8, [-.12, 1.88 - i * .13, 1.31], [.65 - (i % 2) * .2, .035, .01]);
      for (let i = 0; i < 5; i++) box(computer, 0x82938e, [0, 1.3, .68 + i * .11], [.95, .015, .045]);
      roundedBox(book, 0x474e4c, [0, 1.25, .95], [1.45, .08, 1]);
      box(book,0xdad3c3,[0,1.29,.95],[1.39,.06,.96]);
      const page=new THREE.Mesh(paperGeometry,paperMaterial);page.position.set(.36,1.325,.95);book.add(page);
      const leftPage=new THREE.Mesh(paperGeometry,paperMaterial);leftPage.position.set(-.36,1.325,.95);book.add(leftPage);
      box(book,0x958d7b,[0,1.328,.95],[.012,.008,.95]);
      box(notebook, 0xfaf0d8, [0, 1.27, .9], [1.1, .07, .95]);
      for (let i = 0; i < 6; i++) box(notebook, 0xb5c5c3, [0, 1.311, .55 + i * .13], [.9, .008, .012]);
      const pencil = box(notebook, 0xd1984e, [.25, 1.36, .75], [.035, .035, .65]); pencil.rotation.y = -.5;
      deskProps.push({ computer, book, notebook, pencil, page });
    });
    const assetEnabled=graphics!=='illustrated'&&['library','grand','intimate','cafe','city-cafe','heritage-library','monastery-library'].includes(atmosphere);
    setAssetState(assetEnabled?'loading':'');
    const assets=assetEnabled?attachRoomAssets(scene,renderer,assetStations,environment.assetShelves,environment.bookPlaceholders,environment.assetWindows,atmosphere,{floor:ground,walls:environment.assetWalls}):null;
    let assetsActive=true;
    assets?.ready.then(result=>{if(assetsActive)setAssetState(result.loaded?'ready':'fallback');});
    interface Avatar { root: THREE.Group; body: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[]; head: THREE.Group; label: THREE.Sprite; labelKey: string; style: number; target: Position; route: Position[]; next: number; position: Position; }
    const avatars = new Map<string, Avatar>();
    const hands = new THREE.Group(); scene.add(hands);
    const leftHand = ball(hands, SKINS[0], [-.48, 1.27, .6], [.12, .07, .21]);
    const rightHand = ball(hands, SKINS[0], [.48, 1.27, .6], [.12, .07, .21]);
    box(hands, trim, [-.48, 1.23, .2], [.19, .12, .5]);
    box(hands, trim, [.48, 1.23, .2], [.19, .12, .5]);
    const disposeLabel = (label: THREE.Sprite) => { label.material.map?.dispose(); label.material.dispose(); };
    const sizeLabel=(label:THREE.Sprite)=>{
      const height=2*Math.tan(camera.fov*Math.PI/360)*26/Math.max(1,element.clientHeight);
      label.scale.set(height*5,height,1);
    };
    const makeLabel = (text: string) => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 80;
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff9e9'; ctx.fillRect(0, 0, 400, 80);
      ctx.fillStyle = '#284839'; ctx.font = '500 38px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text.slice(0, 28), 200, 40, 380);
      const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, sizeAttenuation:false, toneMapped:false }));
      sizeLabel(sprite);sprite.position.y = 2.9; return sprite;
    };
    const makeAvatar = (p: FocusRoomParticipant): Avatar => {
      const design=decodeAvatar(p.avatarStyle),index=design.shirt,skin=AVATAR_SKINS[design.skin];
      const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(); scene.add(root); root.add(body); body.add(head);
      roundedBox(body, SHIRTS[index], [0, 1.35, 0], [.7, .75, .43]);
      roundedBox(body, SHIRTS[index], [0, 1.72, 0], [.4, .08, .3]);
      roundedBox(body, SHIRTS[index], [.19, 1.42, .225], [.16, .15, .025]);
      head.position.y = 2.1;
      ball(head, skin, [0, 0, 0], [.45, .48, .4]);
      if(design.cut!==2)ball(head, AVATAR_HAIR[design.hair], [0, .22, -.04], [.46, .3, .4]);
      if(design.cut===1)ball(head,AVATAR_HAIR[design.hair],[0,-.1,-.2],[.47,.48,.25]);
      for (const x of [-.16, .16]) ball(head, 0x292d31, [x, -.03, .37], [.045, .065, .025]);
      for (const x of [-.17, .15]) ball(head, 0xf6eee2, [x, -.01, .394], [.012, .016, .006]);
      for (const x of [-.43, .43]) ball(head, skin, [x, -.04, 0], [.075, .12, .08]);
      ball(head, skin, [0, -.1, .39], [.055, .07, .045]);
      ball(head, 0xb17963, [0, -.22, .38], [.09, .02, .02]);
      if(design.accessory===0)for (const x of [-.46, .46]) ball(head, 0x3e5757, [x, -.03, 0], [.08, .19, .16]);
      if(design.accessory===1){for(const x of [-.16,.16]){box(head,0x34434c,[x,-.03,.402],[.25,.17,.025]);box(head,0xa7c4ca,[x,-.03,.42],[.19,.11,.012]);}box(head,0x34434c,[0,-.03,.42],[.08,.025,.025]);}
      const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(side * .45, 1.6, 0); body.add(arm);
        roundedBox(arm, SHIRTS[index], [0, -.18, 0], [.22, .4, .25]);
        ball(arm, skin, [0, -.51, 0], [.12, .22, .12]); arms.push(arm);
        const leg = new THREE.Group(); leg.position.set(side * .2, 1, 0); body.add(leg);
        roundedBox(leg, AVATAR_PANTS[design.pants], [0, -.4, 0], [.26, .8, .27]);
        roundedBox(leg, 0xe5ddc9, [0, -.85, .08], [.29, .18, .43]);
        roundedBox(leg, 0xf7f0df, [0, -.93, .08], [.3, .04, .44]); legs.push(leg);
      }
      const label = makeLabel(p.displayName); root.add(label);
      root.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = true; });
      const start=p.userId.startsWith('scenery-character-')?{...p,y:p.y<50?84:28}:p;
      const position = safeFloorPosition(start, layout); root.position.copy(world(position));
      return { root, body, arms, legs, head, label, labelKey: p.displayName, style: p.avatarStyle || 0, target: position, position, route: [position], next: 0 };
    };
    let yaw = 0, pitch = -.12, wasSeated = false, lastMe = '', frame = 0, lastTime = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const turn = (amount: number) => { yaw += amount; };
    const step = (amount: number) => {
      const me = latest.current.participants.find(p => p.isMe);
      if (me) latest.current.onMove(safeFloorPosition({ x: me.x - Math.sin(yaw) * amount * 4, y: me.y - Math.cos(yaw) * amount * 4 }, layout));
    };
    controls.current = { turn, step };
    const resize = () => { const { width, height } = element.getBoundingClientRect(); renderer.setPixelRatio(roomPixelRatio(window.devicePixelRatio,width,height,graphics!=='illustrated')); renderer.setSize(Math.max(1, width), Math.max(1, height), false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();avatars.forEach(avatar=>sizeLabel(avatar.label)); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const contextLost = (event: Event) => { event.preventDefault(); latest.current.onUnavailable(); };
    canvas.addEventListener('webglcontextlost', contextLost);
    let drag: { x: number; y: number; lastX: number; lastY: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
      if (drag.moved) { yaw -= (e.clientX - drag.lastX) * .006; pitch = THREE.MathUtils.clamp(pitch - (e.clientY - drag.lastY) * .004, -.65, .55); }
      drag.lastX = e.clientX; drag.lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (drag && !drag.moved) {
        const rect = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), camera);
        const hit = ray.intersectObjects(targets, false)[0];
        if (hit) {
          const seat = hit.object.userData.seat;
          if (Number.isInteger(seat)) latest.current.onSeat(FOCUS_SEATS[seat]);
          else latest.current.onMove(floor(hit.point));
        }
      }
      drag = null;
    };
    const cancel = () => { drag = null; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || now - lastTime < 32) return;
      const dt = Math.min(.1, (now - lastTime) / 1000); lastTime = now;
      const phase = resolveRoomDaylight(latest.current.daylight || latest.current.flightTime || 'auto');
      environment.update(latest.current.elapsed || 0, !!latest.current.running, reduced.matches, dt, phase, latest.current.weather || 'clear');
      {
        const dark = phase === 'night', golden = phase === 'sunset', wet = latest.current.weather === 'rain';
        ambient.intensity = dark ? .55 : wet ? .9 : 1.15;
        ambient.color.set(dark ? 0x91adc8 : 0xf7efdf);
        sun.color.set(dark ? 0x86a8cf : golden ? 0xffb56e : 0xffe5be);
        sun.intensity = dark ? .25 : wet ? .6 : golden ? 1.4 : 1.9;
        sun.position.set(golden ? -13 : -5, golden ? 5 : 10, -5);
        scene.environmentIntensity = dark ? .28 : golden ? .5 : .65;
        outdoors?.update(dt, latest.current.daylight || 'auto', latest.current.weather || 'clear', !!latest.current.scenery && !reduced.matches);
      }
      const local = latest.current.participants.find(p => p.isMe);
      const people = latest.current.participants.filter(p => !p.isMe).slice(0, local ? 79 : 80);
      if (local) people.push(local);
      if(latest.current.scenery&&!flying)sceneryTargets(reduced.matches?0:now/1000).forEach((position,index)=>people.push({
        userId:`scenery-character-${index}`,displayName:roomLifeCopy[lang][1],...position,avatarStyle:index+3,status:'away',seated:false,
      }));
      const ids = new Set(people.map(p => p.userId));
      for (const [id, avatar] of avatars) if (!ids.has(id)) { scene.remove(avatar.root); disposeLabel(avatar.label); avatars.delete(id); }
      for (const p of people) {
        let avatar = avatars.get(p.userId);
        if (avatar && avatar.style !== (p.avatarStyle || 0)) {
          scene.remove(avatar.root); disposeLabel(avatar.label); avatars.delete(p.userId); avatar = undefined;
        }
        if (!avatar) { avatar = makeAvatar(p); avatars.set(p.userId, avatar); }
        if (avatar.labelKey !== p.displayName) { avatar.root.remove(avatar.label); disposeLabel(avatar.label); avatar.label = makeLabel(p.displayName); avatar.root.add(avatar.label); avatar.labelKey = p.displayName; }
        const target = safeFloorPosition(p, layout);
        if (target.x !== avatar.target.x || target.y !== avatar.target.y) { avatar.target = target; avatar.route = planFocusWalk(avatar.position, target, layout); avatar.next = 1; }
        let distance = dt * (p.userId.startsWith('scenery-character-')?6:22);
        while (avatar.next < avatar.route.length && distance > 0) {
          const to = avatar.route[avatar.next], dx = to.x - avatar.position.x, dy = to.y - avatar.position.y, length = Math.hypot(dx, dy);
          if (reduced.matches || length <= distance) { avatar.position = { ...to }; avatar.next++; distance -= length; }
          else { avatar.position = { x: avatar.position.x + dx / length * distance, y: avatar.position.y + dy / length * distance }; distance = 0; }
          avatar.root.rotation.y = Math.atan2(dx * xScale, dy * zScale);
        }
        const walking = avatar.next < avatar.route.length, seated = p.seated && !walking;
        avatar.root.position.copy(world(avatar.position)); avatar.root.visible = !(p.isMe && latest.current.mode === 'eye');
        avatar.label.visible=!p.isMe;
        avatar.body.position.y = seated ? -.47 : 0; avatar.label.position.y = seated ? 2.5 : 2.9;
        if (seated) avatar.root.rotation.y = flying || p.y > 57 ? Math.PI : 0;
        const wave = reduced.matches ? 0 : Math.sin(now * .007);
        const phase=[...p.userId].reduce((sum,char)=>sum+char.charCodeAt(0),0);
        const breath=reduced.matches?0:Math.sin(now*.0017+phase);
        avatar.body.position.y+=(walking?0:breath*.014);
        avatar.body.rotation.z=walking||reduced.matches?0:Math.sin(now*.00065+phase)*.012;
        avatar.head.rotation.y=walking||reduced.matches?0:Math.sin(now*.00045+phase)*.055;
        avatar.head.rotation.x = seated && p.status === 'focusing' ? .16 + wave * .025 : 0;
        avatar.arms.forEach((arm, i) => { arm.rotation.x = seated ? -1.85 + (p.status === 'focusing' ? wave * (p.activity === 'computer' ? .08 : .03) : 0) : walking ? wave * .45 * (i ? -1 : 1) : 0; });
        avatar.legs.forEach((leg, i) => { leg.rotation.x = seated ? -Math.PI / 2 : walking ? wave * .5 * (i ? 1 : -1) : 0; });
      }
      deskProps.forEach((items, index) => {
        const seat = FOCUS_SEATS[index], p = people.find(p => p.seated && Math.hypot(p.x - seat.x, p.y - seat.y) < 12);
        items.computer.visible = p?.activity === 'computer'; items.book.visible = !p || p.activity === 'book'; items.notebook.visible = p?.activity === 'notebook';
        const active = p?.status === 'focusing' && !reduced.matches;
        items.pencil.position.x = .25 + (active ? Math.sin(now * .005) * .12 : 0);
        items.page.rotation.z = active ? Math.max(0, Math.sin(now * .0008)) * .12 : 0;
      });
      const me = people.find(p => p.isMe), avatar = me && avatars.get(me.userId);
      hands.visible = !!me?.seated && latest.current.mode === 'eye' && !!avatar && avatar.next >= avatar.route.length;
      if (me && avatar) {
        const seated = !!me.seated && avatar.next >= avatar.route.length;
        if ((seated && !wasSeated) || lastMe !== me.userId) { yaw = seated && me.y < 57 && !flying ? Math.PI : 0; pitch = seated ? -.16 : -.12; }
        wasSeated = seated; lastMe = me.userId;
        const base = avatar.root.position.clone(), eye = seated ? 1.8 : 2.3;
        hands.position.copy(base); hands.rotation.y = flying || me.y > 57 ? Math.PI : 0;
        const skin = mat(AVATAR_SKINS[decodeAvatar(me.avatarStyle).skin]);
        leftHand.material = skin; rightHand.material = skin;
        const movement = me.status === 'focusing' && !reduced.matches ? Math.sin(now * .008) * .025 : 0;
        leftHand.position.y = 1.27 + movement; rightHand.position.y = 1.27 - movement;
        const direction = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
        if (latest.current.mode === 'eye') { camera.position.copy(base).add(new THREE.Vector3(0, eye, 0)); camera.lookAt(camera.position.clone().add(direction)); }
        else { const target = base.clone().add(new THREE.Vector3(0, 1.4, 0)); camera.position.copy(target).addScaledVector(direction, -3.7); camera.position.y = 3.1; camera.position.x = THREE.MathUtils.clamp(camera.position.x, -environment.width+.6, environment.width-.6); camera.position.z = THREE.MathUtils.clamp(camera.position.z, environment.front+.7, environment.back-.7); camera.lookAt(target); }
      } else { camera.position.set(0, 2.3, 6); camera.lookAt(0, 1.8, -3); }
      if(latest.current.mode==='overview'){
        camera.position.set(0,flying?3.25:atmosphere==='grand'?4.7:3.5,environment.back-1.1);
        camera.lookAt(-Math.sin(yaw)*environment.width*.65,THREE.MathUtils.clamp((flying?1.75:2)+(pitch+.12)*4,.8,4.5),environment.front+3);
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick); setReady(true);
    return () => {
      assetsActive=false;assets?.dispose();
      cancelAnimationFrame(frame); observer.disconnect(); controls.current = undefined;
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
      avatars.forEach(avatar => disposeLabel(avatar.label)); cube.dispose(); sphere.dispose(); cylinder.dispose(); materials.forEach(material => material.dispose());
      outdoors?.dispose(); environment.dispose(); roundedCube.dispose();
      environmentMaterials.forEach(material=>material.dispose());grainTexture.dispose();
      paperGeometry.dispose();paperMaterial.dispose();paperTexture.dispose();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  }, [props.scene, props.atmosphere, props.graphics, props.flightTime, lang]);

  return <div className="bg-[#eee4cf] text-[#304c3e]">
    {assetState&&<p role="status" className="bg-[#f8f5eb] px-4 py-2 text-xs" data-testid="room-asset-status">{({he:['טוען ריהוט מפורט ותאורה…','ריהוט תלת־ממדי מפורט ותאורת HDR','חלק מפרטי הריהוט לא נטענו; תצוגה בסיסית זמינה'],en:['Loading detailed furniture and lighting…','Detailed 3D furniture and HDR lighting','Some assets could not load; basic room available'],es:['Cargando muebles e iluminación…','Muebles 3D detallados e iluminación HDR','Algunos recursos no se cargaron; sala básica disponible'],zh:['正在加载精细家具和灯光…','精细3D家具与HDR灯光','部分资源未加载，基础房间仍可用'],ar:['تحميل الأثاث والإضاءة…','أثاث ثلاثي الأبعاد وإضاءة HDR','تعذر تحميل بعض الموارد؛ الغرفة الأساسية متاحة'],ru:['Загрузка мебели и освещения…','Детальная 3D-мебель и HDR-освещение','Часть ресурсов не загружена; доступна базовая комната']}[lang])[assetState==='loading'?0:assetState==='ready'?1:2]}</p>}
    <div ref={host} data-testid="immersive-room" className="relative h-[420px] w-full sm:h-[560px]" tabIndex={0} role="group" aria-label={copy.camera}
      onKeyDown={event => { if ((event.target as HTMLElement).closest('button')) return; if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') controls.current?.turn(event.key === 'ArrowLeft' ? .2 : -.2); else controls.current?.step(event.key === 'ArrowUp' ? 1 : -1); }}>
      {!ready && <p className="absolute inset-0 grid place-items-center">{copy.loading}</p>}
    </div>
    <div className="room-camera-controls flex flex-wrap items-center justify-between gap-3 border-t border-[#c9cbb8] bg-[#f8f5eb] px-4 py-3">
      <p className="max-w-xl text-xs leading-5">{copy.hint}</p>
      <div className="flex gap-2" dir="ltr">{[{icon:RotateCcw,label:copy.left,action:()=>controls.current?.turn(.3)},{icon:ArrowUp,label:copy.forward,action:()=>controls.current?.step(1)},{icon:ArrowDown,label:copy.back,action:()=>controls.current?.step(-1)},{icon:RotateCw,label:copy.right,action:()=>controls.current?.turn(-.3)}].map(({icon:Icon,label,action})=><button key={label} type="button" aria-label={label} onClick={action} className="rounded-xl border border-[#c5d1c0] bg-white p-3 hover:bg-[#e2eadd]"><Icon className="h-4 w-4"/></button>)}</div>
    </div>
  </div>;
}
