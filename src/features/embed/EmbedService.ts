/*****************************************************************
 * src/features/embed/EmbedService.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📎  EmbedService
 * ---------------------------------------------------------------
 *  · 플러그인(Core) ↔ EmbedOverride 간 가벼운 래퍼
 *  · CoverTablePlugin 에서
 *        new EmbedService(this, () => this.settings.embed)
 *    형태로 생성 → enable() / reload() / destroy() 로 제어합니다.
 *  · 실질적인 Drag / Paste 로직은 EmbedOverride 가 담당합니다.
 * =============================================================== */

import { Plugin } from "obsidian";
import { EmbedOverride } from "./EmbedOverride";

/*───────────────────────────────────────────────────────────────
  1.  설정 타입 & 기본값  (legacy embed.ts 그대로 재수출)
───────────────────────────────────────────────────────────────*/
export interface EmbedFileHandlerSettings {
  /** true ⇒ 지정 확장자는 [[링크]], 그 외는 ![[embed]] */
  enableEmbedNoPreview: boolean;
  /** 쉼표(,) 구분, 점(.) 포함, 소문자 확장자 배열 */
  nonPreviewExtensions: string[];
}

export const DEFAULT_EMBED_SETTINGS: EmbedFileHandlerSettings = {
  enableEmbedNoPreview : true,
  nonPreviewExtensions : [".pdf", ".exe", ".zip", ".rar"],
};                                                               /* :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1} */

/*───────────────────────────────────────────────────────────────
  2.  EmbedService  –  Plugin-side façade
───────────────────────────────────────────────────────────────*/
export class EmbedService {
  private readonly override: EmbedOverride;

  /**
   * @param plugin   CoverTablePlugin 인스턴스(Plugin.app 필요)
   * @param getCfg   최신 EmbedFileHandlerSettings 를 반환하는 함수
   */
  constructor(
    plugin : Plugin,
    getCfg : () => EmbedFileHandlerSettings,
  ) {
    /* Override 는 Plugin 참조 없이 App 만 사용하도록 설계 */
    this.override = new EmbedOverride(plugin.app, getCfg);
  }

  /*============================================================
    플러그인에서 직접 호출할 공개 API
  ============================================================*/
  /** 설정을 반영하여 리스너를 (재)등록 */
  enable()  { this.override.enable(); }

  /** enable() 별칭 – 설정 변경 직후 편의용 */
  reload()  { this.override.reload(); }

  /** 리스너 제거(Obsidian Workspace 이벤트 해제) */
  disable() { this.override.disable(); }

  /** plugin.onunload() 시 호출 */
  destroy() { this.override.destroy(); }
}

/* ===============================================================
 *                      ⛔  END OF FILE  ⛔
 * =============================================================== */
