/*****************************************************************
 * src/features/header-numbering/HeaderNumberingService.ts
 *   – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🏷️ HeaderNumberingService
 * ---------------------------------------------------------------
 *  · “읽기모드 자동 Heading 번호” 기능을 전담하는 서비스입니다.
 *  · 기존 **theme/headerLabeller.ts** 클래스를 계층에 맞추어
 *    서비스 형태로 리팩터링했습니다.  :contentReference[oaicite:0]{index=0}
 *
 *  📌 주요 기능
 *    1) <h1>‥<h6> 앞에 ‘1.2.3 ’ 번호 라벨을 삽입
 *    2) 파일 경계·탭 전환 시 카운터 자동 초기화
 *    3) Settings.toggle(enableHeaderNumbering) 동기화
 *    4) 헤더 앞 기존 CSS counter 제거 & 기본 라벨 스타일 주입
 * =============================================================== */

import {
  Plugin,
  MarkdownPostProcessorContext,
} from "obsidian";

/*───────────────────────────────────────────────────────────────
  1.  HeaderNumberingService
───────────────────────────────────────────────────────────────*/
export class HeaderNumberingService {
  /*──────── 필드 ────────*/
  /** h1‥h6 카운터 (index 0 = h1) */
  private readonly cnt         = [0, 0, 0, 0, 0, 0];
  private lastPath: string | null = null;            // 문서 경계 확인
  private styleInjected        = false;              // base 스타일 1회 주입
  private readonly HIDE_ID     = "ct-hn-hide";       // 숨김 style id

  constructor(private readonly plugin: Plugin) {}

  /*============================================================
    register() – 플러그인 onload 시 CoverTablePlugin 이 호출
  ============================================================*/
  register(): void {
    this.injectBaseStyleOnce();
    this.injectHideStyle();                // Settings 동기화

    /* (A) 읽기모드 Post-Processor – 번호 삽입 */
    this.plugin.registerMarkdownPostProcessor(
      (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        /* ① 파일 경계: sourcePath 변경 시 카운터 리셋 */
        if (ctx.sourcePath !== this.lastPath) {
          this.cnt.fill(0);
          this.lastPath = ctx.sourcePath;
        }

        /* ② 블록 내 모든 헤더 꾸미기 */
        el.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")
          .forEach(h => this.decorate(h));
      },
      /* 낮은 우선순위(100) → 다른 플러그인 처리 이후 실행 */
      100,
    );

    /* (B) file-open 이벤트 – 탭 재열기 시 카운터 초기화 */
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("file-open", () => {
        this.cnt.fill(0);
        this.lastPath = null;
      }),
    );

    /* (C) 테마 / CSS 변경 → 숨김 스타일 재주입 */
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("css-change", () => this.injectHideStyle()),
    );
  }

  /*───────────────────────────────────────────────────────────────
    decorate() – <hX> 요소 앞에 “1.2 ” 라벨 삽입
  ───────────────────────────────────────────────────────────────*/
  private decorate(h: HTMLElement): void {
    const level = Number(h.tagName[1]);              // 'H3' → 3
    if (!level) return;

    /* 하위 레벨 카운터 리셋 */
    for (let i = level; i < 6; i++) this.cnt[i] = 0;

    /* 현재 레벨 +1 */
    this.cnt[level - 1]++;

    /* ‘1.2.3 ’ 문자열 조립 */
    const label = this.cnt.slice(0, level).join(".") + " ";

    /* span 재사용(중복 방지) */
    let span = h.querySelector(".ct-hn-label") as HTMLSpanElement | null;
    if (!span) {
      span = document.createElement("span");
      span.className = "ct-hn-label";
      h.prepend(span);
    }
    span.textContent = label;
  }

  /*───────────────────────────────────────────────────────────────
    injectBaseStyleOnce() – 기본 라벨용 CSS 주입
  ───────────────────────────────────────────────────────────────*/
  private injectBaseStyleOnce(): void {
    if (this.styleInjected) return;
    this.styleInjected = true;

    const css = `
      /* HeaderNumbering – 기존 CSS counter 제거 */
      .markdown-preview-view h1::before,
      .markdown-preview-view h2::before,
      .markdown-preview-view h3::before,
      .markdown-preview-view h4::before,
      .markdown-preview-view h5::before,
      .markdown-preview-view h6::before{ content:none!important; }

      /* 새 라벨(span) 공통 스타일 */
      .ct-hn-label{ font-weight:bold; margin-right:.3em; }
    `;
    const st = document.createElement("style");
    st.id = "ct-hn-style";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /*───────────────────────────────────────────────────────────────
    injectHideStyle() – Settings 토글 OFF ⇒ 라벨 숨김
  ───────────────────────────────────────────────────────────────*/
  private injectHideStyle(): void {
    /* 플러그인 Settings 참조 */
    const enabled =
      (this.plugin as any).settings?.enableHeaderNumbering ?? true;

    let st = document.getElementById(this.HIDE_ID) as HTMLStyleElement | null;

    /* OFF → 숨김 style 삽입 */
    if (!enabled) {
      if (!st) {
        st = document.createElement("style");
        st.id = this.HIDE_ID;
        document.head.appendChild(st);
      }
      st.textContent = `.ct-hn-label{ display:none!important; }`;
    }
    /* ON → 숨김 style 제거 */
    else {
      st?.remove();
    }
  }

  /*============================================================
    destroy() – 외부 수동 해제용 (현재는 사용되지 않음)
  ============================================================*/
  destroy(): void {
    /* 숨김‧기본 style 유지(다른 문서에도 영향) → 제거하지 않음 */
    this.cnt.fill(0);
    this.lastPath = null;
  }
}

/* ===============================================================
 *                      ⛔  END OF FILE  ⛔
 * =============================================================== */
