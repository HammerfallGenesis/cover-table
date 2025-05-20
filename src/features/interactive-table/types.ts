/*****************************************************************
 * src/features/interactive-table/types.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  Interactive-Table –  **공통 타입 모음**
 * ---------------------------------------------------------------
 *  · Model / Controller / UI 계층이 공유해야 하는 순수 타입을
 *    한곳에 모아두었습니다.
 *  · Obsidian API 나 런타임 객체에 의존하지 않는 선언만 포함합니다.
 * =============================================================== */

/*───────────────────────────────────────────────────────────────
  1. ColumnDef  –  Dataview 프로퍼티 메타데이터
───────────────────────────────────────────────────────────────*/
/**
 * Dataview 필드를 Interactive-Table 컬럼으로 노출할 때의
 * 개별 프로퍼티 정의입니다. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
 */
export interface ColumnDef {
  /** Dataview / front-matter 키 이름 (예: `"created"`, `"tags"`) */
  prop   : string;

  /** 테이블 헤더에 표시할 제목(미지정 시 prop 사용) */
  name   : string;

  /** “front-matter 필터 버튼” 대상 여부 */
  filter : boolean;

  /** 실제 테이블 컬럼 표시 여부 */
  column : boolean;

  /** 표시·정렬 방식 – 생략 시 "text" */
  format?: "text" | "num" | "date" | "year" | "tags";
}

/*───────────────────────────────────────────────────────────────
  2. TableModelSettings  –  Interactive-Table 옵션 집합
───────────────────────────────────────────────────────────────*/
/**
 * 코드펜스 옵션 + 내부 상태 플래그를 모두 포함한 설정 오브젝트.
 * Controller 가 Dataview 페이지를 수집하고 Model 을 초기화할 때
 * 주입합니다. :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}
 */
export interface TableModelSettings {
  /** 페이지당 행 수 (0 또는 음수 ⇒ 페이지네이션 비활성) */
  perPage?: number;

  /** Dataview 경로 재정의 (`path:"\"Projects\""`) */
  path?: string;

  /** “태그 필터” 버튼 노출 여부 (기본값: true) */
  showTagFilterButton?: boolean;

  /** Front-matter 필터 버튼 노출 여부 (기본값: true) */
  showFrontmatterFilterButton?: boolean;

  /* ----- 내부 제어 플래그 (UI-노출 X) ------------------------- */
  /** 상태 스토리지 초기화 플래그 (Gantt ↔ IT 전환 시 사용) */
  __wipeState?: boolean;

  /** 탭-로컬 viewId – Controller 가 자동 주입 */
  __viewId?: string;

  /** 현재 노트 경로 – Controller 가 자동 주입 */
  _notePath?: string;

  /** 추가 사용자 정의 값은 자유롭게 확장 */
  [k: string]: any;
}

/*───────────────────────────────────────────────────────────────
  3. 기타 유틸 타입
───────────────────────────────────────────────────────────────*/
/** 정렬 방향 */
export type SortDirection = "asc" | "desc";

/* ===============================================================
 *                      ⛔  END OF FILE  ⛔
 * =============================================================== */
