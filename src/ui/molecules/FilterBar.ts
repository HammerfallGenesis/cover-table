/*****************************************************************
 * src/ui/molecules/FilterBar.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🔍 FilterBar – Molecule Component
 * ---------------------------------------------------------------
 *  • Replaces legacy ui.ts (#3  Filter‑Area) with a clean, modular
 *    component that groups **front‑matter filter buttons, tag
 *    selector, search box, and utility controls** (refresh, open
 *    folder, new note).
 *  • Consumes atoms (ButtonFactory, Input, Icon) and the callback
 *    façade (`UITableCallbacks`) provided by InteractiveTableController.
 *  • Emits no side‑effects itself – every user action delegates to
 *    the callbacks so Controller ↔ Model ↔ StateCenter pipeline
 *    stays intact.
 * =============================================================== */

import { App, Notice } from "obsidian";
import { Dom } from "../atoms/dom";
import { ButtonFactory } from "../atoms/button";
import { Input } from "../atoms/input";
import { Spinner } from "../atoms/spinner";
import type { ColumnDef } from "../../features/interactive-table/types";
import type { FmCandidate, UITableCallbacks } from "../interactive-table/UIManager"; // relative to ui folder

/*───────────────────────────────────────────────────────────────
  🔧 Safe-cast helper – tag 값이 어떤 형태든 배열로 변환
───────────────────────────────────────────────────────────────*/
function toTagArray(raw: any): string[] {          // ★ PATCH
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;              // 이미 배열
  if (raw instanceof Set) return [...raw];         // Dataview Set
  if (typeof raw === "object" && raw.tag) return [String(raw.tag)];
  return [String(raw)];
}

/*───────────────────────────────────────────────────────────────
  1. FilterBar Options (subset of UIManager options)
───────────────────────────────────────────────────────────────*/
export interface FilterBarOptions {
  showOpenFolderButton        : boolean;
  showNewNoteButton           : boolean;
  showTagFilterButton         : boolean;
  showFrontmatterFilterButton : boolean;
  showSearchBox               : boolean;
  showRefreshButton           : boolean;
  folderPath                  : string | null; // for open‑folder
}

/*───────────────────────────────────────────────────────────────
  2. FilterBar Class
───────────────────────────────────────────────────────────────*/
export class FilterBar {
  private readonly wrap : HTMLDivElement;
  private readonly btns : HTMLDivElement;
  private readonly btnFactory: ButtonFactory;

  constructor(
    private readonly app    : App,
    host                    : HTMLElement,      // parent container
    private readonly note   : string,           // ctx.sourcePath
    private readonly vid    : string,           // viewId
    private readonly cols   : ColumnDef[],      // for fm‑filter buttons
    private readonly cb     : UITableCallbacks, // get/set state etc.
    private readonly opts   : FilterBarOptions,
    private readonly fmList : FmCandidate[],
    private readonly tagList: string[] | null

  ) {
    this.btnFactory = new ButtonFactory(app);

    /* Wrapper (flex row) ------------------------------------------------ */
    this.wrap = Dom.el("div", "ct-filter-bar");
    host.prepend(this.wrap);

    /* (A) Front‑matter / Tag buttons (left) ------------------------------ */
    if (opts.showFrontmatterFilterButton) this.buildFrontmatterFilters();
    if (opts.showTagFilterButton)         this.buildTagFilter();

    /* (B) Search box ----------------------------------------------------- */
    if (opts.showSearchBox)              this.buildSearchBox();

    /* (C) Utility buttons (right) --------------------------------------- */
    this.btns = Dom.el("div", "ct-filter-bar__utils");
    this.wrap.appendChild(this.btns);

    if (opts.showOpenFolderButton && opts.folderPath)
      this.btns.appendChild(this.btnFactory.openFolder(opts.folderPath));

    if (opts.showNewNoteButton)
      this.btns.appendChild(this.btnFactory.newNote());

    if (opts.showRefreshButton)
      this.btns.appendChild(this.btnFactory.refresh(async () => {
        /* Replace label with spinner while awaiting */
        const btn = (event!.currentTarget as HTMLButtonElement);
        const prev = btn.textContent;
        btn.replaceChildren(Spinner.tiny());
        try { await this.cb.rerender(); }
        finally { btn.textContent = prev ?? "↻"; }
      }));
  }

  /*───────────────────────────────────────────────────────────────
    2‑A. Tag Filter Button
  ───────────────────────────────────────────────────────────────*/
  private buildTagFilter(): void {
    /* current selection */
    const key = `tagFilter_${this.vid}`;
    const cur = (this.cb.getState as any)(this.note, this.vid, key) || "ALL";

    const btn = this.btnFactory.tagFilter(cur === "ALL" ? "#Tags" : cur, async () => {
      if (!this.tagList) return; 
      const chosen = await this.cb.suggester(this.tagList);
      if (chosen == null) return;
      this.cb.sync(this.note, this.vid, key, chosen);
    });

    /* ✨ 추가: “ALL” 이 아니면 강조 */
  if (cur !== "ALL") btn.classList.add("is-active");

    this.wrap.appendChild(btn);
  }

  /*───────────────────────────────────────────────────────────────
    2‑B. Front‑matter Filter Buttons
  ───────────────────────────────────────────────────────────────*/
  private buildFrontmatterFilters(): void {
    this.fmList.forEach(({ prop, values }) => {
      const key = `filter_${this.vid}_${prop}`;
      const cur = (this.cb.getState as any)(this.note, this.vid, key) || "ALL";
      const label = cur === "ALL" ? prop : `${prop}: ${cur}`;

      const btn = this.btnFactory.filter(label, async () => {
        const chosen = await this.cb.suggester(values);
        if (chosen == null) return;
        this.cb.sync(this.note, this.vid, key, chosen);
      });

      /* ✨ 추가 */
if (cur !== "ALL") btn.classList.add("is-active");

      this.wrap.appendChild(btn);
    });
  }

  private collectPropValues(prop: string): string[] {
    const pages: any[] = this.cb.getLocalState(this.note, this.vid)?.pages ?? [];
    const set = new Set<string>();
    pages.forEach(pg => {
      const raw = this.cb.getVal(pg, prop);
      const v = this.cb.formatAsDate(raw) || String(raw ?? "-");
      set.add(v);
    });
    return Array.from(set).filter(v=>v!=="-").sort();
  }

  /*───────────────────────────────────────────────────────────────
    2‑C. Search Box
  ───────────────────────────────────────────────────────────────*/
  private buildSearchBox(): void {
    const keyReady = `search_ready_${this.vid}`;
    const keyQuery = `search_${this.vid}`;
    const prev     = (this.cb.getState as any)(this.note, this.vid, keyQuery) || "";

    const input = Input.text({
      cls: "ct-filter-bar__search",
      placeholder: "Search…",
      value: prev,
      onEnter: q => {
        this.cb.sync(this.note, this.vid, keyReady, true);
        this.cb.sync(this.note, this.vid, keyQuery, q);
      }
    });

    this.wrap.appendChild(input);
  }
}

/*───────────────────────────────────────────────────────────────
  📌  Legacy Mapping Notes
      • TagPill & SearchInput originally in ui.ts (#2-C / #2-B) – moved.
      • State keys and naming strictly identical to legacy so StateCenter
        continues to work without migration.
──────────────────────────────────────────────────────────────*/
