/*****************************************************************
 * src/ui/atoms/spinner.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🧩 Spinner – Atom Component
 * ---------------------------------------------------------------
 *  · Extremely lightweight **loading indicator** used by
 *    Interactive‑Table, Gantt, and Setting‑Tab while waiting for
 *    async work (Dataview queries, heavy DOM diff, etc.).
 *  · Implementation is **CSS‑only**: a single <div> element with
 *    class `.ct-spinner` whose style/animation is defined in
 *    `src/theme/css/interactive-table.css`.
 *
 *    .ct-spinner {
 *      width:16px;height:16px;border-radius:50%;
 *      border:2px solid var(--ct-spinner-bg,#9992);
 *      border-top-color:var(--ct-spinner-fg,#666);
 *      animation:ct-spin 0.6s linear infinite;
 *    }
 *    @keyframes ct-spin{to{transform:rotate(360deg)}}
 *
 *  · This atom exposes a factory so every module creates the same
 *    DOM structure, making style overrides trivial.
 * =============================================================== */

import { Dom } from "./dom";

export class Spinner {
  /**
   * Create a new spinner element.
   *
   * @param small   set to `true` for 12×12 variant
   * @param cls     extra className(s) appended to `.ct-spinner`
   * @returns       HTMLDivElement ready for insertion
   */
  static create(small = false, cls = ""): HTMLDivElement {
    const spinner = Dom.el("div", `ct-spinner${small ? " ct-spinner--sm" : ""}${cls ? " " + cls : ""}`);
    return spinner;
  }

  /*─────────────────────────────────────────────────────────────
    Convenience helpers mirroring legacy ui.ts API
  ─────────────────────────────────────────────────────────────*/

  /** Legacy alias – default 16×16 spinner */
  static default(): HTMLDivElement {
    return Spinner.create();
  }

  /** 12×12 tiny spinner (inline icon size) */
  static tiny(): HTMLDivElement {
    return Spinner.create(true);
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      · CSS 정의는 base theme & interactive-table.css 로 이동.
      · 과거 ui.ts 의 `createSpinner()` 함수 구현을 그대로 옮겨
        Class + static factory 형태로 개선했습니다.
──────────────────────────────────────────────────────────────*/
