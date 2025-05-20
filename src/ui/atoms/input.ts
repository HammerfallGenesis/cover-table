/*****************************************************************
 * src/ui/atoms/input.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🧩 Input – Atom Components
 * ---------------------------------------------------------------
 *  · **input.ts** houses ultra-lightweight factories for the three
 *    primitive HTML < input > types that Interactive-Table and other
 *    UI blocks rely on: **text**, **number**, and **date**.
 *  · All functions return the *exact* HTMLElement type so
 *    downstream code keeps its strong typing.
 *
 *  ▸ Why a separate atom?
 *      ui.ts originally embedded “#2-B Elements – Inputs” such as
 *      `SearchInput`. Those snippets are extracted verbatim and
 *      generalised here so that every feature (Gantt, Setting-Tab,
 *      etc.) can reuse the same input helpers without dragging in
 *      heavy UI logic. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
 *
 *  ✨ Quick Usage
 *    ```ts
 *    const txt = Input.text({
 *      cls: "it-search__input",
 *      placeholder: "Search…",
 *      value: "foo",
 *      onEnter: () => doSearch(),
 *    });
 *
 *    const num = Input.number({
 *      min: 0, max: 99, step: 1,
 *      value: 12,
 *      onChange: v => console.log(v),
 *    });
 *    ```
 * =============================================================== */

import { Dom } from "./dom";

/*───────────────────────────────────────────────────────────────
  1. Type Declarations
───────────────────────────────────────────────────────────────*/
export interface BaseInputOptions<T extends string | number | Date> {
  /** class="" value (space-separated)                     */
  cls?: string;
  /** placeholder attribute (text input only)              */
  placeholder?: string;
  /** initial value                                        */
  value?: T;
  /** fired on <Enter> key (text) or on <change> (num/date)*/
  onEnter?: (val: string) => any;
  onChange?: (val: T) => any;
}

export interface NumberInputExtra {
  min?: number;
  max?: number;
  step?: number;
}

/*───────────────────────────────────────────────────────────────
  2. Input Factory
───────────────────────────────────────────────────────────────*/
export class Input {
  /*───────────────────────────────
    2-A. Text Input
  ───────────────────────────────*/
  static text(opts: BaseInputOptions<string> = {}): HTMLInputElement {
    const el = Dom.el("input", opts.cls ?? "");
    el.type        = "text";
    el.placeholder = opts.placeholder ?? "";
    if (opts.value != null) el.value = String(opts.value);

    /* <Enter> key → onEnter */
    if (opts.onEnter)
      el.addEventListener("keydown", ev => {
        if (ev.key === "Enter") opts.onEnter!(el.value.trim());
      });

    /* change → onChange */
    if (opts.onChange)
      el.addEventListener("change", () => opts.onChange!(el.value.trim()));

    return el;
  }

  /*───────────────────────────────
    2-B. Number Input
  ───────────────────────────────*/
  static number(
    opts: BaseInputOptions<number> & NumberInputExtra = {},
  ): HTMLInputElement {
    const el = Dom.el("input", opts.cls ?? "");
    el.type  = "number";
    if (opts.min  != null) el.min  = String(opts.min);
    if (opts.max  != null) el.max  = String(opts.max);
    if (opts.step != null) el.step = String(opts.step);
    if (opts.value != null) el.value = String(opts.value);

    /* change → onChange */
    if (opts.onChange)
      el.addEventListener("change", () =>
        opts.onChange!(el.value === "" ? NaN : Number(el.value)),
      );

    return el;
  }

  /*───────────────────────────────
    2-C. Date Input (YYYY-MM-DD)
  ───────────────────────────────*/
  static date(opts: BaseInputOptions<Date | string> = {}): HTMLInputElement {
    const el = Dom.el("input", opts.cls ?? "");
    el.type  = "date";

    if (opts.value != null) {
      const val =
        opts.value instanceof Date
          ? opts.value.toISOString().slice(0, 10)
          : String(opts.value);
      el.value = val;
    }

    /* change → onChange */
    if (opts.onChange)
      el.addEventListener("change", () =>
        opts.onChange!(
          el.value ? new Date(`${el.value}T00:00:00`) : ("" as any),
        ),
      );

    return el;
  }
}

/*───────────────────────────────────────────────────────────────
  📌  Notes
      • These atoms are *logic-free*: validation or formatting
        should be handled in caller modules.
      • Stylistic rules (padding, border radius, focus ring) are
        defined in `src/theme/css/interactive-table.css`.
───────────────────────────────────────────────────────────────*/
