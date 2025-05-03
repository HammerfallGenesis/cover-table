/***********************************************************************
 * src/theme/headerLabeller.ts – rev.2025-05-09-fix-reset-&-hide
 *   • “읽기모드 인덱싱” 초기화 버그 수정
 *   • file-open 이벤트로 카운터 자동 리셋
 *   • Auto-Number Heading 토글 OFF 시 숨김-CSS 자동 적용(별도 style)
 ***********************************************************************/

import {
    Plugin,
    MarkdownPostProcessorContext,
  } from "obsidian";
  
  export class HeaderLabeller {
    /** h1‥h6 카운터 (index 0 = h1) */
    private readonly cnt       = [0, 0, 0, 0, 0, 0];
    private lastPath: string | null = null;          // 문서 경계 확인용
    private styleInjected      = false;
    private readonly HIDE_ID   = "ct-hl-hide";       // 숨김 style id
  
    constructor(private readonly plugin: Plugin) {}
  
    /*───────────────────────────────────────────────────────────────
      register() – 플러그인 onload() 단계에서 호출
    ───────────────────────────────────────────────────────────────*/
    register() {
      this.injectBaseStyleOnce ();
      this.injectHideStyle     ();                   // 토글 상태 동기화
  
      /* (A) 읽기모드 포스트-프로세서 */
      this.plugin.registerMarkdownPostProcessor(
        (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
          /* ① 파일 경계 검사: 파일이 바뀌면 무조건 리셋 */
          if (ctx.sourcePath !== this.lastPath) {
            this.cnt.fill(0);
            this.lastPath = ctx.sourcePath;
          }
  
          /* ② 현재 블록 안 h1‥h6 순서대로 번호 삽입 */
          el.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")
            .forEach(h => this.decorate(h));
        },
        /* low priority = 100 → 다른 플러그인보다 늦게 실행 */
        100,
      );
  
      /* (B) file-open 이벤트: 탭 종료·재열기 시 카운터 초기화 */
      this.plugin.registerEvent(
        this.plugin.app.workspace.on("file-open", () => {
          this.cnt.fill(0);
          this.lastPath = null;
        }),
      );
  
      /* (C) 설정 변경 이벤트: 숨김 스타일 동기화 */
      this.plugin.registerEvent(
        this.plugin.app.workspace.on("css-change", () => this.injectHideStyle()),
      );
    }
  
    /*───────────────────────────────────────────────────────────────
      decorate() – <hX> 앞에 “1.2 ” 등 라벨 삽입
    ───────────────────────────────────────────────────────────────*/
    private decorate(h: HTMLElement) {
      const level = Number(h.tagName[1]);            // 'H3' → 3
      if (!level) return;
  
      /* 하위 레벨 리셋 (깊은 번호 제거) */
      for (let i = level; i < 6; i++) this.cnt[i] = 0;
  
      /* 현재 레벨 +1 */
      this.cnt[level - 1]++;
  
      /* ‘1.2.3 ’ 라벨 작성 */
      const label = this.cnt.slice(0, level).join(".") + " ";
  
      /* 기존 span 재사용(중복 방지) */
      let span = h.querySelector(".ct-hl-label") as HTMLSpanElement | null;
      if (!span) {
        span = document.createElement("span");
        span.className = "ct-hl-label";
        h.prepend(span);
      }
      span.textContent = label;
    }
  
    /*───────────────────────────────────────────────────────────────
      injectBaseStyleOnce() – 기본 스타일 (카운터 제거 + 라벨 굵기)
    ───────────────────────────────────────────────────────────────*/
    private injectBaseStyleOnce() {
      if (this.styleInjected) return;
      this.styleInjected = true;
  
      const css = `
        /* HeaderLabeller – 기존 CSS counter 제거 */
        .markdown-preview-view h1::before,
        .markdown-preview-view h2::before,
        .markdown-preview-view h3::before,
        .markdown-preview-view h4::before,
        .markdown-preview-view h5::before,
        .markdown-preview-view h6::before{ content:none!important; }
  
        /* 새 라벨(span) 스타일 */
        .ct-hl-label{ font-weight:bold; margin-right:.3em; }
      `;
      const st = document.createElement("style");
      st.id = "ct-hl-style";
      st.textContent = css;
      document.head.appendChild(st);
    }
  
    /*───────────────────────────────────────────────────────────────
      injectHideStyle() – 설정 토글 OFF → 라벨 숨김
    ───────────────────────────────────────────────────────────────*/
    private injectHideStyle() {
      /* CoverTable 설정 참조 → enableHeaderNumbering OFF 시 숨김 */
      const cfg = (this.plugin as any).settings?.enableHeaderNumbering ?? true;
      let st = document.getElementById(this.HIDE_ID) as HTMLStyleElement | null;
  
      if (!cfg) {                                   // 숨겨야 한다
        if (!st) {
          st = document.createElement("style");
          st.id = this.HIDE_ID;
          document.head.appendChild(st);
        }
        st.textContent = `.ct-hl-label{ display:none!important; }`;
      } else {                                      // 보여야 한다
        st?.remove();
      }
    }
  }
  