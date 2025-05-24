/*****************************************************************
 * src/features/interactive-table/InteractiveTableModel.ts
 *   – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  InteractiveTableModel
 * ---------------------------------------------------------------
 *  · “데이터/상태 계층”만 전담하는 순수 Model
 *  · UI 는 UIManager 로 분리되어 있으며, Model 은
 *    ① Dataview 페이지 수집
 *    ② 필터·검색·정렬·페이지네이션
 *    ③ pane-state(localStorage + BroadcastChannel) 동기화
 *    ④ 유틸(날짜 파싱, 정렬 값 계산 등)
 *  · Obsidian API 의존을 최소화(App 참조 O/X 모두 허용)
 * =============================================================== */

import type { MarkdownPostProcessorContext } from "obsidian";
import type { ColumnDef }                    from "./types";
import { tableState }                        from "../../core/state/StateCenter";
import { normalizeTags } from "./utils/tag";
import { Log } from "./utils/log";


/* ───────────────────────── 타입 ───────────────────────── */
export interface TableModelSettings {
  /** 1 페이지당 행 수(0 또는 음수 ⇒ paging OFF) */
  perPage?: number;
  /** Dataview 쿼리 path override */
  path?   : string;
  /** 태그 필터 버튼 노출 여부 */
  showTagFilterButton?: boolean;
  /** front-matter 필터 버튼 노출 여부 */
  showFrontmatterFilterButton?: boolean;
  alwaysPopout?: boolean;     // ★ 행 단일 클릭 시 pop-out 강제 여부
  /** 초기 wipe (Gantt ↔ IT 전환 등) */
  __wipeState?: boolean;
  /** 탭-로컬 viewId (자동 주입) */
  __viewId?: string;
  /** 현재 노트 경로(자동 주입) */
  _notePath?: string;
  /** 기타 사용자 정의 키 */
  [k: string]: any;
}

/* ────────────────────── 상수 & 헬퍼 ────────────────────── */

/** 랜덤 UUID(polyfill) */
function uuid() {
  return (crypto as any)?.randomUUID
    ? crypto.randomUUID()
    : `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** tableState 래퍼 – get */
function gs(note: string, vid: string, k: string) {
  return tableState.get(note, vid)?.[k] ?? null;
}

/** tableState 래퍼 – set (pane 존재 여부에 따라 echo 차단) */
function ss(note: string, vid: string, k: string, v: any) {
  const arr  = (tableState as any).paneMap.get(vid) as any[] | undefined;
  const inst = arr?.[0];

  /* ① Pane 존재 → 정상 로직 */
  if (inst) {
    const silent = !!(inst as any).skipStateWrite;
    tableState.set(inst, { [k]: v }, false, silent);
    return;
  }

  /* ② Pane 닫힘 → storage 직접 쓰기 */
  const key = `coverTable::${note}::${vid}`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    data[k] = v;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    localStorage.setItem(key, JSON.stringify({ [k]: v }));
  }
}

/* ===============================================================
 *  1. InteractiveTableModel
 * =============================================================== */
export class InteractiveTableModel {
  /*──────── 필드 ────────*/
  public readonly host: HTMLElement;
  private readonly notePath : string;
  private readonly viewId   : string;
  private readonly dv       : any;
  private          pages    : any[];
  private          columns  : ColumnDef[];
  private readonly ctx      : MarkdownPostProcessorContext;
  private readonly settings : TableModelSettings;
  public filteredRows: any[] = [];

/*──────── ctor ────────*/
constructor(
  dv: any,
  pages: any[],
  columns: ColumnDef[],
  ctx: MarkdownPostProcessorContext,
  settings: TableModelSettings,
  host: HTMLElement,
) {
  if (!ctx?.sourcePath) throw new Error("ctx.sourcePath missing");

  /* ── 0. 필드 저장 ───────────────────── */
  this.dv        = dv;
  this.pages     = pages;
  this.columns   = columns;
  this.ctx       = ctx;
  this.settings  = settings;
  this.notePath  = ctx.sourcePath;
  this.host      = host;

  /* ── 1. viewId 먼저 확보 (⚠️ 순서 중요) ─ */
  this.viewId = settings.__viewId ?? (settings.__viewId = uuid());

  /* ── 2. leafEl 탐색 ──────────────────── */
  const leafEl = host.closest(".workspace-leaf") as HTMLElement | null;

  /* ── 3. pane 등록 (leaf 가 있을 때만) ─ */
  if (leafEl) {
    tableState.addPane({
      viewId   : this.viewId,
      notePath : this.notePath,
      dv,
      settings,
      ctx,
      container: host,
      leafEl,
      rerender    : async p => await this.compute(p),
      refreshView : async p => await settings.___refreshHook?.(p),
    });
  } else {
    Log.w("[Cover-Table] workspace-leaf not found – skip pane registration");
  }
}
  /* ===========================================================
   * 2. 외부 노출 API
   * =========================================================== */

  /** 현재 뷰에 표시할 “페이지네이션 적용 후” 배열 */
  public displayRows: any[] = [];
  /** 필터/검색/정렬 적용 전 전체 행 수 */
  public totalRows  = 0;

  /** Model 내부 상태를 재계산하고 결과를 갱신한다. */
  async compute(passive = false) {
    /* ① copy & 정규화 */
    const cloned = this.pages.map((pg,idx) => {

  const cp:any = { ...pg, __idx:idx };

  /* tags 배열 강제 */
  cp.tags = Array.isArray(pg.tags) ? pg.tags
          : Array.isArray(pg.file?.tags) ? pg.file.tags
          : pg.tags ? [pg.tags] : [];

  /* — Title 결정 — */
  const dvPg = (() => {
    try { return this.dv.page(pg.file.path); }
    catch { return null; }
  })();

  /* 파일명 안전 추출 */
 /* file.basename 은 Controller 에서 항상 주입됨 */
  const baseName = pg.file?.basename ?? "";

  const fileTitle =
      baseName.endsWith(".excalidraw")
        ? baseName.slice(0, -".excalidraw".length)
        : baseName || "-";

  cp.__fmTitle =
      dvPg?.frontmatter?.title
   ?? dvPg?.title
   ?? pg.frontmatter?.title
   ?? fileTitle;

      return cp;
    });

    /* ② 필터·검색 */
    let fine = await this.applyAllFilters(cloned);

    /* ③ 정렬 */
    fine = this.applySort(fine);

    this.filteredRows = fine;

    this.totalRows = fine.length;

    /* ④ pagination */
    const per = this.settings.perPage ?? 10;
    this.displayRows = per > 0 ? this.paginate(fine, per, passive) : fine;
  }

  /* ===========================================================
   * 3. 필터 / 검색
   * =========================================================== */

  /** 전체 필터 (프론트매터 + 태그 + 검색) */
  private async applyAllFilters(pages: any[]): Promise<any[]> {
    /* front-matter 프로퍼티별 필터 */
    for (const col of this.columns.filter(c => c.filter)) {
      pages = await this.filterByProp(col, pages);
    }

    /* 태그 필터 */
    pages = await this.applyTagFilter(pages);

    /* 텍스트 검색 */
    pages = this.applySearch(pages);

    return pages;
  }

  /** 프론트매터 프로퍼티 단일 필터 */
  private async filterByProp(c: ColumnDef, pages: any[]): Promise<any[]> {
    const key = `filter_${this.viewId}_${c.prop}`;
    const val = gs(this.notePath, this.viewId, key);
    if (!val || val === "ALL") return pages;

    /* 후보-리스트에서 사용한 것과 동일한 규칙으로 normalize */
    const normalize = (raw: any) => {
      switch (c.format) {
        case "date": {
  const ymd = this.normalizeYMD(raw);
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
    };

    return pages.filter(pg => normalize(this.getVal(pg, c.prop)) === val);
  }

  /** 태그 필터 */
  private async applyTagFilter(pages: any[]) {
    const tg = gs(this.notePath, this.viewId, `tagFilter_${this.viewId}`) || "ALL";
    if (tg === "ALL") return pages;
    return pages.filter(pg => {
const arr = Array.isArray(pg.file?.tags) ? pg.file!.tags
          : Array.isArray(pg.tags)       ? pg.tags
          : [pg.file?.tags ?? pg.tags];
return arr.includes(tg);
    });
  }

  /** 텍스트 검색 */
  private applySearch(pages: any[]) {
    const ready = gs(this.notePath, this.viewId, `search_ready_${this.viewId}`);
    if (!ready) return pages;

    const q = (gs(this.notePath, this.viewId, `search_${this.viewId}`) || "")
      .trim()
      .toLowerCase();
    if (!q) return pages;

    /* 인덱스 구축(열 값 모두 lower-join) */
    const cols = this.columns.filter(c => c.column);
    pages.forEach(pg => {
      const buf: string[] = [];
      cols.forEach(c => {
        let tv =
          c.prop === "title_link"
            ? pg.__fmTitle || ""
            : String(this.getVal(pg, c.prop) || "");
        buf.push(tv.toLowerCase());
      });
      pg.__searchText = buf.join(" ");
    });

    return pages.filter(pg =>
      q
        .split(" ")
        .every((w:string) => w && (pg.__searchText || "").includes(w.toLowerCase())),
    );
  }

  /* ===========================================================
   * 4. 정렬 / 페이지네이션
   * =========================================================== */

  private applySort(arr: any[]) {
    const prop = gs(this.notePath, this.viewId, `sort_${this.viewId}`);
    const dir  = gs(this.notePath, this.viewId, `sort_direction_${this.viewId}`);

    if (!prop || !dir) return arr.sort((a,b)=>a.__idx - b.__idx);

    /* ① 정렬키 없으면 → 원본 순서(__idx) */
    if (!prop) return arr.sort((a,b)=>a.__idx - b.__idx);

    const col = this.columns.find(c => c.prop === prop);
    const fmt = col?.format ?? "text";

    return arr.sort((a, b) => {
      const A = this.getSortValue(this.getVal(a, prop), fmt);
      const B = this.getSortValue(this.getVal(b, prop), fmt);

      const cmp = (typeof A === "number" && typeof B === "number")
      ? A - B
      : JSON.stringify(A).localeCompare(JSON.stringify(B),"ko");
    
      return dir==="asc" ? cmp : -cmp;
    });
  }

  private paginate(arr: any[], per: number, passive: boolean) {
    const key   = `pagination_${this.viewId}`;
    const total = per > 0 ? Math.ceil(arr.length / per) : 1;

    let idx = gs(this.notePath, this.viewId, key) ?? 0;
    if (total === 0) idx = 0;
    else {
      if (idx < 0) idx = 0;
      if (idx >= total) idx = total - 1;
    }

    if (!passive && idx !== gs(this.notePath, this.viewId, key))
      ss(this.notePath, this.viewId, key, idx);

    return per > 0 ? arr.slice(idx * per, (idx + 1) * per) : [...arr];
  }

  /* ===========================================================
   * 5. 유틸 (날짜 파싱 / 정렬 값 계산 등)
   * =========================================================== */

  private readonly dateYMDRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  private readonly isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})T/;
  private readonly timeHMRegex  = /^(\d{1,2}):(\d{1,2})$/;

  private parseDateYMD(str: string) {
    if (typeof str !== "string") return null;
    const m = str.match(this.dateYMDRegex);
    if (!m) return null;
    const y = +m[1],
      mo = +m[2],
      d = +m[3];
    if (y < 1000 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d);
  }

  /** ISO(yyyy-mm-ddThh…)·short(yyyy-m-d) → "yyyy-m-d" */
public normalizeYMD(str: any): string | null {
  if (!str) return null;
  const s = String(str).split("T")[0];             // "yyyy-mm-dd"
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return `${+m[1]}-${+m[2]}-${+m[3]}`;             // 숫자 → 0 제거
}


  private parseTimeHM(str: string) {
    if (typeof str !== "string") return null;
    const m = str.match(this.timeHMRegex);
    if (!m) return null;
    const hh = +m[1],
      mm = +m[2];
    if (hh > 23 || mm > 59) return null;
    const dt = new Date();
    dt.setHours(hh, mm, 0, 0);
    return dt;
  }

/** v 값과 format 을 받아 정렬용 프리미티브 반환 */
/** 정렬용 Key 생성 ─ 모든 format 공통 */
private getSortValue(
  v: any,
  fmt: "text" | "num" | "date" | "year" | "tags" = "text"
): number | string | [number,string,string] {      // ← tuple 추가
  if (v == null) return fmt === "num" ? 0 : [99,"",""];

  switch (fmt) {
    case "num": {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    }
    case "date": {
let s = String(v);
if (this.isoDateRegex.test(s)) s = s.slice(0,10);     // ← YYYY-MM-DD 추출
const d = this.parseDateYMD(s);
      return d ? d.getTime() : 0;
    }
    case "year": {
      const y = String(v).match(/\d{4}/)?.[0];
      return y ? Number(y) : 0;
    }
    case "tags": {
      const first = normalizeTags(v).sort((a,b)=>a.localeCompare(b,"ko"))[0];
      return first ?? "";
    }
    default: {                             // text
      const raw  = String(v ?? "");
      const base = raw.normalize("NFKD")
                      .replace(/[\u0300-\u036F]/g,"")  // 결합기호 제거
                      .replace(/[#*_`~\[\]\(\)\{\}<>\-]/g,"")
                      .trim()
                      .toLowerCase();
      const ch   = base[0] ?? "";
      /* 그룹 코드: 영문 0, 한글 1, 숫자 2, 기호 3, 이모지 4 */
      const grp =
        /[a-z]/.test(ch) ? 0 :
        /[가-힣]/.test(ch) ? 1 :
        /\d/.test(ch)      ? 2 :
        /\p{Extended_Pictographic}/u.test(ch) ? 4 : 3;
      return [grp, base, raw];
    }
  }
}



  private formatAsDate(v: any) {
    if (v == null) return "";
    const d = this.parseDateYMD(String(v));
    if (!d) return String(v);
    const y = d.getFullYear(),
      m = d.getMonth() + 1,
      dd = d.getDate();
    return `${y}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`;
  }

  private getVal(p: any, prop: string) {
    return prop.startsWith("file.")
      ? prop.split(".").reduce((v, k) => v?.[k], p)
      : p[prop];
  }
}

/* ───────────────────────── 참고 원본 코드 ─────────────────────────
 * · 필터/검색/정렬 로직, 날짜 파싱 등은 legacy InteractiveTable.ts
 *   에서 1:1 포팅하였음. :contentReference[oaicite:0]{index=0}
 * · pane state echo 차단 전략은 StateCenter.set() 구현과 동일.
 * · UI(UIManager) 는 src/ui/interactive-table/UIManager.ts 참조.
 * ─────────────────────────────────────────────────────────────── */
