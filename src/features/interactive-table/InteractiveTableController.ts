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
  TAbstractFile
} from "obsidian";

import { UIManager, UITableCallbacks } from "../../ui/interactive-table/UIManager";
import TableController from "./services/TableController";
import { InteractiveTableModel,
         TableModelSettings       }     from "./InteractiveTableModel";
import type { ColumnDef }                    from "./types";
import { tableState, ViewInst as StateInst }   from "../../core/state/StateCenter";
import { EventBus } from "../../core/events/EventBus";
import { Log } from "./utils/log";



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
// created 값이 없으면 “파일 생성일(ctime)”로 고정
if (!page.created || page.created === "-") {
  const born =
    /* Dataview 0.5↑: Luxon DateTime 객체 */
    page.file?.cday?.toISODate?.() ??
    page.file?.ctime?.toISODate?.() ??
    /* Dataview 0.4↓: epoch 숫자 */
    (typeof page.file?.ctime === "number"
      ? epochToYMD(page.file.ctime)
      : todayYMD());            // ↙ 최후 fallback

  return {
    ...page,
    created: born,
    frontmatter: { ...page.frontmatter, created: born }
  };
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
  private refreshTimer : number | null = null;  // debounced refresh
  private skipStateWrite= false;     // rerender(passive) → 상태 재저장 차단

  /*──────── ctor ────────*/
  constructor(private readonly app: App) {
    /* ◇ 서비스 & UI 초기화 ────────────────────────── */
    this.svc = new TableController(app);            /* 💡 생성 */


    /* ◇  전역 RefreshBus 구독  ─────────────────────── */
    const busCb = (file?: TFile) => this.refreshByBus(file);
    EventBus.i.on(busCb);
    /* 언로드 대비 */
    (this as any).__cover_unload__ = () => EventBus.i.off(busCb);






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




/* ◆ 탭 헤더 클릭 → cover-view refresh */
/* ── 탭 헤더 클릭 → cover-view refresh ──────────────────── */
this.app.workspace.containerEl.addEventListener(
  "click",
  (evt) => {
    if (!(evt.target as HTMLElement)
          .closest(".workspace-tab-header.tappable")) return;

    /* ★ ① 바로 실행하지 말고, leaf 가 완전히 교체된 이후로 미룬다 */
    setTimeout(() => {                     // ← 0.1-0.2 s 정도면 충분
      const host = this.app.workspace.activeLeaf?.view
        ?.containerEl?.querySelector?.("[data-cover-view]") as HTMLElement|null;
      if (!host) return;                   // 여전히 없으면 아무 일도 안 함

      const vid  = host.dataset.coverView!;
      const note = (this.app.workspace.activeLeaf?.view as any)?.file?.path ?? "";

      /* ② ALL 버튼과 ‘완전히 동일한’ 트리거 호출 */
      this.cb.sync(
        note,                              // notePath
        vid,                               // viewId
        // 아무 filter key 나 하나 골라 “ALL” 로 던지면 기존 로직이 rerender
        `tagFilter_${vid}`,                // ← 존재하는 키
        "ALL"
      );
    }, 180);   // ← delay; 150-200 ms 사이 아무 값 OK
  },
  true   // capture
);










  }

/*───────────────────────────────────────────────
  탭 헤더(click) → 모든 cover-view 강제 rerender
───────────────────────────────────────────────*/
private handleWorkspaceTabClick = (e: MouseEvent): void => {
  /* ① 실제 탭 헤더 영역인지 판별 */
  const header = (e.target as HTMLElement)
    .closest(".workspace-tab-header.tappable");
  if (!header) return;

  /* ② 화면에 존재하는 모든 cover-view 순회 */
  document.querySelectorAll<HTMLElement>("[data-cover-view]").forEach(el => {
    const vid = el.dataset.coverView!;
    /* models 에 이미 등록돼 있으면 바로 rerender  */
    if (this.models.has(vid)) {
      this.rerender(true, vid);          // ← Filter ‘ALL’ 과 같은 경로
      return;
    }

    /* (드물게) 탭이 새로 열렸는데 models 에 아직 없다면:
       – viewId 를 이용해 최초 render 후 다시 rerender */
    const mdl = [...this.models.values()].find(m => !m["host"].isConnected);
    if (mdl) this.rerender(true, mdl["viewId"]);
  });
};









  

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
hostPre.dataset.coverSettings = JSON.stringify(settings);

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
      tags       : "#category/canvas"
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
 const allPages = [...canvasPages, ...mdPages, ...excaliPages];


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
          return { prop: c.prop, name: c.name, values:["ALL", ...vals] };
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
           return { prop: c.prop, name: c.name, values:["ALL", ...vals] };
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
          showNewCanvasButton         : settings.showNewCanvasButton  ?? true,  // ★
          showTagFilterButton         : settings.showTagFilterButton         ?? true,
          showFrontmatterFilterButton : settings.showFrontmatterFilterButton ?? true,
          showSearchBox               : settings.showSearchBox               ?? true,
          showRefreshButton           : settings.showRefreshButton           ?? false,
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
    Log.d(`[CT] rerender(${vid ?? "auto"}) ▶ passive=${passive}`);
    while (this._rendering) {
      await new Promise(r => setTimeout(r, 15));
    }
    


    
let model: InteractiveTableModel | undefined = vid
    ? this.models.get(vid)
    : (() => {
        const host = (event?.target as HTMLElement)?.closest?.("[data-cover-view]");
        const hvid = host ? (host as HTMLElement).dataset.coverView : null;
        return hvid ? this.models.get(hvid)                // ② DOM 이벤트 발생 Pane
                    : [...this.models.values()].pop();     // ③ fallback
      })();

/* ──── ★★★ self-heal 시작 ★★★ ──── */
if (!model && vid) {
  const host = document.querySelector<HTMLElement>(
                `[data-cover-view="${vid}"]`);
  if (host) {
    // 1. Dataview API 얻기
    const dvApi = (this.app as any)
                    .plugins?.plugins?.dataview?.api;
    if (dvApi) {
      // 2. Dataview 인덱스 완료를 보장
      const mc: any = this.app.metadataCache;
      if (!mc.resolved) {
        await new Promise<void>(res => mc.once?.("resolved", res));
      }
      // 3. 첫 번째 renderAutoView 실행 → model 등록
      await this.renderAutoView(
        dvApi,                 // ← Dataview
        host.dataset.coverSettings
          ? JSON.parse(host.dataset.coverSettings)
          : {},                // 저장된 설정 복원
        { sourcePath:
            (host.closest(".markdown-preview-view") as any)?.file?.path ?? ""
        } as any,              // 최소 ctx
        host,                  // hostPre
        true                   // passive=true (상태 보존)
      );
      model = this.models.get(vid);   // 방금 생긴 model 회수
    }
  }
}
/* ──── ★★★ self-heal 끝 ★★★ ──── */




  /* perPage 복원 */
  if (model) {
    const pp = gs(model["settings"]._notePath!, model["viewId"], "perPage");
    if (typeof pp === "number" && pp > 0) model["settings"].perPage = pp;
  }

  /* ② host 가 살아 있는지 확인 */
  if (model && !document.body.contains(model["host"])) {
    /* 동일 viewId 를 가진 새 host 탐색 */
    const fresh = document.querySelector(
      `[data-cover-view="${model["viewId"]}"]`,
    ) as HTMLElement | null;

    if (fresh) {
      (model as any)["host"] = fresh;          // host 교체
    } else {
      this.models.delete(model["viewId"]); // 유령 제거
      model = undefined;
    }
  }
  if (!model) {
    Log.d("[CT] rerender – model not found -> abort");
    return; 
  }                // 대상 없음 → 종료

    Log.time(`[CT] compute+render ${vid}`);
    await model.compute(passive);
    await this.renderAutoView(
      model["dv"],
      model["settings"],
      model["ctx"],
      model["host"],
      passive
    );
    Log.timeEnd(`[CT] compute+render ${vid}`);
    /* models 맵에서 화면에 더 존재하지 않는 Pane 제거 */
/* ① 지금 갱신 중인 뷰는 절대 지우지 않는다 */
const keeping = model["viewId"];

/* ② 300 ms 뒤에 한 번 더 확인 후 삭제
      (탭 전환으로 잠시 떨어졌다 다시 붙는 상황 방지) */
setTimeout(() => {
  this.models.forEach((m, id) => {
    if (id === keeping) return;                    // 현재 모델 보존
    if (!document.body.contains(m.host)) this.models.delete(id);
  });
}, 300);

   
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
rerender : async (_n = note, _v = vid) => {
  await this.rerender(true, _v);
},
    sync     : async (_, __, key, val) => {
      ss(note, vid, key, val);            // note/vid 고정
      await this.rerender(true, vid);
    },
    getState : (n, v, k) => gs(n ?? note, v ?? vid, k),
    setState : (n, v, k, val) => ss(n ?? note, v ?? vid, k, val),
  };
}

/* ===========================================================
 *  Global EventBus → passive rerender (FINAL & STABLE)
 * ========================================================= */
private refreshByBus(file?: TFile) {
  /* ── 0. Debounced render – 중복 호출 방지 ── */
  const renderDebounced = () => {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.models.forEach((_, vid) => this.rerender(true, vid));
      this.refreshTimer = null;
    }, 80);
  };


  /* ── 1. 폴더 필터 검사 ─────────────────────── */
  if (file && this.models.size) {
    const first = this.models.values().next().value as
                  InteractiveTableModel | undefined;
    if (first) {
      const folder = first["settings"].path ??
                     first["ctx"].sourcePath.replace(/\/[^/]+$/, "");
      if (!file.path.startsWith(folder + "/")) return;   // 다른 폴더
    }
  }

  /* 1-B. models 가 비어 있는데 host 가 화면에 존재 → 최초 Pane 등록 */
  if (!this.models.size) {
    document
      .querySelectorAll("[data-cover-view]")
      .forEach((h) => {
        const vid = (h as HTMLElement).dataset.coverView!;
        if (!this.models.has(vid)) {
          /* 첫 렌더는 Controller.renderAutoView 내부에서 자동 등록됨
             → 여기서는 models.size==0 일 때 만 호출되므로 skip */
        }
      });
  }

  /* ── 2. Dataview cache 확인 & 대기 ──────────── */
  if (file) {
    const mc: any = this.app.metadataCache as any;
    const parsed  = mc.getFileCache(file)?.frontmatter != null;

    if (!parsed) {
      /* 아직 파싱 전 → resolved 1-shot */
      const ref = mc.on("resolved", () => {
        mc.offref(ref);
        renderDebounced();
      });
      return;               // 📌 대기만 하고 종료
    }
  }

  /* ── 3. 즉시(또는 debounce) 렌더 ─────────────── */
  renderDebounced();
}

}





/*──────────────────────────────────────────────────────────────
  📌  참고
      • render / 필터 / 정렬 전체 로직은 legacy InteractiveTable.ts
        (#0~#3 구역) 을 그대로 포팅하였다.  :contentReference[oaicite:0]{index=0}
      • UI 구성은 ui.ts – UIManager.buildView() 와 1:1 연동됨. :contentReference[oaicite:1]{index=1}:contentReference[oaicite:2]{index=2}
      • tableState 동기화 전략은 StateCenter.set() 과 동일. :contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}
──────────────────────────────────────────────────────────────*/
