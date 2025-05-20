/*****************************************************************
 * src/ui/atoms/button.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  🧩 Button – Atom Component
 * ---------------------------------------------------------------
 *  · 모든 UI 모듈에서 재사용하는 **단일 버튼 생성 팩토리**입니다.
 *  · 기존 ui.ts 의 “Elements – Buttons” 구역(#2-A) 코드를
 *    atoms 레벨로 분리-이관했습니다.
 *  · Dom.el() 유틸을 사용하여 **한 줄**로 HTMLButtonElement
 *    인스턴스를 만들고, 공통 비활성(disabled) 스타일을 적용합니다.
 *
 *  ✨ 주요 메서드
 *    • create(opts)            – 일반 버튼
 *    • openFolder(relPath)     – “↪ Open Folder” (Electron shell)
 *    • newNote()               – “＋ New note”   (Explorer command)
 *    • refresh(onRefresh)      – “↻ Refresh”     (async callback)
 *    • tagFilter(curTag, cb)   – 태그 필터 토글
 *    • filter(prop, cb)        – front-matter 필터 토글
 *    • pagination(label,…)     – 페이지네이션 ‘← / → / 1…’ 버튼
 * =============================================================== */

import { App } from "obsidian";
import { Dom } from "./dom";

/*───────────────────────────────────────────────────────────────
  1.  타입 정의
───────────────────────────────────────────────────────────────*/
/**
 * **UIButtonOptions**
 *  · ButtonFactory.create() 파라미터
 */
export interface UIButtonOptions {
  /** 버튼 textContent               */
  label    : string;
  /** class="" (공백구분, BEM etc.)  */
  cls      : string;
  /** 클릭 시 실행할 콜백            */
  onClick  : () => any | Promise<any>;
  /** true ⇒ disabled + aria-disabled */
  disabled?: boolean;
}

/*───────────────────────────────────────────────────────────────
  2.  ButtonFactory
───────────────────────────────────────────────────────────────*/
export class ButtonFactory {
  constructor(private readonly app: App) {}

  /*============================================================
    create() – 공통 버튼 생성 헬퍼
  ============================================================*/
  create(opts: UIButtonOptions): HTMLButtonElement {
    const btn = Dom.el("button", opts.cls, opts.label);

    /* ── 비활성(disabled) 처리 ────────────────────────────── */
    if (opts.disabled) {
      btn.classList.add(`${opts.cls}--disabled`);
      btn.setAttribute("aria-disabled", "true");
      btn.disabled = true;          // ← 실제 클릭 불가
      return btn;                   // ★ 이벤트 바인딩 생략
    }

    /* ── 일반(onClick) 바인딩 ────────────────────────────── */
    btn.onclick = opts.onClick;
    return btn;
  }

  /*============================================================
    2-A. Preset Buttons
  ============================================================*/
  /** ↪ **Open Folder** – 파일 관리자에서 폴더/파일 열기 */
  openFolder(relPath: string): HTMLButtonElement {
    return this.create({
      label: "↪ Open Folder",
      cls  : "interactive_table-button interactive_table-button--open-folder",
      onClick: async () => {
        /* Electron 환경 한정 – 안전하게 try/catch */
        try {
          const { shell }   = (window as any).require("electron");
          const pathMod     = (window as any).require("path");
          const vaultBase   = (this.app.vault.adapter as any).basePath;
          const abs         = pathMod.resolve(vaultBase, relPath);
          const isFile      = pathMod.extname(abs) !== "";
          isFile ? shell.showItemInFolder(abs) : shell.openPath(abs);
        } catch (_) {/* no-op – 모바일/Web 환경 */ }
      },
    });
  }

  /** ＋ **New note** – 탐색기 ‘새 파일’ 명령 호출 */
  newNote(): HTMLButtonElement {
    return this.create({
      label : "＋ New note",
      cls   : "interactive_table-button interactive_table-button--new-note",
      onClick: () =>
        (this.app as any).commands.executeCommandById("file-explorer:new-file"),
    });
  }

  /** ↻ **Refresh** – async 재렌더 콜백 전담 */
  refresh(onRefresh: () => Promise<void>): HTMLButtonElement {
    return this.create({
      label : "↻",
      cls   : "interactive_table-button interactive_table-button--refresh",
      onClick: onRefresh,
    });
  }

  /** **Tag Filter** – 현재 태그 표시 & 선택 모달 */
  tagFilter(curTag: string, onSelect: () => Promise<void>): HTMLButtonElement {
    return this.create({
      label  : curTag,
      cls    : "interactive_table-button interactive_table-button--tag-filter",
      onClick: onSelect,
    });
  }

  /** **Front-matter Filter** – 프로퍼티명 표시 & 선택 모달 */
  filter(propName: string, onSelect: () => Promise<void>): HTMLButtonElement {
    return this.create({
      label  : propName,
      cls    : "interactive_table-button interactive_table-filter__btn",
      onClick: onSelect,
    });
  }

  /** **Pagination** – ‘← / → / 1…’ 버튼 (disabled 지원) */
  pagination(
    label    : string,
    disabled : boolean,
    onClick  : () => any,
  ): HTMLButtonElement {
    return this.create({
      label,
      cls     : "interactive_table-pagination__btn",
      disabled,
      onClick,
    });
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      · 모든 로직은 legacy ui.ts (#2-A Buttons) 를 그대로 이전했습니다. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
      · ButtonGroup(여러 버튼을 래핑) 은 “ui/molecules/ButtonGroup.ts”
        로 이동되었으며, 여기서는 **단일 버튼 Atom** 만 제공합니다.
──────────────────────────────────────────────────────────────*/
