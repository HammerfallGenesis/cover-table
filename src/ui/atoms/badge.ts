/*****************************************************************
 * src/ui/atoms/badge.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *
 *  🧩 Badge – Atom Component
 * ---------------------------------------------------------------
 *  · A minimal **status / tag pill** element used across
 *    Interactive‑Table (e.g. property chips, status column),
 *    Gantt legend, and Setting-Tab hints.
 *  · Styling is handled by `.ct-badge` and modifier classes that
 *    map to semantic colours (success, warning, danger, etc.).
 *    Rules live in `src/theme/css/interactive-table.css`.
 *
 *       .ct-badge            { …base pill… }
 *       .ct-badge--success   { background:#4caf50; }
 *       .ct-badge--warning   { background:#ff9800; }
 *       .ct-badge--danger    { background:#f44336; }
 *       .ct-badge--info      { background:#2196f3; }
 *       .ct-badge--neutral   { background:#9e9e9e; }
 *
 * =============================================================== */

import { Dom } from "./dom";

/** Badge semantic variants → CSS modifier suffix */
export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface BadgeOptions {
  /** Text content of the pill */
  label   : string;
  /** Variant for colour semantics (default "neutral") */
  variant?: BadgeVariant;
  /** Additional className(s) */
  cls?    : string;
  /** Tooltip / title attribute */
  title?  : string;
}

export class Badge {
  /**
   * Create a new badge <span> element.
   */
  static create(opts: BadgeOptions): HTMLSpanElement {
    const variant = opts.variant ?? "neutral";

    const span = Dom.el(
      "span",
      `ct-badge ct-badge--${variant}${opts.cls ? " " + opts.cls : ""}`,
      opts.label,
    );
    if (opts.title) span.title = opts.title;
    return span;
  }

  /*─────────────────────────────────────────────────────────────
   * Convenience helpers (legacy API parity)
   *────────────────────────────────────────────────────────────*/
  static success(label: string, title?: string) {
    return Badge.create({ label, variant: "success", title });
  }
  static warning(label: string, title?: string) {
    return Badge.create({ label, variant: "warning", title });
  }
  static danger(label: string, title?: string) {
    return Badge.create({ label, variant: "danger", title });
  }
  static info(label: string, title?: string) {
    return Badge.create({ label, variant: "info", title });
  }
  static neutral(label: string, title?: string) {
    return Badge.create({ label, variant: "neutral", title });
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      · Legacy implementation existed inside ui.ts (#2-C TagPill /
        StatusBadge). The code here is an exact extraction with only
        type‑safety & naming tweaks.                                      
──────────────────────────────────────────────────────────────*/
