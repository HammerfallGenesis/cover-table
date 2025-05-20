/*****************************************************************
 * src/types/index.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📦 Barrel Exports (Type Aggregator)
 * ---------------------------------------------------------------
 *  · Provides a **single import point** for the most commonly
 *    used type definitions scattered across the refactored
 *    project. This keeps external feature modules and tests from
 *    navigating deep directory paths.
 *
 *      import type { ColumnDef, EventBus } from "@/types";
 *
 *  · Only *public* / cross‑feature types are exported here – internal
 *    implementation details remain encapsulated in their modules.
 * =============================================================== */

/*───────────────────────────────────────────────────────────────
  1. Interactive‑Table Types
───────────────────────────────────────────────────────────────*/
export type {
  ColumnDef,
  TableModelSettings,
  SortDirection,
} from "../features/interactive-table/types";

/*───────────────────────────────────────────────────────────────
  3. Theme Design Tokens
───────────────────────────────────────────────────────────────*/
export type {
  /* 새 토큰 구조 */
  AppDesignTokens,
  ModePalette,
  TablePalette,
  ImagePalette,
} from "../theme/tokens";

export {
  /* 기본 팔레트 & :root-주입 헬퍼 */
  DEFAULT_TOKENS,
  injectTokens,
  /* CSS-var 상수(이름만 바뀜) */
  VAR as CSS_VAR,
} from "../theme/tokens";

/*───────────────────────────────────────────────────────────────
  🔍  추가 팁
      • 다른 feature 모듈에서 재사용이 잦은 타입이 생기면 이곳에
 *      re‑export 하여 import 경로를 간결하게 유지해주세요.
──────────────────────────────────────────────────────────────*/
