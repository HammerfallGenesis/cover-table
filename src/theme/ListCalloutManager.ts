/*****************************************************************
 * src/theme/ListCalloutManager.ts – refactored safe version v3.0.0
 *****************************************************************/

import { Plugin, MarkdownPostProcessor } from "obsidian";
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type CoverTablePlugin from "../core/Plugin";
import type { ListCallout } from "../setting";

type CalloutMap = Record<string, ListCallout>;

/*───────────────────────────────────────────────────────────────
  CM6 ViewPlugin – row‑decoration with safety guard
───────────────────────────────────────────────────────────────*/
function createPlugin(map: CalloutMap) {
  /* prebuild regex */
  const chars = Object.keys(map).join("");
  if (!chars) return [] as any;
  const re = new RegExp(`^\\s*(?:[-*+]|\\d+[.)])\\s+([${chars}])\\s+`);

  const decoFor = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    const docEnd = view.state.doc.length;

    for (const { from, to } of view.visibleRanges) {
      let pos = from;
      while (pos <= to && pos < docEnd) {
        const line = view.state.doc.lineAt(pos);
        const m = re.exec(line.text);
        if (m) {
          const ch = m[1];
          builder.add(
            line.from,
            line.from,
            Decoration.line({ attributes: { class: "lc-cm6-row", "data-callout-char": ch } }),
          );
        }
        /* next line – avoid infinite loop */
        if (line.to <= pos) break;
        pos = line.to + 1;
      }
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = decoFor(view); }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = decoFor(u.view);
      }
    },
    { decorations: v => (v as any).decorations },
  );
}

/*───────────────────────────────────────────────────────────────
  Manager class
───────────────────────────────────────────────────────────────*/
export class ListCalloutManager {
  private styleEl: HTMLStyleElement | null = null;
  private cmExt: any[] = [];
  private cmDispose: (() => void) | null = null;   // ← Disposable 보관
  private map: CalloutMap = {};

  constructor(private plugin: CoverTablePlugin) { this.rebuild(); }

  rebuild() {
    /* settings → map */
    this.map = {};
  (this.plugin.settings.listCallouts ?? []).forEach(
    (c: ListCallout) => (this.map[c.char] = c)
  );

    /* CSS */
    this.injectCss();

    /* CM6 extension – dispose ▶ 재등록 */
    if (this.cmDispose) {
      this.cmDispose();
      this.cmDispose = null;
    }
    this.cmExt = createPlugin(this.map);
    if (this.cmExt.length) 
      this.plugin.registerEditorExtension(this.cmExt);
  }

  /*───────────────────────────────────────────────────────────*/
  editorExtensions() { return this.cmExt; }

  postProcessor(): MarkdownPostProcessor {
    return el => {
      if (!Object.keys(this.map).length) return;
      el.querySelectorAll<HTMLLIElement>("li").forEach(li => {
        const txt = li.textContent?.trim() || "";
        const ch = txt.charAt(0);
        const cfg = this.map[ch];
        if (!cfg) return;

        li.empty();
        const pill = document.createElement("span");
        pill.className = "lc-pill";
        pill.textContent = txt.slice(1).trim();
        li.appendChild(pill);
        li.classList.add("lc-list-callout");
        li.setAttribute("data-callout-char", ch);
      });
    };
  }

  /*───────────────────────────────────────────────────────────*/
/* …중략… */
private injectCss() {
  if (!this.styleEl) {
    this.styleEl = document.createElement("style");
    this.styleEl.id = "ct-lc-style";
    document.head.appendChild(this.styleEl);
  }

  /* 기존 pill 색상 CSS ------------------------- */
  let css = `.lc-pill{display:block;width:100%;padding:6px 10px;border-radius:6px;font-weight:600}`;

  /* 🆕 ① 공통 들여쓰기 제거 블록 추가 ---------- */
  css += `
    li.lc-list-callout{
      list-style-type:none!important;
      list-style-position:inside!important;
      margin-inline-start:0!important;
      padding-inline-start:0!important;
      text-indent:0!important;
    }
    li.lc-list-callout::marker{content:""!important;font-size:0!important;}
  `;

  /* 기존 색상-동적 생성 루프 -------------------- */
  for (const ch in this.map) {
    const c = this.map[ch];
    css += `
    .theme-light li[data-callout-char='${ch}'] .lc-pill{
      background:${c.bgLight}!important;color:${c.fgLight}!important;
    }
    .theme-dark  li[data-callout-char='${ch}'] .lc-pill{
      background:${c.bgDark}!important;color:${c.fgDark}!important;
    }`;
  }

  /* 최종 주입 */
  this.styleEl.textContent = css;
}

}
