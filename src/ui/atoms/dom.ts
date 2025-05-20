/*****************************************************************
 * src/ui/atoms/dom.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🧩 Dom  –  UI Atom Helper
 * ---------------------------------------------------------------
 *  · “단 한 줄”로 Element 생성하는 초경량 헬퍼.
 *      Dom.el("div", "cls foo", "Hello");
 *  · Interactive-Table / Gantt / Setting UI 등
 *    전모듈에서 공통 사용하므로 atoms 로 분리했습니다.
 * =============================================================== */

/**
 * HTML 태그 이름 문자열 ↔ HTMLElement 매핑
 * ─ K                       : tag 이름 리터럴 타입
 * ─ HTMLElementTagNameMap[K]: 해당 태그의 정확한 Element 타입
 */
export class Dom {
  /**
   * Element 생성 헬퍼
   * @param tag  "div" | "button" | …
   * @param cls  class="" 값 (공백 구분, 선택)
   * @param text textContent (선택)
   * @returns    HTMLElementTagNameMap[K] – 정확한 태그 타입
   *
   * 📌 사용 예
   * ```ts
   * const btn = Dom.el("button",
   *   "it-btn it-btn--primary",
   *   "Click");
   * ```
   */
  static el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls = "",
    text = "",
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (cls)  el.className    = cls;
    if (text) el.textContent  = text;
    return el;
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      · 코드 로직은 ui.ts Core-helper Dom.el() 을 1:1 이전했습니다. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
───────────────────────────────────────────────────────────────*/
