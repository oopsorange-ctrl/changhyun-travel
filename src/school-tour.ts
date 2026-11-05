import {places,type Point,type TourMode} from './school-layout.ts';
import {campusEntrancePoint} from './school-outdoors.ts';
import {upperRooms} from './school-upper-floors.ts';
import {floorRise} from './school-structure.ts';

export type TourStop={placeId:string;mode:TourMode;floor?:number;title:string;description:string};
export type TourCourse={id:string;name:string;intro:string;stops:TourStop[]};
const roomId=(floor:number,name:string)=>upperRooms.find(room=>room.floor===floor&&room.name===name)!.id;
const entrance:TourStop={placeId:'entrance',mode:'campus',title:'학교 안으로 첫걸음',description:'정원 쪽 중앙현관에 도착했다냥. 이곳으로 들어가면 1층 중앙 로비가 나온다냥. 다음 버튼을 눌러서 같이 들어가 보자냥!'};
export const tourCourses:TourCourse[]=[
  {id:'student',name:'신입생 코스',intro:'처음 오는 학교에서 자주 찾게 될 곳들을 쩡이랑 같이 만나 보자냥!',stops:[
    entrance,
    {placeId:'teachers-1',mode:'floor1',title:'1층 교무실',description:'중앙현관에서 서쪽으로 조금 가면 1층 교무실이다냥. 선생님께 물어볼 게 있을 때 찾아오면 된다냥.'},
    {placeId:'av-hall',mode:'floor1',title:'시청각실',description:'행사나 영상 수업을 하는 큰 방이다냥. 1층 복도 북쪽, 운동장이 보이는 쪽에 있다냥.'},
    {placeId:'stairs-central',mode:'floor1',title:'위층으로 이어지는 중앙계단',description:'중앙계단에 도착했다냥. 올라가기 버튼을 누르면 자동으로 걸어 올라간다냥. 학교는 한 층에 남쪽 교실과 북쪽 교실이 복도를 사이에 두고 마주 보고 있다냥.'},
    {placeId:roomId(3,'1-1'),mode:'floor1',floor:3,title:'3층 1학년 교실',description:'1학년 교실이 있는 3층이다냥. 이 교실은 복도 북쪽이라 창밖으로 운동장이 보인다냥. 남쪽 교실에서는 앞 정원이 보인다냥.'},
  ]},
  {id:'parent',name:'학부모 코스',intro:'학교에 찾아올 때 알아 두면 좋은 곳들을 쩡이가 안내해 준다냥!',stops:[
    entrance,
    {placeId:'admin',mode:'floor1',title:'학교 업무를 안내하는 행정실',description:'중앙현관에서 동쪽 복도로 오면 행정실이 있다냥. 실제로 방문할 때는 방문 목적과 담당 부서를 학교에 먼저 확인해 달라냥.'},
    {placeId:'principal',mode:'floor1',title:'교장실',description:'행정실 옆에 교장실이 있다냥. 여기서는 문을 열고 교장선생님이 계신 공간도 둘러볼 수 있다냥.'},
    {placeId:'back-entrance',mode:'floor1',title:'운동장으로 이어지는 후면 로비',description:'중앙현관 맞은편 로비다냥. 북쪽 문으로 나가면 운동장이 나온다냥.'},
    {placeId:'entrance',mode:'floor1',title:'다시 중앙현관에서',description:'학교의 중심인 중앙현관으로 돌아왔다냥. 안내도에서 다른 층의 장소를 확인하거나, 계단을 따라 자유롭게 더 둘러보라냥!'},
  ]},
];

export function tourStopPoint(stop:TourStop):Point {
  return stop.mode==='campus'&&(stop.placeId==='entrance'||stop.placeId==='back-entrance')?campusEntrancePoint(stop.placeId):[...places,...upperRooms].find(place=>place.id===stop.placeId)!.approach;
}
export function reachedTourStop(stop:TourStop,position:Point&{y:number},mode:TourMode):boolean {
  const target=tourStopPoint(stop);
  return mode===stop.mode&&Math.abs(position.y-((stop.floor??1)-1)*floorRise)<.15&&Math.hypot(position.x-target.x,position.z-target.z)<.65;
}
