/**
 * 학교마다 바꾸는 이름·주소·연결값을 한곳에 둔다. 다른 학교는 이 파일부터 고친다.
 * 배치·문·가구 같은 형상은 docs/내-학교로-바꾸기.md의 파일 표를 따른다.
 * index.html의 제목·공유 정보와 홈 화면 manifest도 빌드할 때 이 값으로 채운다(vite.config.ts).
 */
export const schoolConfig={
  schoolName:'창현고등학교',
  /** 게임 문구에 붙는 짧은 이름: '창현 축제', '창현 길잡이' */
  shortName:'창현',
  /** 첫 화면 위쪽의 작은 영문 표기 */
  englishName:'CHANGHYUN',
  siteName:'창현 여행',
  tagline:'창현고등학교를 거닐다',
  description:'익숙한 학교를, 새로운 산책으로. 교문부터 시작하는 포근한 3D 창현고등학교 여행.',
  shareDescription:'익숙한 학교를, 새로운 산책으로. 교문부터 시작하는 포근한 3D 학교 여행에 초대합니다.',
  /** 배포한 사이트의 주소. 끝에 /를 붙인다. 공유 미리보기 이미지 주소에 쓰인다. */
  siteUrl:'https://changhyun-travel.vercel.app/',
  /** public/ 안의 1200×630 공유 이미지 (학교 모형이 완성된 뒤 창현고 것으로 교체) */
  shareImage:'school-share-v2.jpg',
  shareImageAlt:'창현 여행 — 크림색 배경에 펼쳐진 3D 학교 전경',
  themeColor:'#f3eedf',
  /**
   * 방명록·교장선생님 인사말·공간 안내를 주는 Apps Script 웹앱 주소(docs/시트-연결.md).
   * 비워 두면 시트 기능은 "아직 연결하지 않았어요" 안내만 보여 준다.
   */
  dataUrl:'https://script.google.com/macros/s/AKfycbykHUtUt1CC7u_kBRKk4qFg2nE1RON4dVMM5x4kIWRAMnNjyeQn7_yQ8g0OIxIlUx9Z/exec',
  /** 로비 현수막과 기념사진 아래쪽 글 */
  eventTitle:'창현고등학교 입학설명회',
  eventWelcome:'예비 창현인 여러분, 마음껏 둘러보세요',
  /** 도움말의 '자료와 표현 범위' 상자 */
  about:{
    note:'이 3D 학교는 제작 중인 견본입니다. 층별 배치·문·가구는 앞으로 창현고등학교에 맞게 바꿔 갈 예정이며, 지금 보이는 모습은 실제와 다를 수 있습니다.',
    details:[
      '교문에서 출발해 복도와 교실을 걸을 수 있어요. WASD·방향키 또는 이동판으로 움직이세요. 교실 문을 열고 들어갈 수 있으며 가구는 기본 견본이에요.',
    ],
    /** 층별 안내도 아래 '실 이름 참고' 링크 */
    roomNames:{label:'학교 지도·거리뷰',url:'https://map.naver.com/p/search/%EC%B0%BD%ED%98%84%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90'},
    links:[
      {label:'학교 지도·거리뷰',url:'https://map.naver.com/p/search/%EC%B0%BD%ED%98%84%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90'},
    ],
    credits:'주인공·교장·교감·학교보안관·숙직실 경비원: Meshy 모형 · 비율·자세 조정: Blender · 걷기 동작: dossamlab Meshy 모형',
    maker:'창현고등학교',
  },
};
