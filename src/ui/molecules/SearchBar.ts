/*****************************************************************
 * src/ui/molecules/Pagination.ts – auto-generated from legacy
 * Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📄 Pagination – Molecule Component
 * ---------------------------------------------------------------
 *  · Reusable pagination control extracted from legacy ui.ts
 *    (#3 Pagination area). Provides **prev / next** arrows and
 *    current page indicator. When total page count is small
 *    (<=5) it also renders direct page buttons.
 *
 *  · It relies on `ButtonFactory` for visual consistency and
 *    interacts with InteractiveTable via the `UITableCallbacks`
 *    passed from UIManager.
 * =============================================================== */

import { App } from "obsidian";
import { Dom } from "../atoms/dom";
import { ButtonFactory } from "../atoms/button";
import type { UITableCallbacks } from "../interactive-table/UIManager";

/*───────────────────────────────────────────────────────────────
  1. Pagination Options
───────────────────────────────────────────────────────────────*/
export interface PaginationOptions {
  notePath   : string;               // ctx.sourcePath
  viewId     : string;               // table viewId
  perPage    : number;               // rows per page
  totalRows  : number;               // rows after filter
}

/*───────────────────────────────────────────────────────────────
  2. Pagination Class
───────────────────────────────────────────────────────────────*/
export class Pagination {
  private readonly wrap: HTMLDivElement;
  private readonly btnFactory: ButtonFactory;

  constructor(
    private readonly app : App,
    host                 : HTMLElement,           // parent container
    private readonly cb  : UITableCallbacks,      // state helpers
    private readonly opt : PaginationOptions,
  ) {
    this.btnFactory = new ButtonFactory(app);
    this.wrap = Dom.el("div", "ct-pagination");
    host.appendChild(this.wrap);

    this.render();
  }

  /*───────────────────────────────────────────────────────────────
    render() – rebuild buttons when state changes
  ───────────────────────────────────────────────────────────────*/
  render(): void {
    const { notePath, viewId, perPage, totalRows } = this.opt;
    const key = `pagination_${viewId}`;
    const cur = (this.cb.getState as any)(notePath, viewId, key) ?? 0;
    const pages = perPage > 0 ? Math.ceil(totalRows / perPage) : 1;

    /* flush old children */
    this.wrap.empty();

    if (pages <= 1) return; // no need

    /* prev */
    const prev = this.btnFactory.pagination("←", cur === 0, () =>
      this.cb.sync(notePath, viewId, key, cur - 1));
    this.wrap.appendChild(prev);

    /* numbered buttons (<=5 pages) */
    if (pages <= 5) {
      for (let i = 0; i < pages; i++) {
        const btn = this.btnFactory.pagination(
          String(i + 1),
          i === cur,
          () => this.cb.sync(notePath, viewId, key, i),
        );
        if (i === cur) btn.classList.add("is-active");
        this.wrap.appendChild(btn);
      }
    } else {
      /* text indicator "3 / 12" */
      const info = Dom.el(
        "span",
        "ct-pagination__info",
        `${cur + 1} / ${pages}`,
      );
      this.wrap.appendChild(info);
    }

    /* next */
    const next = this.btnFactory.pagination("→", cur >= pages - 1, () =>
      this.cb.sync(notePath, viewId, key, cur + 1));
    this.wrap.appendChild(next);
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      • State keys maintain exact naming so no migration needed.
      • Button active / disabled styling lives in CSS.
──────────────────────────────────────────────────────────────*/
