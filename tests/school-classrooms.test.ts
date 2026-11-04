import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3,Matrix4,Quaternion,Vector3} from 'three';
import {classroomModels} from '../src/school-classrooms.ts';
import {upperRooms} from '../src/school-upper-floors.ts';
import {makeFloorQuiz,balloonPoints,quizFloorLabel} from '../src/school-minigames.ts';

type Node={name?:string;children?:number[];mesh?:number;translation?:number[];rotation?:number[];scale?:number[];matrix?:number[]};
type Asset={nodes:Node[];meshes:{primitives:{indices?:number;attributes:{POSITION:number}}[]}[];accessors:{count:number;min?:number[];max?:number[]}[]};
const file=readFileSync(new URL('../public/school-classrooms.glb',import.meta.url));
const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12))) as Asset;
function bounds(name:string) {
  const index=data.nodes.findIndex(node=>node.name===name);
  assert.ok(index>=0,`Missing prototype ${name}`);
  const result=new Box3();
  (function visit(id:number,parent:Matrix4) {
    const node=data.nodes[id]!;
    const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3().fromArray(node.translation??[0,0,0]),new Quaternion().fromArray(node.rotation??[0,0,0,1]),new Vector3().fromArray(node.scale??[1,1,1]));
    const world=parent.clone().multiply(local);
    if(node.mesh!==undefined)for(const primitive of data.meshes[node.mesh]!.primitives) {
      const position=data.accessors[primitive.attributes.POSITION]!;
      result.union(new Box3(new Vector3().fromArray(position.min!),new Vector3().fromArray(position.max!)).applyMatrix4(world));
    }
    for(const child of node.children??[])visit(child,world);
  })(index,new Matrix4());
  return result;
}

test('classroom prototypes are centred, grounded and match the declared footprints',()=>{
  assert.ok(file.length<1.5*1024*1024,`school-classrooms.glb: ${file.length} bytes`);
  const triangles=data.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+data.accessors[p.indices??p.attributes.POSITION]!.count/3,0);
  assert.ok(triangles<70000,`${triangles} triangles`);
  for(const [name,[width,depth]] of Object.entries(classroomModels)) {
    const box=bounds(name),size=box.getSize(new Vector3()),centre=box.getCenter(new Vector3());
    assert.ok(Math.abs(box.min.y)<.01,`${name} stands on the floor`);
    assert.ok(Math.abs(centre.x)<.01&&Math.abs(centre.z)<.01,`${name} is centred on its footprint`);
    assert.ok(Math.abs(size.x-width)<.02&&Math.abs(size.z-depth)<.02,`${name}: ${size.x.toFixed(3)} x ${size.z.toFixed(3)}`);
  }
});

test('interactive cabinets keep hinge pivots and the arcades keep their screen anchors',()=>{
  for(const name of ['printer-cabinet-door-l','printer-cabinet-door-r','germ-incubator-a-door','germ-incubator-b-door','arcade-balloon-screen','arcade-quiz-marquee','welcome-banner-face','power-rack-bar'])
    assert.ok(data.nodes.some(node=>node.name===name),`Missing node ${name}`);
  assert.ok(bounds('germ').max.y<.7,'The germ is scaled up only while it pops out');
});

test('every chair, stool and bench seat carries a sitting marker',()=>{
  const seats=data.nodes.filter(node=>node.name?.startsWith('seat'));
  assert.ok(seats.length>=50,`${seats.length} seat markers`);
  for(const name of ['lab-set-orange','student-set','computer-set','staff-desk','booth','wall-bench-blue','round-table-stools']) {
    const root=data.nodes.find(node=>node.name===name)!;
    assert.ok(root.children?.some(child=>data.nodes[child]!.name?.startsWith('seat')),`${name} has a seat`);
  }
  for(const node of seats)assert.ok(node.translation&&node.translation[1]!>.4&&node.translation[1]!<1,`${node.name} sits at seat height`);
});

test('floor quiz answers match the walkable map',()=>{
  let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const rooms=upperRooms.map(r=>({name:r.name,floor:r.floor}));
  for(let round=0;round<20;round++) {
    const quiz=makeFloorQuiz(rooms,random);
    assert.equal(quiz.length,5);
    assert.equal(new Set(quiz.map(q=>q.statement)).size,5);
    for(const q of quiz) {
      const [,name,label]=q.statement.match(/^(.+)은\(는\) (.+)에 있어요\.$/)!;
      const actual=upperRooms.filter(r=>r.name===name).map(r=>r.floor);
      assert.equal(actual.length,1,`${name} is unique`);
      assert.equal(q.answer,quizFloorLabel(actual[0]!)===label,q.statement);
    }
  }
  assert.equal(balloonPoints(true),3);assert.equal(balloonPoints(false),1);
});

