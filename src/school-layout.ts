import type {FloorCell} from './school-floor-data.ts';
import {planAspectRatios,firstFloorDimensions} from './school-plan-data.ts';
import {frontZ,planRect,buildingDepth,frontDoor,backDoor,roomsOnFloor,links} from './changhyun-plan.ts';
import {stairs,stairEntry} from './school-structure.ts';
import {fieldRect,backGate,gymRect,gymName,frontLawn,arrivalPoint,campusEntrancePoint} from './school-outdoors.ts';

export type Point={x:number;z:number};
export type TourMode='campus'|'floor1';
export type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
/** floor는 1층이 아닌 곳(별관 A동·B동 입구 등)에만 적는다. */
export type Place={id:string;name:string;rect:Rect;kind:'room'|'outdoor'|'service';door:Point;approach:Point;enterable:boolean;area?:number;areaNote?:string;description:string;floor?:number};
export type Furnishing={roomId:string;kind:'desk'|'shelf'|'bench';rect:Rect};

export const doorWidth=1.8;
export const wallThickness=.16;
export const characterRadius=.25;
/** 본관 평면 전체(엘리베이터·동쪽 끝 방까지). */
export const schoolBounds:Rect=planRect(0,84,0,buildingDepth);
/** 첫 도착 자리: 앞 학교 쪽 앞마당 길. 정문이 없다. */
export const arrivalSpawn:Point={...arrivalPoint};
/** 건물 밖으로 나올 때와 전체 보기의 기준 자리. */
export const campusSpawn:Point=campusEntrancePoint('entrance');

export function cellRect(cell:FloorCell,_floor=1):Rect {
  const width=firstFloorDimensions.width,colScale=width/42,rowScale=width*planAspectRatios[1]/9;
  const minX=(cell.col-1)*colScale-width/2,minZ=(cell.row-10)*rowScale+frontZ;
  return {minX,maxX:minX+cell.colSpan*colScale,minZ,maxZ:minZ+cell.rowSpan*rowScale};
}

const lobbyPlan=roomsOnFloor(1).find(r=>r.style==='lobby'&&r.row==='south')!;
const backLobbyPlan=roomsOnFloor(1).find(r=>r.style==='lobby'&&r.row==='north')!;
const lobbyRect=lobbyPlan.rect;
export const lobbyExit:Point={x:(lobbyRect.minX+lobbyRect.maxX)/2,z:lobbyRect.maxZ-1.2};
export const floorSpawn:Point={x:(lobbyRect.minX+lobbyRect.maxX)/2,z:lobbyRect.maxZ-1.6};
export const backLobbyExit:Point={x:(backLobbyPlan.rect.minX+backLobbyPlan.rect.maxX)/2,z:backLobbyPlan.rect.minZ+1.2};

/** 방이 아닌 곳: 두 출입구, 계단, 바깥 공간. 방은 school-upper-floors의 upperRooms에 있다(1층도 포함). */
export const places:Place[]=[
  {id:'entrance',name:'중앙현관',rect:lobbyRect,kind:'service',enterable:false,door:{...frontDoor},approach:lobbyExit,
    description:'정원이 보이는 정면 출입구예요. 들어가면 1층 중앙 로비가 나오고, 건너편 후면 로비로 나가면 운동장이에요.'},
  {id:'back-entrance',name:'후면 로비 · 운동장 출입구',rect:backLobbyPlan.rect,kind:'service',enterable:false,door:{...backDoor},approach:backLobbyExit,
    description:'중앙현관과 마주 보는 로비예요. 북쪽 문으로 나가면 운동장이 펼쳐져요.'},
  ...stairs.map<Place>(s=>({id:s.id,name:s.name,rect:s.rect,kind:'service',enterable:false,door:stairEntry(s),approach:stairEntry(s),...(s.topFloor<1?{floor:s.topFloor}:{}),
    description:`이동키나 화면 이동판으로 ${s.bottomFloor}~${s.topFloor}층 계단과 계단참을 오르내려 보세요.`})),
  {id:'field',name:'운동장',rect:fieldRect,kind:'outdoor',enterable:false,door:{x:(fieldRect.minX+fieldRect.maxX)/2,z:fieldRect.maxZ},approach:{x:(fieldRect.minX+fieldRect.maxX)/2,z:fieldRect.maxZ+.5},
    description:'본관 뒤쪽에 있는 운동장이에요. 북향 교실에서 이 운동장이 내려다보여요.'},
  {id:'front-garden',name:'앞 정원',rect:frontLawn,kind:'outdoor',enterable:false,door:{x:frontDoor.x,z:frontLawn.minZ},approach:{x:frontDoor.x,z:frontLawn.minZ+1},
    description:'남향 교실에서 내려다보이는 앞마당 잔디와 길이에요. 앞 학교와 이어져 있어요.'},
  {id:'gym',name:gymName,rect:gymRect,kind:'outdoor',enterable:false,door:{x:gymRect.maxX,z:(gymRect.minZ+gymRect.maxZ)/2},approach:{x:gymRect.maxX+1,z:(gymRect.minZ+gymRect.maxZ)/2},
    description:'운동장 건너편, 후문 가까이에 있는 붉은 벽돌 체육관이에요. 출입문은 후문 쪽(동쪽) 벽에 있어요. 안은 둘러볼 수 없어요.'},
  ...links.map<Place>(l=>({id:l.id,name:l.name,floor:l.floor,kind:'service',enterable:false,
    rect:{minX:l.inside.x-.5,maxX:l.inside.x+.5,minZ:l.inside.z-.5,maxZ:l.inside.z+.5},door:{x:l.wall.x,z:l.wall.z},approach:{...l.inside},
    description:l.id==='west-entrance'?'본관 1층 복도 서쪽 끝 문이에요. 나가면 비탈길을 따라 별관 A동(음악·미술)으로 내려가요.':l.id==='a-entrance'?'음악실과 미술실이 있는 별관 A동이에요. 본관보다 한 층 아래 비탈길 아래에 있어서 밖으로 나가 걸어서 들어와요. 건물 뒤쪽 계단을 내려가면 B동이에요.':'도서관 층으로 들어가는 B동 입구예요. 안쪽 계단을 한 층 더 내려가면 급식실(복지관)이에요.'})),
  {id:'back-gate',name:'후문',rect:{minX:backGate.x-2,maxX:backGate.x+2,minZ:backGate.z-1,maxZ:backGate.z+1},kind:'outdoor',enterable:false,door:{...backGate},approach:{x:backGate.x,z:backGate.z+2},
    description:'운동장 건너 체육관 쪽에 있는 후문이에요. 정문이 따로 없어서 앞쪽은 앞 학교와 이어져 있어요.'},
];

const roomCenter=(name:string,floor=1)=>{const r=roomsOnFloor(floor).find(p=>p.name===name)!.rect;return {x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2};};
const principalAt=roomCenter('교장실'),viceAt=roomCenter('1층 교무실'),dutyAt=roomCenter('당직실');
// 실내 인물은 모두 1층이다. 교문이 없으므로 환영 인사는 앞마당 길에서 한다.
export const schoolResidents=[
  {model:'principal-resident',roomId:'principal',x:principalAt.x,z:principalAt.z-.5,outside:false,rotation:0},
  {model:'vice-principal-resident',roomId:'teachers-1',x:viceAt.x+2.5,z:viceAt.z,outside:false,rotation:0},
  {model:'duty-resident',roomId:'night-duty',x:dutyAt.x,z:dutyAt.z-.5,outside:false,rotation:0},
  {model:'principal-resident',roomId:'gate-welcome',x:arrivalPoint.x+2.2,z:arrivalPoint.z-5,outside:true,rotation:0},
];
export const residentObstacles:Rect[]=schoolResidents.map(p=>({minX:p.x-.35,maxX:p.x+.35,minZ:p.z-.4,maxZ:p.z+.5}));
/** 1층 실내 고정 장애물(인물). */
export const fixedObstacles:Rect[]=residentObstacles;
