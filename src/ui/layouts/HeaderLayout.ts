/*****************************************************************
 * src/ui/layouts/HeaderLayout.ts – auto-generated from legacy
 * Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🏷️ HeaderLayout – Layout Component (Organism)
 * ---------------------------------------------------------------
 *  • Generic **section header** used by Gantt charts, Interactive
 *    Table wrappers, SettingTab panels, etc.
 *
 *  • Provides a flexible slot-based structure:
 *        ┌────────────────────────────────────────────┐
 *        │ [icon]  Title Text                [actions]│
 *        └────────────────────────────────────────────┘
 *
 *  • All elements are pure DOM; no Obsidian API required so it is
 *    safe to render in pop-outs or during server-side tests.
 * =============================================================== */

import { Dom } from "../atoms/dom";
import { createIcon, CTIconName } from "../atoms/icon";

/*───────────────────────────────────────────────────────────────
  1. Options Interface
───────────────────────────────────────────────────────────────*/
export interface HeaderLayoutOptions {
  /** Visible title string (plain text) */
  title      : string;
  /** Optional CTIconName to prepend (fallback UNICODE if missing) */
  icon?      : CTIconName;
  /** Additional action elements (right-aligned) */
  actions?   : HTMLElement[];
  /** Extra className(s) for root wrapper */
  cls?       : string;
}

/*───────────────────────────────────────────────────────────────
  2. HeaderLayout Class (static builder)
───────────────────────────────────────────────────────────────*/
export class HeaderLayout {
  /**
   * Build and return a complete header element.
   *
   * @param opts configuration object
   * @returns    HTMLDivElement ready for insertion
   */
  static build(opts: HeaderLayoutOptions): HTMLDivElement {
    const wrap = Dom.el(
      "div",
      `ct-header${opts.cls ? " " + opts.cls : ""}`,
    );

    /* icon (optional) */
    if (opts.icon) {
      const ico = createIcon(opts.icon, "ct-header__icon");
      wrap.appendChild(ico);
    }

    /* title */
    const h = Dom.el("h2", "ct-header__title", opts.title);
    wrap.appendChild(h);

    /* spacer + actions */
    const spacer = Dom.el("div", "ct-header__spacer");
    wrap.appendChild(spacer); // flex-grow 1

    if (opts.actions?.length) {
      const actWrap = Dom.el("div", "ct-header__actions");
      opts.actions.forEach(a => actWrap.appendChild(a));
      wrap.appendChild(actWrap);
    }

    return wrap;
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  CSS Expectations (interactive-table.css)
      .ct-header           { display:flex; align-items:center; gap:.4rem; }
      .ct-header__title    { flex:none; font-size:1.1rem; font-weight:600; }
      .ct-header__spacer   { flex:1 0 0; }
      .ct-header__actions  { display:flex; gap:.3rem; }
      .ct-header__icon svg { width:18px; height:18px; }
──────────────────────────────────────────────────────────────*/
