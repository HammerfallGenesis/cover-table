/*****************************************************************
 * src/ui/interactive-table/UIManager.ts – auto-generated from
 * legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📐 UIManager – Interactive‑Table View Builder
 * ---------------------------------------------------------------
 *  • Acts as the **presentation layer**: takes the already‑filtered
 *    rows from InteractiveTableModel & renders DOM components
 *    (FilterBar → DataTable → Pagination) inside the host <pre>.
 *
 *  • Contains **no business logic** – any state mutation
 *    (filter, search, pagination) is delegated to the callback
 *    façade so Controller ⇆ Model ⇆ StateCenter remain the single
 *    sources of truth.
 *
 *  • Legacy `ui.ts` responsibilities are now split:
 *        atoms/           – Dom, Button, Input, …
 *        molecules/       – FilterBar, Pagination, …
 *        layouts/         – DataTable, HeaderLayout, …
 *        interactive-table/UIManager.ts  ← YOU ARE HERE
 * =============================================================== */

import { App, TFile, TFolder } from "obsidian";
import { Dom } from "../atoms/dom";
import { FilterBar } from "../molecules/FilterBar";
import { Pagination } from "../molecules/Pagination";
import { DataTable } from "../layouts/DataTable";

import type { ColumnDef } from "../../features/interactive-table/types";
import type { FilterBarOptions } from "../molecules/FilterBar";
import type { PaginationOptions } from "../molecules/Pagination";



async function openPathInPopout(app: App, path: string): Promise<void> {
  if (!path) return;
  const file =
        app.metadataCache.getFirstLinkpathDest(path, "") ??
        app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return;

  const leaf = app.workspace.openPopoutLeaf();
  await leaf.openFile(file);
  app.workspace.revealLeaf(leaf);
}

/* ============================================================= */
/*  OPEN FILE IN POPOUT WINDOW + AUTOCLOSE LOGIC                  */
/* ============================================================= */
export async function openInNewLeafAndClose(
  app: App,
  filePath: string,
  currHost: HTMLElement,
) {
  /* ① pop-out Leaf 직접 생성 (가장 확실) */
  const popoutLeaf = app.workspace.openPopoutLeaf();   // WorkspaceLeaf

  /* ② 새 파일(또는 canvas) 열기 – 반드시 Leaf 에서! */
  const af = app.vault.getAbstractFileByPath(filePath);
  if (af instanceof TFile)
    await popoutLeaf.openFile(af, { active: true });
  else
    await app.workspace.openLinkText(filePath, "", true);   // e.g. canvas

  /* ③ Interactive-Table Pane 닫기 */
  (currHost.closest(".workspace-leaf") as any)?.view?.leaf?.detach?.();

/* 창 닫기 헬퍼 */
const closeWindow = () =>
  (app as any).commands.executeCommandById("workspace:close-window");

/* 삭제 이벤트 */
const refDelete = app.vault.on("delete", f => {
  if (f.path === filePath) closeWindow();
});

/* ✨ file-open(null) 이벤트 */
const refOpen = app.workspace.on("file-open", (file: any) => {
  if (file == null && app.workspace.activeLeaf === popoutLeaf)
    closeWindow();
});

/* 창 소멸 시 두 리스너 해제 */
app.workspace.on("layout-change", () => {
  if ((popoutLeaf as any).view == null) {
    app.vault.offref(refDelete);
    app.workspace.offref(refOpen);
  }
});

}



/*───────────────────────────────────────────────────────────────
  1. UITableCallbacks – Controller ↔ UI contract
───────────────────────────────────────────────────────────────*/
export interface UITableCallbacks {
  /*── state helpers (→ StateCenter) ─────────────────────────*/
  getState     : (note: string, viewId: string, key: string) => any;
  setState     : (note: string, viewId: string, key: string, val: any) => void;
  /** Local model cache (pages etc.) */
  getLocalState: (note: string, viewId: string) => any;

  /*── util parity with Model ───────────────────────────────*/
  getVal       : (row: any, prop: string) => any;
  parseDateYMD : (str: string) => Date | null;
  formatAsDate : (v: any) => string;
  getSortValue : (v: any) => string | number;
  suggester    : (values: string[]) => Promise<string | null>;

  /*── render flow control ─────────────────────────────────*/
  rerender     : () => Promise<void>;                  // Controller→Model→UI
  sync         : (note: string, viewId: string, key: string, val: any) => Promise<void> | void;
  resetState   : (note: string, viewId: string) => Promise<void> | void;
}

/*───────────────────────────────────────────────────────────────
  2. Internal Helper Types
───────────────────────────────────────────────────────────────*/
export interface UIManagerOptions {
  showOpenFolderButton        : boolean;
  showNewNoteButton           : boolean;
  showTagFilterButton         : boolean;
  showFrontmatterFilterButton : boolean;
  showSearchBox               : boolean;
  showRefreshButton           : boolean;
  folderPath                  : string | null;
}


export interface FmCandidate {                    // 새 타입
  prop   : string;
  values : string[];
}


/*───────────────────────────────────────────────────────────────
  3. UIManager Class
───────────────────────────────────────────────────────────────*/
export class UIManager {
  private app: App;
  private cb : UITableCallbacks;

  constructor(app: App, callbacks: UITableCallbacks) {
    this.app = app;
    this.cb  = callbacks;
  }

  /*============================================================
    buildView() – (re)render entire Interactive‑Table block
  ============================================================*/
  async buildView(
    hostPre   : HTMLElement,
    notePath  : string,
    viewId    : string,
    rows      : any[],
    columns   : ColumnDef[],
    perPage   : number,
    totalRows : number,
    opts      : UIManagerOptions,
    /* reserved params for future compatibility */
    fmList   : FmCandidate[] = [],
    tagList  : string[] | null = null,
    cb: UITableCallbacks = this.cb
  ): Promise<void> {
    /* ── 0. Prepare host container ───────────────────────────*/
    hostPre.empty(); 
    hostPre.classList.add("ct-it-container");

    /* ── 1. FilterBar (molecule) ─────────────────────────────*/
    const fbOpts: FilterBarOptions = {
      showOpenFolderButton        : opts.showOpenFolderButton,
      showNewNoteButton           : opts.showNewNoteButton,
      showTagFilterButton         : opts.showTagFilterButton,
      showFrontmatterFilterButton : opts.showFrontmatterFilterButton,
      showSearchBox               : opts.showSearchBox,
      showRefreshButton           : opts.showRefreshButton,
      folderPath                  : opts.folderPath,
    };
    new FilterBar(
      this.app,
      hostPre,
      notePath,
      viewId,
      columns,
      cb,
      fbOpts,
      fmList,
      tagList
    );

    /* ── 2. DataTable (layout) ───────────────────────────────*/
/* ── 2. DataTable (layout) ───────────────────────────────*/
const table = DataTable.build({
  columns,
  rows,
  zebra: true,
onRowClick: (row) => {
  const file = row?.file?.path;
  if (!file) return;

  /* 새 Leaf로 열고, 현재 Leaf 닫기 */
  openInNewLeafAndClose(this.app, file, hostPre);
},
  notePath,
  viewId,
  cb: {
    getState: cb.getState,
    sync    : cb.sync,
  },
});
hostPre.appendChild(table);


/* ➌  Delegated handler so “link-in-cell” & dbl-click도 pop-out */
table.addEventListener(
  "dblclick",
  async (e) => {
    const el = e.target as HTMLElement;
    if (el.closest(".nav-file-title")) return;      // 탐색기 예외

    const href = el.closest<HTMLAnchorElement>("a")?.getAttribute("href");
    const row  = el.closest<HTMLTableRowElement>("tr");
    const path = href ?? row?.dataset.path ?? "";
    if (!path) return;

    e.preventDefault();                            // 기본 탐색 억제
    await openPathInPopout(this.app, path);        // ★ Pop-out
  },
  true,   // capture 단계
);




    /* ── 3. Pagination (molecule) ────────────────────────────*/
    if (perPage > 0) {
      const pgOpts: PaginationOptions = {
        perPage,
        totalRows,
      };
      new Pagination(notePath, viewId, cb, hostPre, pgOpts);
    }

    
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      • Sorting click‑handlers were removed from UI layer – they are
        now handled inside Controller (sync → rerender).
      • Legacy CSS classes are preserved to minimise visual diff.
──────────────────────────────────────────────────────────────*/
