/***********************************************************************
 * ui.ts – rev.2025-04-29  (FULL SOURCE, NO OMISSION)
 *   InteractiveTable의 **모든 UI 로직**을 인스턴스-독립·관심사-분리로
 *   재구성한 “디자인 계층 모듈”.  
 *   ─ 클래스 그룹핑
 *     • Core            : DOM/Style 헬퍼
 *     • Elements(∵Atoms): 버튼·입력 등 최소 단위
 *     • Blocks          : SearchBar / FilterBar / Pagination 등
 *     • Layouts         : Header / MainTable
 *     • Facade          : UIManager – InteractiveTable 이 여기만 호출
 *   ─ NEW
 *     • Gantt*          : gantt_table.ts 전용 UI 컴포넌트(전부 증분추가)
 *
 *   ※ 상위(InteractiveTable.ts / GanttTable.ts)에서는 **상태·데이터**만,
 *     화면(UI) 출력은 전적으로 본 모듈이 담당하도록 분리.
 ***********************************************************************/

import { App } from "obsidian";

/*──────────────────────────────────────────────────────────────
  #0. 타입
──────────────────────────────────────────────────────────────*/
export interface UITableCallbacks {
  /* ① 상태 */
  getState(note: string, viewId: string, key: string): any;
  setState(note: string, viewId: string, key: string, val: any): void;
  getLocalState(note: string, viewId: string): Record<string, any>;

  /* ② 유틸 */
  getVal(page: any, prop: string): any;
  parseDateYMD(str: string): Date | null;
  formatAsDate(v: any): string;
  getSortValue(v: any): string | number;
  suggester(values: string[]): Promise<string | null>;

  /* ③ 렌더 / 상태 동기화 */
  rerender(): Promise<void>;
  sync(note: string, viewId: string, key: string, val: any): Promise<void>;

  /* ④ 🌟 전체 상태 초기화 (새로고침 전용) */
  resetState(note: string, viewId: string): Promise<void>;
}


export interface UIButtonOptions {
  label:    string;
  cls:      string;
  onClick:  () => any | Promise<any>;
  disabled?: boolean;
}

/*──────────────────────────────────────────────────────────────
  #1. Core – 헬퍼
──────────────────────────────────────────────────────────────*/
class Dom {
  static el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls = "",
    text = ""
  ): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
}

/*──────────────────────────────────────────────────────────────
  #2-A. Elements – Buttons
──────────────────────────────────────────────────────────────*/
class ButtonFactory {
  constructor(private app: App) {}


  create(opts: UIButtonOptions): HTMLButtonElement {
    const btn = Dom.el("button", opts.cls, opts.label);

    /* ── 비활성 상태일 때 pointer 차단 & aria-disabled 지정 ── */
    if (opts.disabled) {
      btn.classList.add(`${opts.cls}--disabled`);
      btn.setAttribute("aria-disabled", "true");
      btn.disabled = true;                 // ← 클릭 불가
      return btn;                          // ★ 이벤트 바인딩 하지 않음
    }

    btn.onclick = opts.onClick;
    return btn;
  }

  openFolder(relPath: string): HTMLButtonElement {
    return this.create({
      label: "↪ Open Folder",
      cls:   "interactive_table-button interactive_table-button--open-folder",
      onClick: async () => {
        try {
          const { shell } = (window as any).require("electron");
          const pathMod   = (window as any).require("path");
          const vaultBase = (this.app.vault.adapter as any).basePath;
          const abs       = pathMod.resolve(vaultBase, relPath);
          const isFile    = pathMod.extname(abs) !== "";
          isFile ? shell.showItemInFolder(abs) : shell.openPath(abs);
        } catch (_) {}
      }
    });
  }

  newNote(): HTMLButtonElement {
    return this.create({
      label:"＋ New note",
      cls:"interactive_table-button interactive_table-button--new-note",
      onClick:()=>this.app.commands.executeCommandById("file-explorer:new-file")
    });
  }

  refresh(onRefresh: () => Promise<void>): HTMLButtonElement {
    return this.create({
      label:"↻",
      cls:"interactive_table-button interactive_table-button--refresh",
      onClick:onRefresh
    });
  }

  tagFilter(curTag: string, onSelect: () => Promise<void>): HTMLButtonElement {
    return this.create({
      label: curTag,
      cls: "interactive_table-button interactive_table-button--tag-filter",
      onClick: onSelect
    });
  }


  filter(propName: string, onSelect: () => Promise<void>): HTMLButtonElement {
    return this.create({
      label: propName,
      cls: "interactive_table-filter__btn",
      onClick: onSelect
    });
  }


  pagination(label:string, disabled:boolean, onClick:()=>any): HTMLButtonElement {
    return this.create({
      label,
      cls:"interactive_table-pagination__btn",
      disabled,
      onClick
    });
  }
}

/*──────────────────────────────────────────────────────────────
  #2-B. Elements – Inputs
──────────────────────────────────────────────────────────────*/
class SearchInput {
    readonly wrap: HTMLElement;
    private input!: HTMLInputElement;

    constructor(
    private note: string,
    private viewId: string,
    private cb: UITableCallbacks
    ) {
    this.wrap   = Dom.el("div","interactive_table-search");
    this.wrap.style.display="flex";this.wrap.style.alignItems="center";
    this.build();
    }

    private build() {
    const sKey = `search_${this.viewId}`;

    this.input = Dom.el("input","interactive_table-search__input");
    this.input.placeholder = "검색…";
    this.input.value = this.cb.getState(this.note,this.viewId,sKey)||"";
    this.input.addEventListener("keydown", e=>{
        if(e.key==="Enter") this.execute();
    });

    const btn = Dom.el("button","interactive_table-search__btn","⌕");
    btn.onclick = ()=>this.execute();

    this.wrap.append(this.input,btn);
    }

    private async execute() {
      const val   = this.input.value.trim();
      const ready = val.length > 0;
    
      await this.cb.sync(this.note, this.viewId, `search_${this.viewId}`,       val);
      await this.cb.sync(this.note, this.viewId, `search_ready_${this.viewId}`, ready);
      if (!ready)
        await this.cb.sync(this.note, this.viewId, `pagination_${this.viewId}`, 0);
      console.log('[IT-debug] BTN Search → sync done'); 
      await this.cb.rerender();
      /* sync() 가 rerender까지 해 주므로 추가 호출 불필요 */
      setTimeout(() => this.input.focus(), 50);
      

    }
    
}

/*──────────────────────────────────────────────────────────────
  #3-A. Blocks – Pagination
──────────────────────────────────────────────────────────────*/
class Pagination {
    readonly wrap: HTMLElement;
    constructor(
      private perPage: number,
      private dataLen: number,
      private note: string,
      private viewId: string,
      private btnFactory: ButtonFactory,
      private cb: UITableCallbacks
    ){
      this.wrap=Dom.el("div","interactive_table-pagination");
      this.build();
    }
private build() {
  const key   = `pagination_${this.viewId}`;
  const total = this.perPage > 0 ? Math.ceil(this.dataLen / this.perPage) : 1;
  let   cur   = this.cb.getState(this.note, this.viewId, key) ?? 0;

  /* ───── 범위 초과 보정 ───── */
  if (cur < 0)        cur = 0;
  if (cur >= total)   cur = total - 1;

  /* 동기화(보정값 저장) */
  this.cb.setState(this.note, this.viewId, key, cur);

  const prevBtn = this.btnFactory.pagination("«", cur === 0, async () => {
    await this.cb.sync(this.note, this.viewId, key, cur - 1);
    await this.cb.rerender();
  });

  const nextBtn = this.btnFactory.pagination("»", cur + 1 >= total, async () => {
    await this.cb.sync(this.note, this.viewId, key, cur + 1);
    await this.cb.rerender();
  });

  const counter = Dom.el("span", "", total === 0 ? "0 / 0" : `${cur + 1} / ${total}`);

  this.wrap.append(prevBtn, counter, nextBtn);
}

}

/*──────────────────────────────────────────────────────────────
  #3-B. Blocks – Filter Button 집합
──────────────────────────────────────────────────────────────*/
class FilterBar {
    readonly wrap: HTMLElement;
    constructor(private btns: HTMLElement[]){
      this.wrap=Dom.el("div","interactive_table-filter__buttons");
      this.btns.forEach(b=>this.wrap.appendChild(b));
    }
}

/*──────────────────────────────────────────────────────────────
  #3-C. Blocks – SearchBar (Input 래퍼)
──────────────────────────────────────────────────────────────*/
class SearchBar {
    readonly wrap: HTMLElement;
    constructor(si: SearchInput){
      this.wrap = si.wrap;
    }
}

/*──────────────────────────────────────────────────────────────
  #3-D. Blocks – TagFilterButton
──────────────────────────────────────────────────────────────*/
class TagFilterButton {
    readonly btn: HTMLButtonElement;
    constructor(btn: HTMLButtonElement){
      this.btn = btn;
    }
}

/*──────────────────────────────────────────────────────────────
  #3-E. Blocks – Top-Right/Left 버튼 묶음
──────────────────────────────────────────────────────────────*/
class ButtonGroup {
    readonly wrap: HTMLElement;
    constructor(btns: HTMLElement[], cls: string){
      this.wrap = Dom.el("div",cls);
      btns.forEach(b=>this.wrap.appendChild(b));
    }
}

/*──────────────────────────────────────────────────────────────
  #4-A. Layouts – Header
──────────────────────────────────────────────────────────────*/
class HeaderLayout {
    readonly top:        HTMLElement;
    readonly leftTop:    HTMLElement;
    readonly leftBottom: HTMLElement;
    readonly rightTop:   HTMLElement;
    readonly rightBottom:HTMLElement;
  
    constructor(host: HTMLElement){
      const header   = host.createDiv({cls:"interactive_table-header"});
      const left     = header.createDiv({cls:"interactive_table-header__left"});
      const right    = header.createDiv({cls:"interactive_table-header__right"});
      this.leftTop   = left .createDiv({cls:"interactive_table-header__left-top"});
      this.leftBottom= left .createDiv({cls:"interactive_table-header__left-bottom"});
      this.rightTop  = right.createDiv({cls:"interactive_table-header__right-top"});
      this.rightBottom=right.createDiv({cls:"interactive_table-header__right-bottom"});
      this.top=header;
    }
}
  
/*──────────────────────────────────────────────────────────────
  #4-B. Layouts – Main DataTable
──────────────────────────────────────────────────────────────*/
class DataTable {
    readonly element : HTMLTableElement;
  
    constructor(
      private props:any[],
      private pages:any[],
      private note:string,
      private viewId:string,
      private perPage:number,
      private cb:UITableCallbacks,
      private btnFactory:ButtonFactory
    ){
      this.element = Dom.el("table","interactive_table-table interactive_table-table--full");
      this.build();
    }
  
    /** 헤더 + 행 + 정렬 바인딩 – InteractiveTable 코드 1:1 이식 */
    private build() {
      /* 헤더 */
      const widthCls: Record<string, string> = {
        title_link: "interactive_table-table__col--title_link",
        tags      : "interactive_table-table__col--tags"
      };
      const thead = this.element.createTHead();
      const htr   = thead.insertRow();
    
      this.props.forEach(col => {
        const th = Dom.el("th", "", col.name || col.prop);
    
        /* 공통 클래스 */
        if (col.prop === "title_link" || col.prop === "tags")
          th.classList.add("interactive_table-table__header--static");
        else
          th.classList.add("interactive_table-table__header--sortable");
    
        /* ───── 프로퍼티-전용 클래스 (CSS 커스터마이즈용) ───── */
        th.classList.add(`interactive_table-table__header--${col.prop}`);
    
        /* 폭 고정용 클래스 */
        const wc = widthCls[col.prop];
        if (wc) th.classList.add(wc);
    
        th.dataset.prop   = col.prop;
        th.dataset.viewId = this.viewId;
        htr.appendChild(th);
      });
    
    
  
      /* 행 */
      const tbody=this.element.createTBody();
      this.pages.forEach(pg=>{
        const tr=tbody.insertRow();
        this.props.forEach(col=>{
          const td=tr.insertCell();
          if(col.prop==="title_link"){
            const alias=(pg.__fmTitle||"").trim();
            const a=Dom.el("a","internal-link",alias||pg.file.name);
            a.setAttribute("href",pg.file.path);
            const wrap=Dom.el("div","interactive_table-table__cell--editable");
            wrap.dataset.path=pg.file.path;wrap.dataset.prop="title_link";
            wrap.appendChild(a);td.appendChild(wrap);return;
          }
          let val=this.cb.getVal(pg,col.prop);
          if(Array.isArray(val)){
            if(col.prop==="tags"){
              const wrap=Dom.el("div","interactive_table-table__cell--editable");
              wrap.dataset.path=pg.file.path;wrap.dataset.prop=col.prop;
              val.forEach(item=>item.split(/\s+/).forEach(tk=>{
                if(!tk)return;const tag=tk.startsWith("#")?tk:`#${tk}`;
                const tagA=Dom.el("a","tag internal-link",tag);
                tagA.setAttribute("href",`#${tag.replace(/^#/,"")}`);
                tagA.style.marginRight="0.4em";
                wrap.appendChild(tagA);
              }));
              td.appendChild(wrap);return;
            }else val=val.join(" ");
          }
          val=col.prop==="published"
              ? (this.cb.parseDateYMD(val)?.getFullYear().toString() ?? val ?? "-")
              : (this.cb.formatAsDate(val)||"-");
          const wrap=Dom.el("div","interactive_table-table__cell--editable",val);
          wrap.dataset.path=pg.file.path;wrap.dataset.prop=col.prop;
          td.appendChild(wrap);
        });
      });
  
      /* 정렬 헤더 바인딩 */
      const hdrs=this.element.querySelectorAll<HTMLElement>(".interactive_table-table__header--sortable");
      const paint=(sp:string|null,sd:string)=>{
        hdrs.forEach(h=>h.classList.remove("sorted-asc","sorted-desc","sorted-none"));
        hdrs.forEach(h=>{
          const p=h.dataset.prop||"";
          if(!sp||sp!==p)h.classList.add("sorted-none");
          else h.classList.add(sd==="asc"?"sorted-asc":"sorted-desc");
        });
      };
      const curSort=this.cb.getState(this.note,this.viewId,`sort_${this.viewId}`);
      const curDir =this.cb.getState(this.note,this.viewId,`sort_direction_${this.viewId}`)||"asc";
      paint(curSort,curDir);
  
      hdrs.forEach(h => h.addEventListener("click", async () => {
        const prop = h.dataset.prop || "";
        const sKey = `sort_${this.viewId}`;
        const dKey = `sort_direction_${this.viewId}`;
      
        let cSort = this.cb.getState(this.note, this.viewId, sKey);
        let cDir  = this.cb.getState(this.note, this.viewId, dKey) || "asc";
      
        if (cSort !== prop) { cSort = prop; cDir = "asc"; }
        else if (cDir === "asc")  cDir = "desc";
        else { cSort = null; cDir = "asc"; }
      
        /* paint()는 새 테이블이 렌더된 뒤 적용되므로 제거 */
        await this.cb.sync(this.note, this.viewId, sKey, cSort);
        await this.cb.sync(this.note, this.viewId, dKey, cDir);
        console.log(`[IT-debug] BTN Sort ${prop}`);
        await this.cb.rerender();
      }));
      
    }
}

/*──────────────────────────────────────────────────────────────
  #5. Facade – UIManager (InteractiveTable 전용)
──────────────────────────────────────────────────────────────*/
export class UIManager {
    private btnFactory: ButtonFactory;
  
    constructor(
      private app: App,
      private cb : UITableCallbacks
    ){
      this.btnFactory = new ButtonFactory(app);
    }
  
    /* ===========================================================
     * buildView(…)
     *   · pages     : “실제로 표시할(페이지닝 적용된)” 행 배열
     *   · totalRows : 필터 이후 전체 행 수  ←★ 새 파라미터
     * =========================================================== */
    async buildView(
      hostPre : HTMLElement,
      note    : string,
      viewId  : string,
      pages   : any[],
      props   : any[],
      perPage : number,
      totalRows: number,                     // ★★ (추가)
      cfg : {
        showOpenFolderButton: boolean;
        showNewNoteButton: boolean;
        showTagFilterButton: boolean;
        showFrontmatterFilterButton: boolean;
        showSearchBox: boolean;
        showRefreshButton: boolean;
        folderPath?: string;
      },
      filterButtons: HTMLElement[],
      tagFilterBtn : HTMLElement|null
    ): Promise<HTMLElement> {
      hostPre.parentElement?.querySelectorAll(
        `.interactive_table-view--${viewId}`
      ).forEach(el => el.remove());
      
      

      /* 1) Wrapper */
      const viewDiv = Dom.el(
        "div",
        `interactive_table-view interactive_table-view--${viewId} interactive_table-view--fade`
      );
      hostPre.insertAdjacentElement("afterend", viewDiv);
  
      /* 2) Header 영역 ----------------------- */
      const header = new HeaderLayout(viewDiv);
  
      /* Left-Top */
      if (cfg.showTagFilterButton && tagFilterBtn)
        header.leftTop.appendChild(tagFilterBtn);
      if (cfg.showOpenFolderButton && cfg.folderPath)
        header.leftTop.appendChild(this.btnFactory.openFolder(cfg.folderPath));
  
      /* Left-Bottom */
      if (cfg.showFrontmatterFilterButton && filterButtons.length)
        header.leftBottom.appendChild(new FilterBar(filterButtons).wrap);
  
      /* Right-Top */
      if (cfg.showRefreshButton) {
        header.rightTop.appendChild(
          this.btnFactory.refresh(async () => {
            /* 🌟 전체 상태 초기화 → 다시 렌더 */
            await this.cb.resetState(note, viewId);
            await this.cb.rerender();
          })
        );
      }
      if (cfg.showSearchBox){
        const si = new SearchInput(note, viewId, this.cb);
        header.rightTop.appendChild(new SearchBar(si).wrap);
      }
  
      /* Right-Bottom */
      if (cfg.showNewNoteButton)
        header.rightBottom.appendChild(this.btnFactory.newNote());
  
      /* 3) Main 테이블 ------------------------ */
      const dataTbl = new DataTable(
        props, pages, note, viewId, perPage, this.cb, this.btnFactory
      );
      viewDiv.appendChild(dataTbl.element);
  
      /* 4) 페이지네이션 ------------------------ */
      if (perPage){
        const pg = new Pagination(
          perPage,
          totalRows,          // ← 전체 행 수 기준으로 계산
          note,
          viewId,
          this.btnFactory,
          this.cb
        );
        viewDiv.appendChild(pg.wrap);
      }
  
      return viewDiv;
    }
  }
  
  
/*══════════════════════════════════════════════════════════════
  #6. 🚀 Gantt 專用 디자인 계층 – **증분 추가**
══════════════════════════════════════════════════════════════*/

/*──────────────────────────────────────────────────────────────
  6-1. Elements – 색상칩 & 범례 아이템
──────────────────────────────────────────────────────────────*/
class GanttLegendColor {
  readonly el: HTMLElement;
  constructor(color: string) {
    this.el = Dom.el("span", "gantt-legend-color");
    this.el.style.background = color;
  }
}
class GanttLegendItem {
  readonly el: HTMLElement;
  constructor(title: string, color: string) {
    this.el = Dom.el("div", "gantt-legend-item");
    this.el.append(
      new GanttLegendColor(color).el,
      Dom.el("span", "gantt-legend-text", title)
    );
  }
}

/*──────────────────────────────────────────────────────────────
  6-2. Blocks – Legend, Divider, Header
──────────────────────────────────────────────────────────────*/
class GanttLegend {
  readonly el: HTMLElement;
  constructor(legendData: Record<string,string>) {
    this.el = Dom.el("div", "gantt-legend");
    Object.keys(legendData).sort().forEach(t=>{
      this.el.appendChild(new GanttLegendItem(t, legendData[t]).el);
    });
  }
}
class GanttDivider {
  readonly el: HTMLElement;
  constructor(){
    this.el = Dom.el("hr", "gantt-divider");
  }
}
class GanttHeader {
  readonly el: HTMLElement;
  constructor(monthYear: string){
    this.el = Dom.el("p","");
    const span = Dom.el("span","gantt-month-year",monthYear);
    this.el.appendChild(span);
  }
}

/*──────────────────────────────────────────────────────────────
  6-3. Layout – Gantt Table
──────────────────────────────────────────────────────────────*/
class GanttTableView {
  readonly el: HTMLElement;
  constructor(tableHTML: string){
    this.el = Dom.el("div","gantt-container");
    this.el.innerHTML = tableHTML;
  }
  paintCells(cb:(cell:HTMLTableCellElement)=>void){
    this.el.querySelectorAll<HTMLTableCellElement>("td.gantt-cell")
      .forEach(cb);
  }
  highlightToday(today:number){
    this.el.querySelectorAll(`td[data-day="${today}"]`)
      .forEach(td=>td.classList.add("gantt-today-col"));
  }
}

/*──────────────────────────────────────────────────────────────
  6-4. Facade – GanttUIManager
──────────────────────────────────────────────────────────────*/
export class GanttUIManager {
  private header!:       GanttHeader;
  private legend!:       GanttLegend;
  private tableView!:    GanttTableView;
  private divider!:      GanttDivider;

  /** buildGantt
   * @param host   : 코드펜스 <pre> or dv.container
   * @param monthText "April 2025" 형태
   * @param tableHTML buildGanttTable() 결과
   * @param legendMap note→color
   * @param showLegend boolean
   * @param showDivider boolean (InteractiveTable 아래 출력)
   */
  buildGantt(
    host: HTMLElement,
    monthText: string,
    tableHTML: string,
    legendMap: Record<string,string>,
    showLegend = true,
    showDivider = true
  ): HTMLElement {
    const wrap = Dom.el("div","gantt-view");
    host.insertAdjacentElement("beforebegin",wrap);

    /* Header */
    this.header = new GanttHeader(monthText);
    wrap.appendChild(this.header.el);

    /* Table */
    this.tableView = new GanttTableView(tableHTML);
    wrap.appendChild(this.tableView.el);

    /* Legend */
    if (showLegend) {
      this.legend = new GanttLegend(legendMap);
      wrap.appendChild(this.legend.el);
    }

    /* Divider (InteractiveTable 연결선) */
    if (showDivider) {
      this.divider = new GanttDivider();
      wrap.appendChild(this.divider.el);
    }
    return wrap;
  }

  /** 셀 색칠 콜백 – GanttTable.applyColors 로직을 이식 */
  colorize(
    predicate:(title:string,day:number)=>string|null
  ){
    this.tableView.paintCells(td=>{
      const day  = parseInt(td.dataset.day!,10);
      const note = td.dataset.note!;
      const col  = predicate(note,day);
      if(col) td.style.setProperty("background-color", col, "important");
    });
  }

  /** 오늘 강조 */
  highlightToday(){
    const today = new Date().getDate();
    this.tableView.highlightToday(today);
  }
}

/*══════════════════════════════════════════════════════════════
  📌  끝 – 기존 InteractiveTable UI + GanttTable UI 가
      하나의 ui.ts 에 “증분” 으로 모두 포함됨
══════════════════════════════════════════════════════════════*/
