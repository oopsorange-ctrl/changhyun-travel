import type {FloorCell} from './school-floor-data.ts';
import {buildingLength,buildingDepth,floorList,floorFrames,roomsOnFloor,planCorridors,planStairs,type PlanRect} from './changhyun-plan.ts';

/** 본관의 가로·세로(m). 층 배치는 changhyun-plan.ts가 정본이고, 여기서는 안내도용 칸으로만 바꾼다. */
export const firstFloorDimensions={width:buildingLength,depth:buildingDepth};
export const schoolPlayerHeight=1.70;
/** 층마다 안내도 틀의 세로÷가로 비율. 본관은 모두 같고 별관(0·-1·-2층)은 각자 다르다. */
export const planAspectRatios:Record<number,number>=Object.fromEntries(floorList.map(floor=>[floor,floorFrames[floor]!.depth/floorFrames[floor]!.width]));

// 안내도 격자: col = 1 + x/가로×42, row = 1 + y/세로×9. 본관 6 m 교실 한 칸이 약 3.3칸이다.
function cell(name:string,r:PlanRect,floor:number):FloorCell {
  const f=floorFrames[floor]!;
  const x0=r.minX-f.minX,x1=r.maxX-f.minX,y0=r.minZ-f.minZ,y1=r.maxZ-f.minZ;
  return {name,col:+(1+x0/f.width*42).toFixed(4),colSpan:+((x1-x0)/f.width*42).toFixed(4),row:+(1+y0/f.depth*9).toFixed(4),rowSpan:+((y1-y0)/f.depth*9).toFixed(4),border:true};
}

export const planFloorData:Record<number,FloorCell[]>=Object.fromEntries(floorList.map(floor=>{
  const rooms=roomsOnFloor(floor);
  const corridors=planCorridors[floor]!.filter(c=>!rooms.some(r=>(r.style==='lobby'||r.style==='terrace')&&r.rect===c));
  const stairsHere=planStairs.filter(s=>s.bottomFloor<=floor&&s.topFloor>=floor&&!rooms.some(r=>r.style==='stair'&&r.rect===s.rect));
  return [floor,[
    ...corridors.map(c=>cell('복도',c,floor)),
    ...rooms.map(r=>cell(r.style==='stair'?'계단':r.name,r.rect,floor)),
    ...stairsHere.map(s=>cell('계단',s.rect,floor)),
  ]];
}));
