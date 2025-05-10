/***********************************************************************
 * src/theme/embed.ts – rev.2025-05-10
 *   · 드롭/붙여넣기 시 특정 확장자를 [[링크]]로, 그 외는 ![[embed]]로
 *   · CoverTable 설정탭 토글에 따라 실시간 Enable/Disable
 ***********************************************************************/

import { App, Editor, MarkdownView } from "obsidian";
import type CoverTablePlugin from "../main";

/*───────────────────────────────────────────────
  1. 설정 스키마 & 기본값
──────────────────────────────────────────────*/
export interface EmbedFileHandlerSettings {
  /** true → 기능 ON / false → Obsidian 기본 동작 */
  enableEmbedNoPreview: boolean;
  /** 쉼표로 구분된 확장자(.pdf 등, 소문자, 점 포함) */
  nonPreviewExtensions: string[];
}

export const DEFAULT_EMBED_SETTINGS: EmbedFileHandlerSettings = {
  enableEmbedNoPreview: true,
  nonPreviewExtensions: [".pdf", ".exe", ".zip", ".rar"],
};

/*───────────────────────────────────────────────
  2. 핵심 클래스
──────────────────────────────────────────────*/
export class EmbedFileHandler {
  private offDrop:  (() => void) | null = null;
  private offPaste: (() => void) | null = null;

  constructor(
    private readonly plugin : CoverTablePlugin,
    private readonly getCfg : () => EmbedFileHandlerSettings,
  ) {}

  /*―――― enable / disable ――――*/
  enable(): void {
    /* 항상 새 설정 반영을 위해 먼저 clean */
    this.disable();
    if (!this.getCfg().enableEmbedNoPreview) return;

    const listener = (
      evt: DragEvent | ClipboardEvent,
      editor: Editor,
      view:   MarkdownView,
    ) => {
      const files =
        evt instanceof DragEvent
          ? evt.dataTransfer?.files
          : evt.clipboardData?.files;
      if (!files?.length) return;

      const exts = this.getCfg().nonPreviewExtensions.map(e => e.toLowerCase());
      let handled = false;

      for (const f of Array.from(files)) {
        const ext = f.name.includes(".")
          ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
          : "";
        if (ext && exts.includes(ext)) { handled = true; break; }
      }
      if (!handled) return;

      /* Obsidian 기본 동작 차단 */
      evt.preventDefault();
      evt.stopPropagation();

      let insertText = "";
      for (const f of Array.from(files)) {
        const ext = f.name.includes(".")
          ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
          : "";
        insertText +=
          ext && exts.includes(ext)
            ? `[[${f.name}]]\n`
            : `![[${f.name}]]\n`;
      }
      if (insertText.endsWith("\n"))
        insertText = insertText.slice(0, -1);

      editor.replaceSelection(insertText);
    };

    /* 워크스페이스 이벤트 등록 */
    this.offDrop  = this.plugin.app.workspace.on("editor-drop",  listener);
    this.offPaste = this.plugin.app.workspace.on("editor-paste", listener);
  }

  disable(): void {
    this.offDrop?.();  this.offDrop  = null;
    this.offPaste?.(); this.offPaste = null;
  }

  /* 설정이 바뀔 때 외부에서 호출 */
  reload(): void { this.enable(); }

  /* plugin.onunload()에서 호출 */
  destroy(): void { this.disable(); }
}
