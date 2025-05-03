/***********************************************************************
 * src/theme/list.ts – rev.2025-05-08  (FULL SOURCE, ICON REMOVED)
 *   • lucide-icon(마커) 기능 삭제
 *   • 읽기모드: 글머리 기호 숨기고 텍스트에만 배경(pill) 적용
 *   • 라이브-프리뷰(CM6)용 필드만 남겨 둬 추후 확장 가능
 ***********************************************************************/

import {
    App,
    MarkdownPostProcessor,
    MarkdownPostProcessorContext,
    Plugin
  } from "obsidian";
  import { EditorView }            from "@codemirror/view";
  import { StateEffect, StateField }from "@codemirror/state";
  
  import type CoverTablePlugin      from "../main";
  
/*──────────────────────────────────────────────────────────────
  #0. 타입
──────────────────────────────────────────────────────────────*/
export interface ListCallout {
    /** 호출 문자 한 글자(예: "!", "&" 등) */
    char   : string;
  
    /** ── 색상 (라이트 / 다크 개별 지정) ───────────────────────── */
    bgLight: string;   /* 라이트 모드 배경 (#rrggbb | css colour) */
    bgDark : string;   /* 다크   모드 배경 */
    fgLight: string;   /* 라이트 모드 글자색 */
    fgDark : string;   /* 다크   모드 글자색 */
  }
  
  interface CalloutConfig {
    map: Record<string, ListCallout>;
    re : RegExp | null;
  }
  
  
  /*──────────────────────────────────────────────────────────────
    #1. CM6 StateField – 설정 전달용 (Live-Preview)
  ──────────────────────────────────────────────────────────────*/
  const setConfig = StateEffect.define<CalloutConfig>();
  const cfgField  = StateField.define<CalloutConfig>({
    create() { return { map: {}, re: null }; },
    update(v, tr) {
      for (const e of tr.effects) if (e.is(setConfig)) v = e.value;
      return v;
    }
  });
  
/*──────────────────────────────────────────────────────────────
  #2. 읽기모드 Post-Processor
─────────────────────────────────────────────────────────────*/
function buildPostProcessor(getCfg: () => CalloutConfig): MarkdownPostProcessor {
    return (el, ctx) => {
      const cfg = getCfg();
  
      /* 문서 내 모든 <li> 순회 */
      el.findAll("li").forEach(li => {
        /* ── (A) 첫 번째 “실제 텍스트 노드” 탐색 ─────────────── */
        const txt = Array.from(li.childNodes)
          .find(n =>
            n.nodeType === Node.TEXT_NODE &&
            n.textContent!.trim().length) as Text | undefined;
        if (!txt) return;
  
        const first = txt.textContent!.trim().charAt(0);
        const co    = cfg.map[first];
        if (!co) return;                                // 매핑 없으면 통과
  
        /* ── (B) li 데이터 지정 ─────────────────────────────── */
        li.addClass("lc-list-callout");
        li.setAttribute("data-callout", co.char);
  
        /* 글머리 기호·여백 제거 */
        li.style.listStyleType = "none";
        li.style.paddingLeft   = "0";
        li.style.textIndent    = "0";
  
        /* ── (C) 트리거 문자( !, E 등) 제거 ───────────────── */
        txt.textContent = txt.textContent!.replace(first, "").trimStart();
  
        /* ── (D) pill 래퍼 생성 ────────────────────────────── */
        const pill = createSpan({ cls: "lc-pill" });
        while (li.firstChild) pill.appendChild(li.firstChild);
        li.appendChild(pill);
  
        /* ── (E) Obsidian이 만든 bullet(span.list-bullet) 제거 ── */
        pill.querySelectorAll(".list-bullet").forEach(b => b.remove());
      });
    };
  }
  
  
  
  
/*──────────────────────────────────────────────────────────────
  #3. 매니저
──────────────────────────────────────────────────────────────*/
export class ListCalloutManager {
    private cfg: CalloutConfig = { map: {}, re: null };
    private styleEl: HTMLStyleElement | null = null;
  
    constructor(private plugin: CoverTablePlugin) { this.rebuild(); }
  
    /** Settings → 정규식 & 맵 재생성 + 에디터·CSS 실시간 갱신 */
    rebuild() {
      const st   = this.plugin.settings;
      const map: Record<string, ListCallout> = Object.create(null);
  
      /* (A) 설정 → 매핑 테이블 생성 */
      (st.listCallouts || []).forEach(c => { map[c.char] = c; });
  
      /* (B) 매핑이 없으면 기능 OFF */
      if (Object.keys(map).length === 0) {
        this.cfg = { map: {}, re: null };
      } else {
        const chars = Object.keys(map)
          .map(s => s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"))
          .join("|");
  
        /* 블록인용(>), 체크박스, 번호목록 포함 전체 대응 */
        this.cfg = {
          map,
          re: new RegExp(
            `(^\\s*(?:>\\s*)*[-*+](?: \\[.\\])?\\s+|^\\s*(?:>\\s*)*\\d+[.)](?: \\[.\\])?\\s+)(${chars})\\s`
          ),
        };
      }
  
      /* (C) 라이브-프리뷰(CodeMirror6) 설정 재주입 */
      this.plugin.app.workspace.getLeavesOfType("markdown")
        .forEach(l => {
          const view = (l.view as any);
          const cm   = (view.editor as any)?.cm as EditorView | undefined;
          cm?.dispatch({ effects: [setConfig.of(this.cfg)] });
        });
  
      /* (D) 전역 동적 CSS 최초 생성 */
      if (!this.styleEl) {
        this.styleEl = document.createElement("style");
        this.styleEl.id = "lc-dynamic-style";
        document.head.appendChild(this.styleEl);
      }
  
      /* (E) 공통 기본 스타일 */
      let css = `
        /*───────────────────────────────────────────────────────────
          List Callout – 공통(읽기모드·라이브프리뷰)
        ───────────────────────────────────────────────────────────*/
        li.lc-list-callout{
          list-style:none!important;
          margin:4px 0;
          padding-left:0!important;
          position:relative;
          text-indent:0!important;
        }
        li.lc-list-callout::marker,
        li.lc-list-callout .list-bullet{ display:none!important; content:none!important; }
  
        .markdown-source-view.mod-cm6 li.lc-list-callout .cm-formatting-list,
        .markdown-source-view.mod-cm6 li.lc-list-callout .cm-list-plain{ display:none!important; }
  
        .lc-pill{
          display:block;
          width:100%; box-sizing:border-box;
          padding:8px 12px; border-radius:8px; font-weight:600;
        }`;
  
      /* (F) 콜아웃별 · 테마별 색상 규칙 */
      Object.values(map).forEach(c => {
        const sel = c.char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"); // CSS selector escape
        css += `
          /* ${c.char} – Light */
          .theme-light li.lc-list-callout[data-callout="${sel}"] .lc-pill{
            background:${c.bgLight || "#e0e0e0"};
            color:${c.fgLight || "#000"};
          }
          /* ${c.char} – Dark */
          .theme-dark  li.lc-list-callout[data-callout="${sel}"] .lc-pill{
            background:${c.bgDark || "#3a3a3a"};
            color:${c.fgDark || "#fff"};
          }`;
      });
  
      /* (G) 최종 CSS 삽입(덮어쓰기) */
      this.styleEl.textContent = css;
    }
  
    /** CM6 확장 */
    editorExtensions() { return [cfgField.init(() => this.cfg)]; }
  
    /** Markdown Post-Processor */
    postProcessor(): MarkdownPostProcessor {
      return buildPostProcessor(() => this.cfg);
    }
  }
  

  /*──────────────────────────────────────────────────────────────
  헥사 #rgb → #rrggbb 변환 (UI 재사용)
──────────────────────────────────────────────────────────────*/
export function toHex6(col: string): string {
    if (/^#([0-9a-f]{3})$/i.test(col))
      return col.replace(
        /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i,
        (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`,
      );
    return col;
  }
  
  