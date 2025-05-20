/*****************************************************************
 * src/features/embed/EmbedOverride.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📎 EmbedOverride
 * ---------------------------------------------------------------
 *  · 드래그 / 붙여넣기 할 때 **미리보기 불가(ext 목록)** 는
 *    `[[링크]]` 로, 그 밖은 `![[embed]]` 로 삽입합니다.  
 *  · 실질 로직은 기존 `EmbedFileHandler` 를 그대로 옮긴 것으로
 *    “순수 서비스 계층(Plugin  참조 X)” 을 목적으로 합니다.
 *  · EmbedService 가 이 클래스를 래핑하여 Plugin 과 Settings
 *    변경에 대응합니다.
 * =============================================================== */

import { App, Editor, MarkdownView, EventRef } from "obsidian";
import type { EmbedFileHandlerSettings } from "./EmbedService";   // service ↔ override 분리

/*───────────────────────────────────────────────────────────────
  1. EmbedOverride
───────────────────────────────────────────────────────────────*/
export class EmbedOverride {
  /*─────────── 필드 ───────────*/
  private offDrop:  EventRef | null = null;
  private offPaste: EventRef | null = null;

  /*─────────── ctor ───────────*/
  constructor(
    private readonly app   : App,
    private readonly getCfg: () => EmbedFileHandlerSettings,
  ) {}

  /*============================================================
   *  enable() / disable()
   *  · Settings 토글·변경 시 EmbedService 가 재호출
   *===========================================================*/
  enable(): void {
    /* 항상 최신 설정을 적용하기 위해 먼저 해제 */
    this.disable();
    if (!this.getCfg().enableEmbedNoPreview) return;

    /* ―― 공통 Drop/Paste 리스너 ―― */
    const listener = (
      evt   : DragEvent | ClipboardEvent,
      editor: Editor,
      _v : MarkdownView,
    ) => {
      const files =
        evt instanceof DragEvent
          ? evt.dataTransfer?.files
          : evt.clipboardData?.files;
      if (!files?.length) return;

      const exts = this.getCfg().nonPreviewExtensions.map(e => e.toLowerCase());

      /* 대상 확장자 포함 여부 검출 */
      let needOverride = false;
      for (const f of Array.from(files)) {
        const ext = f.name.includes(".")
          ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
          : "";
        if (ext && exts.includes(ext)) { needOverride = true; break; }
      }
      if (!needOverride) return;

      /* Obsidian 기본 동작 차단 */
      evt.preventDefault();
      evt.stopPropagation();

      /* 삽입 문자열 조립 */
      let insertText = "";
      for (const f of Array.from(files)) {
        const ext = f.name.includes(".")
          ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
          : "";
        insertText +=
          ext && exts.includes(ext)
            ? `[[${f.name}]]\n`         // 미리보기 OFF
            : `![[${f.name}]]\n`;       // 일반 embed
      }
      if (insertText.endsWith("\n"))
        insertText = insertText.slice(0, -1);

      editor.replaceSelection(insertText);
    };

    /* 워크스페이스 이벤트 등록 */
    this.offDrop  = (this.app.workspace as any).on("editor-drop",  listener);
    this.offPaste = (this.app.workspace as any).on("editor-paste", listener);
  }

  disable(): void {
    if (this.offDrop)  this.app.workspace.offref(this.offDrop);
    if (this.offPaste) this.app.workspace.offref(this.offPaste);
    this.offDrop = this.offPaste = null;
  }


  /*============================================================
   *  외부 노출 편의 메서드
   *===========================================================*/
  /** Settings 변경 후 EmbedService → enable() 재호출 */
  reload(): void { this.enable(); }

  /** Plugin.unload → 완전 해제 */
  destroy(): void { this.disable(); }
}

/*──────────────────────────────────────────────────────────────
  🔍  참고
      · 코드 로직은 legacy `src/theme/embed.ts` 를 1:1 옮겼습니다. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
      · 플러그인 참조를 제거하고 App 객체만 의존하도록 수정했습니다.
──────────────────────────────────────────────────────────────*/
