/*****************************************************************
 * src/ui/molecules/Pagination.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🔢 Pagination – Molecule Component
 * ---------------------------------------------------------------
 *  • Re‑implements legacy ui.ts (#2‑D Pagination) as a standalone
 *    class that creates and manages page‑navigation controls for
 *    Interactive‑Table.
 *  • Works exclusively through **UITableCallbacks** so that it can
 *    read/write StateCenter without direct imports.
 * =============================================================== */

import { Dom } from "../atoms/dom";
import { ButtonFactory } from "../atoms/button";
import type { UITableCallbacks } from "../interactive-table/UIManager";

/*───────────────────────────────────────────────────────────────
  1. Options & Internal Types
───────────────────────────────────────────────────────────────*/
export interface PaginationOptions {
  perPage     : number;   // rows per page (≥1)
  totalRows   : number;   // filtered row count
  maxButtons? : number;   // page buttons to show (default 7)
}

/*───────────────────────────────────────────────────────────────
  2. Pagination Class
───────────────────────────────────────────────────────────────*/
export class Pagination {
  private readonly wrap       : HTMLDivElement;
  private readonly btnFactory : ButtonFactory;
  private totalPages          : number;

  constructor(
    private readonly note : string,
    private readonly vid  : string,
    private readonly cb   : UITableCallbacks,
    host                  : HTMLElement,        // container below table
    opts                  : PaginationOptions,
  ) {
    this.btnFactory = new ButtonFactory(cb as any);

    /* 계산 */
    const per = Math.max(opts.perPage, 1);
    this.totalPages = Math.ceil(opts.totalRows / per);
    if (this.totalPages <= 1) {
      this.wrap = Dom.el("div");
      return;          // 필요 없음
    }

    this.wrap = Dom.el("div", "ct-pagination");
    host.appendChild(this.wrap);

    this.render(opts.maxButtons ?? 7);
  }

  /*───────────────────────────────────────────────────────────────
    render() – (re)create buttons set
  ───────────────────────────────────────────────────────────────*/
  private render(maxBtn: number): void {
    this.wrap.empty();

    const key   = `pagination_${this.vid}`;
    const cur   = (this.cb.getState as any)(this.note, this.vid, key) ?? 0;

    /* helper to add button */
    const add = (lbl: string, pg: number, disabled = false) => {
      const btn = this.btnFactory.pagination(lbl, disabled, () => {
        this.cb.sync(this.note, this.vid, key, pg);
      });

        /* ▼▼▼ 여기 한 줄 – 화살표면 arrow, 아니면 num 클래스 부여 ▼▼▼ */
  btn.classList.add( lbl === "←" || lbl === "→"
    ? "interactive_table-pagination__btn--arrow"
    : "interactive_table-pagination__btn--num" );

    if (disabled) btn.classList.add("is-active");
      this.wrap.appendChild(btn);
    };

    /* ← Prev */
    add("←", cur - 1, cur === 0);

    /* numbered buttons with windowing */
    const win = Math.max(3, maxBtn);
    let start = Math.max(0, cur - Math.floor(win / 2));
    let end   = start + win - 1;
    if (end >= this.totalPages) {
      end   = this.totalPages - 1;
      start = Math.max(0, end - win + 1);
    }

    if (start > 0) add("1", 0);
    if (start > 1) this.wrap.appendChild(Dom.el("span", "ct-pagination__ellipsis", "…"));

    for (let p = start; p <= end; p++) {
      add(String(p + 1), p, p === cur);
    }

    if (end < this.totalPages - 2) this.wrap.appendChild(Dom.el("span", "ct-pagination__ellipsis", "…"));
    if (end < this.totalPages - 1) add(String(this.totalPages), this.totalPages - 1);

    /* → Next */
    add("→", cur + 1, cur >= this.totalPages - 1);
  }
}

/*───────────────────────────────────────────────────────────────
  📌  Notes
      • State key naming unchanged, guaranteeing backward‑compat.
      • No direct DOM style here – CSS lives in interactive‑table.css.
      • Uses ButtonFactory.pagination() for consistent look & feel.
──────────────────────────────────────────────────────────────*/
