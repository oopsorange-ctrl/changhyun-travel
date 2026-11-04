import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPlayerMotion, type PlayerActivity } from './player';
import { createEffects } from './school-effects';
import { schoolPlayerHeight } from './school-plan-data';
import { roomsOnFloor, planCorridors, corridorDepth, floorCount, floorList, lowestFloor, floorLabel, frontZ, frontDoor, backDoor, openings, links } from './changhyun-plan';
import { places, schoolResidents, schoolBounds, campusSpawn, doorWidth } from './school-layout';
import {stairs,stairPoint,stairRotation,stairSurfaces,stairGroundObstacles,surfaceHeight,floorRise,groundHeight} from './school-structure';
import type { Point, Rect, TourMode } from './school-layout';
/** `model` names the furniture the seat belongs to (the piano bench plays the piano). */
export type Seat={floor:number;x:number;y:number;z:number;yaw:number;model:string};
import {campusHeight,campusEntrancePoint,entranceIds,campusBounds,campusSolids,frontLawn,lawnPath,fieldRect,pitchRect,standsRect,gymRect,gymName,backGate,westRamp,rampTop,aCourt,bCourt,bStairsRect,aDrop,bDrop,aFootprint,bFootprint,pits} from './school-outdoors';
import {upperRooms,upperCorridors,upperFurniture,upperDecor,upperProps,customRooms,closedBoxes,upperRoomWalls,floorBounds,walkingFloor,onFloorLevel} from './school-upper-floors';
import {classroomModels} from './school-classrooms';
import {createClassroomProps,bannerMaterial} from './school-props';
import {schoolConfig} from './school-config';

const center = (rect: Rect) => ({x:(rect.minX+rect.maxX)/2,z:(rect.minZ+rect.maxZ)/2});
const inside = (point:Point,rect:Rect) => point.x>=rect.minX&&point.x<=rect.maxX&&point.z>=rect.minZ&&point.z<=rect.maxZ;

/** Metric floor plans share their walking geometry and cutaway model. */
export async function createSchool(host:HTMLElement) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.92;
  renderer.setClearColor(0xeceee3);
  renderer.domElement.setAttribute('aria-label','학교 탐방 3D 견본. 주인공을 움직이거나 방과 바닥을 눌러 탐방합니다.');
  host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,400);
  const building=new THREE.Group(),campusContext=new THREE.Group(),stairRoot=new THREE.Group();
  building.name='building-exterior';campusContext.name='campus-context';stairRoot.name='stairs';scene.add(building,campusContext,stairRoot);
  const upperViews=new Map<number,THREE.Group>();
  const pmrem=new THREE.PMREMGenerator(renderer),roomEnvironment=new RoomEnvironment();
  const environment=pmrem.fromScene(roomEnvironment,.06);
  scene.environment=environment.texture;scene.environmentIntensity=.26;
  roomEnvironment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff9e7,0x98afa3,1.35));
  const sun=new THREE.DirectionalLight(0xffecd1,2.25);
  sun.position.set(-28,80,46);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-82,right:82,top:78,bottom:-78,near:1,far:220});
  sun.shadow.normalBias=.045;sun.shadow.bias=-.00018;sun.shadow.radius=3;
  scene.add(sun);scene.add(sun.target);
  const fill=new THREE.DirectionalLight(0xd8eee5,.6);fill.position.set(38,24,-28);scene.add(fill);

  const material = (color:number,roughness=.88) => new THREE.MeshStandardMaterial({color,roughness,metalness:0});
  const palette={cream:material(0xfff9e9),mint:material(0xa6c8ba),darkMint:material(0x668f80),wood:material(0xc99458),lightWood:material(0xe0b87f),floor:material(0xe9d3ad),corridor:material(0xece8d8),stone:material(0xd9dfd3),soil:material(0x917257),green:material(0x719e6b),leaf:material(0x99ba7d),glass:material(0xb5d9d8,.4),ink:material(0x5f756b),white:material(0xfffaf0)};
  const facade={field:material(0x6f936c),fieldStripe:material(0x7a9f74),court:material(0xb87967),courtEdge:material(0x789aa8),road:material(0xb8beb6)};
  const wallFinish={body:material(0xe2cfad),base:material(0xa48c73)};
  const hall={trim:material(0xb7bfbd),metal:material(0xc1cac6,.48),blue:material(0xc3dcdf),returnGreen:material(0xb9ce76),dark:material(0x626b67)};
  const roomGlass=new THREE.MeshStandardMaterial({color:0xb7d7cf,roughness:.3,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [exteriorAsset,entryAsset,furnitureAsset,residentAsset,classroomAsset]=await Promise.all(
    ['school-exterior','school-entry','school-furniture','school-residents','school-classrooms'].map(name=>loader.loadAsync(`${import.meta.env.BASE_URL}${name}.glb`)),
  );
  const prototypes=new Map<string,THREE.Object3D>();
  for(const name of ['entrance','gate'])prototypes.set(name,entryAsset!.scene.getObjectByName(name)!);
  for(const name of ['door','desk','shelf','bench'])prototypes.set(name,furnitureAsset!.scene.getObjectByName(name)!);
  for(const name of ['principal-resident','vice-principal-resident','duty-resident','gate-resident','standing-desk','restroom-sink','restroom-toilet'])prototypes.set(name,residentAsset!.scene.getObjectByName(name)!);
  for(const name of Object.keys(classroomModels))prototypes.set(name,classroomAsset!.scene.getObjectByName(name)!);
  // Cabinet glass shows the printers and microscopes stored behind it.
  classroomAsset!.scene.traverse(object=>{if(object instanceof THREE.Mesh&&/clear glass/.test((object.material as THREE.Material).name)){
    Object.assign(object.material,{transparent:true,opacity:.3,depthWrite:false});object.castShadow=false;
  }});
  // Preserve the supplied residents' atlas colors around tightly packed UV seams.
  residentAsset!.scene.traverse(object=>{if(object instanceof THREE.Mesh){
    const mat=object.material as THREE.MeshStandardMaterial;
    if(mat.map){mat.map.minFilter=THREE.LinearFilter;mat.map.generateMipmaps=false;mat.map.needsUpdate=true;}
  }});
  function asset(name:string) {
    const model=prototypes.get(name)!.clone(true);
    model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    return model;
  }
  const batches=new Map<THREE.Group,Map<THREE.Material,THREE.BufferGeometry[]>>();
  function staticGeometry(group:THREE.Group,geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,rotation?:THREE.Euler) {
    if(geometry.index) {const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(rotation??new THREE.Euler()),new THREE.Vector3(1,1,1));
    geometry.applyMatrix4(matrix);
    const batch=batches.get(group)??new Map<THREE.Material,THREE.BufferGeometry[]>();
    const geometries=batch.get(mat)??[];geometries.push(geometry);batch.set(mat,geometries);batches.set(group,batch);
  }
  function box(group:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,width:number,height:number,depth:number,rounded=false) {
    if(width<=0||height<=0||depth<=0)return;
    const geometry=rounded?new RoundedBoxGeometry(width,height,depth,2,Math.min(.1,width/5,height/5,depth/5)):new THREE.BoxGeometry(width,height,depth);
    staticGeometry(group,geometry,mat,x,y,z);
  }
  // Keep walls separate from floor/furniture batches so only an obstructing wall fades.
  const occludingWalls:{mesh:THREE.Mesh;material:THREE.Material;bounds:THREE.Box3}[]=[];
  function wallBox(group:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number) {
    if(w<=0||h<=0||d<=0)return;
    const faded=mat.clone();faded.transparent=true;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),faded);
    mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    occludingWalls.push({mesh,material:faded,bounds:new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2))});
  }
  function cylinder(group:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,radius:number,height:number) {
    staticGeometry(group,new THREE.CylinderGeometry(radius*.88,radius,height,10),mat,x,y,z);
  }
  function staticModel(group:THREE.Group,model:THREE.Object3D) {
    model.updateMatrixWorld(true);
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      let geometry=object.geometry.clone();
      if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose();}
      geometry.applyMatrix4(object.matrixWorld);
      // Imported models contain one material per mesh; match the scene's batch attributes.
      for(const name of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(name))geometry.deleteAttribute(name);
      if(!geometry.hasAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
      const batch=batches.get(group)??new Map<THREE.Material,THREE.BufferGeometry[]>();
      const mat=object.material as THREE.Material,geometries=batch.get(mat)??[];
      geometries.push(geometry);batch.set(mat,geometries);batches.set(group,batch);
    });
  }
  function plant(group:THREE.Group,x:number,y:number,z:number,size=1) {
    cylinder(group,palette.wood,x,y+.16*size,z,.23*size,.32*size);
    cylinder(group,palette.soil,x,y+.33*size,z,.205*size,.025);
    for(let i=0;i<4;i++) {
      const angle=i*Math.PI/2;
      const geometry=new THREE.SphereGeometry(.25*size,8,5);geometry.scale(.64,1.4,.74);
      staticGeometry(group,geometry,i%2?palette.leaf:palette.green,x+Math.cos(angle)*.14*size,y+.63*size,z+Math.sin(angle)*.14*size,new THREE.Euler(0,angle,.38));
    }
  }
  const signNames=[...new Set([...places.map(place=>place.name),...upperRooms.map(room=>room.name),...closedBoxes.map(b=>b.name),schoolConfig.schoolName,'엘리베이터',...floorList.map(floorLabel),'후문',gymName,'운동장','앞 정원','중앙현관'])];
  const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=Math.ceil(signNames.length/2)*128;
  const signContext=signCanvas.getContext('2d')!;
  signContext.fillStyle='#f8f4e7';signContext.fillRect(0,0,signCanvas.width,signCanvas.height);
  for(let i=0;i<signNames.length;i++) {
    const x=i%2*512,y=Math.floor(i/2)*128;
    signContext.fillStyle='#f8f4e7';signContext.fillRect(x,y,512,128);
    signContext.strokeStyle='#a2bdb1';signContext.lineWidth=5;signContext.strokeRect(x+6,y+6,500,116);
    signContext.fillStyle='#39554a';signContext.font='600 42px "Noto Sans KR", "Malgun Gothic", sans-serif';signContext.textAlign='center';signContext.textBaseline='middle';
    signContext.fillText(signNames[i]!,x+256,y+65,464);
  }
  const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const signMaterial=new THREE.MeshStandardMaterial({map:signTexture,roughness:.95,side:THREE.DoubleSide});
  function sign(group:THREE.Group,text:string,x:number,y:number,z:number,width=2.6,rotation=new THREE.Euler()) {
    const index=signNames.indexOf(text);if(index<0)return;
    const geometry=new THREE.PlaneGeometry(width,width/4),uv=geometry.getAttribute('uv');
    const rowCount=signCanvas.height/128;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+index%2)/2,(uv.getY(i)+rowCount-1-Math.floor(index/2))/rowCount);
    staticGeometry(group,geometry,signMaterial,x,y,z,rotation);
  }
  function rail(group:THREE.Group,a:THREE.Vector3,b:THREE.Vector3) {
    const geometry=new THREE.CylinderGeometry(.035,.035,a.distanceTo(b),6);
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));
    const c=a.clone().add(b).multiplyScalar(.5);staticGeometry(group,geometry,hall.metal,c.x,c.y,c.z,rotation);
  }

  const doors=new Map<string,{pivot:THREE.Group;second?:THREE.Group;target:number;angle:number;slide?:THREE.Object3D[]}>();
  /** Chair, stool and bench seats from the classroom furniture markers. */
  const seats:Seat[]=[];
  let seatHeight:number|undefined;
  let activityPose:{activity?:PlayerActivity;lift?:number}={};
  /** Batch one classroom prototype into a floor group, keeping its seats and banner face. */
  function placePiece(group:THREE.Group,floor:number,name:string,x:number,y:number,z:number,rotation:number) {
    const model=asset(name);model.position.set(x,y,z);model.rotation.y=rotation;model.updateMatrixWorld(true);
    model.traverse(marker=>{if(marker.name.startsWith('seat')){
      const at=marker.getWorldPosition(new THREE.Vector3()),facing=new THREE.Vector3(0,0,1).applyQuaternion(marker.getWorldQuaternion(new THREE.Quaternion()));
      seats.push({floor,x:at.x,y:at.y,z:at.z,yaw:Math.atan2(facing.x,facing.z),model:name});
    }});
    const face=model.getObjectByName('welcome-banner-face');
    if(face){const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.05),bannerMaterial());face.getWorldPosition(sign.position);sign.rotation.y=model.rotation.y;group.add(sign);}
    staticModel(group,model);
  }
  const pickDoors:THREE.Object3D[]=[];
  /** 농구 골대는 창현고에 없다. 상호작용 코드가 기대하는 빈 목록만 둔다. */
  const hoops:THREE.Vector3[]=[];

  // ── 바깥: 풀밭, 앞마당, 운동장, 유집체육관, 후문 ────────────────────────────────
  const earth={grass:material(0x86a97a),lawn:material(0x9cbd86),track:material(0xb87967),path:material(0xe3dcc7),pave:material(0xcfd3c5),leaf:material(0x6f9a63),leaf2:material(0x86ad6f),trunk:material(0x8a6a4c),gym:material(0xd6d9d2),gymRoof:material(0x9aa49e),stripe:material(0x7a9f74),standBlue:material(0x5d8fb8),standWhite:material(0xf3f6f8)};
  const bounds=campusBounds,groundCenter=center(bounds);
  // 낮은 구역(서쪽 비탈·별관 앞마당)은 풀밭에 구멍을 낸다.
  const subtract=(base:Rect,holes:Rect[]):Rect[]=>holes.reduce<Rect[]>((pieces,h)=>pieces.flatMap(r=>{
    const a=Math.max(r.minX,h.minX),b=Math.min(r.maxX,h.maxX),c=Math.max(r.minZ,h.minZ),d=Math.min(r.maxZ,h.maxZ);
    if(a>=b||c>=d)return [r];
    return [{...r,maxX:a},{...r,minX:b},{minX:a,maxX:b,minZ:r.minZ,maxZ:c},{minX:a,maxX:b,minZ:d,maxZ:r.maxZ}].filter(q=>q.maxX-q.minX>1e-6&&q.maxZ-q.minZ>1e-6);
  }),[base]);
  for(const r of subtract({minX:bounds.minX-40,maxX:bounds.maxX+40,minZ:bounds.minZ-40,maxZ:bounds.maxZ+40},pits))box(campusContext,earth.grass,center(r).x,-.09,center(r).z,r.maxX-r.minX,.1,r.maxZ-r.minZ);
  const lawnCenter=center(frontLawn),pathCenter=center(lawnPath);
  box(campusContext,earth.lawn,lawnCenter.x,-.04,lawnCenter.z,frontLawn.maxX-frontLawn.minX,.07,frontLawn.maxZ-frontLawn.minZ,true);
  box(campusContext,earth.path,pathCenter.x,-.01,pathCenter.z,lawnPath.maxX-lawnPath.minX,.06,lawnPath.maxZ-lawnPath.minZ,true);
  const buildingCenterX=(schoolBounds.minX+schoolBounds.maxX)/2,buildingWidth=schoolBounds.maxX-schoolBounds.minX;
  box(campusContext,earth.pave,buildingCenterX,-.03,frontZ+1.2,buildingWidth+4,.07,2.4,true);
  box(campusContext,earth.pave,buildingCenterX,-.03,schoolBounds.minZ-1.4,buildingWidth+4,.07,2.8,true);
  for(const side of [-1,1])for(let z=frontZ+4;z<frontZ+30;z+=5)plant(campusContext,frontDoor.x+side*2.6,.0,z,1.4);
  // 운동장: 트랙 + 잔디 + 선
  const fieldCenter=center(fieldRect),pitchCenter=center(pitchRect);
  box(campusContext,earth.track,fieldCenter.x,-.02,fieldCenter.z,fieldRect.maxX-fieldRect.minX,.06,fieldRect.maxZ-fieldRect.minZ,true);
  box(campusContext,facade.field,pitchCenter.x,.02,pitchCenter.z,pitchRect.maxX-pitchRect.minX,.06,pitchRect.maxZ-pitchRect.minZ,true);
  for(let i=0;i<10;i+=2)box(campusContext,earth.stripe,pitchCenter.x,.052,pitchRect.minZ+(i+.5)*(pitchRect.maxZ-pitchRect.minZ)/10,pitchRect.maxX-pitchRect.minX-.4,.012,(pitchRect.maxZ-pitchRect.minZ)/10);
  const pw=pitchRect.maxX-pitchRect.minX,pd=pitchRect.maxZ-pitchRect.minZ;
  for(const z of [pitchRect.minZ+.8,pitchRect.maxZ-.8])box(campusContext,palette.white,pitchCenter.x,.07,z,pw-1.6,.012,.1);
  for(const x of [pitchRect.minX+.8,pitchRect.maxX-.8])box(campusContext,palette.white,x,.07,pitchCenter.z,.1,.012,pd-1.6);
  box(campusContext,palette.white,pitchCenter.x,.07,pitchCenter.z,.1,.012,pd-1.6);
  staticGeometry(campusContext,new THREE.TorusGeometry(3.6,.05,5,48),palette.white,pitchCenter.x,.075,pitchCenter.z,new THREE.Euler(Math.PI/2,0,0));
  for(const side of [-1,1]) {
    const x=pitchCenter.x+side*(pw/2-.8);
    for(const z of [pitchCenter.z-3.6,pitchCenter.z+3.6])box(campusContext,palette.white,x,1.1,z,.1,2.2,.1,true);
    box(campusContext,palette.white,x,2.2,pitchCenter.z,.1,.1,7.3,true);
  }
  // 건물 뒤 스탠드(지붕 있는 길)
  for(let x=standsRect.minX+.4;x<standsRect.maxX;x+=4)cylinder(campusContext,hall.metal,x,1.6,standsRect.minZ+.4,.06,3.2);
  for(let i=0,x=standsRect.minX;x<standsRect.maxX-.01;i++,x+=4)box(campusContext,i%2?earth.standWhite:earth.standBlue,x+2,3.25,center(standsRect).z,Math.min(4,standsRect.maxX-x),.14,standsRect.maxZ-standsRect.minZ,true);
  // 유집체육관: 운동장 건너편
  const gymCenter=center(gymRect);
  box(campusContext,earth.gym,gymCenter.x,5,gymCenter.z,gymRect.maxX-gymRect.minX,10,gymRect.maxZ-gymRect.minZ,true);
  box(campusContext,earth.gymRoof,gymCenter.x,10.2,gymCenter.z,gymRect.maxX-gymRect.minX+.8,.5,gymRect.maxZ-gymRect.minZ+.8,true);
  box(campusContext,facade.courtEdge,gymCenter.x,1.2,gymRect.maxZ+.05,gymRect.maxX-gymRect.minX-1,2.4,.1);
  sign(campusContext,gymName,gymCenter.x,6.2,gymRect.maxZ+.15,6);
  // 후문
  for(const side of [-1,1]){cylinder(campusContext,hall.metal,backGate.x+side*2.4,1.6,backGate.z,.14,3.2);for(let i=0;i<4;i++)rail(campusContext,new THREE.Vector3(backGate.x+side*(2.6+i*1.5),.9,backGate.z),new THREE.Vector3(backGate.x+side*(2.6+(i+1)*1.5),.9,backGate.z));}
  box(campusContext,hall.metal,backGate.x,3.1,backGate.z,5,.14,.14,true);
  sign(campusContext,'후문',backGate.x,2.55,backGate.z+.2,2.4);
  // ── 서쪽 비탈: 본관 서쪽 출입구 → 별관 A동 앞마당(-3.6 m) → 계단 → B동 앞마당(-7.2 m) ─────────
  const stoneWall=material(0xbdb6a4),stoneTop=material(0xd8d2c0);
  const level=(r:Rect,y:number,mat:THREE.Material)=>box(campusContext,mat,center(r).x,y-.05,center(r).z,r.maxX-r.minX,.1,r.maxZ-r.minZ);
  level(aCourt,aDrop,earth.pave);level(bCourt,bDrop,earth.pave);
  // 옹벽: 둘레 중 비탈·계단·건물과 닿은 쪽은 비운다.
  const retain=(x0:number,x1:number,z0:number,z1:number,y:number,gaps:[number,number][]=[])=>{
    const alongX=Math.abs(x1-x0)>Math.abs(z1-z0),from=alongX?x0:z0,to=alongX?x1:z1;
    let free:[number,number][]=[[from,to]];
    for(const [a,b] of gaps)free=free.flatMap(([f,t])=>a>=t||b<=f?[[f,t] as [number,number]]:[...(a>f?[[f,a] as [number,number]]:[]),...(b<t?[[b,t] as [number,number]]:[])]);
    for(const [f,t] of free){
      const len=t-f;if(len<.05)continue;
      if(alongX)box(campusContext,stoneWall,(f+t)/2,(y-.02)/2,z0,len,-y+.02,.3);
      else box(campusContext,stoneWall,x0,(y-.02)/2,(f+t)/2,.3,-y+.02,len);
    }
  };
  retain(aCourt.minX,aCourt.maxX,aCourt.minZ,aCourt.minZ,aDrop,[[bStairsRect.minX,bStairsRect.maxX]]);
  retain(aCourt.minX,aCourt.maxX,aCourt.maxZ,aCourt.maxZ,aDrop);
  retain(aCourt.maxX,aCourt.maxX,aCourt.minZ,aCourt.maxZ,aDrop,[[westRamp.minZ,westRamp.maxZ]]);
  retain(bCourt.minX,bCourt.maxX,bCourt.maxZ,bCourt.maxZ,bDrop,[[bStairsRect.minX,bStairsRect.maxX]]);
  retain(bCourt.minX,bCourt.minX,bCourt.minZ,bCourt.maxZ,bDrop);
  retain(bCourt.maxX,bCourt.maxX,bCourt.minZ,bCourt.maxZ,bDrop);
  // 경사길: 매끈한 면 + 옆 옹벽 + 난간
  {
    const w=westRamp.maxX-westRamp.minX,d=westRamp.maxZ-westRamp.minZ,segs=22;
    const geometry=new THREE.PlaneGeometry(w,d,segs,1);geometry.rotateX(-Math.PI/2);geometry.translate(center(westRamp).x,0,center(westRamp).z);
    const v=geometry.getAttribute('position');
    for(let i=0;i<v.count;i++)v.setY(i,campusHeight({x:v.getX(i),z:v.getZ(i)})-.01);
    geometry.computeVertexNormals();staticGeometry(campusContext,geometry,earth.path,0,0,0);
    for(const z of [westRamp.minZ,westRamp.maxZ])for(let i=0;i<segs;i++) {
      const x0=westRamp.minX+i*w/segs,x1=x0+w/segs,h=campusHeight({x:(x0+x1)/2,z:westRamp.minZ});
      box(campusContext,stoneWall,(x0+x1)/2,h/2-.01,z,w/segs,-h+.02,.25);
    }
    for(const z of [westRamp.minZ+.1,westRamp.maxZ-.1])rail(campusContext,new THREE.Vector3(rampTop,.95,z),new THREE.Vector3(westRamp.minX,aDrop+.95,z));
  }
  // B동으로 내려가는 계단(20단)
  {
    const steps=20,w=bStairsRect.maxX-bStairsRect.minX,d=(bStairsRect.maxZ-bStairsRect.minZ)/steps;
    for(let i=0;i<steps;i++) {
      const z=bStairsRect.maxZ-(i+.5)*d,y=aDrop+(bDrop-aDrop)*(i+.5)/steps;
      box(campusContext,palette.stone,center(bStairsRect).x,y-.09,z,w,.18,d);
      box(campusContext,palette.lightWood,center(bStairsRect).x,y+.006,z-d/2+.02,w,.012,.04);
      for(const x of [bStairsRect.minX-.15,bStairsRect.maxX+.15]){box(campusContext,stoneWall,x,(y-.02)/2,z,.3,-y+.02,d);}
    }
    for(const x of [bStairsRect.minX+.1,bStairsRect.maxX-.1])rail(campusContext,new THREE.Vector3(x,aDrop+.95,bStairsRect.maxZ),new THREE.Vector3(x,bDrop+.95,bStairsRect.minZ));
  }
  // 별관 A동 정면(앞마당 쪽): 복도가 열린 벽 + 입구
  {
    const x=aFootprint.maxX,a=links.find(l=>l.id==='a-entrance')!,wallH=-aDrop;
    for(const [z0,z1] of [[aFootprint.minZ,a.wall.z-a.wall.width/2],[a.wall.z+a.wall.width/2,aFootprint.maxZ]] as const)
      box(campusContext,wallFinish.body,x-.1,aDrop+wallH/2,(z0+z1)/2,.2,wallH,z1-z0);
    box(campusContext,wallFinish.body,x-.1,aDrop+3.2,a.wall.z,.2,.8,a.wall.width);
    sign(campusContext,a.name,x+.12,aDrop+3.0,a.wall.z,2.8,new THREE.Euler(0,Math.PI/2,0));
    for(let z=aFootprint.minZ+2;z<aFootprint.maxZ-1;z+=3.3){
      if(Math.abs(z-a.wall.z)<a.wall.width/2+.6)continue;
      box(campusContext,palette.cream,x+.02,aDrop+1.9,z,.05,1.2,1.7);box(campusContext,palette.glass,x+.05,aDrop+1.9,z,.04,1,1.5);
    }
  }
  // 별관 B동 정면(앞마당 쪽): 도서관 층 창과 입구
  {
    const z=bFootprint.maxZ,b=links.find(l=>l.id==='b-entrance')!,wallH=-bDrop;
    for(const [x0,x1] of [[bFootprint.minX,b.wall.x-b.wall.width/2],[b.wall.x+b.wall.width/2,bFootprint.maxX]] as const)
      box(campusContext,wallFinish.body,(x0+x1)/2,bDrop+wallH/2,z-.1,x1-x0,wallH,.2);
    box(campusContext,wallFinish.body,b.wall.x,bDrop+3.2,z-.1,b.wall.width,.8,.2);
    sign(campusContext,b.name,b.wall.x,bDrop+3.0,z+.12,3.2);
    for(let x=bFootprint.minX+2;x<bFootprint.maxX-1;x+=3){
      if(Math.abs(x-b.wall.x)<b.wall.width/2+.8)continue;
      box(campusContext,palette.cream,x,bDrop+1.9,z+.02,1.7,1.25,.05);box(campusContext,palette.glass,x,bDrop+1.9,z+.05,1.5,1.05,.04);
    }
  }
  // 본관 서쪽 끝 출입구 표시
  {
    const west=links.find(l=>l.id==='west-entrance')!;
    sign(campusContext,west.name,west.wall.x-.12,2.7,west.wall.z,2.8,new THREE.Euler(0,-Math.PI/2,0));
  }
  // 숲(왼쪽·오른쪽 경사면): 항공사진의 나무 띠를 가볍게 옮긴 것
  const random=(i:number)=>{const x=Math.sin(i*127.1+11.7)*43758.5453;return x-Math.floor(x);};
  const clearOf=(x:number,z:number)=>![...campusSolids,fieldRect,gymRect,lawnPath,frontLawn,standsRect,...pits,aFootprint,bFootprint].some(r=>x>r.minX-3&&x<r.maxX+3&&z>r.minZ-3&&z<r.maxZ+3);
  for(let i=0,planted=0;i<400&&planted<90;i++) {
    const west=random(i*2)<.55,x=west?-78+random(i*3+1)*30:48+random(i*3+1)*14,z=-60+random(i*5+2)*122;
    if(!clearOf(x,z)||Math.hypot(x-backGate.x,z-backGate.z)<6)continue;
    const size=.9+random(i*7+3)*.8;
    cylinder(campusContext,earth.trunk,x,1.1*size,z,.22*size,2.2*size);
    staticGeometry(campusContext,new THREE.SphereGeometry(1.5*size,8,6),i%2?earth.leaf:earth.leaf2,x,3.1*size,z);
    staticGeometry(campusContext,new THREE.SphereGeometry(1.1*size,8,6),i%2?earth.leaf2:earth.leaf,x+.4*size,4.1*size,z-.3*size);
    planted++;
  }

  // 건물 뒤(운동장 쪽)에 서면 외벽이 학생을 가리므로, 이 재질들은 따로 복제해 두고 가릴 때만 투명하게 만든다.
  const shell=Object.fromEntries(Object.entries({body:wallFinish.body,base:wallFinish.base,cream:palette.cream,glass:palette.glass,stone:palette.stone,metal:hall.metal}).map(([k,m])=>{const c=m.clone();c.transparent=true;return [k,c];})) as unknown as Record<'body'|'base'|'cream'|'glass'|'stone'|'metal',THREE.MeshStandardMaterial>;
  const shellBounds=new THREE.Box3(new THREE.Vector3(schoolBounds.minX-1,0,schoolBounds.minZ-1),new THREE.Vector3(schoolBounds.maxX+1,floorCount*floorRise,schoolBounds.maxZ+1));
  // ── 건물 외관: 같은 층 데이터에서 코드로 만든다 ───────────────────────────────
  const exteriorRise=floorRise;
  for(let floor=1;floor<=floorCount;floor++) {
    const base=(floor-1)*exteriorRise;
    const parts=roomsOnFloor(floor);
    const strips=planCorridors[floor]!.filter(c=>Math.abs((c.maxZ-c.minZ)-corridorDepth)<.01);
    for(const rect of [...parts.filter(p=>p.style!=='terrace').map(p=>p.rect),...strips]) {
      const c=center(rect),w=rect.maxX-rect.minX,d=rect.maxZ-rect.minZ;
      box(building,shell.body,c.x,base+exteriorRise/2-.1,c.z,w,exteriorRise-.2,d);
      box(building,shell.base,c.x,base+exteriorRise-.1,c.z,w+.3,.2,d+.3);
    }
    for(const part of parts.filter(p=>p.style==='terrace')) {
      const c=center(part.rect);
      box(building,shell.stone,c.x,base+exteriorRise-.1,c.z,part.rect.maxX-part.rect.minX,.2,part.rect.maxZ-part.rect.minZ);
      box(building,shell.metal,c.x,base+exteriorRise+.45,part.rect.maxZ-.05,part.rect.maxX-part.rect.minX,.9,.06);
    }
    // 창: 북줄은 북쪽 면(운동장 쪽), 남줄은 남쪽 면(앞마당 쪽)에 낸다.
    for(const part of parts.filter(p=>!['stair','elevator','terrace','lobby'].includes(p.style))) {
      const w=part.rect.maxX-part.rect.minX,bays=Math.max(1,Math.round(w/1.9)),bayWidth=w/bays;
      const z=part.row==='north'?part.rect.minZ-.04:part.rect.maxZ+.04;
      for(let i=0;i<bays;i++) {
        const x=part.rect.minX+(i+.5)*bayWidth;
        box(building,shell.cream,x,base+1.95,z,bayWidth-.5,1.4,.05);
        box(building,shell.glass,x,base+1.95,z+(part.row==='north'?-.03:.03),bayWidth-.7,1.22,.04);
      }
    }
    for(const part of parts.filter(p=>p.style==='stair')) {
      const c=center(part.rect);
      box(building,shell.glass,c.x,base+1.9,part.row==='north'?part.rect.minZ-.04:part.rect.maxZ+.04,part.rect.maxX-part.rect.minX-.6,1.8,.05);
    }
  }
  // 중앙현관 차양과 학교 이름
  const lobbyFront=roomsOnFloor(1).find(r=>r.style==='lobby'&&r.row==='south')!.rect;
  {
    const c=center(lobbyFront),canopy=asset('entrance');canopy.scale.x=(lobbyFront.maxX-lobbyFront.minX+1.5)/16.55;
    canopy.position.set(c.x,0,lobbyFront.maxZ);staticModel(building,canopy);
    sign(building,schoolConfig.schoolName,c.x,3.72,lobbyFront.maxZ+3.055,5.45);
    box(building,shell.glass,c.x,1.4,lobbyFront.maxZ+.02,lobbyFront.maxX-lobbyFront.minX-.4,2.5,.05);
  }

  // ── 실내: 1~6층을 같은 방식으로 ───────────────────────────────────────────────
  // 도서관 서가: 양쪽 면에 색색의 책을 꽂는다(색이 같은 책끼리 한 번에 합쳐 그린다).
  const bookMaterials=[0xc0504d,0x4f81bd,0x9bbb59,0xf2c14e,0x7a5195,0xe0875a,0x5aa6a6,0xe8e1d0].map(c=>material(c,.7));
  let bookSeed=7;const bookRandom=()=>(bookSeed=(bookSeed*16807)%2147483647)/2147483647;
  function shelfWithBooks(group:THREE.Group,r:Rect) {
    const c=center(r),w=r.maxX-r.minX,d=r.maxZ-r.minZ,alongX=w>=d,length=alongX?w:d,thick=alongX?d:w;
    box(group,palette.wood,c.x,.95,c.z,w,1.9,d,true);
    box(group,palette.lightWood,c.x,1.93,c.z,w,.05,d);
    for(const side of [-1,1])for(const base of [.12,.6,1.08,1.56]) {
      for(let t=-length/2+.08;t<length/2-.14;) {
        const bookW=.05+bookRandom()*.07,bookH=.2+bookRandom()*.13,bookD=.15,mat=bookMaterials[Math.floor(bookRandom()*bookMaterials.length)]!;
        const along=t+bookW/2,face=thick/2+bookD/2-.01,y=base+bookH/2+.02;
        if(bookRandom()>.07)box(group,mat,alongX?c.x+along:c.x+side*face,y,alongX?c.z+side*face:c.z+along,alongX?bookW:bookD,bookH,alongX?bookD:bookW);
        t+=bookW+.012;
      }
    }
  }
  type Gap={x:number;z:number;axis:'x'|'z';width:number};
  /** 한 사각형의 둘레에서 다른 방과 닿지 않고 문틈도 아닌 부분만 얇은 벽 사각형으로 돌려준다. */
  function exposedWalls(rect:Rect,others:Rect[],gaps:Gap[]):Rect[] {
    const out:Rect[]=[],t=.08,tol=.06;
    const sides=[
      {alongX:true,c:rect.minZ,from:rect.minX,to:rect.maxX},{alongX:true,c:rect.maxZ,from:rect.minX,to:rect.maxX},
      {alongX:false,c:rect.minX,from:rect.minZ,to:rect.maxZ},{alongX:false,c:rect.maxX,from:rect.minZ,to:rect.maxZ},
    ];
    for(const side of sides) {
      let free:[number,number][]=[[side.from,side.to]];
      const cut=(a:number,b:number)=>{free=free.flatMap(([f,e])=>a>=e||b<=f?[[f,e] as [number,number]]:[...(a>f?[[f,a] as [number,number]]:[]),...(b<e?[[b,e] as [number,number]]:[])]);};
      for(const o of others) {
        if(side.alongX){if(o.minZ-tol<=side.c&&o.maxZ+tol>=side.c)cut(o.minX,o.maxX);}
        else if(o.minX-tol<=side.c&&o.maxX+tol>=side.c)cut(o.minZ,o.maxZ);
      }
      for(const g of gaps) {
        if(side.alongX&&g.axis==='z'&&Math.abs(g.z-side.c)<.25)cut(g.x-g.width/2,g.x+g.width/2);
        if(!side.alongX&&g.axis==='x'&&Math.abs(g.x-side.c)<.25)cut(g.z-g.width/2,g.z+g.width/2);
      }
      for(const [f,e] of free){
        if(e-f<.05)continue;
        out.push(side.alongX?{minX:f,maxX:e,minZ:side.c-t,maxZ:side.c+t}:{minX:side.c-t,maxX:side.c+t,minZ:f,maxZ:e});
      }
    }
    return out;
  }
  const lowWall=(group:THREE.Group,r:Rect,h=.8)=>{
    const c=center(r),w=r.maxX-r.minX,d=r.maxZ-r.minZ;
    box(group,wallFinish.body,c.x,h/2,c.z,w,h,d);box(group,wallFinish.base,c.x,.13,c.z,w+.01,.2,d+.01);
  };
  const stairViews:{group:THREE.Group;floor:number;stairId:string;arrival?:boolean}[]=[];
  for(const stair of stairs)for(let floor=stair.bottomFloor;floor<=stair.topFloor;floor++) {
    const group=new THREE.Group();group.name=`${stair.id}-${floor}F`;stairRoot.add(group);stairViews.push({group,floor,stairId:stair.id});
    const origin=stairPoint(stair,0,0),w=stair.rect.maxX-stair.rect.minX,d=stair.rect.maxZ-stair.rect.minZ;
    group.position.set(origin.x,0,origin.z);group.rotation.y=stairRotation(stair);
    group.scale.set(d/5.8,1,w/4);
    for(const s of stairSurfaces.filter(s=>s.stairId===stair.id&&s.floor===floor)) {
      const r=s.localRect,c=center(r),count=s.kind==='flight'?10:1,stepW=(r.maxX-r.minX)/count;
      const height=(x:number,z:number)=>surfaceHeight(s,stairPoint(stair,x,z));
      for(let i=0;i<count;i++) {
        const x=r.minX+(i+.5)*stepW,y=height(x,c.z);
        box(group,palette.corridor,x,y-.09,c.z,stepW,.18,r.maxZ-r.minZ);
        if(s.kind==='flight')box(group,palette.lightWood,x-stepW/2+.02,y+.006,c.z,.04,.012,r.maxZ-r.minZ);
      }
      if(s.kind==='flight')for(const z of [r.minZ+.08,r.maxZ-.08]) {
        rail(group,new THREE.Vector3(r.minX,height(r.minX,z)+.95,z),new THREE.Vector3(r.maxX,height(r.maxX,z)+.95,z));
        for(let i=0;i<=4;i++){const x=r.minX+(r.maxX-r.minX)*i/4,y=height(x,z);cylinder(group,hall.metal,x,y+.47,z,.025,.94);}
      }
    }
    sign(group,floorLabel(floor),.6,(floor-1)*floorRise+.8,.12,1);
    if(floor<stair.topFloor) {
      const arrival=new THREE.Group(),h=floor*floorRise;
      arrival.position.copy(group.position);arrival.rotation.copy(group.rotation);arrival.scale.copy(group.scale);
      stairRoot.add(arrival);stairViews.push({group:arrival,floor,stairId:stair.id,arrival:true});
      box(arrival,palette.corridor,.6,h-.09,2,1.2,.18,4);
    }
  }
  for(const floor of floorList) {
    const group=new THREE.Group();group.name=`walkable-floor-${floor}`;group.position.y=(floor-1)*floorRise;group.visible=false;scene.add(group);upperViews.set(floor,group);
    const rooms=upperRooms.filter(r=>r.floor===floor);
    let corridorRects=upperCorridors[floor]!;
    for(const hole of stairGroundObstacles)corridorRects=corridorRects.flatMap(r=>{
      const a=Math.max(r.minX,hole.minX),b=Math.min(r.maxX,hole.maxX),c=Math.max(r.minZ,hole.minZ),d=Math.min(r.maxZ,hole.maxZ);
      if(a>=b||c>=d)return [r];
      return [{...r,maxX:a},{...r,minX:b},{minX:a,maxX:b,minZ:r.minZ,maxZ:c},{minX:a,maxX:b,minZ:d,maxZ:r.maxZ}].filter(r=>r.maxX>r.minX&&r.maxZ>r.minZ);
    });
    for(const rect of corridorRects) {
      const c=center(rect);box(group,palette.corridor,c.x,-.10,c.z,rect.maxX-rect.minX,.20,rect.maxZ-rect.minZ);
      for(let x=Math.ceil(rect.minX);x<rect.maxX;x++)box(group,hall.trim,x,.003,c.z,.012,.006,rect.maxZ-rect.minZ);
      for(let z=Math.ceil(rect.minZ);z<rect.maxZ;z++)box(group,hall.trim,c.x,.003,z,rect.maxX-rect.minX,.006,.012);
    }
    // 복도 둘레 중 바깥으로 열린 쪽은 낮은 벽으로 닫는다(방·계단 칸과 닿은 쪽과 출입문 자리는 비운다).
    {
      const touching=[...roomsOnFloor(floor).map(r=>r.rect),...stairs.filter(s=>s.bottomFloor<=floor&&s.topFloor>=floor).map(s=>s.rect)];
      const gaps=[...openings.filter(o=>o.floor===floor),...(floor===1?[{x:frontDoor.x,z:frontDoor.z,axis:'z' as const,width:2.4},{x:backDoor.x,z:backDoor.z,axis:'z' as const,width:2.4}]:[])];
      for(const strip of planCorridors[floor]!)for(const wall of exposedWalls(strip,touching.filter(r=>r!==strip),gaps))lowWall(group,wall,.8);
    }
    // 계단 칸 옆면
    for(const stair of stairs.filter(s=>s.bottomFloor<=floor&&s.topFloor>=floor)) {
      const r=stair.rect,farZ=stair.entry==='north'?r.maxZ:r.minZ;
      lowWall(group,{minX:r.minX-.08,maxX:r.minX+.08,minZ:r.minZ,maxZ:r.maxZ});lowWall(group,{minX:r.maxX-.08,maxX:r.maxX+.08,minZ:r.minZ,maxZ:r.maxZ});
      lowWall(group,{minX:r.minX,maxX:r.maxX,minZ:farZ-.08,maxZ:farZ+.08});
    }
    // 열린 홀(급식실)의 둘레는 낮은 벽으로 닫는다(조리실 쪽은 터 둔다).
    for(const hallRoom of upperRooms.filter(r=>r.floor===floor&&r.open)) {
      const adjacent=roomsOnFloor(floor).filter(r=>r.rect!==hallRoom.rect&&r.style!=='stair').map(r=>r.rect);
      for(const wall of exposedWalls(hallRoom.rect,adjacent,[]))lowWall(group,wall,.8);
    }
    // 1층 중앙현관·후면 로비의 문 앞 매트와 간판
    for(const part of roomsOnFloor(floor)) {
      if(part.style==='lobby') {
        const edgeZ=part.row==='south'?part.rect.maxZ:part.rect.minZ,doorX=center(part.rect).x;
        box(group,palette.mint,doorX,.018,edgeZ+(part.row==='south'?-1.1:1.1),2.4,.035,1.6,true);
        sign(group,part.row==='south'?'중앙현관':'운동장',doorX,2.3,edgeZ,2.6);
      }
    }
    // 들어갈 수 없는 칸(창고·서고·매점·엘리베이터)
    for(const closed of closedBoxes.filter(b=>b.floor===floor)) {
      const c=center(closed.rect);
      lowWall(group,closed.rect,closed.style==='elevator'?1.1:.8);
      box(group,closed.style==='elevator'?hall.blue:palette.lightWood,c.x,closed.style==='elevator'?1.15:.84,c.z,closed.rect.maxX-closed.rect.minX-.2,.08,closed.rect.maxZ-closed.rect.minZ-.2);
      const edge=closed.row==='north'?closed.rect.maxZ+.03:closed.rect.minZ-.03;
      sign(group,closed.name,c.x,1.5,edge,Math.min(2.6,closed.rect.maxX-closed.rect.minX));
    }
    for(const room of rooms) {
      const r=room.rect,c=center(r),width=r.maxX-r.minX,depth=r.maxZ-r.minZ;
      box(group,room.style==='toilet'?palette.corridor:room.open?palette.corridor:palette.floor,c.x,-.08,c.z,width,.16,depth);
      if(room.open){
        // 벽도 문도 없는 열린 홀(급식실): 바닥 타일 줄과 간판만 둔다.
        for(let x=Math.ceil(r.minX);x<r.maxX;x+=2)box(group,hall.trim,x,.003,c.z,.012,.006,depth);
        for(let z=Math.ceil(r.minZ);z<r.maxZ;z+=2)box(group,hall.trim,c.x,.003,z,width,.006,.012);
        sign(group,room.name,c.x,2.4,r.maxZ-.25,3.6);
        continue;
      }
      for(const wall of upperRoomWalls(room)) {
        const wc=center(wall);box(group,wallFinish.body,wc.x,.40,wc.z,wall.maxX-wall.minX,.8,wall.maxZ-wall.minZ);
        box(group,wallFinish.base,wc.x,.13,wc.z,wall.maxX-wall.minX+.01,.20,wall.maxZ-wall.minZ+.01);
      }
      // 북줄 방의 북쪽(운동장 쪽) 벽은 높게 세워 창을 달고, 남줄 방의 남쪽(앞마당 쪽) 벽은 카메라 쪽이라 낮게 둔다.
      if(room.row==='north') {
        box(group,wallFinish.body,c.x,1.7,r.minZ,width,1.8,.1);
        box(group,palette.glass,c.x,1.7,r.minZ+.06,Math.min(3.6,width-1),1.1,.04,true);
        box(group,palette.lightWood,c.x,1.08,r.minZ+.1,Math.min(3.8,width-.8),.08,.14,true);
      }
      const frame=new THREE.Group(),pivot=new THREE.Group();
      frame.position.set(room.axis==='x'?room.door.x:room.door.x-.9,0,room.axis==='x'?room.door.z-.9:room.door.z);
      if(room.axis==='x')frame.rotation.y=-Math.PI/2;
      const leaf=asset('door');pivot.add(leaf);frame.add(pivot);group.add(frame);
      leaf.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.placeId=room.id;pickDoors.push(o);}});
      doors.set(room.id,{pivot,target:0,angle:0});
      for(const offset of [-.94,.94])box(group,palette.lightWood,room.door.x+(room.axis==='z'?offset:0),1.12,room.door.z+(room.axis==='x'?offset:0),.1,2.24,.1);
      sign(group,room.name,room.door.x,2.5,room.door.z,Math.min(3.8,Math.max(2.2,room.name.length*.28)),room.axis==='x'?new THREE.Euler(0,Math.PI/2,0):new THREE.Euler());
      if((room.style==='classroom'||room.style==='lab')&&!customRooms.has(room.id))box(group,palette.darkMint,r.minX+.1,1.25,c.z,.06,1.1,Math.min(3.2,depth-1));
    }
    for(const resident of schoolResidents.filter(p=>!p.outside&&floor===1)) {
      const model=asset(resident.model);model.position.set(resident.x,0,resident.z);model.rotation.y=resident.rotation;staticModel(group,model);
    }
    for(const f of upperFurniture.filter(f=>f.floor===floor)) {
      if(f.model){placePiece(group,floor,f.model,f.x!,f.y??0,f.z!,f.rotation??0);continue;}
      const r=f.rect,c=center(r),w=r.maxX-r.minX,d=r.maxZ-r.minZ;
      if(f.kind==='sink'||f.kind==='toilet'){const model=asset(f.kind==='sink'?'restroom-sink':'restroom-toilet');model.position.set(c.x,0,c.z);staticModel(group,model);continue;}
      if(f.kind==='shelf'){shelfWithBooks(group,r);continue;}
      const h=f.kind==='bench'?.42:.74;
      box(group,palette.lightWood,c.x,h,c.z,w,.06,d,true);
      for(const x of [r.minX+.06,r.maxX-.06])for(const z of [r.minZ+.06,r.maxZ-.06])box(group,hall.metal,x,h/2,z,.035,h,.035);
      if(f.kind==='bench'){if(w>d)box(group,palette.mint,c.x,.66,r.maxZ-.02,w,.42,.05,true);else box(group,palette.mint,r.maxX-.02,.66,c.z,.05,.42,d,true);}
    }
  }
  for(const decor of upperDecor)placePiece(upperViews.get(decor.floor)!,decor.floor,decor.model,decor.x,decor.y,decor.z,decor.rotation);
  // 바깥에 선 인물(환영 인사)
  for(const resident of schoolResidents.filter(p=>p.outside)) {
    const model=asset(resident.model);model.position.set(resident.x,campusHeight(resident),resident.z);model.rotation.y=resident.rotation;staticModel(campusContext,model);
  }
  for(const [group,materials] of batches)for(const [mat,geometries] of materials) {
    const merged=mergeGeometries(geometries);
    if(merged) {const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
    geometries.forEach(geometry=>geometry.dispose());
  }

  const classroomProps=createClassroomProps(upperProps,asset,floor=>upperViews.get(floor)!);
  // 창이(남)와 현이(여): 한 명을 조종하고 다른 한 명이 뒤따른다. 창이는 학생 모형, 현이는 같은 몸에 긴 머리와 치마를 더한 모형이다(assets/prepare_hyeoni.py).
  // 진짜 모형이 생기면 heroFiles의 파일만 바꾸면 된다(관절 이름 playerHips 등과 Idle·Walk 동작이 같아야 한다).
  const heroFiles:Record<'boy'|'girl',string>={boy:'school-player-meshy.glb',girl:'school-hyeoni.glb'};
  const loaded=new Map<string,Awaited<ReturnType<GLTFLoader['loadAsync']>>>();
  for(const file of new Set(Object.values(heroFiles)))loaded.set(file,await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${file}`));
  const player=new THREE.Group();player.name='school-tour-player';player.position.set(campusSpawn.x,.08,campusSpawn.z);scene.add(player);
  for(const asset of loaded.values())asset.scene.traverse(object=>{if(object instanceof THREE.Mesh){
    object.castShadow=true;object.receiveShadow=true;
    const mat=object.material as THREE.MeshStandardMaterial;
    // This densely packed atlas has no gutters: mip levels mix skin/ivory into hair.
    if(mat.map){mat.map.minFilter=THREE.LinearFilter;mat.map.generateMipmaps=false;mat.map.needsUpdate=true;}
  }});
  type Hero='boy'|'girl';
  const heroes:Record<Hero,{name:string;tint:number;height:number}>={
    boy:{name:'창이',tint:0xffffff,height:schoolPlayerHeight},
    girl:{name:'현이',tint:0xffffff,height:schoolPlayerHeight*.97},
  };
  function makeRig(kind:Hero) {
    const asset=loaded.get(heroFiles[kind])!;
    const bounds=new THREE.Box3().setFromObject(asset.scene),modelHeight=bounds.max.y-bounds.min.y;
    const model=cloneSkinned(asset.scene);
    model.traverse(object=>{if(object instanceof THREE.Mesh){
      const mat=(object.material as THREE.MeshStandardMaterial).clone();mat.color.multiply(new THREE.Color(heroes[kind].tint));object.material=mat;
    }});
    model.scale.setScalar(heroes[kind].height/Math.max(.01,modelHeight));
    const group=new THREE.Group();group.name=`hero-${kind}`;group.add(model);
    // 머리 위 이름표
    const tagCanvas=document.createElement('canvas');tagCanvas.width=256;tagCanvas.height=96;
    const tagContext=tagCanvas.getContext('2d')!;
    tagContext.fillStyle='rgba(255,252,240,.92)';tagContext.beginPath();tagContext.roundRect(18,14,220,68,34);tagContext.fill();
    tagContext.strokeStyle=kind==='boy'?'#6d8fb8':'#c77a96';tagContext.lineWidth=5;tagContext.stroke();
    tagContext.fillStyle='#39554a';tagContext.font='700 44px "Noto Sans KR","Malgun Gothic",sans-serif';tagContext.textAlign='center';tagContext.textBaseline='middle';
    tagContext.fillText(heroes[kind].name,128,50);
    const tagTexture=new THREE.CanvasTexture(tagCanvas);tagTexture.colorSpace=THREE.SRGBColorSpace;
    const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tagTexture,transparent:true,depthWrite:false}));
    tag.scale.set(.95,.356,1);tag.position.y=heroes[kind].height+.42;group.add(tag);
    return {kind,group,animate:createPlayerMotion(model,asset.animations)};
  }
  const rigs:Record<Hero,ReturnType<typeof makeRig>>={boy:makeRig('boy'),girl:makeRig('girl')};
  let lead:Hero='boy';
  const follower=new THREE.Group();follower.name='school-tour-follower';scene.add(follower);
  // 따라오는 친구는 조종하는 쪽이 걸어온 길(발자국)을 1.5 m 뒤에서 그대로 밟아 온다. 벽을 뚫지 않고 계단도 같이 오른다.
  const trail:{x:number;y:number;z:number}[]=[];
  const followGap=1.5;
  let followerMoving=false;
  function resetTrail() {
    trail.length=0;followerMoving=false;
    follower.position.copy(player.position);
    follower.rotation.y=player.rotation.y;
  }
  function setLead(kind:Hero) {
    lead=kind;
    player.add(rigs[kind].group);follower.add(rigs[kind==='boy'?'girl':'boy'].group);
    resetTrail();
  }
  setLead('boy');
  const animatePlayer=(dt:number,moving:boolean,pose:{seat?:number;activity?:PlayerActivity;lift?:number})=>rigs[lead].animate(dt,moving,pose);
  function updateFollower(dt:number) {
    const p=player.position,last=trail[trail.length-1];
    // 건물 안팎을 드나든 직후(발자국이 비어 있을 때)에는 곁으로 바로 옮긴다.
    if(!last&&Math.hypot(p.x-follower.position.x,p.z-follower.position.z)>3)follower.position.copy(p);
    if(!last||Math.hypot(p.x-last.x,p.z-last.z,p.y-last.y)>.15) {
      // 문을 지나 건물 안팎이 바뀌는 등 갑자기 멀리 옮겨 가면 발자국을 비우고 곁에 선다.
      if(last&&Math.hypot(p.x-last.x,p.z-last.z)>3){trail.length=0;follower.position.copy(p);}
      trail.push({x:p.x,y:p.y,z:p.z});
      if(trail.length>500)trail.shift();
    }
    let remaining=followGap,target={x:p.x,y:p.y,z:p.z};
    for(let i=trail.length-1;i>0;i--) {
      const a=trail[i]!,b=trail[i-1]!,length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
      if(length>=remaining&&length>0){const t=remaining/length;target={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};remaining=0;break;}
      remaining-=length;target={x:b.x,y:b.y,z:b.z};
    }
    const f=follower.position,blend=1-Math.exp(-dt*9),before={x:f.x,z:f.z};
    f.x+=(target.x-f.x)*blend;f.y+=(target.y-f.y)*blend;f.z+=(target.z-f.z)*blend;
    const dx=f.x-before.x,dz=f.z-before.z,speed=dt>0?Math.hypot(dx,dz)/dt:0;
    followerMoving=speed>.25;
    // 걸을 때는 가는 쪽을, 멈추면 조종하는 친구 쪽을 본다.
    const yaw=followerMoving?Math.atan2(dx,dz):Math.atan2(p.x-f.x,p.z-f.z);
    follower.rotation.y+=Math.atan2(Math.sin(yaw-follower.rotation.y),Math.cos(yaw-follower.rotation.y))*Math.min(1,dt*10);
    rigs[lead==='boy'?'girl':'boy'].animate(dt,followerMoving,{});
  }
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const shadowContext=shadowCanvas.getContext('2d')!,gradient=shadowContext.createRadialGradient(32,32,1,32,32,31);
  gradient.addColorStop(0,'rgba(54,67,42,.36)');gradient.addColorStop(.5,'rgba(54,67,42,.17)');gradient.addColorStop(1,'rgba(54,67,42,0)');
  shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,64,64);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.04,.78),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,toneMapped:false}));
  contact.rotation.x=-Math.PI/2;scene.add(contact);
  const followerContact=contact.clone();scene.add(followerContact);
  const routeMaterial=new THREE.MeshBasicMaterial({color:0xa26d33,transparent:true,opacity:.82,depthWrite:false});
  const routeDots=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.12,.018,10),routeMaterial,180);routeDots.count=0;routeDots.frustumCulled=false;scene.add(routeDots);
  const routeEnd=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,6,28),new THREE.MeshBasicMaterial({color:0xa26d33,transparent:true,opacity:.9}));routeEnd.rotation.x=-Math.PI/2;routeEnd.visible=false;scene.add(routeEnd);
  let mode:TourMode='campus',overview=true;
  let currentSpan=150;
  // Phones held sideways see more of the school around the visitor (0.6x magnification).
  let followSpan=20,focus=1;
  const target=new THREE.Vector3(0,4,6),desiredTarget=new THREE.Vector3(),desiredPosition=new THREE.Vector3();
  const followOffset=new THREE.Vector3(9.5,13,18),overviewOffset=new THREE.Vector3(26,58,76);
  camera.position.copy(target).add(overviewOffset);camera.lookAt(target);
  const size=()=>host.getBoundingClientRect();
  function updateFrustum() {
    const rect=size(),aspect=Math.max(1,rect.width)/Math.max(1,rect.height);
    const height=overview?currentSpan/Math.min(aspect,1.55):currentSpan/Math.max(1,aspect);
    camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  }
  const resize=()=>{const rect=size();renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height));updateFrustum();};
  new ResizeObserver(resize).observe(host);resize();
  function setMode(next:TourMode) {mode=next;resetTrail();building.visible=mode==='campus';campusContext.visible=mode==='campus';}
  function setOverview(on:boolean) {if(overview!==on)camera.zoom=1;overview=on;updateFrustum();}
  function zoomBy(factor:number) {
    camera.zoom=Math.max(.45,Math.min(2.6,camera.zoom*factor));
    camera.updateProjectionMatrix();
  }
  renderer.domElement.addEventListener('wheel',event=>{
    if(event.ctrlKey)return;
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?size().height:1);
    zoomBy(Math.exp(-delta*.0015));
  },{passive:false});
  function openDoor(id:string,open:boolean) {const door=doors.get(id);if(door)door.target=open?(id==='shop'?Math.PI/2:-Math.PI/2):0;}
  function setRoute(points:Point[]) {
    const dots:Point[]=[];let remaining=0;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1]!,b=points[i]!,length=Math.hypot(b.x-a.x,b.z-a.z);
      if(!Number.isFinite(length)||length===0)continue;
      for(let distance=remaining;distance<length;distance+=.55)dots.push({x:a.x+(b.x-a.x)*distance/length,z:a.z+(b.z-a.z)*distance/length});
      remaining=(remaining-length)% .55;if(remaining<0)remaining+=.55;
    }
    const stride=Math.max(1,Math.ceil(dots.length/180)),matrix=new THREE.Matrix4();let count=0;
    const floor=walkingFloor(player.position.y),height=(floor-1)*floorRise;
    for(let i=0;i<dots.length;i+=stride){const point=dots[i]!;matrix.makeTranslation(point.x,(mode==='floor1'?(floor>1?height:groundHeight(point)):campusHeight(point))+.105,point.z);routeDots.setMatrixAt(count++,matrix);}
    routeDots.count=count;routeDots.instanceMatrix.needsUpdate=true;
    const end=points.at(-1);routeEnd.visible=!!end&&Number.isFinite(end.x)&&Number.isFinite(end.z);
    if(routeEnd.visible&&end)routeEnd.position.set(end.x,(mode==='floor1'?(floor>1?height:groundHeight(end)):campusHeight(end))+.13,end.z);
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
  function pick(x:number,y:number):{point?:Point;placeId?:string;propId?:string} {
    const rect=size();if(rect.width<=0||rect.height<=0)return {};
    pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    floorPlane.constant=-(player.position.y+.08);
    const hit=new THREE.Vector3();if(!raycaster.ray.intersectPlane(floorPlane,hit))return {};
    const point={x:hit.x,z:hit.z};
    const activePlaces=mode==='floor1'?[...upperRooms.filter(r=>r.floor===walkingFloor(player.position.y)),...places.filter(p=>(p.floor??1)===walkingFloor(player.position.y))]:places;
    if(mode==='floor1'&&onFloorLevel(player.position.y)) {
      const propHit=raycaster.intersectObjects(classroomProps.pickables(walkingFloor(player.position.y)),true)[0];
      if(propHit)return {point,propId:propHit.object.userData.propId as string};
    }
    if(onFloorLevel(player.position.y)) {
      const doorHit=raycaster.intersectObjects(pickDoors,true).find(hit=>activePlaces.some(place=>place.id===hit.object.userData.placeId));
      if(doorHit) {
        const id=doorHit.object.userData.placeId as string,place=activePlaces.find(place=>place.id===id);
        if(place&&Math.hypot(player.position.x-place.door.x,player.position.z-place.door.z)<2.8)return {point,placeId:id};
      }
    }
    const place=activePlaces.find(place=>inside(point,place.rect));
    // An open room's floor remains a walking target instead of closing its door.
    if(place?.enterable&&doors.get(place.id)?.target===0)return {point,placeId:place.id};
    if(mode==='campus')for(const id of entranceIds)if(Math.hypot(point.x-campusEntrancePoint(id).x,point.z-campusEntrancePoint(id).z)<1.5)return {point,placeId:id};
    return {point};
  }
  function project(point:Point,height=0) {
    const position=new THREE.Vector3(point.x,height,point.z).project(camera),rect=size();
    return {x:(position.x+1)*rect.width/2,y:(1-position.y)*rect.height/2,visible:Number.isFinite(position.x)&&position.z>=-1&&position.z<=1&&Math.abs(position.x)<1&&Math.abs(position.y)<1};
  }
  function tick(dt:number,time:number,moving:boolean) {
    dt=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.05):0;
    animatePlayer(dt,moving,{seat:seatHeight,...activityPose});
    updateFollower(dt);
    for(const view of stairViews) {
      const base=(view.floor-1)*floorRise,stair=stairs.find(s=>s.id===view.stairId)!;
      view.group.visible=player.position.y>=base-.15&&player.position.y<(base+floorRise+(view.arrival?-.15:.15))&&(player.position.y<.2||Math.hypot(player.position.x-stair.rect.minX,player.position.z-stair.rect.minZ)<12);
    }
    const activeFloor=Math.max(lowestFloor,Math.min(floorCount,Math.floor((player.position.y+.15)/floorRise)+1));
    building.visible=mode==='campus';campusContext.visible=mode==='campus';
    stairRoot.visible=mode==='floor1';
    for(const [floor,view] of upperViews)view.visible=mode==='floor1'&&floor===activeFloor;
    contact.position.set(player.position.x,player.position.y+.035,player.position.z);
    followerContact.position.set(follower.position.x,follower.position.y+.035,follower.position.z);
    classroomProps.tick(dt,player);
    effects.tick(dt);
    if(cue.visible){cueClock+=dt;arrow.position.y=rim.position.y=Math.sin(cueClock*4)*.08;cue.rotation.y+=dt*1.8;}
    for(const door of doors.values()) {
      door.angle=THREE.MathUtils.damp(door.angle,door.target,door.slide?7:12,dt);
      // Sliding leaves part sideways along the wall instead of swinging.
      if(door.slide){const open=Math.abs(door.angle)/(Math.PI/2);door.slide.forEach((leaf,i)=>{leaf.position.x=doorWidth/2+(i?1:-1)*open*(doorWidth/2-.04);});continue;}
      door.pivot.rotation.y=door.angle;if(door.second)door.second.rotation.y=-door.angle;
    }
    if(overview)desiredTarget.set(mode==='campus'?0:(floorBounds[activeFloor]!.minX+floorBounds[activeFloor]!.maxX)/2,mode==='campus'?4:(activeFloor-1)*floorRise,mode==='campus'?6:(floorBounds[activeFloor]!.minZ+floorBounds[activeFloor]!.maxZ)/2);
    else desiredTarget.set(player.position.x,player.position.y+1,player.position.z-.5);
    desiredPosition.copy(desiredTarget).add(overview?overviewOffset:followOffset);
    const blend=1-Math.exp(-dt*5.5);target.lerp(desiredTarget,blend);camera.position.lerp(desiredPosition,blend);
    currentSpan=THREE.MathUtils.lerp(currentSpan,overview?(mode==='campus'?150:activeFloor<1?60:105):followSpan/focus,blend);camera.lookAt(target);updateFrustum();
    const viewDirection=camera.getWorldDirection(new THREE.Vector3()).negate();
    for(const wall of occludingWalls) {
      const hidden=!overview&&mode==='floor1'&&[.45,1,1.5].some(h=>{
        const ray=new THREE.Ray(player.position.clone().add(new THREE.Vector3(0,h,0)),viewDirection);
        return ray.intersectsBox(wall.bounds);
      });
      wall.material.opacity=THREE.MathUtils.damp(wall.material.opacity,hidden?.12:1,14,dt);
      wall.material.depthWrite=wall.material.opacity>.98;
      wall.mesh.castShadow=wall.material.opacity>.98;
    }
    {
      const hiddenByBuilding=mode==='campus'&&!overview&&[.4,1,1.6].some(h=>new THREE.Ray(player.position.clone().add(new THREE.Vector3(0,h,0)),viewDirection).intersectsBox(shellBounds));
      for(const m of Object.values(shell)){m.opacity=THREE.MathUtils.damp(m.opacity,hiddenByBuilding?.045:1,10,dt);m.depthWrite=m.opacity>.98;}
    }
    if(routeEnd.visible)routeEnd.scale.setScalar(1+Math.sin(Number.isFinite(time)?time*3:0)*.06);
    renderer.render(scene,camera);
  }
  setMode('campus');
  const effects=createEffects(scene);
  // A bobbing orange marker above whatever the action button would use; drawn over walls so it is never lost.
  const cue=new THREE.Group();cue.visible=false;cue.renderOrder=10;scene.add(cue);
  const cueMaterial=new THREE.MeshBasicMaterial({color:0xff7a2f,depthTest:false,transparent:true});
  const cueEdge=new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true});
  const arrow=new THREE.Mesh(new THREE.ConeGeometry(.16,.3,4),cueMaterial);arrow.rotation.x=Math.PI;arrow.renderOrder=11;
  const rim=new THREE.Mesh(new THREE.ConeGeometry(.2,.37,4),cueEdge);rim.rotation.x=Math.PI;rim.position.y=.02;rim.renderOrder=10;
  cue.add(rim,arrow);
  let cueClock=0;
  /** The current view as a 2D canvas, rendered now so the WebGL buffer is still intact. */
  function capture() {
    renderer.render(scene,camera);
    const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
    canvas.getContext('2d')!.drawImage(renderer.domElement,0,0);return canvas;
  }
  /** Shows the cue above a point (world height included), or hides it. */
  function setCue(at:{x:number;y:number;z:number}|undefined) {
    cue.visible=!!at&&!overview;if(at)cue.position.set(at.x,at.y,at.z);
  }
  return {effects,hoops,setCue,setLead,getLead:()=>lead,heroName:(kind:Hero)=>heroes[kind].name,courtFloor:0,capture,setFocus:(value:number)=>{focus=value;},setActiveProp:classroomProps.setActive,propStage:classroomProps.stage,renderer,scene,camera,player,setMode,setOverview,zoomBy,openDoor,setRoute,pick,project,tick,useProp:classroomProps.use,seats,setActivityPose:(pose:{activity?:PlayerActivity;lift?:number})=>{activityPose=pose;},setFollowScale:(magnification:number)=>{followSpan=20/magnification;},setSeated:(height:number|undefined)=>{seatHeight=height;}};
}
export type School=Awaited<ReturnType<typeof createSchool>>;
