import test from 'node:test';
import assert from 'node:assert/strict';
import {planRooms,roomsOnFloor,planCorridors,planStairs,floorPlans,floorCount,floorList,buildingLength,buildingDepth,corridorY,planRect,toWorld,frontDoor,backDoor,roomView,links,openings} from '../src/changhyun-plan.ts';

const overlap=(a:{minX:number;maxX:number;minZ:number;maxZ:number},b:typeof a)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>1e-6&&Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>1e-6;

test('같은 층의 방은 서로 겹치지 않고 건물 안에 있다', () => {
  for(let floor=1;floor<=floorCount;floor++) {
    const rooms=roomsOnFloor(floor);
    assert.ok(rooms.length>0,`${floor}층에 방이 있어야 한다`);
    const bounds=planRect(0,buildingLength+3,0,buildingDepth);
    for(const r of rooms) {
      assert.ok(r.x1>r.x0,`${floor}층 ${r.name}의 폭은 양수`);
      assert.ok(r.rect.minX>=bounds.minX-1e-6&&r.rect.maxX<=bounds.maxX+1e-6,`${floor}층 ${r.name}은 건물 안`);
    }
    rooms.forEach((a,i)=>rooms.slice(i+1).forEach(b=>assert.ok(!overlap(a.rect,b.rect),`${floor}층 ${a.name}과 ${b.name}이 겹침`)));
  }
});

test('방은 복도나 계단과 맞닿는다(들어갈 수 있는 방은 반드시 복도에 닿음)', () => {
  const touches=(a:{minX:number;maxX:number;minZ:number;maxZ:number},b:typeof a)=>
    Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>.5&&(Math.abs(a.minZ-b.maxZ)<1e-6||Math.abs(a.maxZ-b.minZ)<1e-6)
    ||Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>.5&&(Math.abs(a.minX-b.maxX)<1e-6||Math.abs(a.maxX-b.minX)<1e-6);
  for(const r of planRooms.filter(r=>['classroom','office','lab','hall','toilet'].includes(r.style))) {
    // 급식실처럼 벽 없는 열린 홀도 복도처럼 걸을 수 있는 바닥이다.
    const surfaces=[...planCorridors[r.floor]!,...roomsOnFloor(r.floor).filter(o=>o.open).map(o=>o.rect)];
    const reachable=surfaces.some(c=>touches(r.rect,c));
    assert.ok(reachable,`${r.floor}층 ${r.name}은 복도에 닿아야 한다`);
  }
});

test('계단은 모든 층의 같은 자리에 있다', () => {
  for(const s of planStairs) {
    for(let floor=s.bottomFloor;floor<=s.topFloor;floor++) {
      // B동 계단은 급식실(-2층)에서는 홀 안으로 내려와 따로 칸이 없다.
      if(s.id==='stairs-b'&&floor===-2)continue;
      const bay=roomsOnFloor(floor).find(r=>r.style==='stair'&&Math.abs(r.x0-s.x0)<.3&&Math.abs(r.x1-s.x1)<.3&&r.row===s.row);
      assert.ok(bay,`${s.name}이 ${floor}층에 있어야 한다`);
    }
    assert.ok(s.rect.maxX>s.rect.minX&&s.rect.maxZ>s.rect.minZ);
  }
  assert.equal(planStairs.length,5);
});

test('계단 한쪽은 복도와 맞닿아 층계참으로 들어갈 수 있다', () => {
  const [y0,y1]=corridorY;
  for(const s of planStairs) {
    // 입구면이 그 층의 복도 한 띠의 가장자리와 같은 선에 있어야 한다.
    const edgeZ=s.entry==='north'?s.rect.minZ:s.rect.maxZ;
    const corridor=planCorridors[s.topFloor]!.find(c=>c.minX<=s.rect.maxX&&c.maxX>=s.rect.minX&&Math.abs((s.entry==='north'?c.maxZ:c.minZ)-edgeZ)<1e-6);
    assert.ok(corridor,`${s.name} 입구면이 복도와 같은 선`);
  }
  void y0;void y1;void planRect;
});

test('각 층의 복도는 계단과 이어진다', () => {
  for(const floor of floorList) {
    for(const s of planStairs.filter(s=>s.bottomFloor<=floor&&s.topFloor>=floor)) {
      const joined=planCorridors[floor]!.some(c=>c.minX<=s.rect.maxX&&c.maxX>=s.rect.minX&&c.minZ<=s.rect.maxZ&&c.maxZ>=s.rect.minZ);
      // 급식실(-2층)에서는 계단 층계참이 홀 안에 있어 복도와 이어지지 않는다.
      if(s.id==='stairs-b'&&floor===-2)continue;
      assert.ok(joined,`${floor}층 복도가 ${s.name} 쪽으로 이어져야 한다`);
    }
  }
});

test('중앙현관이 1층 정면에 있고 정면 문 좌표가 건물 앞면이다', () => {
  const lobby=roomsOnFloor(1).find(r=>r.name==='중앙현관')!;
  assert.equal(lobby.style,'lobby');
  assert.equal(lobby.row,'south');
  assert.ok(Math.abs(frontDoor.z-toWorld(0,buildingDepth).z)<1e-6);
});

test('본관은 요청대로 1~6층만 있고 7층은 없다', () => {
  assert.equal(Math.max(...planRooms.map(r=>r.floor)),6);
  assert.equal(Object.keys(floorPlans).length,6);
});

test('급식실은 본관이 아니라 별관 B동 한 층 아래(-2층)에만 있고 조리실이 옆에 붙어 있다', () => {
  const dining=planRooms.filter(r=>r.name.includes('급식'));
  assert.equal(dining.length,1);
  assert.equal(dining[0]!.floor,-2);
  assert.equal(dining[0]!.style,'dining');
  assert.equal(dining[0]!.open,true,'별도 문 없이 도서관 층 입구에서 계단으로 내려오는 열린 홀');
  assert.equal(planCorridors[-2]!.length,0,'급식실 층에는 따로 복도가 없다');
  assert.ok(roomsOnFloor(-2).some(r=>r.name==='조리실'));
  assert.ok(roomsOnFloor(-1).some(r=>r.name==='도서관'),'도서관은 한 층 위(-1층)');
});

test('별관은 본관 1층 서쪽 끝 문에서 이어지는 두 층·세 단계로 내려간다', () => {
  assert.deepEqual(links.map(l=>l.id),['west-entrance','a-entrance','b-entrance']);
  assert.deepEqual(links.map(l=>l.floor),[1,0,-1]);
  assert.ok(planRooms.some(r=>r.floor===0&&r.name==='음악실(합창)'));
  assert.ok(planRooms.some(r=>r.floor===0&&r.name==='미술2실(조소)'));
  assert.ok(!planRooms.some(r=>r.name.includes('목공')),'목공실은 제외');
  assert.equal(openings.length,3);
});

test('B동의 중앙 화장실은 서→동으로 여자, 남자 순서다', () => {
  const toilets=roomsOnFloor(-1).filter(r=>r.style==='toilet').sort((a,b)=>a.rect.minX-b.rect.minX);
  assert.deepEqual(toilets.map(t=>t.name),['여자화장실','남자화장실']);
});

test('중앙현관(앞)과 후면 로비(뒤)가 같은 축으로 이어져 운동장으로 나간다', () => {
  assert.ok(Math.abs(frontDoor.x-backDoor.x)<1.6,'앞문과 뒷문이 거의 같은 축');
  assert.ok(backDoor.z<frontDoor.z-10,'뒷문은 건물 북쪽(운동장 쪽)');
  const back=roomsOnFloor(1).find(r=>r.style==='lobby'&&r.row==='north')!;
  assert.ok(planCorridors[1]!.some(c=>Math.abs(c.minX-back.rect.minX)<1e-6&&Math.abs(c.maxX-back.rect.maxX)<1e-6),'로비는 걸을 수 있는 바닥');
});

test('남쪽 교실은 정원을, 북쪽 교실은 운동장을 본다 — 모든 층이 마주 보는 두 줄', () => {
  for(let floor=1;floor<=floorCount;floor++) {
    const rooms=roomsOnFloor(floor);
    assert.ok(rooms.some(r=>r.row==='north')&&rooms.some(r=>r.row==='south'),`${floor}층에 북줄과 남줄이 모두 있어야 한다`);
    for(const r of rooms)assert.equal(roomView(r),r.row==='south'?'정원':'운동장');
  }
  const c=roomsOnFloor(3).filter(r=>r.style==='classroom');
  assert.ok(c.some(r=>r.row==='north')&&c.some(r=>r.row==='south'));
  for(const r of c.filter(r=>r.row==='south'))assert.ok(r.rect.minZ>planCorridors[3]![0]!.maxZ-1e-6,'남쪽 교실은 복도보다 남쪽');
  for(const r of c.filter(r=>r.row==='north'))assert.ok(r.rect.maxZ<planCorridors[3]![0]!.minZ+1e-6,'북쪽 교실은 복도보다 북쪽');
});
