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

/*───────────────────────────────────────────────────────────────
  postProcessor() – 첫 위키링크가 없으면 순수 텍스트 사용
───────────────────────────────────────────────────────────────*/

/*───────────────────────────────────────────────────────────────
  postProcessor() – “첫 링크 노드를 그대로 살려 pill 로 감싸기”
───────────────────────────────────────────────────────────────*/
postProcessor(): MarkdownPostProcessor {
  return el => {
    if (!Object.keys(this.map).length) return;

    el.querySelectorAll<HTMLLIElement>("li").forEach(li => {
      const raw = li.textContent ?? "";
      const ch  = raw.trim().charAt(0);
      if (!this.map[ch]) return;

      /* 1️⃣  첫 <a> 요소 찾기 (내부·외부 링크 모두) */
      const firstLink = li.querySelector<HTMLAnchorElement>(
        "a.internal-link, a.external-link, a:not([href^='#'])",
      );

      /* 2️⃣  표시 라벨 결정 */
      let labelNode: Node;
      if (firstLink) {
        labelNode = firstLink;           // 그대로 사용 – Obsidian 이벤트 유지
      } else {
        /* 위키링크도 없고 <a>도 없으면 => 순수 텍스트 */
        const txt = raw.trim().slice(1).trim();            // 앞의 콜아웃 문자 제거
        labelNode = document.createTextNode(txt || " ");   // 공백 방지
      }

      /* 3️⃣  li 내부 비우고 pill 구성 */
      li.replaceChildren();             // 기존 자식 전부 제거
      const pill = document.createElement("span");
      pill.className = "lc-pill";
      pill.appendChild(labelNode);
      li.appendChild(pill);

      li.classList.add("lc-list-callout");
      li.setAttribute("data-callout-char", ch);

      /* 4️⃣  더블-클릭 → 첫 링크 트리거 (텍스트만 있을 땐 무시) */
      if (firstLink) {
        li.addEventListener("dblclick", () => {
          if (!li.closest(".markdown-reading-view")) return;
          firstLink.dispatchEvent(
            new MouseEvent("click", { bubbles:true, cancelable:true, view:window }),
          );
        });
      }
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
    /* 일반 리스트 유지, 콜아웃 안에서만 불릿 숨김 */
  li.lc-list-callout .list-bullet{display:none!important;}

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
