/*****************************************************************
 * src/ui/layouts/DataTable.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📊 DataTable – Layout Component (Organism)
 * ---------------------------------------------------------------
 *  • Pure layout wrapper responsible for building the DOM
 *    structure of the **interactive table** whilst delegating any
 *    behavioural logic (sorting, filtering, state-sync) back to
 *    UIManager / Controller.
 *
 *  • Accepts raw rows + ColumnDef meta and outputs a <table>
 *    element with semantic class names so theme CSS can style it
 *    consistently (see `interactive-table.css`).
 *
 *  • This file purposefully contains **zero Obsidian API usage**
 *    so that it can be rendered in pop-ups / React previews or even
 *    server-side tests.
 * =============================================================== */

import { Dom } from "../atoms/dom";
import type { ColumnDef } from "../../features/interactive-table/types";
import { normalizeTags } from "../../features/interactive-table/utils/tag";

/*───────────────────────────────────────────────────────────────
  1. Type Declarations
───────────────────────────────────────────────────────────────*/
export interface DataTableOptions {
  /** Visible columns list (ColumnDef.column === true) */
  columns : ColumnDef[];
  /** Row objects coming from InteractiveTableModel.displayRows */
  rows    : any[];
  /**
   * Optional cell renderer. If omitted, DataTable falls back to
   * simple stringification with date formatting identical to
   * InteractiveTableModel.getVal().
   */
  cellRenderer?: (row: any, col: ColumnDef) => string | HTMLElement;
  /** Click callback for entire <tr>. */
  onRowClick?: (row: any, index: number) => void;
  /** True ⇒ zebra striping via CSS :nth-child(even). */
  zebra?: boolean;
  /* ▼ 정렬용 메타 – UIManager 가 전달 */
  notePath : string;
  viewId   : string;
  cb       : {
    getState : (note:string, vid:string, key:string) => any;
    sync     : (note:string, vid:string, key:string, val:any) => void;
  };

}

/*───────────────────────────────────────────────────────────────
  2. Utility – getVal mirror (kept here for SSR purity)
───────────────────────────────────────────────────────────────*/
function pad(n:number){return n.toString().padStart(2,"0");}
function fmtDate(d:Date){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}

function renderByFormat(raw:any, fmt?:string): string {
  if (raw == null) return "";

  switch(fmt){
    case "num":   return String(raw);
    case "year": {
      const y = String(raw).match(/\d{4}/)?.[0];
      return y ?? String(raw);
    }
    case "date": {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? String(raw) : fmtDate(d);
    }
    case "tags": {
  const sorted = normalizeTags(raw).sort((a,b)=>a.localeCompare(b,"ko"));
  return sorted.join(", ");           // [] 없애고 보기 좋게
    }
    default:     // text
      return String(raw);
  }
}

function getVal(row: any, prop: string): any {
  return prop.startsWith("file.")
    ? prop.split(".").reduce((v, k) => v?.[k], row)
    : row[prop];
}

/* Date helpers identical to Model for consistent formatting */
const YMD = /^\d{4}-\d{1,2}-\d{1,2}$/;
function formatDate(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (!YMD.test(s)) return s;
  const [y, m, d] = s.split("-").map(Number);
  return `${y}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
}

/*───────────────────────────────────────────────────────────────
  3. DataTable Class (static build helper)
───────────────────────────────────────────────────────────────*/
export class DataTable {
  /**
   * Build a complete <table> element according to options.
   */
  static build(opts: DataTableOptions): HTMLTableElement {
    const table = Dom.el("table", "ct-data-table") as HTMLTableElement;
    if (opts.zebra) table.classList.add("ct-data-table--zebra");

    /* ── thead ───────────────────────────────────────────────*/
    const thead = Dom.el("thead", "");
    const trHead = Dom.el("tr", "");
    // opts.columns.filter(c => c.column).forEach(col => {
    //   trHead.appendChild(Dom.el("th", "ct-data-table__th", col.name));
    // });
    opts.columns.filter(c => c.column).forEach(col => {
      const th = Dom.el("th", "ct-data-table__th", col.name);

      /* ===== 바로 아래에 추가 ===== */
      const curProp = opts.cb.getState(opts.notePath, opts.viewId, `sort_${opts.viewId}`);
      const curDir  = opts.cb.getState(opts.notePath, opts.viewId, `sort_direction_${opts.viewId}`);
      if (col.prop === curProp) {
        if (curDir === "asc")  th.classList.add("is-asc");
        if (curDir === "desc") th.classList.add("is-desc");
      }

      /* ── 정렬 클릭 핸들러 ────────────────────────── */
      th.addEventListener("click", () => {

      /* 모든 헤더에서 이전 상태 제거 */
      trHead.querySelectorAll(".ct-data-table__th")
            .forEach(el => el.classList.remove("is-asc","is-desc"));



      
/* ─── 기존 코드 keep ───────────── */
  const keySort = `sort_${opts.viewId}`;
  const keyDir  = `sort_direction_${opts.viewId}`;

  const curProp = opts.cb.getState(opts.notePath, opts.viewId, keySort);
  const curDir  = opts.cb.getState(opts.notePath, opts.viewId, keyDir);

  /* 기존 선언 그대로 */
let nextProp: string | null = null;
let nextDir:  "asc" | "desc" | null = null;

const anySorted = curProp && curDir;     // 현재 열이든 다른 열이든 정렬 중인가?

if (col.prop !== curProp) {              // ── 다른 열을 눌렀다
  if (anySorted) {                       // ① 이미 정렬 중이면 “초기화”만
    nextProp = null;
    nextDir  = null;                     //   (= 전체 reset)
  } else {                               // ② 아무 정렬도 없을 때는 ASC 시작
    nextProp = col.prop;
    nextDir  = "asc";
  }
} else {                                 // ── 같은 열 반복 클릭
  if (curDir === null)        { nextProp = col.prop; nextDir = "asc";  } // 대기 → ASC
  else if (curDir === "asc")  { nextProp = col.prop; nextDir = "desc"; } // ASC  → DESC
  else                        { nextProp = null;     nextDir = null;   } // DESC → reset
}


/* ③ 계산된 nextDir 으로 클래스 달기 */
  if (nextDir === "asc")  th.classList.add("is-asc");
  if (nextDir === "desc") th.classList.add("is-desc");

/* ④ 상태 저장 & 리렌더 트리거 */
  opts.cb.sync(opts.notePath, opts.viewId, keySort, nextProp);
  opts.cb.sync(opts.notePath, opts.viewId, keyDir , nextDir);
});
      trHead.appendChild(th);
    });

    thead.appendChild(trHead);
    table.appendChild(thead);

    /* ── tbody ───────────────────────────────────────────────*/
    const tbody = Dom.el("tbody", "");
    opts.rows.forEach((row, rowIdx) => {
      const tr = Dom.el("tr", "ct-data-table__tr");
      tr.dataset.path = row?.file?.path ?? "";

/* ▼ 기존 tr.onclick = … 한 줄을 이 코드로 교체 ▼ */
tr.onclick = () => {
  const isActive = tr.classList.contains("ct-row--active");

  /* ① 이미 선택돼 있으면 → 해제만 하고 종료 */
  if (isActive) {
    tr.classList.remove("ct-row--active");
    return;
  }

  /* ② 아니면 → 다른 행의 활성 상태를 해제하고 자신을 활성화 */
  const prev = table.querySelector(".ct-row--active") as HTMLTableRowElement | null;
  if (prev) prev.classList.remove("ct-row--active");
  tr.classList.add("ct-row--active");
};

      /* 더블 클릭 → 노트 열기 */
      tr.ondblclick = () => {
        const file = row?.file?.path;
        if (file) (window as any).app.workspace.openLinkText(file,"",false);
      };

      opts.columns.filter(c => c.column).forEach(col => {
        const td = Dom.el("td", "ct-data-table__td");
        let content: string | HTMLElement;

        if (opts.cellRenderer) {
          content = opts.cellRenderer(row, col);
        } else {
          const raw = getVal(row, col.prop);
          content = renderByFormat(raw, col.format);
        }

        if (content instanceof HTMLElement) td.appendChild(content);
        else td.textContent = content;

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      • CSS selectors are namespaced with `ct-data-table` to avoid
        clashing with Obsidian default table styles.
      • build() is static for simplicity – no instance state needed.
──────────────────────────────────────────────────────────────*/
