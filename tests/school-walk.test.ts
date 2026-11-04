import test from 'node:test';
import assert from 'node:assert/strict';
import {places,floorSpawn,arrivalSpawn,campusSpawn,schoolBounds,doorWidth,type Point,type Rect} from '../src/school-layout.ts';
import {upperRooms,upperFurniture,upperCorridors,upperFloorSurface,upperRoomWalls,walkingFloor,onFloorLevel} from '../src/school-upper-floors.ts';
import {stairs,stairEntry,stairPoint,stairSurfaces,stairSupport,surfaceHeight,floorRise,stairGroundObstacles} from '../src/school-structure.ts';
import {findSchoolPath,isWalkable,moveInSchool,moveSchoolVisitor,schoolInputDirection,advanceSchoolRoute} from '../src/school-navigation.ts';
import {automaticStairPath,advanceStairRoute,stairApproach,nearbyStair} from '../src/school-auto-stairs.ts';
import {campusEntrancePoint,campusSolids,fieldRect,gymRect,backGate} from '../src/school-outdoors.ts';
import {tourCourses,tourStopPoint,reachedTourStop} from '../src/school-tour.ts';
import {frontDoor,backDoor,planRooms,floorCount,floorList,links} from '../src/changhyun-plan.ts';
import {pits,campusHeight,westRamp,aCourt,bCourt,bStairsRect} from '../src/school-outdoors.ts';

const noDoors=new Set<string>();
const center=(r:Rect):Point=>({x:(r.minX+r.maxX)/2,z:(r.minZ+r.maxZ)/2});
const roomOf=(floor:number,name:string)=>upperRooms.find(r=>r.floor===floor&&r.name===name)!;
const inside=(p:Point,r:Rect)=>p.x>=r.minX&&p.x<=r.maxX&&p.z>=r.minZ&&p.z<=r.maxZ;

test('visitors arrive on the front lawn path — there is no gate to walk through', () => {
  assert.ok(isWalkable(arrivalSpawn,'campus',noDoors),'arrival spot is open ground');
  assert.ok(!places.some(p=>/교문|정문/.test(p.name)),'Changhyun has no gate');
  const path=findSchoolPath(arrivalSpawn,campusEntrancePoint('entrance'),'campus',noDoors);
  assert.ok(path.length>1,'the path leads to the central entrance');
  assert.ok(Math.abs(campusEntrancePoint('entrance').x-frontDoor.x)<1e-6);
});

test('the field behind the school, the back gate and the new gym are reachable outdoors', () => {
  for(const id of ['field','back-gate','gym','front-garden']) {
    const place=places.find(p=>p.id===id)!;
    assert.ok(place,`${id} exists`);
    assert.ok(isWalkable(place.approach,'campus',noDoors),`${id} approach is open ground`);
    assert.ok(findSchoolPath(arrivalSpawn,place.approach,'campus',noDoors).length>1,`${id} can be reached from the arrival path`);
  }
  assert.ok(findSchoolPath(campusEntrancePoint('back-entrance'),places.find(p=>p.id==='field')!.approach,'campus',noDoors).length>1,'the back exit opens straight onto the field');
});

test('the building and the unfinished gym block outdoor walking', () => {
  assert.ok(!isWalkable(center(roomOf(3,'1-1').rect),'campus',noDoors));
  assert.ok(!isWalkable(center(gymRect),'campus',noDoors));
  assert.ok(isWalkable(center(fieldRect),'campus',noDoors),'the field itself is open');
  assert.ok(!campusSolids.some(r=>inside(arrivalSpawn,r)));
});

test('the front entrance and the back lobby face each other across the corridor', () => {
  assert.ok(isWalkable(floorSpawn,'floor1',noDoors,1));
  const back=places.find(p=>p.id==='back-entrance')!;
  assert.ok(isWalkable(back.approach,'floor1',noDoors,1));
  assert.ok(findSchoolPath(floorSpawn,back.approach,'floor1',noDoors,1).length>1,'walk straight through the building to the field side');
  assert.ok(backDoor.z<frontDoor.z-10);
});

test('south rooms look at the garden and north rooms at the field on every floor', () => {
  for(let floor=1;floor<=floorCount;floor++) {
    const rooms=upperRooms.filter(r=>r.floor===floor);
    assert.ok(rooms.some(r=>r.row==='north')&&rooms.some(r=>r.row==='south'),`${floor}F has both rows`);
    for(const r of rooms) {
      assert.equal(r.view,r.row==='south'?'정원':'운동장');
      // The door always opens onto the corridor between the two rows.
      assert.ok(r.row==='north'?Math.abs(r.door.z-r.rect.maxZ)<1e-6:Math.abs(r.door.z-r.rect.minZ)<1e-6,`${floor}F ${r.name} door faces the corridor`);
    }
  }
  // 별관 방은 본관의 남북 구조와 무관하다: 전망 문구가 없다.
  for(const r of upperRooms.filter(r=>r.floor<1))assert.equal(r.view,undefined,`${r.name}`);
});

test('every room can be entered through its open door and stays closed otherwise', () => {
  for(const room of upperRooms.filter(r=>!r.open)) {
    const open=new Set([room.id]);
    assert.ok(isWalkable(room.approach,'floor1',noDoors,room.floor),`${room.floor}F ${room.name} approach is corridor floor`);
    // Free floor inside the room, found on a 0.5 m grid.
    let goal:Point|undefined;
    for(let x=room.rect.minX+.5;x<room.rect.maxX&&!goal;x+=.5)for(let z=room.rect.minZ+.5;z<room.rect.maxZ&&!goal;z+=.5)
      if(Math.abs(room.axis==='z'?z-room.door.z:x-room.door.x)>.9&&isWalkable({x,z},'floor1',open,room.floor))goal={x,z};
    assert.ok(goal,`${room.floor}F ${room.name} has free floor`);
    assert.equal(findSchoolPath(room.approach,goal!,'floor1',noDoors,room.floor).length,0,`${room.name} is closed`);
    assert.ok(findSchoolPath(room.approach,goal!,'floor1',open,room.floor).length>1,`${room.floor}F ${room.name} opens`);
  }
});

test('furniture stays inside its room and never blocks the doorway', () => {
  for(const f of upperFurniture) {
    const room=upperRooms.find(r=>r.id===f.roomId)!;
    assert.ok(f.rect.minX>=room.rect.minX-1e-6&&f.rect.maxX<=room.rect.maxX+1e-6&&f.rect.minZ>=room.rect.minZ-1e-6&&f.rect.maxZ<=room.rect.maxZ+1e-6,`${room.name} furniture is inside`);
    if(room.open)continue; // 문이 없는 열린 홀은 문 앞 통로 검사가 필요 없다(도착 자리는 따로 확인).
    const lane=room.axis==='z'
      ?{minX:room.door.x-doorWidth/2,maxX:room.door.x+doorWidth/2,minZ:Math.min(room.door.z,room.door.z+(room.doorSide==='south'?-1.2:1.2)),maxZ:Math.max(room.door.z,room.door.z+(room.doorSide==='south'?-1.2:1.2))}
      :{minX:Math.min(room.door.x,room.door.x+(room.doorSide==='east'?-1.2:1.2)),maxX:Math.max(room.door.x,room.door.x+(room.doorSide==='east'?-1.2:1.2)),minZ:room.door.z-doorWidth/2,maxZ:room.door.z+doorWidth/2};
    assert.ok(!(f.rect.minX<lane.maxX&&f.rect.maxX>lane.minX&&f.rect.minZ<lane.maxZ&&f.rect.maxZ>lane.minZ),`${room.floor}F ${room.name} keeps its door lane clear`);
  }
});

test('each toilet room has one sink and one toilet inside its walls', () => {
  for(const room of upperRooms.filter(r=>r.style==='toilet')) {
    const pieces=upperFurniture.filter(f=>f.roomId===room.id);
    assert.equal(pieces.filter(f=>f.kind==='sink').length,1,`${room.floor}F ${room.name} sink`);
    assert.equal(pieces.filter(f=>f.kind==='toilet').length,1,`${room.floor}F ${room.name} toilet`);
  }
});

test('stairs: every core is entered from the corridor and climbs each floor without a height jump', () => {
  for(const stair of stairs)for(let from=stair.bottomFloor;from<=stair.topFloor;from++)for(const to of [from-1,from+1]) {
    let position={...stairApproach(stair,from),y:(from-1)*floorRise};
    assert.equal(nearbyStair(position)?.id,stair.id,`${stair.id} ${from}F entry is recognised`);
    const path=automaticStairPath(position,stair,to,noDoors);
    if(to<stair.bottomFloor||to>stair.topFloor){assert.equal(path.length,0);continue;}
    assert.ok(path.length,`${stair.id} ${from}→${to}`);
    for(let ticks=0;path.length&&ticks<4000;ticks++) {
      const step=advanceStairRoute(position,path,[.11,.052,.16,.027,.08,.12][ticks%6]!,noDoors);
      assert.equal(step.blocked,false,`${stair.id} ${from}→${to} at ${JSON.stringify(position)} toward ${JSON.stringify(path[0])}`);
      assert.ok(Math.abs(step.position.y-position.y)<.12,'height changes continuously');
      position=step.position;path.splice(0,step.consumed);
    }
    assert.equal(path.length,0);
    assert.ok(Math.abs(position.y-(to-1)*floorRise)<1e-6,`${stair.id} reaches ${to}F`);
    assert.ok(isWalkable(position,'floor1',noDoors,to),`${stair.id} ends on the ${to}F corridor`);
  }
});

test('the stairwell void is blocked on every floor and the landing is walkable', () => {
  for(const stair of stairs)for(let floor=stair.bottomFloor;floor<=stair.topFloor;floor++) {
    const landing=stairSurfaces.find(s=>s.stairId===stair.id&&s.floor===floor&&s.kind==='landing')!;
    const entry=stairApproach(stair,floor);
    assert.ok(isWalkable(entry,'floor1',noDoors,floor),`${stair.id} ${floor}F entry`);
    assert.ok(isWalkable(center(landing.rect),'floor1',noDoors,floor),`${stair.id} ${floor}F landing`);
  }
  for(const hole of stairGroundObstacles)assert.ok(!isWalkable(center(hole),'floor1',noDoors,2));
});

test('stairs line up through all floors', () => {
  for(const stair of stairs) {
    const heights=stairSurfaces.filter(s=>s.stairId===stair.id&&s.kind==='landing'&&s.localRect.minX===0);
    assert.deepEqual(heights.map(s=>s.floor),Array.from({length:stair.topFloor-stair.bottomFloor+1},(_,i)=>stair.bottomFloor+i));
    for(const s of heights)assert.ok(Math.abs(surfaceHeight(s,center(s.rect))-(s.floor-1)*floorRise)<1e-9);
  }
});

test('each corridor connects the rooms of its wing; the east wing joins the main bar from the third floor', () => {
  const entryFor=(floor:number)=>[...stairs.filter(s=>s.bottomFloor<=floor&&s.topFloor>=floor).map(s=>stairApproach(s,floor)),...places.filter(p=>(p.floor??1)===floor&&links.some(l=>l.id===p.id)).map(p=>p.approach)];
  for(const room of upperRooms) {
    // 급식실(-2층)의 계단은 홀 안으로 내려오므로 복도 쪽 방은 홀 문을 열어야 닿는다.
    const open=room.floor===-2?new Set(['dining']):noDoors;
    const reachable=entryFor(room.floor).some(entry=>findSchoolPath(entry,room.approach,'floor1',open,room.floor).length>0);
    assert.ok(reachable,`${room.floor}F ${room.name} can be reached from a stair`);
  }
  // 1~2F: the passage under the third floor separates the west bar and the east wing.
  const west=stairEntry(stairs.find(s=>s.id==='stairs-west')!),far=roomOf(1,'체육부실').approach;
  assert.equal(findSchoolPath(west,far,'floor1',noDoors,1).length,0,'1F wing is separate');
  const west3=stairEntry(stairs.find(s=>s.id==='stairs-west')!),far3=roomOf(3,'진로탐색실').approach;
  assert.ok(findSchoolPath(west3,far3,'floor1',noDoors,3).length>1,'3F corridor is continuous');
});

test('closed doors block movement and an open door lets it through', () => {
  const room=roomOf(1,'행정실'),inward={x:room.door.x,z:room.door.z+(room.row==='north'?-1:1)*2};
  const start=room.approach;
  const blocked=moveInSchool(start,{x:inward.x-start.x,z:inward.z-start.z},'floor1',noDoors,1);
  assert.deepEqual(blocked,start,'a closed door does not let the visitor in');
  const through=moveInSchool(start,{x:inward.x-start.x,z:inward.z-start.z},'floor1',new Set([room.id]),1);
  assert.notDeepEqual(through,start);
});

test('long movement cannot tunnel through a wall and diagonals follow the axes', () => {
  const room=roomOf(1,'교장실');
  const through=moveInSchool(room.approach,{x:0,z:(room.row==='north'?-1:1)*6},'floor1',noDoors,1);
  assert.ok(Math.hypot(through.x-room.approach.x,through.z-room.approach.z)<6);
  const d=schoolInputDirection(1,1);
  assert.ok(Math.abs(Math.hypot(d.x,d.z)-1)<1e-9);
  assert.equal(schoolInputDirection(0,0).x,0);
});

test('invalid, outside and unreachable destinations return no path and never teleport', () => {
  assert.deepEqual(findSchoolPath(floorSpawn,{x:Number.NaN,z:0},'floor1',noDoors,1),[]);
  assert.deepEqual(findSchoolPath(floorSpawn,{x:500,z:500},'floor1',noDoors,1),[]);
  assert.deepEqual(findSchoolPath(arrivalSpawn,{x:-500,z:0},'campus',noDoors),[]);
  const inRoomWalls=center(roomOf(2,'보건실').rect);
  assert.deepEqual(findSchoolPath(floorSpawn,inRoomWalls,'floor1',noDoors,1),[],'a point on another floor is not on this floor');
});

test('automatic routes stop at a closed door and continue once it is open', () => {
  const room=roomOf(1,'교장실'),opened=new Set([room.id]);
  let goal:Point|undefined;
  for(let x=room.rect.minX+.5;x<room.rect.maxX&&!goal;x+=.5)for(let z=room.rect.minZ+.5;z<room.rect.maxZ&&!goal;z+=.5)
    if(Math.abs(z-room.door.z)>1.4&&isWalkable({x,z},'floor1',opened,1))goal={x,z};
  assert.ok(goal,'free floor inside the principal office');
  const path=findSchoolPath(room.approach,goal!,'floor1',opened,1);
  assert.ok(path.length>1);
  const closed=advanceSchoolRoute(room.approach,path,10,'floor1',noDoors,1);
  assert.equal(closed.blocked,true);
  const open=advanceSchoolRoute(room.approach,path,.5,'floor1',new Set([room.id]),1);
  assert.equal(open.blocked,false);
});

test('tour courses visit places that exist and each stop is reached only on the right floor', () => {
  for(const course of tourCourses) {
    assert.ok(course.stops.length>=3,course.name);
    for(const stop of course.stops) {
      const at=tourStopPoint(stop);
      const y=((stop.floor??1)-1)*floorRise;
      assert.ok(reachedTourStop(stop,{...at,y},stop.mode),`${course.name}: ${stop.title} is reached at its own spot`);
      assert.ok(!reachedTourStop(stop,{...at,y:y+floorRise},stop.mode),'not from another floor');
      assert.ok(!reachedTourStop(stop,{...at,y},stop.mode==='campus'?'floor1':'campus'),'not from the other side of the door');
      const walkable=isWalkable(at,stop.mode,noDoors,stop.floor??1);
      assert.ok(walkable,`${course.name}: ${stop.title} spot is walkable`);
    }
  }
});

test('the middle floors and the rooftop level exist and the seventh floor does not', () => {
  assert.equal(Math.max(...upperRooms.map(r=>r.floor)),6);
  assert.equal(walkingFloor(5*floorRise),6);
  assert.equal(walkingFloor(7*floorRise),6,'walking floor is capped at the sixth');
  assert.equal(walkingFloor(-1*floorRise),0,'A동 is one storey below the main ground floor');
  assert.equal(walkingFloor(-2*floorRise),-1);
  assert.equal(walkingFloor(-3*floorRise),-2);
  assert.equal(walkingFloor(-9*floorRise),-2,'walking floor is capped at the dining level');
  assert.ok(onFloorLevel(2*floorRise));
  assert.ok(onFloorLevel(-1*floorRise));
  assert.ok(planRooms.every(r=>r.floor>=-2&&r.floor<=6));
  for(const floor of floorList)assert.ok(upperCorridors[floor]!.length>0);
});

test('spawn spots and room walls stay inside the building', () => {
  assert.ok(inside(floorSpawn,schoolBounds));
  assert.ok(inside(campusSpawn,{minX:-80,maxX:64,minZ:-62,maxZ:66}));
  for(const room of upperRooms.filter(r=>r.floor>=1))for(const wall of upperRoomWalls(room))assert.ok(wall.minX>=schoolBounds.minX-.5&&wall.maxX<=schoolBounds.maxX+.5);
  for(const room of upperRooms)assert.ok(upperFloorSurface(room.approach,room.floor));
  void stairPoint;void stairSupport;void moveSchoolVisitor;void stairEntry;
});

test('the west slope leads down from the main building to the A building and on to the B building', () => {
  const west=places.find(p=>p.id==='west-entrance')!,a=places.find(p=>p.id==='a-entrance')!,b=places.find(p=>p.id==='b-entrance')!;
  assert.ok(Math.abs(campusHeight(campusEntrancePoint('west-entrance')))<1e-9,'the door landing is level with the ground floor');
  assert.ok(Math.abs(campusHeight(campusEntrancePoint('a-entrance'))-(-3.6))<1e-9,'A court is one storey down');
  assert.ok(Math.abs(campusHeight(campusEntrancePoint('b-entrance'))-(-7.2))<1e-9,'B court is two storeys down');
  const pathA=findSchoolPath(campusEntrancePoint('west-entrance'),campusEntrancePoint('a-entrance'),'campus',noDoors);
  assert.ok(pathA.length>1,'walk down the ramp to the A building');
  const pathB=findSchoolPath(campusEntrancePoint('a-entrance'),campusEntrancePoint('b-entrance'),'campus',noDoors);
  assert.ok(pathB.length>1,'walk down the stairs behind the A building to the B building');
  void west;void a;void b;
});

test('the lowered yards cannot be entered from the side and the drop is a wall', () => {
  // 옹벽: 한 걸음 안에서 높이가 3.6 m 달라지므로 걸어서 넘을 수 없다.
  const above={x:aCourt.minX+3,z:aCourt.minZ-.8},below={x:aCourt.minX+3,z:aCourt.minZ+.8};
  assert.ok(Math.abs(campusHeight(above))<1e-9);
  assert.equal(campusHeight(below),-3.6);
  assert.deepEqual(moveInSchool(above,{x:0,z:1.6},'campus',noDoors),above,'cannot walk off the edge');
  assert.ok(pits.length===4);
  assert.ok(westRamp.maxX<=-41&&bCourt.maxZ<=bStairsRect.maxZ);
});

test('every separated annex room can be walked to and the dining hall is reached by the stair from the library floor', () => {
  const dining=upperRooms.find(r=>r.id==='dining')!,library=upperRooms.find(r=>r.id==='library')!;
  assert.equal(dining.floor,-2);assert.equal(library.floor,-1);
  const stairB=stairs.find(s=>s.id==='stairs-b')!;
  const down=automaticStairPath({...stairApproach(stairB,-1),y:-2*floorRise},stairB,-2,noDoors);
  assert.ok(down.length>3,'a route down exists');
  const hallSpot=stairApproach(stairB,-2);
  assert.ok(isWalkable(hallSpot,'floor1',noDoors,-2),'the stair foot is walkable inside the dining hall');
  assert.ok(upperFurniture.filter(f=>f.roomId==='dining').length>6,'the hall has tables');
});
