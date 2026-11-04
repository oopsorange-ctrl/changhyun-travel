import type {Point,Rect} from './school-layout.ts';
import {planStairs,floorCount} from './changhyun-plan.ts';

export const floorRise=3.6;
export const topFloor=floorCount;
export const contains=(p:Point,r:Rect)=>p.x>=r.minX-1e-7&&p.x<=r.maxX+1e-7&&p.z>=r.minZ-1e-7&&p.z<=r.maxZ+1e-7;
/** 본관 바닥은 모두 같은 높이다. 지형 높이 차는 없다. */
export function groundHeight(_p:Point):number {return 0;}

export type Stair={id:string;name:string;rect:Rect;entry:'north'|'south';bottomFloor:number;topFloor:number};
/**
 * 계단 네 곳. 층계참(복도와 닿는 쪽)에서 2단 꺾여 한 층을 오른다.
 * 남줄 계단은 북쪽이, 북줄(중앙) 계단은 남쪽이 복도와 닿는다.
 */
export const stairs:Stair[]=planStairs.map(s=>({id:s.id,name:s.name,rect:s.rect,entry:s.entry,bottomFloor:s.bottomFloor,topFloor:s.topFloor}));

/**
 * 계단 안쪽 좌표 → 월드. x는 층계참 쪽(0)에서 먼 쪽(5.8)까지, z는 폭(0~4)이다.
 * 'south' 입구는 남쪽 끝이 x=0이고, 'north' 입구는 북쪽 끝이 x=0이다.
 */
export const stairPoint=(s:Stair,x:number,z:number):Point=>{
  const w=s.rect.maxX-s.rect.minX,d=s.rect.maxZ-s.rect.minZ;
  return s.entry==='south'?{x:s.rect.minX+z*w/4,z:s.rect.maxZ-x*d/5.8}:{x:s.rect.maxX-z*w/4,z:s.rect.minZ+x*d/5.8};
};
/** 장면에서 계단 모형을 놓을 때의 회전. 안쪽 x축이 남쪽 입구면 위(-z), 북쪽 입구면 아래(+z)를 향한다. */
export const stairRotation=(s:Stair)=>s.entry==='south'?Math.PI/2:-Math.PI/2;
function stairRect(s:Stair,r:Rect):Rect {
  const a=stairPoint(s,r.minX,r.minZ),b=stairPoint(s,r.maxX,r.maxZ);
  return {minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minZ:Math.min(a.z,b.z),maxZ:Math.max(a.z,b.z)};
}
/** 복도 쪽 층계참(계단으로 들어가기 전의 바닥). */
export const stairLanding=(s:Stair):Rect=>stairRect(s,{minX:0,maxX:1.2,minZ:0,maxZ:4});

export type StairSurface={stairId:string;floor:number;kind:'landing'|'flight';rect:Rect;localRect:Rect;axis:'z';leftHeight:number;rightHeight:number};
export const stairSurfaces:StairSurface[]=stairs.flatMap(stair=>{
  const result:StairSurface[]=[];
  function add(floor:number,kind:StairSurface['kind'],localRect:Rect,left:number,right:number) {
    // 남쪽 입구 계단은 안쪽 x가 커질수록 월드 z가 작아진다. 표면 높이는 월드 z 기준이라 좌우를 바꾼다.
    const reversed=stair.entry==='south';
    result.push({stairId:stair.id,floor,kind,rect:stairRect(stair,localRect),localRect,axis:'z',leftHeight:reversed?right:left,rightHeight:reversed?left:right});
  }
  for(let floor=stair.bottomFloor;floor<=stair.topFloor;floor++) {
    const h=(floor-1)*floorRise;
    add(floor,'landing',{minX:0,maxX:1.2,minZ:0,maxZ:4},h,h);
    if(floor===stair.topFloor)continue;
    add(floor,'flight',{minX:1.2,maxX:4.6,minZ:2.2,maxZ:4},h,h+floorRise/2);
    add(floor,'landing',{minX:4.6,maxX:5.8,minZ:0,maxZ:4},h+floorRise/2,h+floorRise/2);
    add(floor,'flight',{minX:1.2,maxX:4.6,minZ:0,maxZ:1.8},h+floorRise,h+floorRise/2);
  }
  return result;
});
/** 층계참을 뺀 계단 구멍. 모든 층 바닥에서 막힌 칸이고 계단 표면으로만 걷는다. */
export const stairGroundObstacles=stairs.map(s=>stairRect(s,{minX:1.2,maxX:5.8,minZ:0,maxZ:4}));
export function surfaceHeight(s:StairSurface,p:Point):number {
  const ratio=(p.z-s.rect.minZ)/(s.rect.maxZ-s.rect.minZ);
  return s.leftHeight+(s.rightHeight-s.leftHeight)*ratio;
}
export function stairSupport(p:Point,height:number):StairSurface|undefined {
  return stairSurfaces.filter(s=>contains(p,s.rect)&&Math.abs(surfaceHeight(s,p)-height)<.16).sort((a,b)=>Math.abs(surfaceHeight(a,p)-height)-Math.abs(surfaceHeight(b,p)-height))[0];
}
/** 복도에서 계단 층계참으로 들어서기 직전의 자리. */
export const stairEntry=(s:Stair):Point=>stairPoint(s,-.65,2);
