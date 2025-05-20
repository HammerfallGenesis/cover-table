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

/*****************************************************************
 * src/theme/ListCalloutManager.ts – patch snippet
 * ① 링크 노드를 보존하면서 pill 구성
 * ② 읽기모드에서 더블-클릭 ⇒ a.href 트리거
 *****************************************************************/

// …생략…

postProcessor(): MarkdownPostProcessor {
  return el => {
    if (!Object.keys(this.map).length) return;

    el.querySelectorAll<HTMLLIElement>("li").forEach(li => {
      const rawTxt = li.textContent ?? "";
      const ch     = rawTxt.trim().charAt(0);
      const cfg    = this.map[ch];
      if (!cfg) return;

      /* -------- ① pill 구성: 기존 자식 노드(링크 포함) 보존 -------- */
      const nodes: Node[] = [];
      while (li.firstChild) {
        nodes.push(li.firstChild);
        li.removeChild(li.firstChild);
      }
      // 첫 텍스트 노드에서 callout 문자 제거
      if (nodes[0]?.nodeType === Node.TEXT_NODE) {
        nodes[0].textContent = nodes[0].textContent!.replace(/^[\s\S]?/, "").trimStart();
      }

      const pill = document.createElement("span");
      pill.className = "lc-pill";
      pill.append(...nodes);             // 링크(<a …>) 보존
      li.appendChild(pill);

      li.classList.add("lc-list-callout");
      li.setAttribute("data-callout-char", ch);

      /* -------- ② 더블-클릭 → 첫 링크 클릭 이벤트 전달 -------- */
      li.addEventListener("dblclick", evt => {
        // 읽기모드 전용: 편집모드(CodeMirror)에서는 동작 X
        if (!li.closest(".markdown-reading-view")) return;

        const link = li.querySelector<HTMLAnchorElement>(
          "a.internal-link, a.external-link, a:not([href^='#'])",
        );
        if (!link) return;

        /* Obsidian은 MouseEvent를 그대로 전파해야 ‘Backlinks’ 등 히스토리 기록 */
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles   : true,
            cancelable: true,
            view      : window,
            /* Cmd/Ctrl+더블-클릭 → 새 탭으로 열고 싶다면 아래 주석 해제
            ctrlKey   : evt.ctrlKey || evt.metaKey,
            metaKey   : evt.metaKey,
            */
          }),
        );
      });
    });
  };
}

/*───────────────────────────────────────────────────────────────
  injectCss() – 콜아웃 리스트를 “단일 텍스트 + 배경” 버전으로 복원
───────────────────────────────────────────────────────────────*/
private injectCss() {
  if (!this.styleEl) {
    this.styleEl = document.createElement("style");
    this.styleEl.id = "ct-lc-style";
    document.head.appendChild(this.styleEl);
  }

  /* ── ① 공통 베이스: 들여쓰기 제거 + pill 기본 ── */
  let css = `
  li.lc-list-callout{
    list-style:none!important;
    margin:0!important;
    padding:0!important;
    font: 600 1em/1 var(--font-interface);
  }
  li.lc-list-callout::marker{content:""!important}

  .lc-pill{
    display:block;
    width:100%;
    padding:6px 10px;
    border-radius:6px;
    font-weight:600;
    margin:0px 0px 5px 0px;
    cursor: pointer;
  }
  .lc-pill:hover{
    transition:all .3s ease;
    transform:scale(.95);
  }

  /* 링크 → “일반 텍스트” 처리 */
  .lc-pill a{
    color:inherit!important;
    text-decoration:none!important;
  }

  /* hover 강조·외곽 배경 제거 (pill 내부 배경만 표시) */
  .markdown-reading-view li.lc-list-callout:hover{
    background:unset!important;
  }

  /* 편집모드 CM6 행 데코 영향 없이, 읽기모드 전용 배경만 유지 */
  .markdown-reading-view li.lc-list-callout .cm-line{background:transparent!important;}

  .list-bullet {display: none;}
  `;

  /* ── ② 색상 동적 생성 ── */
  for (const ch in this.map) {
    const c = this.map[ch];
    css += `
    .theme-light li[data-callout-char='${ch}'] .lc-pill{
      background:${c.bgLight}!important;
      color:${c.fgLight}!important;
    }
    .theme-dark  li[data-callout-char='${ch}'] .lc-pill{
      background:${c.bgDark}!important;
      color:${c.fgDark}!important;
    }
    li.lc-list-callout[data-callout-char='${ch}'] .lc-pill::before{ 
      content:""; 
    }`;

    
  }

  /* ── ③ 최종 주입 ── */
  this.styleEl.textContent = css;
}


}
