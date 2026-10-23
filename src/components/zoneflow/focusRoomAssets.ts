import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RoomAtmosphere } from '@/lib/focusRoomJourney';

type Station = { root: THREE.Group; furniture: THREE.Object3D[] };

export function attachRoomAssets(scene: THREE.Scene, renderer: THREE.WebGLRenderer, stations: Station[], shelves: THREE.Group[], bookPlaceholders: THREE.Object3D[], windows:THREE.Mesh[], kind: RoomAtmosphere) {
  let stopped=false;
  const resources=new Set<{dispose:()=>void}>(), added:THREE.Object3D[]=[];
  const loader=new GLTFLoader();
  const own=(root:THREE.Object3D)=>root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    resources.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      resources.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)resources.add(value);
    }
  });
  const load=async(id:string)=>{
    const gltf=await loader.loadAsync(`/focus-assets/${id}/model.gltf`);
    own(gltf.scene);
    if(stopped){resources.forEach(resource=>resource.dispose());return null;}
    gltf.scene.updateMatrixWorld(true);
    const groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
    gltf.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh)||Array.isArray(object.material))return;
      const geometries=groups.get(object.material)||[];
      const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);resources.add(geometry);geometries.push(geometry);groups.set(object.material,geometries);
    });
    const result=new THREE.Group();
    for(const [material,geometries] of groups){
      const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Model geometry could not be combined');
      resources.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);
    }
    return result;
  };
  const fit=(model:THREE.Group,size:THREE.Vector3,at:THREE.Vector3,parent:THREE.Object3D)=>{
    const instance=model.clone(true),bounds=new THREE.Box3().setFromObject(instance),original=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    instance.scale.set(size.x/original.x,size.y/original.y,size.z/original.z);
    instance.position.set(at.x-center.x*instance.scale.x,at.y-bounds.min.y*instance.scale.y,at.z-center.z*instance.scale.z);
    parent.add(instance);added.push(instance);return instance;
  };
  const furniture=Promise.all([load('wooden_table_02'),load('SchoolChair_01')]).then(([table,chair])=>{
    if(stopped||!table||!chair)return;
    for(const station of stations){
      fit(table,new THREE.Vector3(3.9,1.18,2.3),new THREE.Vector3(0,0,1.25),station.root);
      fit(chair,new THREE.Vector3(1.08,1.1,.95),new THREE.Vector3(0,0,-.14),station.root);
      station.furniture.forEach(object=>{object.visible=false;});
    }
  });
  const library=Promise.all([load('wooden_display_shelves_01'),load('book_encyclopedia_set_01')]).then(([shelf,books])=>{
    if(stopped||!shelf||!books)return;
    for(const placeholder of shelves){
      const root=new THREE.Group();root.position.copy(placeholder.position);root.rotation.copy(placeholder.rotation);scene.add(root);added.push(root);
      fit(shelf,new THREE.Vector3(3.5,4.2,.75),new THREE.Vector3(0,0,0),root);
      for(let row=0;row<4;row++){
        const set=fit(books,new THREE.Vector3(3.05,.56,.38),new THREE.Vector3(0,.45+row*.95,.26),root);
        set.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=false;});
      }
      placeholder.visible=false;
    }
    bookPlaceholders.forEach(object=>{object.visible=false;});
  });
  const lighting=new RGBELoader().loadAsync('/focus-assets/reading_room.hdr').then(texture=>{
    resources.add(texture);if(stopped){texture.dispose();return;}
    const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromEquirectangular(texture);pmrem.dispose();resources.add(target);
    scene.environment=target.texture;scene.environmentIntensity=.65;
  });
  const outdoors=new RGBELoader().loadAsync('/focus-assets/forest_slope.hdr').then(texture=>{
    resources.add(texture);if(stopped){texture.dispose();return;}
    windows.forEach((window,index)=>{
      const map=texture.clone();map.repeat.set(.22,.6);map.offset.set(.12+index*.16,.18);map.needsUpdate=true;
      const material=new THREE.MeshBasicMaterial({map});resources.add(map);resources.add(material);window.material=material;
    });
  });
  // Keep the working procedural room if a local asset cannot be loaded.
  const ready=Promise.allSettled([furniture,library,lighting,outdoors]).then(results=>({loaded:results.every(result=>result.status==='fulfilled'),kind}));
  return {ready,dispose:()=>{stopped=true;scene.environment=null;added.forEach(object=>object.removeFromParent());resources.forEach(resource=>resource.dispose());}};
}
