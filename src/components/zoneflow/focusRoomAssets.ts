import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoomAtmosphere } from '@/lib/focusRoomJourney';

type Station = { root: THREE.Group; furniture: THREE.Object3D[] };

export function attachRoomAssets(scene: THREE.Scene, renderer: THREE.WebGLRenderer, stations: Station[], shelves: THREE.Group[], bookPlaceholders: THREE.Object3D[], windows:THREE.Mesh[], kind: RoomAtmosphere, surfaces:{floor:THREE.Mesh;walls:THREE.Mesh[]}) {
  let stopped=false;
  const resources=new Set<{dispose:()=>void}>(), added:THREE.Object3D[]=[];
  const disposed=new WeakSet<object>(), restore:(()=>void)[]=[];
  const release=(resource:{dispose:()=>void})=>{if(!disposed.has(resource)){disposed.add(resource);resource.dispose();}};
  const keep=<T extends {dispose:()=>void}>(resource:T):T=>{if(stopped)release(resource);else resources.add(resource);return resource;};
  const replaceMaterial=(mesh:THREE.Mesh,material:THREE.Material)=>{
    const previous=mesh.material;restore.push(()=>{mesh.material=previous;});mesh.material=material;
  };
  const hide=(object:THREE.Object3D)=>{const visible=object.visible;restore.push(()=>{object.visible=visible;});object.visible=false;};
  const cafe=kind==='cafe'||kind==='city-cafe';
  const historical=kind==='heritage-library'||kind==='monastery-library';
  const loader=new GLTFLoader();
  const own=(root:THREE.Object3D)=>root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    keep(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      keep(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)keep(value);
    }
  });
  const load=async(id:string)=>{
    const gltf=await loader.loadAsync(`/focus-assets/${id}/model.gltf`);
    own(gltf.scene);
    if(stopped)return null;
    if(historical&&id!=='book_encyclopedia_set_01')gltf.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial)material.color.set(kind==='heritage-library'?0x967658:0xb1a38c);
    });
    gltf.scene.updateMatrixWorld(true);
    const groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
    gltf.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      if(Array.isArray(object.material))throw new Error('Unsupported multi-material model');
      const geometries=groups.get(object.material)||[];
      const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);resources.add(geometry);geometries.push(geometry);groups.set(object.material,geometries);
    });
    const result=new THREE.Group();
    for(const [material,geometries] of groups){
      const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Model geometry could not be combined');
      resources.add(geometry);geometries.forEach(release);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);
    }
    return result;
  };
  const fit=(model:THREE.Group,size:THREE.Vector3,at:THREE.Vector3,parent:THREE.Object3D)=>{
    const instance=model.clone(true),bounds=new THREE.Box3().setFromObject(instance),original=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    if(![original.x,original.y,original.z].every(value=>Number.isFinite(value)&&value>0))throw new Error('Invalid model dimensions');
    instance.scale.set(size.x/original.x,size.y/original.y,size.z/original.z);
    instance.position.set(at.x-center.x*instance.scale.x,at.y-bounds.min.y*instance.scale.y,at.z-center.z*instance.scale.z);
    parent.add(instance);added.push(instance);return instance;
  };
  const furniture=Promise.all([load(cafe?'round_wooden_table_02':'wooden_table_02'),load(cafe||historical?'WoodenChair_01':'SchoolChair_01')]).then(([table,chair])=>{
    if(stopped||!table||!chair)return;
    for(const station of stations){
      fit(table,new THREE.Vector3(cafe?2.5:3.9,1.18,cafe?2.5:2.3),new THREE.Vector3(0,0,1.25),station.root);
      fit(chair,new THREE.Vector3(1.08,1.1,.95),new THREE.Vector3(0,0,-.14),station.root);
      station.furniture.filter(object=>!object.userData.roomAccessory).forEach(hide);
    }
  });
  const library=cafe?Promise.resolve():Promise.all([load('wooden_display_shelves_01'),load('book_encyclopedia_set_01')]).then(([shelf,books])=>{
    if(stopped||!shelf||!books)return;
    for(const placeholder of shelves){
      const root=new THREE.Group();root.position.copy(placeholder.position);root.rotation.copy(placeholder.rotation);scene.add(root);added.push(root);
      const height=Number(placeholder.userData.shelfHeight)||4.2;
      const levels=height>6?2:1,unitHeight=height/levels;
      for(let level=0;level<levels;level++)fit(shelf,new THREE.Vector3(3.5,unitHeight,.75),new THREE.Vector3(0,level*unitHeight,0),root);
      for(let row=0;row<4*levels;row++){
        const set=fit(books,new THREE.Vector3(3.05,.56,.38),new THREE.Vector3(0,.45+Math.floor(row/4)*unitHeight+(row%4)*unitHeight*.226,.26),root);
        set.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=false;});
      }
      hide(placeholder);
    }
    bookPlaceholders.forEach(hide);
  });
  const lighting=new RGBELoader().loadAsync('/focus-assets/reading_room.hdr').then(texture=>{
    keep(texture);if(stopped)return;
    const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromEquirectangular(texture);pmrem.dispose();resources.add(target);
    scene.environment=target.texture;scene.environmentIntensity=.65;
  });
  // Live scenery owns the windows; async asset loads must not replace their materials.
  const textureLoader=new THREE.TextureLoader();
  const surface=async(meshes:THREE.Mesh[],id:string,repeat:number,roughness:number)=>{
    const textures=await Promise.all(['diff','nor_gl'].map(async channel=>keep(await textureLoader.loadAsync(`/focus-assets/${id}/${channel}.jpg`))));
    if(stopped)return;
    for(const texture of textures){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
    textures[0].colorSpace=THREE.SRGBColorSpace;
    const material=keep(new THREE.MeshStandardMaterial({map:textures[0],normalMap:textures[1],normalScale:new THREE.Vector2(.3,.3),roughness}));
    meshes.forEach(mesh=>replaceMaterial(mesh,material));
  };
  const architecture=kind==='monastery-library'?Promise.resolve():Promise.all([surface([surfaces.floor],'herringbone_parquet',5,.65),surface(surfaces.walls,'plastered_wall_02',4,.94)]);
  // Keep the working procedural room if a local asset cannot be loaded.
  const ready=Promise.allSettled([furniture,library,lighting,architecture]).then(results=>({loaded:results.every(result=>result.status==='fulfilled'),kind}));
  const previousEnvironment=scene.environment,previousIntensity=scene.environmentIntensity;
  return {ready,dispose:()=>{if(stopped)return;stopped=true;scene.environment=previousEnvironment;scene.environmentIntensity=previousIntensity;restore.reverse().forEach(action=>action());added.forEach(object=>object.removeFromParent());resources.forEach(release);resources.clear();}};
}
