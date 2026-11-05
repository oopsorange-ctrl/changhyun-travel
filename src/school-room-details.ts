import {classroomModels,type ClassroomModel} from './school-classrooms.ts';

/**
 * 방 용도에 맞는 가구 모형(교탁·사물함·피아노·이젤·소파 등)을 놓는 배치 규칙.
 * 좌표는 문이 있는 벽을 기준으로 한다: u = 문 벽에서 안쪽으로, v = 문 벽을 따라(0~L). L = 문 벽 길이, D = 안쪽 깊이.
 * 모형은 앞면이 +Z를 보는 상태로 만들어져 있고, face는 그 앞면이 바라보는 쪽이다
 * (in: 방 안쪽, out: 문 쪽, up: v가 커지는 쪽, down: v가 작아지는 쪽).
 * 실제 놓기(방 안쪽 안에 들어가는지, 문 앞 통로·계단 구멍·다른 가구와 겹치는지 검사)는 place가 한다.
 */
export type Face='in'|'out'|'up'|'down';
export type Where='far'|'near'|'left'|'right';
export type RoomKind='classroom'|'office'|'lab'|'hall'|'toilet'|'dining'|'library'|'gym'|'gallery';
export type DetailApi={L:number;D:number;place:(model:ClassroomModel,u:number,v:number,face:Face)=>boolean};

const gap=.05;
/** 모형이 바라보는 쪽에 따른 (v 방향 길이, u 방향 길이). */
export const modelSize=(model:ClassroomModel,face:Face)=>{
  const [w,d]=classroomModels[model];
  return face==='in'||face==='out'?{dv:w,du:d}:{dv:d,du:w};
};

/** 벽에 붙여 놓는다. t는 그 벽을 따라 모형 가운데가 오는 자리. */
export function wall(api:DetailApi,where:Where,model:ClassroomModel,t:number):boolean {
  const {L,D}=api;
  if(where==='far'){const s=modelSize(model,'out');return api.place(model,D-s.du/2-gap,t,'out');}
  if(where==='near'){const s=modelSize(model,'in');return api.place(model,s.du/2+gap,t,'in');}
  if(where==='left'){const s=modelSize(model,'up');return api.place(model,t,s.dv/2+gap,'up');}
  const s=modelSize(model,'down');
  return api.place(model,t,L-s.dv/2-gap,'down');
}

/**
 * 정해 둔 자리에 안 들어가는 좁은 방을 위해, 격자를 훑어 놓을 수 있는 첫 자리부터 모형을 놓는다(맨 안쪽 벽에서 문 쪽으로, 왼쪽에서 오른쪽으로).
 * 방 안에 놓을 수 있는지(문 앞 통로·좁은 틈·겹침)는 place가 검사하고, 이미 놓은 것과는 aisle(m) 이상 띄운다. 놓은 개수를 돌려준다.
 */
export function scan(api:DetailApi,model:ClassroomModel,face:Face,count:number,limits:{uFrom?:number;uTo?:number;vFrom?:number;vTo?:number;aisle?:number}={}):number {
  const size=modelSize(model,face),aisle=limits.aisle??.9;
  const uFrom=limits.uFrom??size.du/2,uTo=limits.uTo??api.D-size.du/2,vFrom=limits.vFrom??size.dv/2,vTo=limits.vTo??api.L-size.dv/2;
  const placed:[number,number][]=[];
  for(let u=uTo;u>=uFrom-1e-6&&placed.length<count;u-=.1)for(let v=vFrom;v<=vTo+1e-6&&placed.length<count;v+=.1) {
    if(placed.some(([pu,pv])=>Math.abs(u-pu)<size.du+aisle&&Math.abs(v-pv)<size.dv+aisle))continue;
    if(api.place(model,u,v,face))placed.push([u,v]);
  }
  return placed.length;
}

/** n개를 [from,to] 구간에 고르게 늘어놓은 가운데 자리들. */
const spread=(from:number,to:number,n:number)=>Array.from({length:n},(_,i)=>from+(to-from)*(i+.5)/n);
const sets:ClassroomModel[]=['lab-set-orange','lab-set-grey','lab-set-maroon'];

/**
 * 방 이름과 종류로 가구를 놓고, 기본 책상·벤치를 대신하면 'replace', 기본 배치 위에 더하면 'extra',
 * 따로 놓을 것이 없으면 'none'을 돌려준다.
 */
function primaryDetails(name:string,style:RoomKind,api:DetailApi):'replace'|'extra'|'none' {
  const {L,D,place}=api;
  const wide=L>=5.5;
  if(style==='classroom') {
    // 칠판은 서쪽 벽. 교탁은 칠판 앞, 사물함은 동쪽 벽, 낮은 수납장은 창가.
    place('teacher-desk',D/2,1.62,'up');
    wall(api,'right','locker-wall',D*.6);
    wall(api,'far','cubby-shelf',L-1.2);
    return 'extra';
  }
  if(style==='office') {
    if(/교장실/.test(name)) {
      wall(api,'far','staff-desk',L/2);
      wall(api,'left','sofa-set',D*.5);
      wall(api,'far','bookcase',.9);wall(api,'far','bookcase',L-.9);
      wall(api,'right','seminar-set',D*.62);
      return 'replace';
    }
    if(/교무실/.test(name)) {
      // 교사 책상 두 줄(뒤 줄은 벽에 붙이고, 앞 줄은 통로 0.9 m를 띄운다) + 양옆 벽 캐비닛.
      const columns=Math.max(2,Math.floor((L-3)/2.2));
      for(const v of spread(1.6,L-1.6,columns)){wall(api,'far','staff-desk',v);place('staff-desk',D-1.31-.95-.635,v,'out');}
      for(const u of [1.8,2.72,3.64])wall(api,'left','office-cabinet',u);
      for(const u of [1.8,2.72,3.64])wall(api,'right','office-cabinet',u);
      return 'replace';
    }
    if(/행정실/.test(name)) {
      for(const v of [.75,L/2,L-.75])wall(api,'far','staff-desk',v);
      for(const v of [L*.3,L*.7])place('staff-desk',D-1.31-.95-.635,v,'out');
      return 'replace';
    }
    if(/보건/.test(name)) {
      for(const v of spread(0,L,2))place('infirmary-bed',D-1.1,v,'out');
      wall(api,'right','office-cabinet',2.6);
      return 'extra';
    }
    if(/방송|미디어/.test(name)) {
      wall(api,'far','broadcast-console',L/2);wall(api,'left','server-rack',D*.5);
      return 'extra';
    }
    if(/카페|휴게/.test(name)) {
      wall(api,'left','sofa-set',D*.5);wall(api,'far','drink-fridge',L-.6);
      place('round-table-stools',D*.55,L*.6,'in');
      return 'replace';
    }
    if(/홈베이스|창조실|사랑실|공감|진로|wee|학생실|교목|상담/i.test(name)) {
      place(wide?'hex-table-set':'seminar-set',D*.55,L/2,L<4?'up':'in');
      if(L>=3.5)wall(api,'far','open-shelf',L/2);
      return 'replace';
    }
    if(/세미나/.test(name)) {place('seminar-set',D*.55,L/2,L<4?'up':'in');return 'replace';}
    if(/당직/.test(name))return 'none';
    // 그 밖의 사무 공간: 책상 뒤 벽에 서류 캐비닛.
    if(L<=4)wall(api,'far','office-cabinet',L/2);else{wall(api,'far','office-cabinet',.7);wall(api,'far','office-cabinet',L-.7);}
    return 'extra';
  }
  if(style==='lab') {
    if(/화학|융합실|융합실험/.test(name)) {
      const columns=Math.max(1,Math.floor((L-1.2)/2.75));
      spread(.6,L-.6,columns).forEach((v,i)=>place(sets[i%3]!,D/2+.2,v,'in'));
      place('teacher-desk',D/2,1.62,'up');
      wall(api,'far','sink-counter',2.2);wall(api,'far','fume-hood',L-1.1);
      wall(api,'right','glass-cabinet',D*.5);
      return 'replace';
    }
    if(/가정실습/.test(name)) {
      place('hex-table-set',D/2,L/2,'in');
      wall(api,'far','sink-counter',L/2);wall(api,'left','side-counter',D*.5);
      return 'replace';
    }
    if(/컴퓨터|정보/.test(name)) {
      const columns=wide?2:1,rows=Math.max(1,Math.floor((D-1.9)/1.75));
      spread(1.5,L-.8,columns).forEach(v=>{for(let r=0;r<rows;r++)place('computer-set',2.4+r*1.75,v,'down');});
      place('teacher-desk',D/2,.9,'up');
      return 'replace';
    }
    if(/음악실|베이스|알토/.test(name)) {
      wall(api,'far','upright-piano',L/2);wall(api,'left','storage-rack',D*.5);
      return 'extra';
    }
    if(/미술/.test(name)) {
      for(let i=0;i<Math.min(5,Math.floor((L-1)/.7));i++)place('easel',D-.6,L/2+(i-(Math.min(5,Math.floor((L-1)/.7))-1)/2)*.7,'out');
      for(const v of spread(.8,L-.8,Math.max(1,Math.floor(L/2.7))))place('art-set',D/2,v,'in');
      wall(api,'left','open-shelf',D*.5);
      return 'replace';
    }
    if(/멀티/.test(name)) {
      place('conference-set',D/2,L/2,'in');wall(api,'left','wall-bench-blue',D*.5);
      return 'replace';
    }
    if(/조리/.test(name)) {
      wall(api,'far','sink-counter',L/2);wall(api,'left','side-counter',D*.5);
      place('workbench',D/2,L/2,'in');wall(api,'right','storage-rack',D*.5);
      return 'replace';
    }
    return 'none';
  }
  if(style==='hall') {
    if(/시청각|검색토론/.test(name)) {wall(api,'left','board-electronic',D/2);return 'extra';}
    if(/자기주도/.test(name)) {
      for(const v of spread(.6,L-.6,Math.max(2,Math.floor((L-1)/2.7)))){place('carrel-row',D-.7,v,'out');place('carrel-row',D-2.1,v,'out');}
      return 'replace';
    }
    if(/합창/.test(name)) {
      if(!wall(api,'far','bleacher',L/2))scan(api,'bleacher','out',1,{uFrom:D-1.0});
      wall(api,'left','upright-piano',D*.4);
      return 'replace';
    }
    if(/아름/.test(name)) {
      place('oval-table-set',D*.5,L/2,'in');
      for(const v of spread(.4,L-.4,2))wall(api,'far','lounge-set',v);
      return 'replace';
    }
    return 'none';
  }
  if(style==='library') {
    wall(api,'near','book-cart',L-1.2);
    scan(api,'circulation-desk','in',1,{uTo:1.6,aisle:.9});
    place('lounge-chair-green',.9,L-3,'in');place('lounge-chair-green',.9,L-3.9,'in');
    return 'extra';
  }
  return 'none';
}

/** 정한 자리가 모두 막혀 아무것도 못 놓은 방(좁은 방 등)을 위해, 놓을 수 있는 자리를 찾아 용도에 맞는 가구를 몇 개라도 놓는다. */
function fallbackDetails(name:string,style:RoomKind,api:DetailApi):'replace'|'extra'|'none'|undefined {
  const {D}=api;
  if(/당직|화장실|샤워/.test(name))return undefined;
  if(style==='office') {
    // 폭 2.8 m 미만의 아주 좁은 방은 세미나 탁자를 놓으면 양옆 통로가 막히므로 낮은 수납장만 둔다.
    if(api.L>=2.8&&!scan(api,'seminar-set','in',1,{uFrom:2.0,uTo:D-1.2})&&!scan(api,'seminar-set','up',1,{uFrom:1.5,uTo:D-.8,aisle:.6}))scan(api,'window-desk','in',1,{uFrom:1.5,uTo:D-.8,aisle:.6});
    scan(api,'office-cabinet','out',2,{uFrom:D-.26});
    return 'extra';
  }
  if(style==='lab') {
    if(/컴퓨터|정보/.test(name)) {
      scan(api,'computer-set','down',6);
      scan(api,'teacher-desk','up',1,{aisle:.6});
      return 'replace';
    }
    if(/음악실|베이스|알토/.test(name)) {
      scan(api,'upright-piano','out',1,{uFrom:D-.6});
      scan(api,'storage-rack','up',1,{vTo:.31});
      return 'extra';
    }
  }
  return undefined;
}

/** 방 용도에 맞는 가구를 놓고, 기본 책상·벤치를 대신하면 'replace', 기본 배치 위에 더하면 'extra', 따로 놓을 것이 없으면 'none'을 돌려준다. */
export function roomDetails(name:string,style:RoomKind,api:DetailApi):'replace'|'extra'|'none' {
  let placed=0;
  const counting:DetailApi={...api,place:(model,u,v,face)=>{const ok=api.place(model,u,v,face);if(ok)placed++;return ok;}};
  const result=primaryDetails(name,style,counting);
  if(placed>0)return result;
  const fallback=fallbackDetails(name,style,counting);
  if(fallback===undefined)return result==='replace'?'extra':result;
  return placed>0?fallback:result==='replace'?'extra':result;
}
