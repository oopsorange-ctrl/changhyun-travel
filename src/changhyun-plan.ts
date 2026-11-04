/**
 * 창현고 본관 1~6층 배치. 이 파일이 창현고 건물의 단일 기준이다.
 * 출처: references/배치도.jpg(교실 배치도 사진)를 층별로 옮겼고, 정확한 길이는 모른다.
 * 교실 한 칸을 약 6 m로 가정해 비율로 맞춘 값이며 실측이 아니다. 근거와 추정은 docs/우리학교/배치-대응.md.
 *
 * **이 건물의 가장 중요한 특징:** 한 층에 남쪽 교실과 북쪽 교실이 복도를 사이에 두고 마주 본다.
 * 남줄(아래쪽)은 정원·앞마당이 보이고, 북줄(위쪽)은 운동장이 보인다. 모든 층이 이 구조를 따른다.
 * 7층(탁구장, 6층 댄스실 맞은편)은 표현하지 않는다.
 *
 * 평면 좌표: x는 서쪽 끝에서 동쪽으로(m), y는 북쪽 벽(운동장 쪽)에서 남쪽 정면(앞마당 쪽)으로(m).
 * 층마다 북줄·복도·남줄 세 띠로 이루어진다. 월드 좌표(x 동쪽 +, z 남쪽 +)로는 toWorld/planRect를 쓴다.
 */
export type PlanRect={minX:number;maxX:number;minZ:number;maxZ:number};
/**
 * classroom 교실 · office 사무·상담·기타 방 · lab 특별실 · hall 큰 방 · toilet 화장실
 * stair 계단(방 아님) · elevator 엘리베이터(방 아님) · service 창고 등 닫힌 방(들어갈 수 없음)
 * lobby 중앙현관(복도와 같은 바닥) · terrace 6층 베란다·하늘무대(열린 바닥)
 */
export type PlanStyle='classroom'|'office'|'lab'|'hall'|'toilet'|'stair'|'elevator'|'service'|'lobby'|'terrace'|'dining'|'library';
export type Row='north'|'south';
export type Side='north'|'south'|'east'|'west';
/** style에 dining(급식실)·library(도서관)를 더했다. door는 복도로 열리는 벽, annex는 별관(A동·B동) 방, open은 벽과 문이 없는 열린 홀이다. */
export type PlanRoom={floor:number;name:string;style:PlanStyle;row:Row;x0:number;x1:number;rect:PlanRect;door?:Side;annex?:boolean;open?:boolean};

export const buildingLength=82;
export const rowNorthDepth=6,corridorDepth=2.7,rowSouthDepth=6.5;
export const buildingDepth=rowNorthDepth+corridorDepth+rowSouthDepth;
/** 월드 좌표에서 건물 남쪽 정면(앞마당과 닿는 벽)의 z. */
export const frontZ=20.25;
export const floorCount=6;
const rowY:Record<Row,[number,number]>={north:[0,rowNorthDepth],south:[rowNorthDepth+corridorDepth,buildingDepth]};
export const corridorY:[number,number]=[rowNorthDepth,rowNorthDepth+corridorDepth];

export const toWorld=(x:number,y:number)=>({x:x-buildingLength/2,z:frontZ-buildingDepth+y});
export const planRect=(x0:number,x1:number,y0:number,y1:number):PlanRect=>({
  minX:x0-buildingLength/2,maxX:x1-buildingLength/2,minZ:frontZ-buildingDepth+y0,maxZ:frontZ-buildingDepth+y1,
});

type Bay=[name:string,end:number,style:PlanStyle];
type Segment={row:Row;from:number;bays:Bay[]};
type FloorPlan={segments:Segment[];corridors:[number,number][]};

// 층 사이에서 계단·화장실 열이 같은 x에 오도록 공통 경계를 쓴다.
// 서편 계단 12.5~16.25(남줄) · 중앙 계단 36.25~39.25(북줄) · 동편 계단 58~62.25(남줄) · 동쪽 끝 계단 73~77.25(남줄)
const elevator:Segment={row:'north',from:77.25,bays:[['엘리베이터',80.25,'elevator']]};

const classroomsAbove=(g:number):FloorPlan=>{
  const n=(k:number)=>`${g}-${k}`;
  // 3~5층은 학년별 같은 구성. g=1학년(3층), 2학년(4층), 3학년(5층).
  const floorName=g===1?'3':g===2?'4':'5';
  const homebase=`${floorName}홈베이스`;
  const tailNorth:Bay[]=g===1
    ?[['진로활동실',71,'office'],['상담',74,'office'],['창고',77.25,'service']]
    :[[`${floorName}융합실`,71.5,'lab'],['창고',77.25,'service']];
  const tailSouth:Bay[]=g===1
    ?[[n(4),67.25,'classroom'],['진로탐색실',73,'office'],['계단',77.25,'stair']]
    :[[n(4),67.25,'classroom'],[`${floorName}창조실`,73,'office'],['계단',77.25,'stair']];
  const north:Bay[]=[
    [n(11),6,'classroom'],[n(12),12.5,'classroom'],['화장실',16.25,'toilet'],[n(13),22.25,'classroom'],[n(14),28.75,'classroom'],
    [homebase,36.25,'office'],['계단',39.25,'stair'],['화장실',42.25,'toilet'],
    [n(1),47.5,'classroom'],[n(2),52.75,'classroom'],[n(3),58,'classroom'],['화장실',62.25,'toilet'],...tailNorth,
  ];
  const south:Bay[]=[
    [n(10),6,'classroom'],[n(9),12.5,'classroom'],['계단',16.25,'stair'],[n(8),22.25,'classroom'],
    [`${g}학년 교무실`,35.75,'office'],['컴퓨터실',42.25,'lab'],
    [n(7),47.5,'classroom'],[n(6),52.75,'classroom'],[n(5),58,'classroom'],['계단',62.25,'stair'],...tailSouth,
  ];
  return {segments:[{row:'north',from:0,bays:north},{row:'south',from:0,bays:south},elevator],corridors:[[0,77.25]]};
};

export const floorPlans:Record<number,FloorPlan>={
  1:{
    segments:[
      {row:'north',from:0,bays:[
        ['가정실습실',6,'lab'],['매점',12.5,'service'],['화장실',16.25,'toilet'],['화학실험실',28,'lab'],['발간실',30,'office'],['온라인실',33,'office'],['지원실',36.25,'office'],
        ['계단',39.25,'stair'],['후면 로비',42.25,'lobby'],['오프라인실',47.5,'office'],['시청각실',58,'hall'],['화장실',62.25,'toilet'],
      ]},
      {row:'south',from:0,bays:[
        ['통합홈베이스1',6,'office'],['통합홈베이스2',12.5,'office'],['계단',16.25,'stair'],['사랑실',22.25,'office'],['1층 교무실',36.25,'office'],
        ['중앙현관',42.25,'lobby'],['당직실',45.75,'office'],['행정실',52.25,'office'],['교장실',59,'office'],['서고',62.25,'service'],
      ]},
      {row:'north',from:69,bays:[['체육부실',73.5,'office'],['샤워실',77.25,'toilet']]},
      {row:'south',from:69,bays:[['정보실',73,'lab'],['계단',77.25,'stair']]},
      elevator,
      {row:'north',from:80.25,bays:[['체육',84,'service']]},
    ],
    corridors:[[0,62.25],[69,77.25]],
  },
  2:{
    segments:[
      {row:'north',from:0,bays:[
        ['융합실험실1(생명과학)',9.75,'lab'],['세미나',12.5,'office'],['화장실',16.25,'toilet'],['수리융합교실',25.75,'classroom'],['민원실',29,'office'],['2홈베이스',36.25,'office'],
        ['계단',39.25,'stair'],['화장실',42.25,'toilet'],['방송실',47.5,'office'],['디지털검색토론실',58,'hall'],['화장실',62.25,'toilet'],
      ]},
      {row:'south',from:0,bays:[
        ['융합실험실2(지구과학)',12.5,'lab'],['계단',16.25,'stair'],['교사휴게실',22.25,'office'],['보건실',29,'office'],['학생부실',36.25,'office'],['잉글리시존',42.25,'classroom'],
        ['교목실',47.5,'office'],['wee힐링',52.75,'office'],['학생실',58,'office'],['계단',62.25,'stair'],
      ]},
      {row:'north',from:69,bays:[['음악실 연주2',74.5,'lab'],['서고',77.25,'service']]},
      {row:'south',from:69,bays:[['음악실 연주1',73,'lab'],['계단',77.25,'stair']]},
      elevator,
    ],
    corridors:[[0,62.25],[69,77.25]],
  },
  3:classroomsAbove(1),
  4:classroomsAbove(2),
  5:classroomsAbove(3),
  6:{
    segments:[
      {row:'north',from:16.25,bays:[
        ['자기주도학습실',36.25,'hall'],['계단',39.25,'stair'],['미디어실',42.25,'office'],['공감1',44.75,'office'],['공감2',47.25,'office'],['공감3',49.75,'office'],['공감세미나실',58,'classroom'],
      ]},
      {row:'south',from:12.5,bays:[
        ['계단',16.25,'stair'],['베란다',36.25,'terrace'],['지구별카페',42.25,'office'],['하늘무대',58,'terrace'],['계단',62.25,'stair'],
      ]},
    ],
    corridors:[[12.5,62.25]],
  },
};

const rooms:PlanRoom[]=[];
for(const [key,plan] of Object.entries(floorPlans)) {
  const floor=Number(key);
  for(const seg of plan.segments) {
    let x=seg.from;
    for(const [name,end,style] of seg.bays) {
      const [y0,y1]=rowY[seg.row];
      rooms.push({floor,name,style,row:seg.row,x0:x,x1:end,rect:planRect(x,end,y0,y1)});
      x=end;
    }
  }
}

// ── 별관: 본관 서쪽 아래 비탈에 있는 A동(음악·미술)과 B동(도서관·급식실) ──────────────────────
// 층 번호: 본관 1층=0 m, A동=0층(-3.6 m), B동 도서관 층=-1층(-7.2 m), 급식실=-2층(-10.8 m).
// 좌표는 월드 좌표(m)다. 배치도의 칸 크기를 6 m 교실 기준으로 환산했고 위치 관계는 사용자 설명을 따른 추정이다.
const room=(floor:number,name:string,style:PlanStyle,x0:number,x1:number,z0:number,z1:number,door:Side,open=false):PlanRoom=>({
  floor,name,style,row:door==='south'?'north':'south',x0,x1,rect:{minX:x0,maxX:x1,minZ:z0,maxZ:z1},door,annex:true,...(open?{open:true}:{}),
});
// A동: 서쪽 끝 출입구에서 비탈길을 내려간 앞마당(-3.6 m)에 동쪽으로 열린 복도가 있고 방이 서쪽에 쌓여 있다.
const aTop=-2,aBottom=23.1,aCorridorX0=-64,aCorridorX1=-61.8;
// B동: 도서관 층(-7.2 m)의 방은 북쪽, 복도는 남쪽. 한 층 아래(-10.8 m)가 급식실.
const bX0=-70,bX1=-44.25,bRoomZ0=-24,bRoomZ1=-16.25,bCorridorZ1=-14.05;
rooms.push(
  room(0,'베이스실','lab',-68,-64,aTop,1.3,'east'),
  room(0,'알토실','lab',-68,-64,1.3,4.6,'east'),
  room(0,'음악실(합창)','hall',-72,-64,4.6,9.2,'east'),
  room(0,'미술1실(회화)','lab',-72,-64,9.2,12.9,'east'),
  room(0,'준비실','service',-72,-64,12.9,13.9,'east'),
  room(0,'미술2실(조소)','lab',-72,-64,13.9,aBottom,'east'),
  room(-1,'아름실','hall',bX0,-65,bRoomZ0,bRoomZ1,'south'),
  room(-1,'여자화장실','toilet',-65,-63.5,-19.45,bRoomZ1,'south'),
  room(-1,'남자화장실','toilet',-63.5,-62,-19.45,bRoomZ1,'south'),
  room(-1,'멀티실','lab',-62,-57,bRoomZ0,bRoomZ1,'south'),
  room(-1,'계단','stair',-57,-54,bRoomZ0,bRoomZ1,'south'),
  room(-1,'도서관','library',-54,bX1,bRoomZ0,bRoomZ1,'south'),
  // 급식실(복지관): 도서관 층과 같은 입구에서 안쪽 계단으로 내려오는 벽 없는 큰 홀. 조리실은 홀 동쪽 끝에 붙어 있고 홀 쪽으로 문이 난다.
  room(-2,'급식실','dining',bX0,-49,bRoomZ0,bCorridorZ1,'south',true),
  room(-2,'조리실','lab',-49,bX1,bRoomZ0,bCorridorZ1,'west'),
);
export const planRooms:readonly PlanRoom[]=rooms;
export const roomsOnFloor=(floor:number)=>planRooms.filter(r=>r.floor===floor);

/** 복도 띠. 6층은 베란다·하늘무대를 걸을 수 있는 열린 바닥으로 이어 붙인다. 별관 복도는 월드 좌표로 직접 적었다. */
const mainCorridors:Record<number,PlanRect[]>=Object.fromEntries(Object.entries(floorPlans).map(([floor,plan])=>[
  Number(floor),
  [...plan.corridors.map(([a,b])=>planRect(a,b,corridorY[0],corridorY[1])),
    ...rooms.filter(r=>r.floor===Number(floor)&&(r.style==='lobby'||r.style==='terrace')).map(r=>r.rect)],
]));
const bCorridor:PlanRect={minX:bX0,maxX:bX1,minZ:bRoomZ1,maxZ:bCorridorZ1};
export const planCorridors:Record<number,PlanRect[]>={
  ...mainCorridors,
  0:[{minX:aCorridorX0,maxX:aCorridorX1,minZ:aTop,maxZ:aBottom}],
  [-1]:[{...bCorridor}],
  [-2]:[],
};

/** 위에서 아래로 본 모든 층. 0·-1·-2층은 별관이다. */
export const floorList=[6,5,4,3,2,1,0,-1,-2];
export const lowestFloor=-2;
export const isAnnexFloor=(floor:number)=>floor<1;
export const floorLabel=(floor:number)=>floor===0?'A동':floor===-1?'B동 도서관':floor===-2?'B동 급식실':`${floor}층`;
/** 안내도에서 한 층을 42×9 격자에 맞출 때 쓰는 기준 사각형. */
export const floorFrames:Record<number,{minX:number;minZ:number;width:number;depth:number}>=Object.fromEntries(floorList.map(floor=>{
  if(floor>=1)return [floor,{minX:-buildingLength/2,minZ:frontZ-buildingDepth,width:buildingLength,depth:buildingDepth}];
  const items=[...rooms.filter(r=>r.floor===floor).map(r=>r.rect),...planCorridors[floor]!];
  const minX=Math.min(...items.map(r=>r.minX)),maxX=Math.max(...items.map(r=>r.maxX)),minZ=Math.min(...items.map(r=>r.minZ)),maxZ=Math.max(...items.map(r=>r.maxZ));
  return [floor,{minX,minZ,width:maxX-minX,depth:maxZ-minZ}];
}));

/**
 * 계단 네 곳. 오르내리는 모든 층에서 같은 자리에 겹친다(동편 계단은 1층 배치도에 없어 2층부터). entry는 복도와 닿는 쪽(층계참이 있는 쪽)이다.
 * 남줄 계단은 북쪽이 복도, 북줄 계단(중앙)은 남쪽이 복도다.
 */
export type PlanStair={id:string;name:string;x0:number;x1:number;row:Row;entry:'north'|'south';bottomFloor:number;topFloor:number;rect:PlanRect};
const stairDef=(id:string,name:string,x0:number,x1:number,row:Row,bottomFloor:number,topFloor:number):PlanStair=>{
  const [y0,y1]=rowY[row];
  return {id,name,x0,x1,row,entry:row==='south'?'north':'south',bottomFloor,topFloor,rect:planRect(x0,x1,y0,y1)};
};
export const planStairs:readonly PlanStair[]=[
  stairDef('stairs-west','서편 계단',12.5,16.25,'south',1,6),
  stairDef('stairs-central','중앙계단',36.25,39.25,'north',1,6),
  stairDef('stairs-east','동편 계단',58,62.25,'south',2,6),
  stairDef('stairs-far','동쪽 끝 계단',73,77.25,'south',1,5),
  // B동 안쪽 계단: 도서관 층(-1)에서 급식실(-2)로 내려간다. 북줄 방 옆이라 복도(남쪽)에서 들어간다.
  {id:'stairs-b',name:'B동 계단',x0:-57,x1:-54,row:'north',entry:'south',bottomFloor:-2,topFloor:-1,rect:{minX:-57,maxX:-54,minZ:bRoomZ0,maxZ:bRoomZ1}},
];

/** 정면 중앙현관 문의 월드 좌표. */
export const frontDoor=(()=>{
  const lobby=rooms.find(r=>r.floor===1&&r.style==='lobby'&&r.row==='south')!;
  return {x:(lobby.rect.minX+lobby.rect.maxX)/2,z:lobby.rect.maxZ};
})();

/** 방이 바라보는 쪽. 남줄은 정원(앞마당), 북줄은 운동장. */
export const roomView=(room:Pick<PlanRoom,'row'>)=>room.row==='south'?'정원':'운동장';
export const roomViewLabel=(room:Pick<PlanRoom,'row'>)=>room.row==='south'?'정원이 보이는 남향':'운동장이 보이는 북향';

/** 1층 후면 로비(중앙현관 건너편)의 북쪽 문. 이 문으로 나가면 운동장이다. */
export const backDoor=(()=>{
  const lobby=rooms.find(r=>r.floor===1&&r.style==='lobby'&&r.row==='north')!;
  return {x:(lobby.rect.minX+lobby.rect.maxX)/2,z:lobby.rect.minZ};
})();

/** 본관 서쪽 끝 출입구와 별관 두 곳의 문. 바깥에서 들어가는 자리(outside)와 안쪽 자리(inside)를 같이 적는다. */
const westDoorZ=frontZ-buildingDepth+corridorY[0]+corridorDepth/2;
export type Link={id:string;name:string;floor:number;inside:{x:number;z:number};outside:{x:number;z:number};wall:{x:number;z:number;axis:'x'|'z';width:number}};
export const links:Link[]=[
  {id:'west-entrance',name:'서쪽 출입구 (별관 쪽)',floor:1,inside:{x:-buildingLength/2+1.1,z:westDoorZ},outside:{x:-buildingLength/2-1.6,z:westDoorZ},wall:{x:-buildingLength/2,z:westDoorZ,axis:'x',width:2.4}},
  {id:'a-entrance',name:'별관 A동 입구',floor:0,inside:{x:aCorridorX0+1.1,z:12.4},outside:{x:aCorridorX1+1.8,z:12.4},wall:{x:aCorridorX1,z:12.4,axis:'x',width:3}},
  {id:'b-entrance',name:'별관 B동 입구 (도서관)',floor:-1,inside:{x:-59.5,z:bRoomZ1+1.1},outside:{x:-59.5,z:bCorridorZ1+1.8},wall:{x:-59.5,z:bCorridorZ1,axis:'z',width:3}},
];
/** 복도 끝 벽에 뚫린 문틈(월드 좌표). 장면이 벽을 그릴 때 이 자리는 비운다. */
export const openings=links.map(l=>({floor:l.floor,...l.wall}));
