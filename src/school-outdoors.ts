import type {Point,Rect} from './school-layout.ts';
import {frontZ,frontDoor,backDoor,roomsOnFloor,planCorridors,links} from './changhyun-plan.ts';
import {stairs} from './school-structure.ts';

/**
 * 건물 바깥. 항공사진(references/항공사진.png)의 위치 관계를 가볍게 옮겼고 거리는 어림값이다.
 * 정문은 없다 — 앞 학교와 이어진 앞마당 길로 들어온다. 운동장은 건물 뒤(북쪽), 운동장 건너편에 유집체육관과 후문이 있다.
 */
export const campusBounds:Rect={minX:-80,maxX:64,minZ:-62,maxZ:66};

// ── 서쪽 비탈: 본관 서쪽 끝 출입구 → A동 앞마당(-3.6 m) → B동 앞 계단 → B동 앞마당(-7.2 m) ──
export const westRamp:Rect={minX:-52,maxX:-41,minZ:10.6,maxZ:14.2};
export const rampTop=-43;
export const aCourt:Rect={minX:-61.8,maxX:-52,minZ:-2,maxZ:23.1};
export const bStairsRect:Rect={minX:-58,maxX:-54,minZ:-8,maxZ:-2};
export const bCourt:Rect={minX:-70,maxX:-44.25,minZ:-14.05,maxZ:-8};
export const aDrop=-3.6,bDrop=-7.2;
/** 별관 건물 바닥 자리(비탈에 묻혀 있어 윗면은 바깥 땅과 같은 높이). */
export const aFootprint:Rect={minX:-72,maxX:-61.8,minZ:-2,maxZ:23.1};
export const bFootprint:Rect={minX:-70,maxX:-44.25,minZ:-24,maxZ:-14.05};
/** 바깥 지형이 낮아지는 구역. 둘레는 옹벽이라 걸어서 넘을 수 없다. */
export const pits:Rect[]=[aCourt,bCourt,westRamp,bStairsRect];
const inRect=(p:Point,r:Rect)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
export function campusHeight(p:Point):number {
  if(inRect(p,westRamp))return aDrop*clamp01((rampTop-p.x)/(rampTop-westRamp.minX));
  if(inRect(p,bStairsRect))return aDrop+(bDrop-aDrop)*clamp01((bStairsRect.maxZ-p.z)/(bStairsRect.maxZ-bStairsRect.minZ));
  if(inRect(p,aCourt))return aDrop;
  if(inRect(p,bCourt))return bDrop;
  return 0;
}
export const insideCampusBoundary=(p:Point)=>p.x>=campusBounds.minX&&p.x<=campusBounds.maxX&&p.z>=campusBounds.minZ&&p.z<=campusBounds.maxZ;
export const campusWalkAreas:Rect[]=[campusBounds];
/** 실내로 들어가는 문은 상호작용으로 지나므로 걸어서 들어가는 문틈은 없다. */
export const campusDoorways:Rect[]=[];
export const containsOutdoor=(p:Point,r:Rect)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;

/** 앞마당 삼각 잔디와 중앙현관으로 이어지는 길. */
export const frontLawn:Rect={minX:-26,maxX:20,minZ:frontZ+2,maxZ:frontZ+32};
export const lawnPath:Rect={minX:frontDoor.x-1.6,maxX:frontDoor.x+1.6,minZ:frontZ,maxZ:frontZ+32};
/** 처음 도착하는 자리. 앞 학교 쪽에서 앞마당 길을 따라 올라온다. */
export const arrivalPoint:Point={x:frontDoor.x,z:frontZ+30};

/** 운동장(건물 뒤 북쪽). 사이에 지붕 있는 스탠드 길이 있다. */
export const fieldRect:Rect={minX:-23.5,maxX:34,minZ:-36.4,maxZ:-2.9};
export const pitchRect:Rect={minX:-21,maxX:31.5,minZ:-34,maxZ:-5.5};
export const standsRect:Rect={minX:-22,maxX:10,minZ:-1.6,maxZ:3.4};
/** 운동장 건너편의 유집체육관. 들어갈 수 없다. */
export const gymRect:Rect={minX:4,maxX:36,minZ:-54.5,maxZ:-38.5};
export const gymName='유집체육관';
/** 후문: 체육관과 주차장 사이. */
export const backGate:Point={x:44,z:-45};
export const backGateRect:Rect={minX:backGate.x-3,maxX:backGate.x+3,minZ:backGate.z-1.5,maxZ:backGate.z+1.5};

// 걸을 수 없는 바깥 덩어리: 본관 1층 외곽(필로티 아래 통로는 열려 있다)과 유집체육관.
export const campusSolids:Rect[]=[
  ...roomsOnFloor(1).map(r=>r.rect),
  ...planCorridors[1]!,
  ...stairs.filter(s=>s.bottomFloor===1).map(s=>s.rect),
  gymRect,
];

export function campusEntrancePoint(id:string):Point {
  const link=links.find(l=>l.id===id);
  if(link)return {...link.outside};
  if(id==='back-entrance')return {x:backDoor.x,z:backDoor.z-1.5};
  return {x:frontDoor.x,z:frontDoor.z+1.5};
}
/** 바깥에서 건물 안으로 들어갈 수 있는 문들(본관 앞·뒤, 서쪽 출입구, 별관 A동·B동). */
export const entranceIds=['entrance','back-entrance',...links.map(l=>l.id)];
export function canInteractFromCampus(id:string,p:Point):boolean {
  if(id==='entrance'||id==='back-entrance') {
    const entrance=campusEntrancePoint(id);
    return Math.abs(p.z-entrance.z)<=2&&Math.abs(p.x-entrance.x)<=3.2;
  }
  if(links.some(l=>l.id===id)) {
    const entrance=campusEntrancePoint(id);
    return Math.hypot(p.x-entrance.x,p.z-entrance.z)<=2.4;
  }
  return false;
}
