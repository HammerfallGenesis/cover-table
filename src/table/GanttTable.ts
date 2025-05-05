/***********************************************************************
 * GanttTable.ts – rev.2025-04-29  (FULL SOURCE, NO OMISSION)
 *   Dataview 페이지를 월간 간트 차트로 시각화 + 팔레트 커스터마이즈
 *   ‣ 상태 필터 · 시작/종료일 컬럼 · 라이트/다크 팔레트 자동 전환
 *   ‣ 범례(legend) + 오늘(day-highlight) + InteractiveTable 연동
 *   ‣ 코드 전 구간 **절대 생략 없음**, A~L 구역으로 논리 분류
 ***********************************************************************/

import { App, MarkdownPostProcessorContext } from "obsidian";

/*──────────────────────────────────────────────────────────────
  A. 타입 & 상수
──────────────────────────────────────────────────────────────*/
export interface GanttSettings {
  /* Dataview / 파일 범위 */
  id?: string;
  path?: string;
  customPages?: any[];

  /* 상태 필터 */
  statusField?: string;
  statusDoneValue?: string;
  excludeDone?: boolean;            // 기본값: true

  /* 날짜 필드 */
  startField?: string;              // 기본값: "created"
  endField?: string;                // 기본값: "end"

  /* 팔레트 */
  colorPalette?:       string[];
  colorPaletteDark?:   string[];
  colorPaletteLight?:  string[];

  /* 표시 옵션 */
  showLegend?:            boolean; // 기본값: true
  renderInteractiveBelow?: boolean; // 기본값: true
  forceInteractiveBelow?:  boolean; // 🆕 작업이 없어도 InteractiveTable 강제 렌더
  interactiveOptions?:     any;
  debugLegend?:            boolean;
}

/* 기본 색상군 */
const DEFAULT_DARK = [
  "#ff6363","#ffa600","#ffcf00","#8aff80","#2effd3",
  "#00ffff","#25c6fc","#3399ff","#9975e2","#cc66cc",
  "#ff66ff","#ff66cc","#ff6699","#ff6666","#f06b60",
  "#ed7732","#de9f00","#afff68","#53ffb4","#2f9eff"
];
const DEFAULT_LIGHT = [
  "#ff9999","#ffc04d","#ffe680","#b3ffb3","#80fff2",
  "#80ffff","#99daff","#99c2ff","#c2a3e8","#df9edf",
  "#ff99ff","#ff99e6","#ff99c2","#ff9999","#f4a38c",
  "#f1b066","#eec900","#c5ff8a","#84ffc9","#74baff"
];

/*──────────────────────────────────────────────────────────────
  B. 클래스 정의
──────────────────────────────────────────────────────────────*/
export class GanttTable {
  /*──────── B-1. 필드 (상태) ────────*/
  private noteColorMap: Record<string,{colorIndex:number|null}> = {};
  private colorPtr  = 0;                           // 팔레트 인덱서
  private legendMap: Record<string,string> = {};   // 노트→색상 매핑
  private isDark    = document.body.classList.contains("theme-dark");

  /*──────── B-2. ctor ────────*/
  constructor(private app: App){}

  /*──────────────────────────────────────────────────────────────
    C. 팔레트 & 색상 유틸
  ─────────────────────────────────────────────────────────────*/
  private pickPalette(st:GanttSettings){
    return ( this.isDark
        ? (st.colorPaletteDark   || st.colorPalette || DEFAULT_DARK )
        : (st.colorPaletteLight || st.colorPalette || DEFAULT_LIGHT)
    ).slice();     // 방어적 사본
  }
  private assignColor(note:string,pal:string[]){
    if(this.noteColorMap[note]) return;
    if(!pal.length){ this.noteColorMap[note]={colorIndex:null}; return; }
    const idx=this.colorPtr % pal.length;
    this.noteColorMap[note]={colorIndex:idx};
    this.colorPtr++;
  }
  private colorOf(note:string,pal:string[]){
    const c=this.noteColorMap[note];
    if(!c||c.colorIndex==null) return "#999";
    return pal[c.colorIndex];
  }

  /*──────────────────────────────────────────────────────────────
    D. 데이터 수집
  ─────────────────────────────────────────────────────────────*/
  private gatherData(dv:any, st:GanttSettings){
    this.isDark=document.body.classList.contains("theme-dark");
    const palette=this.pickPalette(st);

    /* 현재 노트가 없으면 중단 */
    const cur=dv.current?.() || (st as any).__dummy;
    if(!cur?.file){
      console.warn("[Gantt] current page not found – abort gather");
      return {dv,all:[],year:0,month:0,total:0,palette};
    }

    /* ① 대상 페이지 */
    const folderPages=dv.pages()
      .where((p:any)=>p.file.folder===cur.file.folder && p.file.path!==cur.file.path)
      .array();

    const base = Array.isArray(st.customPages)
                ? st.customPages
                : st.path
                  ? dv.pages(`"${st.path}"`).array()
                  : folderPages;

    /* ② 상태 필터 */
    const sKey= st.statusField??"status";
    const done=(st.statusDoneValue??"done").toLowerCase();
    const excl= st.excludeDone!==false;

    const all = base.filter((p:any)=>{
      if(excl){
        const stat=(p[sKey]??"").toString().toLowerCase();
        if(stat===done) return false;
      }
      const sOk=p[st.startField??"created"];
      const eOk=p[st.endField  ??"end"];
      return !!sOk && !!eOk;
    });

    /* ③ 범위: 이번달 */
    const now=new Date();
    const yr =now.getFullYear();
    const mo =now.getMonth();
    const days=new Date(yr,mo+1,0).getDate();

    return {
      dv, all, year:yr, month:mo, total:days,
      palette,
      startField: st.startField??"created",
      endField  : st.endField  ??"end"
    };
  }

  /*──────────────────────────────────────────────────────────────
    E. HTML 빌드
  ─────────────────────────────────────────────────────────────*/
  /* E-1. 테이블 */
  private buildTable(data:any){
    const {all,total}=data;
    /* thead */
    const headCols = Array.from({length:total},(_,i)=>
      `<th class="gantt-day-col">${String(i+1).padStart(2,"0")}</th>`).join("");
    const thead = `<thead><tr><th class="gantt-corner-col"></th>${headCols}</tr></thead>`;

    /* tbody */
    let tbody="<tbody>";
    for(const pg of all){
      const title=pg.title||pg.file.name||"Untitled";
      this.assignColor(title,data.palette);

      tbody+=`<tr><td class="gantt-note-col">${title}</td>`;
      for(let d=1;d<=total;d++)
        tbody+=`<td class="gantt-cell" data-note="${title}" data-day="${d}"></td>`;
      tbody+="</tr>";
    }
    tbody+="</tbody>";
    return `<table class="gantt-table">${thead}${tbody}</table>`;
  }

  /* E-2. 범례 */
  private buildLegendHTML(data:any){
    if(data.all.length===0) return "";
    const html = Object.keys(this.noteColorMap).sort().map(t=>{
      const c=this.colorOf(t,data.palette);
      return `<div class="gantt-legend-item">
                <span class="gantt-legend-color" style="background:${c};"></span>
                <span class="gantt-legend-text">${t}</span>
              </div>`;
    }).join("");
    return `<div class="gantt-legend">${html}</div>`;
  }
  private makeLegendMap(data:any){
    const res:Record<string,string>={};
    Object.keys(this.noteColorMap).forEach(t=>{
      res[t]=this.colorOf(t,data.palette);
    });
    return res;
  }

  /*──────────────────────────────────────────────────────────────
    F. 셀 색칠 & 오늘 하이라이트
  ─────────────────────────────────────────────────────────────*/
  private paintCells(wrap:HTMLElement,data:any){
    const {all,year,month,palette,startField,endField}=data;
    all.forEach((pg:any)=>{
      const title=pg.title||pg.file.name||"Untitled";
      const color=this.colorOf(title,palette);
      const s=data.dv.date(pg[startField])?.toJSDate();
      const e=data.dv.date(pg[endField  ])?.toJSDate();
      if(!s||!e) return;
      wrap.querySelectorAll<HTMLTableCellElement>(`td[data-note="${title}"]`)
        .forEach(td=>{
          const day=+td.dataset.day!;
          const cur=new Date(year,month,day);
          if(cur>=s&&cur<=e)
            td.style.setProperty("background-color",color,"important");
        });
    });
    /* 오늘 */
    const today=new Date().getDate();
    wrap.querySelectorAll(`td[data-day="${today}"]`)
      .forEach(td=>td.classList.add("gantt-today-col"));
  }

  /*──────────────────────────────────────────────────────────────
    G. HR(구분선) 생성
  ─────────────────────────────────────────────────────────────*/
  private hr(parent:HTMLElement){
    const hr=parent.createEl("hr");hr.addClass("gantt-divider");
    return hr;
  }

  /*──────────────────────────────────────────────────────────────
      H. renderView (DataviewJS / 코드펜스)
  ──────────────────────────────────────────────────────────────*/
  public async renderView(
    dv: any,
    settings: GanttSettings = {},
    ctx?: MarkdownPostProcessorContext,
    hostPre?: HTMLElement            // 코드펜스 <pre>
  ){
    /* 0) 기본값 확정 */
    settings.renderInteractiveBelow ??= true;
    settings.showLegend             ??= true;
    settings.forceInteractiveBelow  ??= false;

    /* forceInteractive 가 켜져 있으면 InteractiveTable 렌더 플래그를 무조건 ON */
    if (settings.forceInteractiveBelow)
      settings.renderInteractiveBelow = true;

    /* 1) current page 확보 */
    let cur = dv.current?.();
    if ((!cur || !cur.file) && ctx?.sourcePath) cur = dv.page(ctx.sourcePath);
    if (!cur?.file) {
      console.warn("[Gantt] current page not found – abort");
      return;
    }

    /* dv.current 임시 패치 (canvas 지원) */
    const origCurrent = dv.current;
    (dv as any).current = () => cur;

    /* 2) 렌더 컨테이너 */
    let container: HTMLElement;
    if (hostPre) {
      container = document.createElement("div");
      container.classList.add("gantt-view");
      hostPre.insertAdjacentElement("beforebegin", container);
    } else {
      container = dv.container;
    }

    /* 3) 헤더(년·월) */
    const now       = new Date();
    const monthName = new Intl.DateTimeFormat("en",{month:"long"}).format(now);
    const header    = container.createEl("p");
    header.innerHTML = `<span class="gantt-month-year">${monthName} ${now.getFullYear()}</span>`;

    /* 상태 초기화 */
    this.noteColorMap = {};
    this.colorPtr     = 0;
    this.legendMap    = {};

    /* 4) 데이터 수집 */
    const data = this.gatherData(dv, settings);
    (dv as any).current = origCurrent;   // 원복

    /* 5) Gantt 본체 ------------------------------------------------*/
    if (data.all.length > 0) {
      const wrap = container.createDiv("gantt-container");
      wrap.innerHTML =
        this.buildTable(data) +
        (settings.showLegend !== false ? this.buildLegendHTML(data) : "");

      this.paintCells(wrap, data);
      this.legendMap = this.makeLegendMap(data);

      if (settings.debugLegend) {
        const pre = container.createEl("pre", { cls: "gantt-debug" });
        pre.innerText = JSON.stringify(this.legendMap, null, 2);
      }
    } else {
      /* 작업이 없으면 안내 문구만 출력 */
      container.createEl("p", { text: "*No tasks*" });
    }

    /* 6) InteractiveTable 연동 -------------------------------------*/
    if (settings.renderInteractiveBelow) {
      this.hr(container);
      const engine = (window as any).coverTable?.engine;
      await engine?.renderAutoView(
        dv,
        settings.interactiveOptions ?? {},
        ctx,
        container
      );
    }
  }


  /*──────────────────────────────────────────────────────────────
    I. 범례 외부 제공
  ─────────────────────────────────────────────────────────────*/
  public getLegendData(){ return this.legendMap; }
}
