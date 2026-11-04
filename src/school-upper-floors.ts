import type {Point,Rect,Place} from './school-layout.ts';
import type {FloorCell} from './school-floor-data.ts';
import {planRooms,planCorridors,floorCount,floorList,lowestFloor,floorLabel,roomView,roomViewLabel,type PlanRoom,type PlanStyle,type Side} from './changhyun-plan.ts';
import {stairs,stairLanding,stairGroundObstacles,floorRise} from './school-structure.ts';
import {planFloorData} from './school-plan-data.ts';
import {pieceRect,type ClassroomModel,type ClassroomProp} from './school-classrooms.ts';
import {roomDetails,type Face} from './school-room-details.ts';

/** 모든 층의 방(본관 1~6층과 별관 0·-1·-2층). 이름은 예전 견본에서 왔지만 1층도 같은 생성기로 만든다. */
export type UpperRoom=Place&{floor:number;axis:'x'|'z';doorSide:Side;style:'classroom'|'office'|'lab'|'hall'|'gym'|'gallery'|'toilet'|'dining'|'library';row:'north'|'south';view?:'정원'|'운동장';open?:boolean};
export type UpperFurniture={floor:number;roomId:string;rect:Rect;kind:'desk'|'bench'|'shelf'|'sink'|'toilet'|'model';model?:ClassroomModel;x?:number;z?:number;y?:number;rotation?:number};
/** Walk-through furniture without collision: floor mats, balloon arches. */
export type UpperDecor={floor:number;roomId:string;model:ClassroomModel;x:number;z:number;y:number;rotation:number};
export type UpperProp=ClassroomProp&{floor:number;roomId:string;rect:Rect;spot:Point};
export const upperRooms:UpperRoom[]=[];
export const upperDecor:UpperDecor[]=[];
export const upperProps:UpperProp[]=[];
/** 영상 등으로 따로 꾸민 방. 창현고는 아직 없다. */
export const customRooms=new Set<string>();
export const upperCorridors:Record<number,Rect[]>={};
export const upperFurniture:UpperFurniture[]=[];
export const upperPlanData:Record<number,FloorCell[]>=planFloorData;
/** 지금 높이에서 걷고 있는 층. 0·-1·-2층은 별관(지하 쪽)이다. */
export const walkingFloor=(height:number)=>Math.max(lowestFloor,Math.min(floorCount,Math.round(height/floorRise)+1));
export const onFloorLevel=(height:number)=>Math.abs(height-(walkingFloor(height)-1)*floorRise)<.12;
const mid=(r:Rect):Point=>({x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2});
const within=(p:Point,r:Rect)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;

const styleOf:Partial<Record<PlanStyle,UpperRoom['style']>>={classroom:'classroom',office:'office',lab:'lab',hall:'hall',toilet:'toilet',dining:'dining',library:'library'};
/** 자주 찾는 방은 읽기 쉬운 고정 ID를 준다. */
const fixedIds:Record<string,string>={'1:교장실':'principal','1:행정실':'admin','1:1층 교무실':'teachers-1','1:당직실':'night-duty','1:시청각실':'av-hall','1:오프라인실':'offline','-2:급식실':'dining','-1:도서관':'library','-2:조리실':'kitchen','0:음악실(합창)':'music','0:미술1실(회화)':'art-1','0:미술2실(조소)':'art-2'};
const doorDepth=1.05;
const sideAxis=(side:Side)=>side==='east'||side==='west'?'x':'z';
const stairRects=stairs.map(s=>s.rect);

function room(pr:PlanRoom,style:UpperRoom['style']):UpperRoom {
  const rect=pr.rect,c=mid(rect),w=rect.maxX-rect.minX,d=rect.maxZ-rect.minZ;
  // 본관: 북줄 방은 남쪽(복도 쪽) 벽에, 남줄 방은 북쪽(복도 쪽) 벽에 문이 있다. 별관은 문이 열린 벽을 데이터에 적었다.
  const side:Side=pr.door??(pr.row==='north'?'south':'north');
  const door=side==='south'?{x:c.x,z:rect.maxZ}:side==='north'?{x:c.x,z:rect.minZ}:side==='east'?{x:rect.maxX,z:c.z}:{x:rect.minX,z:c.z};
  // 열린 홀은 문이 없으므로 안내 도착 자리를 홀 안쪽 가장자리로 둔다.
  const approach=pr.open?{x:door.x,z:door.z-.7}:side==='south'?{x:door.x,z:door.z+doorDepth}:side==='north'?{x:door.x,z:door.z-doorDepth}:side==='east'?{x:door.x+doorDepth,z:door.z}:{x:door.x-doorDepth,z:door.z};
  const id=fixedIds[`${pr.floor}:${pr.name}`]??`floor-${pr.floor}-room-${upperRooms.filter(r=>r.floor===pr.floor).length}`;
  const view=pr.annex?undefined:roomView(pr);
  const entry:UpperRoom={id,name:pr.name,rect,door,approach,floor:pr.floor,axis:sideAxis(side),doorSide:side,style,row:pr.row,view,kind:'room',enterable:!pr.open,open:!!pr.open,area:Math.round(w*d),
    areaNote:'배치도를 비율로 옮긴 참고값입니다. 실제 면적이 아닙니다.',
    description:`${floorLabel(pr.floor)} ${pr.name}입니다.${pr.annex?'':` ${roomViewLabel(pr)} 쪽 방이에요.`} 가구는 공간 용도를 보여 주는 견본이고 실제와 다를 수 있어요.`};
  if(pr.name==='급식실')entry.description='B동 도서관 층 입구에서 안쪽 계단으로 한 층 내려오는 큰 홀이에요. 긴 식탁과 벤치가 줄지어 있고, 동쪽 끝에 조리실이 붙어 있어요.';
  upperRooms.push(entry);
  const placedBoxes:Rect[]=[];
  const add=(kind:UpperFurniture['kind'],cx:number,cz:number,width:number,depth:number)=>{
    const r={minX:cx-width/2,maxX:cx+width/2,minZ:cz-depth/2,maxZ:cz+depth/2};
    // 계단 구멍과 겹치는 가구는 놓지 않는다. 급식실은 계단이 홀로 내려오므로 둘레도 넉넉히 비운다.
    const margin=style==='dining'?.45:0;
    if(stairGroundObstacles.some(s=>r.minX<s.maxX+margin&&r.maxX>s.minX-margin&&r.minZ<s.maxZ+margin&&r.maxZ>s.minZ-margin))return;
    if(style==='dining'&&stairRects.some(s=>r.minX<s.maxX+margin&&r.maxX>s.minX-margin&&r.minZ<s.maxZ+margin&&r.maxZ>s.minZ-margin))return;
    // 용도별 가구 모형(교탁·피아노 등)과 겹치는 기본 책상·벤치는 놓지 않는다.
    if(placedBoxes.some(b=>r.minX<b.maxX+.05&&r.maxX>b.minX-.05&&r.minZ<b.maxZ+.05&&r.maxZ>b.minZ-.05))return;
    upperFurniture.push({floor:pr.floor,roomId:id,kind,rect:r});
  };
  // 문이 있는 벽에서 안쪽으로 u m, 그 벽을 따라 v m 떨어진 자리(m)를 월드 좌표로.
  const lateral=side==='north'||side==='south'?w:d,deep=side==='north'||side==='south'?d:w;
  const at=(u:number,v:number):Point=>side==='south'?{x:rect.minX+v,z:rect.maxZ-u}:side==='north'?{x:rect.minX+v,z:rect.minZ+u}:side==='east'?{x:rect.maxX-u,z:rect.minZ+v}:{x:rect.minX+u,z:rect.minZ+v};
  // 가구 크기는 (벽을 따르는 길이, 안쪽 깊이)로 적고, 동·서 문 방은 가로세로를 바꿔 놓는다.
  const put=(kind:UpperFurniture['kind'],u:number,v:number,along:number,inward:number)=>{
    const p=at(u,v),alongX=sideAxis(side)==='z';
    add(kind,p.x,p.z,alongX?along:inward,alongX?inward:along);
  };
  // 용도별 가구 모형: 문 앞 통로·방 밖·계단 구멍·다른 모형과 겹치거나 상주 인물이 서는 자리에 걸리면 놓지 않는다.
  const inward:Record<Side,[number,number]>={north:[0,1],south:[0,-1],east:[-1,0],west:[1,0]};
  const alongWall:Record<Side,[number,number]>={north:[1,0],south:[1,0],east:[0,1],west:[0,1]};
  const avoid:Point[]=pr.name==='교장실'?[{x:c.x,z:c.z-.5}]:pr.name==='1층 교무실'?[{x:c.x+2.5,z:c.z}]:[];
  const lane:Rect=side==='south'?{minX:door.x-.9,maxX:door.x+.9,minZ:door.z-1.3,maxZ:door.z}:side==='north'?{minX:door.x-.9,maxX:door.x+.9,minZ:door.z,maxZ:door.z+1.3}:side==='east'?{minX:door.x-1.3,maxX:door.x,minZ:door.z-.9,maxZ:door.z+.9}:{minX:door.x,maxX:door.x+1.3,minZ:door.z-.9,maxZ:door.z+.9};
  const hit=(a:Rect,b:Rect,margin=0)=>a.minX<b.maxX+margin&&a.maxX>b.minX-margin&&a.minZ<b.maxZ+margin&&a.maxZ>b.minZ-margin;
  const place=(model:ClassroomModel,u:number,v:number,face:Face):boolean=>{
    const p=at(u,v),forward=inward[side],sideways=alongWall[side];
    const dir:[number,number]=face==='in'?forward:face==='out'?[-forward[0],-forward[1]]:face==='up'?sideways:[-sideways[0],-sideways[1]];
    const rotation=Math.atan2(dir[0],dir[1]),r=pieceRect({model,x:p.x,z:p.z,rotation});
    if(r.minX<rect.minX-1e-6||r.maxX>rect.maxX+1e-6||r.minZ<rect.minZ-1e-6||r.maxZ>rect.maxZ+1e-6)return false;
    if(!pr.open&&hit(r,lane))return false;
    if(stairGroundObstacles.some(s=>hit(r,s)))return false;
    if(placedBoxes.some(b=>hit(r,b,.05)))return false;
    if(avoid.some(a=>hit(r,{minX:a.x-.7,maxX:a.x+.7,minZ:a.z-.7,maxZ:a.z+.7})))return false;
    // 벽이나 다른 가구와 0.4~1.2 m 틈은 사람이 서 있을 수는 있어도 길 찾기가 지나지 못하는 막힌 구석이 된다(0.4 m 미만은 서 있을 수 없어 괜찮다). 붙이거나 더 띄운다.
    const narrow=(distance:number)=>distance>.4&&distance<1.2;
    if([r.minX-rect.minX,rect.maxX-r.maxX,r.minZ-rect.minZ,rect.maxZ-r.maxZ].some(narrow))return false;
    for(const b of placedBoxes) {
      const sideBySideX=r.minZ<b.maxZ&&r.maxZ>b.minZ,sideBySideZ=r.minX<b.maxX&&r.maxX>b.minX;
      if(sideBySideX&&(narrow(r.minX-b.maxX)||narrow(b.minX-r.maxX)))return false;
      if(sideBySideZ&&(narrow(r.minZ-b.maxZ)||narrow(b.minZ-r.maxZ)))return false;
    }
    upperFurniture.push({floor:pr.floor,roomId:id,kind:'model',model,x:p.x,z:p.z,rotation,rect:r});
    placedBoxes.push(r);
    return true;
  };
  const detail=roomDetails(pr.name,style,{L:lateral,D:deep,place});
  if(detail==='replace') {
    // 방 용도에 맞는 가구 모형이 기본 책상·벤치를 대신한다.
  } else if(style==='classroom') {
    // 서쪽 벽의 칠판을 보고 앉는다. 문 앞 1.6 m는 비운다.
    const inward=(m:number)=>side==='south'?rect.maxZ-m:rect.minZ+m;
    const cols=Math.max(2,Math.floor((w-2.8)/1.2)),rows=Math.max(2,Math.floor((d-2.4)/1.05));
    for(let r=0;r<rows;r++)for(let k=0;k<cols;k++) {
      const px=rect.minX+2.5+k*1.2,pz=inward(1.7+r*1.05);
      add('desk',px,pz,.5,.72);add('bench',px+.43,pz,.38,.42);
    }
  } else if(style==='lab') {
    const cols=Math.max(1,Math.floor((lateral-1.6)/2.6)),rows=Math.max(1,Math.floor((deep-3)/2.6));
    // 좁은 방(베이스실·알토실 등)에서는 양옆으로 1 m씩 지나다닐 수 있게 책상을 줄인다.
    const len=Math.min(1.9,Math.max(.9,lateral-2.1));
    for(let r=0;r<rows;r++)for(let k=0;k<cols;k++)put('desk',2.4+r*2.6,(lateral-(cols-1)*2.6)/2+k*2.6,len,.9);
  } else if(style==='office') {
    const count=Math.max(1,Math.min(5,Math.floor((lateral-1)/2.4)));
    for(let i=0;i<count;i++)put('desk',deep-1.1,1.2+i*Math.min(2.4,(lateral-2.4)/Math.max(1,count-1)),1.4,.75);
  } else if(style==='toilet') {
    put('sink',1.7,Math.min(.6,lateral/2),.62,.48);put('toilet',2.5,Math.max(lateral-.6,lateral/2),.5,.7);
  } else if(style==='hall') {
    const cols=Math.max(2,Math.floor((lateral-3)/2.2)),rows=Math.max(2,Math.floor((deep-3)/1.2));
    for(let r=0;r<rows;r++)for(let k=0;k<cols;k++)put('bench',2.2+r*1.2,2.2+k*(lateral-4.4)/Math.max(1,cols-1),1.6,.55);
  } else if(style==='library') {
    // 안쪽 벽과 양옆 벽을 따라 서가, 가운데 통로를 둔 서가 두 줄, 문 양옆에 열람 책상.
    put('shelf',deep-.6,lateral/2,lateral-1.2,.5);
    const sideLength=Math.max(1,deep-3.4);
    for(const v of [.4,lateral-.4])put('shelf',2+sideLength/2,v,.5,sideLength);
    for(const v of [lateral*.3,lateral*.7])for(const u of [deep-2.8,deep-4.6])put('shelf',u,v,Math.min(2.4,lateral*.25),.5);
    for(const v of [1.8,lateral-1.8])put('desk',2,v,1.8,.9);
  } else if(style==='dining') {
    // 긴 식탁(양쪽 벤치) 두 줄. 계단 구멍을 피해 놓는다.
    // 식탁 사이 1.5 m 통로를 두고, 가운데(문 앞)는 비워 둔다.
    for(const u of [2,5.2,8.4])for(let k=-5;k<5;k++) {
      const v=lateral/2+(k+.5)*4.5;
      if(v<1.8||v>lateral-1.8)continue;
      put('desk',u,v,3,1);put('bench',u-.75,v,3,.38);put('bench',u+.75,v,3,.38);
    }
  }
  return entry;
}
for(const pr of planRooms) {const style=styleOf[pr.style];if(style)room(pr,style);}

for(const floor of floorList) {
  const landings=stairs.filter(s=>s.bottomFloor<=floor&&s.topFloor>=floor).map(stairLanding);
  upperCorridors[floor]=[...planCorridors[floor]!.map(r=>({...r})),...landings];
}

/** 들어갈 수 없는 칸(창고·서고·매점·엘리베이터)은 장면에서 닫힌 상자로 그린다. */
export type ClosedBox={floor:number;name:string;style:PlanStyle;rect:Rect;row:'north'|'south'};
export const closedBoxes:ClosedBox[]=planRooms.filter(r=>r.style==='service'||r.style==='elevator').map(r=>({floor:r.floor,name:r.name,style:r.style,rect:r.rect,row:r.row}));

export const upperResidents:{model:string;floor:number;roomId:string;x:number;z:number;rotation:number}[]=[];
export const upperResidentObstacles:{floor:number;rect:Rect}[]=[];
const upperSurfaces:Record<number,Rect[]>=Object.fromEntries(floorList.map(floor=>[floor,[...upperCorridors[floor]!,...upperRooms.filter(r=>r.floor===floor).map(r=>r.rect)]]));
export function upperFloorSurface(point:Point,floor:number):boolean {
  return (upperSurfaces[floor]??[]).some(r=>within(point,r));
}
/** 한 층에서 걸을 수 있는 바닥 전체를 감싸는 사각형(길찾기 격자와 카메라가 쓴다). */
export const floorBounds:Record<number,Rect>=Object.fromEntries(floorList.map(floor=>{
  const rects=upperSurfaces[floor]!;
  return [floor,{minX:Math.min(...rects.map(r=>r.minX))-.5,maxX:Math.max(...rects.map(r=>r.maxX))+.5,minZ:Math.min(...rects.map(r=>r.minZ))-.5,maxZ:Math.max(...rects.map(r=>r.maxZ))+.5}];
}));
export function upperRoomWalls(room:UpperRoom):Rect[] {
  const r=room.rect,result:Rect[]=[],t=.08,d=.9;
  for(const axis of ['x','z'] as const)for(const at of axis==='x'?[r.minX,r.maxX]:[r.minZ,r.maxZ]) {
    const start=axis==='x'?r.minZ:r.minX,end=axis==='x'?r.maxZ:r.maxX;
    const gap=axis===room.axis&&Math.abs((axis==='x'?room.door.x:room.door.z)-at)<.001;
    const center=axis==='x'?room.door.z:room.door.x;
    for(const [a,b] of gap?[[start,center-d],[center+d,end]]:[[start,end]])if(b>a)result.push(axis==='x'?{minX:at-t,maxX:at+t,minZ:a,maxZ:b}:{minX:a,maxX:b,minZ:at-t,maxZ:at+t});
  }
  return result;
}
export function upperDoorLeaf(room:UpperRoom):Rect {
  return room.axis==='x'?{minX:room.door.x-.08,maxX:room.door.x+.08,minZ:room.door.z-.9,maxZ:room.door.z+.9}:{minX:room.door.x-.9,maxX:room.door.x+.9,minZ:room.door.z-.08,maxZ:room.door.z+.08};
}
