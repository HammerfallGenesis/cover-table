/*****************************************************************
 * src/features/interactive-table/InteractiveTableController.ts
 *   – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  InteractiveTableController
 * ---------------------------------------------------------------
 *  • “애플리케이션 계층(Controller)” – 데이터(Model) ↔ UI(View) 중재
 *  • 주요 역할
 *      ① Dataview pages 수집(md + canvas)
 *      ② InteractiveTableModel 생성 및 재계산 요청
 *      ③ UIManager 에 계산 결과 전달 → 실제 DOM 렌더
 *      ④ 상태(tableState) 변경·동기화(Pagination / 필터 등)
 * ---------------------------------------------------------------
 *  ✨ 흐름 요약
 *      renderAutoView()
 *        ├─ gatherPages()   ← Dataview + vault 스캔
 *        ├─ buildColumns()  ← settings.props → ColumnDef[]
 *        ├─ new InteractiveTableModel(…)
 *        └─ ui.buildView(…model.displayRows,…)
 * =============================================================== */

import {
  App,
  TFile,
  MarkdownPostProcessorContext,
} from "obsidian";

import { UIManager, UITableCallbacks } from "../../ui/interactive-table/UIManager";
import TableController from "./services/TableController";
import { InteractiveTableModel,
         TableModelSettings       }     from "./InteractiveTableModel";
import type { ColumnDef }                    from "./types";
import { tableState, ViewInst as StateInst }   from "../../core/state/StateCenter";



/*──────────────────────────────────────────────────────────────
  0. tableState → 간이 Helper (gs / ss)
──────────────────────────────────────────────────────────────*/
function gs(note: string, vid: string, k: string) {
  return tableState.get(note, vid)?.[k] ?? null;
}
function ss(note: string, vid: string, k: string, v: any) {
  /* Pane(뷰) 가 살아 있으면 tableState.set 이용,
     아니면 localStorage 직접 갱신(↔ Pane closed) */
  const list = (tableState as any).paneMap.get(vid) as any[] | undefined;
  const inst = list?.[0];
  if (inst) {
    const silent = !!(inst as any).skipStateWrite;
    tableState.set(inst, { [k]: v }, false, silent);
    return;
  }
  const key = `coverTable::${note}::${vid}`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    data[k] = v;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    localStorage.setItem(key, JSON.stringify({ [k]: v }));
  }
}

function todayYMD(): string {
  const d = new Date();            // 시스템 날짜 (Asia/Seoul)
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`;
}

function injectCreated(page: any): any {
  // 이미 값이 있으면 그대로 두고, 없으면 오늘 날짜를 넣어 준다
  if (!page.created || page.created === "-") {
    const today = todayYMD();
    return { ...page, created: today, frontmatter:{ ...page.frontmatter, created: today } };
  }
  return page;
}

/** epoch millis → YYYY-MM-DD (Asia/Seoul) */
function epochToYMD(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${m<10?"0":""}${m}-${dd<10?"0":""}${dd}`;
}

/*──────────────────────────────────────────────────────────────
  1. Controller
──────────────────────────────────────────────────────────────*/
export class InteractiveTableController {
  /*──────── 필드 ────────*/
  private readonly cb   : UITableCallbacks;
  private readonly ui   : UIManager;
  private readonly svc  : TableController;
  private models        : Map<string, InteractiveTableModel> = new Map();
  private _rendering    = false;
  private skipStateWrite= false;     // rerender(passive) → 상태 재저장 차단

  /*──────── ctor ────────*/
  constructor(private readonly app: App) {
    /* ◇ 서비스 & UI 초기화 ────────────────────────── */
    this.svc = new TableController(app);            /* 💡 생성 */
    /* ◇ UI 콜백 정의 ──────────────────────────────── */
    this.cb = {
      /* 상태 */
  getState     : gs,
  setState     : ss,
  getLocalState: (n, v) => tableState.get(n, v) ,

      /* 유틸 */
      getVal       : (pg, prop) => this.svc.getVal(pg, prop),
      parseDateYMD : (s) => this.svc.parseDateYMD(s),
      formatAsDate : (v) => this.svc.formatAsDate(v),
      getSortValue : (v) => this.svc.getSortValue(v),
      suggester    : (vals) => this.svc.suggester(vals),

      /* 렌더 */
  rerender : async () => { await this.rerender(true); },
    sync: async (note, vid, key, val) => {
    ss(note, vid, key, val);
    await this.rerender(true, vid);
  },

      /* 전체 상태 초기화 */
  resetState: async () => {}
    };

    /* ◇ UIManager – 실제 View 구축 담당 */
    this.ui = new UIManager(app, this.cb);
    
  }

  

  /* ===========================================================
   *  renderAutoView()
   * -----------------------------------------------------------
   *  • Dataview API(dv) 와 settings 를 받아 자동으로 폴더 자료
   *    (md + canvas) 를 수집하고 테이블을 렌더
   *  • passive = true → 상태(localStorage) 재저장 차단
   * =========================================================== */
  public async renderAutoView(
    dv        : any,
    _settings  : TableModelSettings = {},
    ctx?      : MarkdownPostProcessorContext,
    hostPre?  : HTMLElement,
    passive   = false
  ) {
    const settings: TableModelSettings = { ..._settings };

      /* ▸ ② 호환성 패치 ↓↓↓ (이 블록 추가) */
  if (settings.perPage == null) {
    const legacyPer =
      (_settings as any)["entries on page"] ??
      (_settings as any).entries_on_page ??
      (_settings as any).entriesOnPage;
    if (legacyPer != null) settings.perPage = Number(legacyPer) || 0;
  }
    const c = ctx;
    const notePath = ctx?.sourcePath || "";

    if (this._rendering) return;
    this._rendering   = true;
    if (passive) this.skipStateWrite = true;

    let model: InteractiveTableModel | null = null;

    try {
      if (!ctx?.sourcePath || !hostPre) return;

/* viewId 결정 */
if (!hostPre.dataset.coverVid) {
  hostPre.dataset.coverVid = crypto.randomUUID();   // 창-고유 ID
  settings.__wipeState = true;                      // 새 창 → 상태 초기화
} else {
  settings.__wipeState = false;                     // 재렌더 시엔 false
}
settings.__viewId  = hostPre.dataset.coverVid;
settings._notePath = ctx.sourcePath;

/* pull saved page-size from tableState */
const savedPerPage = gs(notePath, settings.__viewId!, "perPage");
if (typeof savedPerPage === "number" && savedPerPage > 0) {
  settings.perPage = savedPerPage;
}




 /*──────── ① 페이지 수집 ────────*/
 const folder = settings.path ??
                ctx.sourcePath.substring(0, ctx.sourcePath.lastIndexOf("/"));

 /* 1) 일반 .md  ─ 폴더노트 제외 */
 const mdPages = dv.pages()
   .where((p:any)=>p.file.folder===folder)
   .where((p:any)=>!this.isFolderNote(p))
  .map((p:any)=> injectCreated({        // ← 여기
    ...p,
    file:{ ...p.file, basename: p.file.basename ?? p.file.name }
  }))
   .array();

 /* 2) .canvas  ─ Obsidian Canvas 파일 */
const canvasPages = this.app.vault.getFiles()
  .filter(f => f.extension === "canvas" && f.path.startsWith(folder + "/"))
  .map(f => {
    const ctime = epochToYMD(f.stat.ctime);
    return {
      file       : { path:f.path, link:dv.fileLink(f.path), folder, basename:f.basename },
      frontmatter: { title: f.basename },
      created    : ctime,          // ← 최초 생성일
      tags       : "#canvas"
    };
  });

/* 3) Excalidraw.md ------------------------------------------- */
const excaliPages = this.app.vault.getFiles()
  .filter(f => f.extension === "md"
            && f.basename.endsWith(".excalidraw")
            && f.path.startsWith(folder + "/"))
  .map(f => {
    const ctime = epochToYMD(f.stat.ctime);
    return {
      file       : { path:f.path, link:dv.fileLink(f.path), folder, basename:f.basename },
      frontmatter: { title: f.basename.replace(/\.excalidraw$/, "") },
      created    : ctime,          // ← 최초 생성일
      tags       : "#excalidraw"
    };
  });

 /* 4) 합치기 */
 const allPages = [...mdPages, ...canvasPages, ...excaliPages];


      /*──────── ② 컬럼 정의 ────────*/
      const mustTitle: ColumnDef = { prop:"__fmTitle",      name:"Title",  filter:false, column:true, format:"text" };
      const mustTags : ColumnDef = { prop:"tags",       name:"Tags",   filter:false, column:true, format:"tags" };

      const custom   = Array.isArray(settings.props) ? settings.props : [];
      const columns: ColumnDef[] = [
        mustTitle,
        ...custom
          .filter((p: ColumnDef) => !["title_link","tags"].includes(p.prop))
          .map(p => ({ ...p,
            filter : p.filter  ?? true,
            column : p.column ?? true,
            format : (p as any).format ?? "text" 
          })),
        mustTags
      ];

      /*──────── ③ Model 생성 / 재계산 ────────*/
settings.___refreshHook = async (p = false) => {
  await this.renderAutoView(dv, settings, ctx, hostPre, p);
};
      model = new InteractiveTableModel(
        dv,
        allPages,
        columns,
        ctx,
        settings,
        hostPre
      );

      
hostPre.setAttribute("data-cover-view", model["viewId"]);   // ▶★★ 추가
this.models.set(model["viewId"], model);   // ← 반드시 넣어 주세요!

      await model.compute(passive); 

      /* ▼▼▼  이 블록을 바로 아래에 삽입 ▼▼▼ */
      const fmCandidates = columns
        .filter(c => c.filter)
        .map(c => {
          const vals = [...new Set(
            model!.filteredRows.map(r => {
              const raw = this.svc.getVal(r, c.prop);
              switch (c.format) {
                case "date": {
                  const ymd = model!.normalizeYMD(raw);
                  return ymd ?? "-";
                }
                case "year": {
                  const y = typeof raw === "number"
                    ? String(raw)
                    : String(raw).match(/\d{4}/)?.[0];
                  return y ?? "-";
                }
                default:
                  return String(raw ?? "-");
              }
            })
          )].sort((a,b)=>String(a).localeCompare(String(b)));
          return { prop: c.prop, values:["ALL", ...vals] };
        });

      const tagCandidates = (() => {                     // 태그 후보
        const set = new Set<string>();
        model.filteredRows.forEach(r =>
  (Array.isArray(r.file?.tags) ? r.file!.tags
   : Array.isArray(r.tags)      ? r.tags
   : [r.file?.tags ?? r.tags]   // 문자열 → 배열
  ).forEach((t:string)=>set.add(t))
        );
        return set.size ? ["ALL", ...[...set].sort()] : null;
      })();

      /*──────── ③-B.  front-matter & 태그 후보 목록 만들기 ────────*/
      const fmFilters = columns
        .filter(c => c.filter)
        .map(c => {
          const vals = [...new Set(
            model!.filteredRows.map(pg => {
              const raw = this.svc.getVal(pg, c.prop);
              switch (c.format) {
                case "date": {
                  const ymd = model!.normalizeYMD(raw);
                  return ymd ?? "-";
                }
                case "year": {
                  const y = typeof raw === "number"
                    ? String(raw)
                    : String(raw).match(/\d{4}/)?.[0];
                  return y ?? "-";
                }
                default:
                  return String(raw ?? "-");
              }
            })
          )].sort((a,b)=>String(a).localeCompare(String(b)));
          return { prop: c.prop, values:["ALL", ...vals] };
        });
      
      /** ② 태그 후보 목록 */
      const tagSet = new Set<string>();
      model.filteredRows.forEach(pg => {
        (pg.file?.tags ?? pg.tags ?? []).forEach((t: string) => tagSet.add(t));
      });
      const tagFilter = tagSet.size ? ["ALL", ...[...tagSet].sort()] : null;

      /*──────── ④ UI 렌더 ────────*/
      /* ▸▸ view 전용 콜백 만들기 ▸▸ */
      const scopedCb = this.makeScopedCb(settings._notePath!, model["viewId"]);
      await this.ui.buildView(
        hostPre,
        settings._notePath!,
        model["viewId"],
        model.displayRows,
        columns,
        settings.perPage ?? 10,
        model.totalRows,
        {
          showOpenFolderButton        : settings.showOpenFolderButton        ?? true,
          showNewNoteButton           : settings.showNewNoteButton           ?? true,
          showTagFilterButton         : settings.showTagFilterButton         ?? true,
          showFrontmatterFilterButton : settings.showFrontmatterFilterButton ?? true,
          showSearchBox               : settings.showSearchBox               ?? true,
          showRefreshButton           : settings.showRefreshButton           ?? true,
          folderPath                  : settings.path ?? null
        },
        fmCandidates,   // ← ③-B 에서 만든 front-matter 후보
        tagCandidates,    // ← 태그 후보 (없으면 null)
        scopedCb         // ★ 마지막 인수로 콜백 전달
      );
    } finally {
      this.skipStateWrite = false;
      this._rendering     = false;
    }
  }

  /* ===========================================================
   *  rerender(passive) – 현재 Model 재계산 & UI만 갱신
   * =========================================================== */
  private async rerender(passive = false, vid?: string) {
    while (this._rendering) {
      await new Promise(r => setTimeout(r, 15));
    }

  const tgt = vid ? this.models.get(vid) : null;
  if (tgt) {
    const pp = gs(tgt["settings"]._notePath!, tgt["viewId"], "perPage");
    if (typeof pp === "number" && pp > 0) tgt["settings"].perPage = pp;
  }

  /* ① 명시적으로 넘어온 vid 가 있으면 그 Pane만 갱신 */
  const model = vid
    ? this.models.get(vid)
    : (() => {
        const host = (event?.target as HTMLElement)?.closest?.("[data-cover-view]");
        const hvid = host ? (host as HTMLElement).dataset.coverView : null;
        return hvid ? this.models.get(hvid)                // ② DOM 이벤트 발생 Pane
                    : [...this.models.values()].pop();     // ③ fallback
      })();
    if (!model) return;

    await model.compute(passive);
    await this.renderAutoView(
      model["dv"],
      model["settings"],
      model["ctx"],
      model["host"],
      passive
    );
    /* models 맵에서 화면에 더 존재하지 않는 Pane 제거 */
   this.models.forEach((m, id) => {
     if (!document.body.contains(m.host)) this.models.delete(id);
   });
  }

  /* ===========================================================
   *  📦  Util (날짜 파싱 / 정렬 값 등)
   * =========================================================== */

  /** Dataview Page → 임의 값 (누락 때문에 생긴 TypeError 수정) */
public getVal(page: any, prop: string): any {
  /* ① Title 전용 커스텀 처리 ---------------------------------- */
  if (prop === "__fmTitle") {
    // 1) front-matter
    const fmTitle = page?.frontmatter?.title ?? page?.title;
    if (fmTitle && String(fmTitle).trim() !== "") return fmTitle;

    // 2) 파일명 (Excalidraw 확장자 제거)
    const base = page?.file?.basename ?? "";
    return base.replace(/\.excalidraw$/, "");
  }

  /* ② 기존 코드 (그대로 유지) --------------------------------- */
  return prop.startsWith("file.")
    ? prop.split(".").reduce((v, k) => v?.[k], page)
    : page[prop];
}

  private readonly dateYMDRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  private readonly timeHMRegex  = /^(\d{1,2}):(\d{1,2})$/;

  private parseDateYMD(str: string) {
    if (typeof str !== "string") return null;
    const m = str.match(this.dateYMDRegex);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y<1000||y>9999||mo<1||mo>12||d<1||d>31) return null;
    return new Date(y, mo-1, d);
  }

  private parseTimeHM(str: string) {
    if (typeof str !== "string") return null;
    const m = str.match(this.timeHMRegex);
    if (!m) return null;
    const hh=+m[1], mm=+m[2];
    if (hh>23||mm>59) return null;
    const dt=new Date(); dt.setHours(hh,mm,0,0); return dt;
  }

  private formatAsDate(v: any) {
    if (v == null) return "";
    const d = this.parseDateYMD(String(v));
    if (!d) return String(v);
    const y=d.getFullYear(), m=d.getMonth()+1, dd=d.getDate();
    return `${y}-${m<10?"0":""}${m}-${dd<10?"0":""}${dd}`;
  }

  private getSortValue(v: any) {
    if (v==null) return "";
    const s = typeof v==="string"?v:String(v);
    const d = this.parseDateYMD(s) || this.parseTimeHM(s);
    if (d) return d.getTime();
    const n = parseFloat(s);
    return isNaN(n) ? s.toLowerCase() : n;
  }

  private async suggester(values: string[]): Promise<string|null> {
    /* Obsidian 기본 Suggester 사용 – 사용자 편의 */
    return this.svc.suggester(values);
  }

  /* ===========================================================
   *  🔍 Helper – “folder Note” 여부
   * =========================================================== */
private isFolderNote(p: any) {
  const f = p?.file;
  if (!f?.path || f.folder == null) return false;

  // 1) 파일 베이스네임: Dataview가 이미 제공
  const base = f.basename ?? f.path.substring(
    f.path.lastIndexOf("/") + 1,
    f.path.lastIndexOf(".")
  );

  // 2) 폴더의 "마지막 세그먼트"만 추출
  const folderName = f.folder.split("/").pop() ?? "";

  return base === folderName;
}


  /** 현재 note + view 에 바인딩된 콜백 생성 */
private makeScopedCb(note: string, vid: string): UITableCallbacks {
  return {
    ...this.cb,                           // 기존 기능 재사용
    rerender : async () => {              // ← vid 고정
      await this.rerender(true, vid);
    },
    sync     : async (_, __, key, val) => {
      ss(note, vid, key, val);            // note/vid 고정
      await this.rerender(true, vid);
    },
    getState : (n, v, k) => gs(n ?? note, v ?? vid, k),
    setState : (n, v, k, val) => ss(n ?? note, v ?? vid, k, val),
  };
}

}

/*──────────────────────────────────────────────────────────────
  📌  참고
      • render / 필터 / 정렬 전체 로직은 legacy InteractiveTable.ts
        (#0~#3 구역) 을 그대로 포팅하였다.  :contentReference[oaicite:0]{index=0}
      • UI 구성은 ui.ts – UIManager.buildView() 와 1:1 연동됨. :contentReference[oaicite:1]{index=1}:contentReference[oaicite:2]{index=2}
      • tableState 동기화 전략은 StateCenter.set() 과 동일. :contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}
──────────────────────────────────────────────────────────────*/
