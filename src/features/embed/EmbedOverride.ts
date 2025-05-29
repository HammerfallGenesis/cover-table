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
  private offDoc  : (() => void) | null = null;
  

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

/* ―― 공통 Drop / Paste 리스너 ――――――――――――――――――――― */
const listener = (
  evt   : DragEvent | ClipboardEvent,
  editor: Editor,
  _v    : MarkdownView,
) => {
  /* ===== 공통 준비 ===== */
  const exts = this.getCfg().nonPreviewExtensions.map(e => e.toLowerCase());

/* === 0. 전역 프리뷰-드롭 핸들러 =========================== */
const docListener = (evt: DragEvent) => {
  /* 프리뷰(view-content) 위에서만 작동, 에디터 내부 드롭은 CM 확장이 처리 */
  if (!(evt.target as HTMLElement).closest(".markdown-preview-view")) return;

  const cfg  = this.getCfg();
  if (!cfg.enableEmbedNoPreview) return;

  const exts = cfg.nonPreviewExtensions.map(e => e.toLowerCase());

  /* File 객체든 plain-text 경로든 → 이름 배열로 정규화 */
  const names = evt.dataTransfer?.files?.length
    ? Array.from(evt.dataTransfer.files).map(f => f.name)
    : (evt.dataTransfer?.getData("text/plain") ?? "")
        .split(/\r?\n/).filter(Boolean)
        .map(p => p.split(/[\\/]/).pop()!);

  if (!names.some(n => exts.includes(n.slice(n.lastIndexOf(".")).toLowerCase())))
    return;                               // 대상 확장자 없으면 패스

  evt.preventDefault();                   // 기본 링크 삽입 차단
  evt.stopPropagation();

  /* 액티브 에디터(편집 모드 탭 또는 동일 노트)를 찾아 삽입 */
  const active = this.app.workspace.getActiveViewOfType(MarkdownView);
  if (!active) return;

  const insert = names.map(n => {
    const ext = n.slice(n.lastIndexOf(".")).toLowerCase();
    return exts.includes(ext) ? `[[${n}]]` : `![[${n}]]`;
  }).join("\n");

  active.editor.replaceSelection(insert);
};

/* === 1. 등록 (캡처 단계) ================================== */
document.addEventListener("drop", docListener, true);
this.offDoc = () => document.removeEventListener("drop", docListener, true);





  /* ----------------------------------------------------------------
   * ①  File 객체가 있을 때  (OS 탐색기 → 에디터, 또는 Vault 밖 파일)
   * --------------------------------------------------------------- */
  const files =
    evt instanceof DragEvent
      ? evt.dataTransfer?.files
      : evt.clipboardData?.files;

  if (files && files.length) {
    // 대상 확장자 포함 여부 확인
    const needOverride = Array.from(files).some(f => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      return exts.includes(ext);
    });
    if (!needOverride) return;           // 우리 차례 아님 → 기본 동작

    evt.preventDefault();
    evt.stopPropagation();

    const insert = Array.from(files).map(f => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      return exts.includes(ext) ? `[[${f.name}]]` : `![[${f.name}]]`;
    }).join("\n");

    editor.replaceSelection(insert);
    return;                              // ⬅ 파일 분기 끝
  }

  /* ----------------------------------------------------------------
   * ②  File 객체가 없고, plain-text 경로만 있을 때
   *     (nav-pane → 다른 창/leaf, 또는 다중 선택 경로 드롭)
   * --------------------------------------------------------------- */
  const txt = evt instanceof DragEvent
    ? evt.dataTransfer?.getData("text/plain") ?? ""
    : evt.clipboardData?.getData("text/plain") ?? "";
  if (!txt) return;                      // 텍스트 자체가 없으면 패스

  const paths = txt.split(/\r?\n/).filter(Boolean);
  const needOverride = paths.some(p =>
    exts.includes(p.slice(p.lastIndexOf(".")).toLowerCase())
  );
  if (!needOverride) return;             // 대상 아님 → 기본 동작

  evt.preventDefault();
  evt.stopPropagation();

  const insert = paths.map(p => {
    const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
    const name = p.split(/[\\/]/).pop()!;           // 폴더 제거 → 파일명
    return exts.includes(ext) ? `[[${name}]]` : `![[${name}]]`;
  }).join("\n");

  editor.replaceSelection(insert);
};


    /* 워크스페이스 이벤트 등록 */
    this.offDrop  = (this.app.workspace as any).on("editor-drop",  listener);
    this.offPaste = (this.app.workspace as any).on("editor-paste", listener);






/* enable() 끝부분 바로 전에 추가 ↓ */
const docListener = (evt: DragEvent) => {
  /* Reading 뷰 위 드롭만 처리 (CodeMirror 가 이미 가로채면 여기까지 안 옴) */
  const t = evt.target as HTMLElement;
  if (!t.closest(".markdown-preview-view")) return;

  const cfg  = this.getCfg();
  if (!cfg.enableEmbedNoPreview) return;

  const exts = cfg.nonPreviewExtensions.map(e => e.toLowerCase());

  const files = evt.dataTransfer?.files ?? [];
  const names = files.length
    ? Array.from(files).map(f => f.name)
    : (evt.dataTransfer?.getData("text/plain") ?? "")
        .split(/\r?\n/).filter(Boolean)
        .map(p => p.split(/[\\/]/).pop()!);

  if (!names.some(n => exts.includes(n.slice(n.lastIndexOf(".")).toLowerCase()))) return;

  evt.preventDefault();  evt.stopPropagation();

  const insert = names.map(n => {
    const ext = n.slice(n.lastIndexOf(".")).toLowerCase();
    return exts.includes(ext) ? `[[${n}]]` : `![[${n}]]`;
  }).join("\n");

  /* ‣ Reading 뷰에서는 커서가 없으므로, 활성 에디터를 찾아 삽입 */
  const active = this.app.workspace.getActiveViewOfType(MarkdownView);
  active?.editor.replaceSelection(insert);
};

document.addEventListener("drop", docListener, true);   // 캡처 단계
this.offDoc = () => document.removeEventListener("drop", docListener, true);



  }

  disable(): void {
    if (this.offDrop)  this.app.workspace.offref(this.offDrop);
    if (this.offPaste) this.app.workspace.offref(this.offPaste);
    if (this.offDoc) { this.offDoc(); this.offDoc = null; }
    this.offDrop = this.offPaste = null;
  }


  /*============================================================
   *  외부 노출 편의 메서드
   *===========================================================*/
  /** Settings 변경 후 EmbedService → enable() 재호출 */
  reload() {
  /* ① 기존 리스너 제거 → ② 즉시 재등록 */
  this.disable();
  this.enable();
}

  /** Plugin.unload → 완전 해제 */
  destroy(): void { this.disable(); }
}

/*──────────────────────────────────────────────────────────────
  🔍  참고
      · 코드 로직은 legacy `src/theme/embed.ts` 를 1:1 옮겼습니다. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
      · 플러그인 참조를 제거하고 App 객체만 의존하도록 수정했습니다.
──────────────────────────────────────────────────────────────*/
