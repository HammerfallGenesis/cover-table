/*──────────────────────────────────────────────────────────────
  #0  import 구문
──────────────────────────────────────────────────────────────*/
import { App, TFile, MarkdownPostProcessorContext } from "obsidian"; // obsidian 플러그인 API에서 객체(App), 파일 타입(TFile), 코드펜스 컨텍스트(MarkdownPostProcessorContext)
import { UIManager, UITableCallbacks              } from "./ui"    ; // UI 전담 모듈
import { tableState, ViewInst as StateInst        } from "./state" ; // 전역 상태 정의 모듈

/*──────────────────────────────────────────────────────────────
  #1  tableState 전용 헬퍼 
  - gs: 노트/키 값에 대한 객체를 로컬 스토리지에서 호출
  - ss: 노트/키 값에 대한 객체를 로컬 스토리지에 저장
──────────────────────────────────────────────────────────────*/
function gs(
  note: string, // 노트 경로
  vid : string, // view-id 코드펜스마다 고유 키
  k   : string  // 추가 텍스트 + 숫자 키
){
  return tableState.get(note, vid)?.[k] ?? null; 
}

/*──────────────────────────────────────────────────────────────
  #1  tableState 전용 헬퍼 – ss()  ***REPLACE***
──────────────────────────────────────────────────────────────*/
function ss(
  note: string,   // 노트 경로
  vid : string,   // view-id
  k   : string,   // 키
  v   : any       // 값
){
  const arr  = tableState['paneMap'].get(vid) as any[] | undefined;
  const inst = arr?.[0];

  /* ─── ① Pane 가 살아 있을 때: 기존 로직 ─── */
  if (inst) {
    const silent = !!(inst as any).skipStateWrite;
    tableState.set(inst, { [k]: v }, false, silent);
    return;
  }

  /* ─── ② Pane 가 이미 제거된 상태: 로컬스토리지 직-쓰기 ─── */
  const key = `coverTable::${note}::${vid}`;          // storage 키 규칙
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    data[k] = v;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* JSON 파싱 실패 시 새로 작성 */
    localStorage.setItem(key, JSON.stringify({ [k]: v }));
  }
}







/*──────────────────────────────────────────────────────────────
  #1  클래스
──────────────────────────────────────────────────────────────*/
export class InteractiveTable {

/*──────────  1-A. 필드  ──────────*/
private dv!                 : any;
private ui!                 : UIManager;
private cb!                 : UITableCallbacks;
private currentSettings!    : any;
private currentCtx!         : MarkdownPostProcessorContext;
private currentContainerEl! : HTMLElement;
private currentProps!       : any[];
private currentPages!       : any[];
private _rendering = false;

/* ★ 추가: pass-through rerender 시 상태 재-저장을 막기 위한 플래그 */
private skipStateWrite      = false;


/* InteractiveTable.ts – 클래스 맨 위 utilities 바로 아래 */
private ensureUI(){
  if (!this.ui)
    this.ui = new UIManager(this.app, this.cb);
}



/*──────────  1-B. 정규식  ─────────*/
private readonly dateYMDRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
private readonly timeHMRegex  = /^(\d{1,2}):(\d{1,2})$/;

/*──────────  1-C. ctor  ──────────*/
constructor(private app: App) {
  const cb: UITableCallbacks = {
    /* ───── 상태 ───── */
    getState     : gs,
    setState     : ss,
    getLocalState: (n, v) => tableState.get(n, v),

    /* ───── 유틸 ───── */
    getVal       : this.getVal.bind(this),
    parseDateYMD : this.parseDateYMD.bind(this),
    formatAsDate : this.formatAsDate.bind(this),
    getSortValue : this.getSortValue.bind(this),
    suggester    : this.suggester.bind(this),

    /* ───── 렌더 ───── */
    rerender     : async () => { await this.rerender(true); },

    sync         : async (note, vid, key, val) => {
      ss(note, vid, key, val);
      await this.rerender(true);
    },

    /* 🌟 전체 상태 초기화 */
    resetState   : async (note, vid) => {
      const panes = (tableState as any).paneMap.get(vid) as any[] | undefined;
      const inst  = panes?.[0];
      if (inst)            // 현재 Pane 존재
        tableState.set(inst, {}, true, false);   // wipe=true
      else {
        const key = `coverTable::${note}::${vid}`;
        localStorage.removeItem(key);            // 로컬스토리지 즉시 삭제
      }
    }
  };

  this.cb = cb;
  this.ui = new UIManager(app, cb);
}




private debug(msg:string){ console.log(`[IT-debug] ${msg}`); }


/*════════════════════════════════════════════
  #2  유틸
════════════════════════════════════════════*/
private isFolderNote(p:any){
  if(!p?.file) return false;
  const base   = p.file.name.trim().toLowerCase();
  const folder = p.file.folder.split("/").pop()!.trim().toLowerCase();
  return base===folder || base==="index" || base==="readme";
}
/* --------------------------------------------------------------------
   [A] 뷰 ID 생성 – “탭 생명주기 동안 1회”  **REPLACE**
-------------------------------------------------------------------- */
private resolveViewId(settings: any): string {
  /* 이미 발급돼 있으면 그대로 사용 → 탭 재렌더 시 동일 ID 유지 */
  if (settings.__viewId) return settings.__viewId;

  /* 새로 부여 */
  const id = (crypto as any)?.randomUUID
    ? crypto.randomUUID()
    : `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  settings.__viewId = id;          // 탭-로컬 보존
  return id;
}




/*────────────  날짜/정렬/포맷  ───────────*/
private parseDateYMD(str:string){
  if(typeof str!=="string") return null;
  const m=str.match(this.dateYMDRegex);
  if(m){
    const y=+m[1], mo=+m[2], d=+m[3];
    if(y<1000||y>9999||mo<1||mo>12||d<1||d>31) return null;
    return new Date(y,mo-1,d);
  }
  const dt=new Date(str); return isNaN(dt.getTime())?null:dt;
}
private parseTimeHM(str:string){
  if(typeof str!=="string") return null;
  const m=str.match(this.timeHMRegex);
  if(!m) return null;
  const hh=+m[1], mm=+m[2];
  if(hh>23||mm>59) return null;
  const dt=new Date(); dt.setHours(hh,mm,0,0); return dt;
}
private getSortValue(v:any){
  if(v==null) return "";
  const s=typeof v==="string"?v:String(v);
  const d=this.parseDateYMD(s)||this.parseTimeHM(s);
  if(d) return d.getTime();
  const n=parseFloat(s); return isNaN(n)?s.toLowerCase():n;
}
private formatAsDate(v:any){
  if(v==null) return "";
  const d=this.parseDateYMD(String(v)); if(!d) return String(v);
  const y=d.getFullYear(), m=d.getMonth()+1, dd=d.getDate();
  return `${y}-${m<10?"0":""}${m}-${dd<10?"0":""}${dd}`;
}
private getVal(p:any,prop:string){
  return prop.startsWith("file.")
    ? prop.split(".").reduce((v,k)=>v?.[k],p)
    : p[prop];
}
private sortByProp(arr:any[],prop:string|null,dir="asc"){
  if(!prop||prop==="title_link"||prop==="tags") return arr;
  return arr.sort((a,b)=>{
    const A=this.getSortValue(this.getVal(a,prop));
    const B=this.getSortValue(this.getVal(b,prop));
    if(typeof A==="number"&&typeof B==="number")
      return dir==="asc"?A-B:B-A;
    return dir==="asc"
      ? String(A).localeCompare(String(B))
      : String(B).localeCompare(String(A));
  });
}

/*════════════════════════════════════════════
  #3  필터/검색/페이지네이션  (※ 기존 로직 그대로)
════════════════════════════════════════════*/
/* … (makeTagFilterButton · makeFrontmatterButtons ·
       filter/search/paginate 함수군은 모두 기존 코드와 동일.
       단, this._getState/_setState → gs/ss 로 교체)           */

private async makeTagFilterButton(pages:any[],note:string,vid:string){
  const cur = gs(note,vid,`tagFilter_${vid}`) || "ALL";
  const btn=document.createElement("button");
  btn.className="interactive_table-button interactive_table-button--tag-filter";
  btn.textContent=cur;
  btn.onclick=async()=>{
    const tags=new Set<string>();
    pages.forEach(pg=>{
      (pg?.file?.tags??pg?.tags??[]).forEach((t:string)=>tags.add(t));
    });
    const sel=await this.suggester(["ALL",...Array.from(tags).sort()]);
    if(!sel) return;
    await this.cb.sync(note, vid, `tagFilter_${vid}`, sel);
    this.debug('BTN Tag-Filter');
    await this.cb.rerender();
  };
  return btn;
}

private async makeFrontmatterButtons(
  props:any[], pages:any[], note:string, viewId:string
){
  const buttons: HTMLElement[] = [];

  /* title_link / tags 제외, filter가 true(또는 미정의) 인 컬럼 모두 버튼 생성 */
  for(const p of props){
    if(p.prop==="title_link" || p.prop==="tags") continue;
    const need = p.filter ?? true;
    if(need)
      buttons.push(await this.makeFilterButton(p, pages, note, viewId));
  }
  return buttons;
}

private async suggester(vals:string[]):Promise<string|null>{
  const { SuggestModal } = (globalThis as any).coverTable.obsidian;
  return new Promise(resolve=>{
    class MySugg extends SuggestModal<string>{
      getSuggestions(q:string){return vals.filter(x=>x.toLowerCase().includes(q.toLowerCase()));}
      renderSuggestion(v:string,el:HTMLElement){el.createEl("div",{text:v});}
      onChooseSuggestion(v:string){resolve(v);}
    }
    new MySugg(this.app).open();
  });
}

private async makeFilterButton(p:any,pages:any[],note:string,vid:string){
  const btn=document.createElement("button");
  btn.className="interactive_table-filter__btn";
  btn.textContent=p.name||p.prop;
  btn.onclick=()=>this.changePropFilter(p,pages,note,vid);
  return btn;
}

private async changePropFilter(p:any,pages:any[],note:string,vid:string){
  const vals=new Set<string>();
  pages.forEach(pg=>{
    let raw=this.getVal(pg,p.prop);
    let v=this.formatAsDate(raw); if(!v) v="-"; vals.add(v);
  });
  let arr=Array.from(vals); const hasDash=arr.includes("-");
  if(hasDash) arr=arr.filter(v=>v!="-");
  arr.sort();
  const opts=hasDash?["ALL","-"].concat(arr):["ALL",...arr];
  const sel=await this.suggester(opts); if(!sel) return;
  await this.cb.sync(note, vid, `filter_${vid}_${p.prop}`, sel);
  this.debug('BTN Prop-Filter');
  await this.cb.rerender();
}

private async filterByProp(p:any,pages:any[],note:string,vid:string){
  const key=`filter_${vid}_${p.prop}`; const val=gs(note,vid,key);
  if(!val||val==="ALL") return pages;
  return pages.filter(pg=>{
    let raw=this.getVal(pg,p.prop);
    let cmp=this.formatAsDate(raw); if(!cmp) cmp="-";
    return cmp===val;
  });
}

private async renderTagFilterButton(pages:any[],container:HTMLElement,note:string,vid:string){
  const cur=gs(note,vid,`tagFilter_${vid}`) || "ALL";
  const btn=document.createElement("button");
  btn.className="interactive_table-button interactive_table-button--tag-filter";
  btn.textContent=cur;
  btn.onclick=async()=>{
    const tags=new Set<string>();
    pages.forEach(pg=>{
      const tg=pg?.file?.tags||pg?.tags;
      if(!tg) return;
      if(Array.isArray(tg)) tg.forEach(t=>tags.add(t));
    });
    const sel=await this.suggester(["ALL",...Array.from(tags).sort()]);
    if(!sel) return;
    ss(note,vid,`tagFilter_${vid}`,sel);
    await this.renderAutoView(this.dv,this.currentSettings,this.currentCtx,this.currentContainerEl);
  };
  container.appendChild(btn);
}
  private async applyTagFilter(pages:any[],note:string,vid:string){
    const tg=gs(note,vid,`tagFilter_${vid}`) || "ALL";
    if(tg==="ALL") return pages;
    return pages.filter(pg=>{
      const arr=pg?.file?.tags||pg?.tags;
      return Array.isArray(arr)&&arr.includes(tg);
    });
  }
  private buildSearchTextMap(props:any[],pages:any[]){
    const cols=props.filter((c:any)=>c.column);
    pages.forEach(pg=>{
      const buf:string[]=[];
      cols.forEach(c=>{
        let tv=c.prop==="title_link"?pg.__fmTitle||"":String(this.getVal(pg,c.prop)||"");
        buf.push(tv.toLowerCase());
      });
      pg.__searchText=buf.join(" ");
    });
  }
  private async filterProps(props:any[],pages:any[],note:string,vid:string){
    for(const p of props.filter((x:any)=>x.filter))
      pages=await this.filterByProp(p,pages,note,vid);
    pages = await this.applyTagFilter(pages,note,vid);
  
    const ready=gs(note,vid,`search_ready_${vid}`);
    if(ready){
      let q=(gs(note,vid,`search_${vid}`)||"").trim();
      if(q){
        this.buildSearchTextMap(props,pages);
        q.split(" ").forEach(w=>{
          w=w.trim().toLowerCase();
          if(w) pages=pages.filter(pg=>(pg.__searchText||"").includes(w));
        });
      }
    }
    return pages;
  }
  private paginate(arr:any[],per:number,note:string,vid:string){
    const key=`pagination_${vid}`;
    const total=per>0?Math.ceil(arr.length/per):1;
    let idx=gs(note,vid,key)??0;
    if(total===0) idx=0;
    else{
      if(idx<0) idx=0;
      if(idx>=total) idx=total-1;
    }
    if(!this.skipStateWrite && idx!==gs(note,vid,key))
      ss(note, vid, key, idx);      // 저장만
    return per>0?arr.slice(idx*per,(idx+1)*per):[...arr];
  }
  private async nextPageButton(total:number,key:string,note:string,vid:string){
    const cur=gs(note,vid,key)||0;
    const ok=cur+1<total;
    const btn=document.createElement("button");
    btn.className= ok ? "interactive_table-pagination__btn"
                      : "interactive_table-pagination__btn interactive_table-pagination__btn--disabled";
    btn.textContent=">>";
    btn.onclick=async()=>{
      if(!ok) return;
      await this.cb.sync(note, vid, key, cur+1);
    };
    return btn;
  }
  private async prevPageButton(total:number,key:string,note:string,vid:string){
    const cur=gs(note,vid,key)||0;
    const ok=cur>0;
    const btn=document.createElement("button");
    btn.className= ok ? "interactive_table-pagination__btn"
                      : "interactive_table-pagination__btn interactive_table-pagination__btn--disabled";
    btn.textContent="<<";
    btn.onclick=async()=>{
      if(!ok) return;
      await this.cb.sync(note, vid, key, cur-1);
    };
    return btn;
  }
  private async paginationBlock(data:any[],per:number,container:HTMLElement,note:string,vid:string){
    const key=`pagination_${vid}`;
    const total=per>0?Math.ceil(data.length/per):1;
    const wrap=document.createElement("div");
    wrap.className="interactive_table-pagination";
    wrap.appendChild(await this.prevPageButton(total,key,note,vid));
    const cur=gs(note,vid,key)??0;
    const span=document.createElement("span");
    span.textContent=total===0?"0 / 0":`${cur+1} / ${total}`;
    wrap.appendChild(span);
    wrap.appendChild(await this.nextPageButton(total,key,note,vid));
    container.appendChild(wrap);
  }

/*════════════════════════════════════════════
  #4  테이블 build (createTable)  – 변경 無
════════════════════════════════════════════*/
private async createTable(
  props:any[],pages:any[],container:HTMLElement,note:string,vid:string,
  per:number,settings:any){
  props=this.reorderProps(props);
  pages.forEach(pg=>{
    try{const dvPg=this.dv?.page(pg.file.path);pg.__fmTitle=dvPg?.frontmatter?.title||dvPg?.title||"";}
    catch{pg.__fmTitle=pg.frontmatter?.title||"";}
  });

  let filtered=await this.filterProps(props,pages,note,vid);

  const curSort=gs(note,vid,`sort_${vid}`);
  const curDir =gs(note,vid,`sort_direction_${vid}`)||"asc";
  if(!curSort)filtered.sort((a,b)=>a.__fmTitle.localeCompare(b.__fmTitle));
  else filtered=this.sortByProp(filtered,curSort,curDir);

  const disp=per?this.paginate(filtered,per,note,vid):[...filtered];

  const tbl=document.createElement("table");
  console.log("createTable ▶ rows", disp.length);
  tbl.classList.add("interactive_table-table","interactive_table-table--full");

  /* 헤더 */
  const widthClass:{[k:string]:string}={title_link:"interactive_table-table__col--title_link",tags:"interactive_table-table__col--tags"};
  const thead=tbl.createTHead();const htr=thead.insertRow();
  props.forEach(c=>{
    const th=document.createElement("th");
    th.textContent=c.name||c.prop;
    if(c.prop==="title_link"||c.prop==="tags")th.classList.add("interactive_table-table__header--static");
    else{th.classList.add("interactive_table-table__header--sortable");th.dataset.prop=c.prop;th.dataset.viewId=vid;}
    const wc=widthClass[c.prop];if(wc)th.classList.add(wc);
    htr.appendChild(th);
  });

  /* 행 */
  const tbody=tbl.createTBody();
  disp.forEach(pg=>{
    const tr=tbody.insertRow();
    props.forEach(c=>{
      const td=tr.insertCell();
      if(c.prop==="title_link"){
        const alias=(pg.__fmTitle||"").trim();
        const a=document.createElement("a");
        a.className="internal-link";a.setAttribute("href",pg.file.path);
        a.textContent=alias||pg.file.name;
        const wrap=document.createElement("div");
        wrap.className="interactive_table-table__cell--editable";wrap.dataset.path=pg.file.path;wrap.dataset.prop="title_link";wrap.appendChild(a);
        td.appendChild(wrap);return;
      }
      let val=this.getVal(pg,c.prop);
      if(Array.isArray(val)){
        if(c.prop==="tags"){
          const wrap=document.createElement("div");
          wrap.className="interactive_table-table__cell--editable";wrap.dataset.path=pg.file.path;wrap.dataset.prop=c.prop;
          val.forEach(item=>item.split(/\s+/).forEach(tk=>{
            if(!tk)return;const tag=tk.startsWith("#")?tk:`#${tk}`;const tagA=document.createElement("a");
            tagA.classList.add("tag","internal-link");tagA.textContent=tag;tagA.setAttribute("href",`#${tag.replace(/^#/,"")}`);
            tagA.style.marginRight="0.4em";wrap.appendChild(tagA);
          }));
          td.appendChild(wrap);return;
        } else val=val.join(" ");
      }
      if(c.prop==="published"){const d=this.parseDateYMD(val);val=d?d.getFullYear().toString():(val||"-");}
      else{val=this.formatAsDate(val);if(!val)val="-";}
      const wrap=document.createElement("div");
      wrap.className="interactive_table-table__cell--editable";wrap.dataset.path=pg.file.path;wrap.dataset.prop=c.prop;wrap.textContent=val;
      td.appendChild(wrap);
    });
  });
  container.appendChild(tbl);
  log("createTable ▶ appended into", container);

  /* 헤더 정렬 바인딩 */
  const hdrs=tbl.querySelectorAll<HTMLElement>(".interactive_table-table__header--sortable");
  const paint=(sp:string|null,sd:string)=>{
    hdrs.forEach(h=>h.classList.remove("sorted-asc","sorted-desc","sorted-none"));
    hdrs.forEach(h=>{
      const p=h.dataset.prop||"";if(!sp||sp!==p)h.classList.add("sorted-none");
      else h.classList.add(sd==="asc"?"sorted-asc":"sorted-desc");
    });
  };
  hdrs.forEach(h=>h.addEventListener("click",async()=>{
    const prop=h.dataset.prop||"";const sKey=`sort_${vid}`;const dKey=`sort_direction_${vid}`;
    let cSort=gs(note,vid,sKey);let cDir=gs(note,vid,dKey)||"asc";
    if(cSort!==prop){cSort=prop;cDir="asc";}
    else{if(cDir==="asc")cDir="desc";else{cSort=null;cDir="asc";}}
    paint(cSort,cDir);
    await this.cb.sync(note, vid, sKey, cSort);
    await this.cb.sync(note, vid, dKey, cDir);
  }));
  paint(curSort,curDir);

  return filtered;
}

/*════════════════════════════════════════════
  #5  renderView – pane 등록 / 상태 & 클린업  **REPLACE**
════════════════════════════════════════════*/
public async renderView(
  settings   : any,
  props      : any[],
  pages      : any[],
  dv         : any,
  containerEl?: HTMLElement
) {
  if (!dv || !Array.isArray(pages) || !containerEl) return;

  const note = this.currentCtx?.sourcePath ?? settings._notePath;
  if (!note) return;

  /* 컨텍스트 보존 */
  this.dv                 = dv;
  this.currentSettings    = settings;
  this.currentContainerEl = containerEl;

  /* 1) 탭-고유 viewId 재사용 */
  const vid = this.resolveViewId(settings);

  /* 2) Pane 등록 */
  const inst: StateInst = {
    viewId   : vid,
    notePath : note,
    dv,
    settings,
    ctx       : this.currentCtx,
    container : containerEl,
    rerender  : (passive = false) => this.rerender(passive),
  };
  tableState.addPane(inst);

/* 3) 탭이 닫힐 때 pane 해제  ***REPLACE*** */
const mo = new MutationObserver(() => {
  /* ⚠️ 탭(Leaf) 전환 시 DOM 노드가 잠깐 떼어졌다가
     곧바로 다시 붙습니다.  
     바로 removePane() 하면 첫-클릭이 먹히지 않는
     ‘한 번 무시’ 현상이 생기므로,  
     1-2 animation-frame(≈200 ms) 기다렸다가
     여전히 분리돼 있을 때만 pane 을 제거합니다. */
  if (!containerEl.isConnected) {
    setTimeout(() => {
      if (!containerEl.isConnected) {
        tableState.removePane(note, vid);
        mo.disconnect();
      }
    }, 200);          // ← 200 ms 유예
  }
});
mo.observe(
  containerEl.parentElement ?? document.body,
  { childList: true, subtree: true }
);

  /* 4) rows 준비 ─ 필터·검색·정렬·페이지 */
  const pagesReady = pages.map(pg => {
    const cp = { ...pg };
    try {
      const dvPg = dv.page(pg.file.path);
      cp.__fmTitle = dvPg?.frontmatter?.title || dvPg?.title || "";
    } catch {
      cp.__fmTitle = pg.frontmatter?.title || "";
    }
    return cp;
  });

  const filtered = await this.filterProps(props, pagesReady, note, vid);

  const curSort = gs(note, vid, `sort_${vid}`);
  const curDir  = gs(note, vid, `sort_direction_${vid}`) || "asc";
  const sorted  = !curSort
    ? [...filtered].sort((a, b) => a.__fmTitle.localeCompare(b.__fmTitle))
    : this.sortByProp([...filtered], curSort, curDir);

  const perPage  = settings["entries on page"] ?? 10;
  const showRows = perPage
    ? this.paginate(sorted, perPage, note, vid)
    : sorted;

  /* 5) 버튼 DOM 선작성 */
  const tagBtn = settings.showTagFilterButton === false
    ? null
    : await this.makeTagFilterButton(pagesReady, note, vid);

  const fmBtns = settings.showFrontmatterFilterButton === false
    ? []
    : await this.makeFrontmatterButtons(props, pagesReady, note, vid);

  /* 6) UIManager 호출 */
  this.ensureUI();
  await this.ui.buildView(
    containerEl,           // host <pre>
    note,
    vid,
    showRows,
    props,
    perPage,
    sorted.length,         // totalRows
    {
      showOpenFolderButton        : settings.showOpenFolderButton        ?? true,
      showNewNoteButton           : settings.showNewNoteButton           ?? true,
      showTagFilterButton         : settings.showTagFilterButton         ?? true,
      showFrontmatterFilterButton : settings.showFrontmatterFilterButton ?? true,
      showSearchBox               : settings.showSearchBox               ?? true,
      showRefreshButton           : settings.showRefreshButton           ?? true,
      folderPath                  : settings.path ?? null
    },
    fmBtns,
    tagBtn
  );
}


/*──────────────────────────────────────────────────────────────
  #1-D.  공용 rerender – 모든 재그리기 진입점
──────────────────────────────────────────────────────────────*/
/**
 * 현재 dv / settings / ctx / container 를 그대로 사용하여
 * 테이블을 다시 그린다.  
 * passive = true  → 상태(localStorage) 저장을 생략하고 화면만 갱신
 */
private async rerender(passive = false): Promise<void> {
  if (!this.dv || !this.currentCtx || !this.currentContainerEl) return;
  await this.renderAutoView(
    this.dv,
    this.currentSettings,
    this.currentCtx,
    this.currentContainerEl,
    passive
  );
}





/*────────────────────────────────────────────────────────────
  K. renderAutoView – 폴더의 md / canvas 자동 수집  **REPLACE**
────────────────────────────────────────────────────────────*/
public async renderAutoView(
  dv: any,
  settings: any = {},
  ctx?: MarkdownPostProcessorContext,
  containerEl?: HTMLElement,
  passive = false
) {
  this.debug(`renderAutoView  passive=${passive}`);

  /* 탭을 새로 열 때만 기본 상태로 초기화 */
  if (!settings.__viewId) settings.__wipeState = true;

  /* ─── ① passive-mode : 상태 재저장 차단 ─── */
  if (passive) this.skipStateWrite = true;
  if (this._rendering) return;
  this._rendering = true;

  try {
    if (!ctx?.sourcePath || !containerEl) return;

    /* 노트 경로 기록 */
    settings._notePath = ctx.sourcePath;

    /* 컨텍스트 보존 */
    this.currentCtx        = ctx;
    this.currentContainerEl = containerEl;

    /* 폴더 결정 */
    const folder = settings.path ??
      ctx.sourcePath.substring(0, ctx.sourcePath.lastIndexOf("/"));

    /* Dataview md pages 수집 */
    const mdPages = dv.pages()
      .where(p => p.file.folder === folder)
      .where(p => !this.isFolderNote(p))
      .array();

    /* canvas 파일 수집 */
    const canvasPages = this.app.vault.getFiles()
      .filter(f => f.extension === "canvas" && f.path.startsWith(folder + "/"))
      .map(f => ({
        file       : { path: f.path, link: dv.fileLink(f.path), folder },
        frontmatter: { title: f.basename },
        created    : "",
        status     : "",
        tags       : "#canvas"
      }));

    /* 컬럼 정의 */
    const mustTitle = { prop: "title_link", name: "Title", filter: false, column: true };
    const mustTags  = { prop: "tags",       name: "Tags",  filter: false, column: true };

    const finalProps: Array<any> = Array.isArray(settings.props)
      ? [
          mustTitle,
          ...settings.props
            .filter((p: any) => !["title_link", "tags"].includes(p.prop))
            .map((p: any) => ({
              ...p,
              filter : p.filter  ?? true,
              column : p.column ?? true
            })),
          mustTags
        ]
      : [
          mustTitle,
          { prop: "created", name: "Created", filter: true, column: true },
          mustTags
        ];

    /* 컨텍스트 보존 */
    this.dv              = dv;
    this.currentSettings = settings;
    this.currentProps    = finalProps;
    this.currentPages    = mdPages.concat(canvasPages);

    /* 실제 렌더 */
    await this.renderView(
      settings,
      finalProps,
      this.currentPages,
      dv,
      containerEl
    );

    console.log("renderAutoView ▶ END");
  } finally {
    this.skipStateWrite = false;
    this._rendering     = false;
  }
}

  /*────────────────────────────────────────────────────────────
    L. 인라인 편집 & Modal
  ────────────────────────────────────────────────────────────*/
  private async editProp(type:string,path:string,prop:string){
    const file=this.app.vault.getAbstractFileByPath(path);
    if(!file)return;
    if(type==="file name"&&file instanceof TFile){
      const old=file.basename;const nv=await this.textInput(old);if(!nv)return;
      const folder=file.parent?.path||"";const ext=file.extension;
      const newPath=folder?`${folder}/${nv}.${ext}`:`${nv}.${ext}`;
      await this.app.vault.rename(file,newPath);
    }
    await this.renderAutoView(this.dv,this.currentSettings,this.currentCtx,this.currentContainerEl);
  }

  private async textInput(def:string):Promise<string|null>{
    return new Promise(res=>{
      const { Modal }=(globalThis as any).coverTable.obsidian;
      class M extends Modal{
        result:string;constructor(app:App){super(app);this.result=def;}
        onOpen(){const {contentEl}=this;
          contentEl.createEl("h1",{text:"Input"});
          const inp=contentEl.createEl("input");inp.value=this.result;inp.style.width="100%";
          inp.addEventListener("keydown",ev=>{if(ev.key==="Enter"){this.result=inp.value.trim();this.close();res(this.result);}});
          const ok=contentEl.createEl("button",{text:"OK"});ok.onclick=()=>{this.result=inp.value.trim();this.close();res(this.result);};}
        onClose(){this.contentEl.empty();}
      }
      new M(this.app).open();
    });
  }
}

