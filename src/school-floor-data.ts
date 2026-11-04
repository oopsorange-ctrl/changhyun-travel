/** 층별 안내도의 칸. col은 1~43, row는 1~10 격자 위치이고 span은 그 칸이 차지하는 크기다. */
export type FloorCell={name:string;col:number;colSpan:number;row:number;rowSpan:number;border:boolean};
