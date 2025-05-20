/*****************************************************************
 * src/features/gantt/palette.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  Gantt  ➜  Palette Module
 * ---------------------------------------------------------------
 *  · 간트 차트에서 사용하는 **색상 팔레트 관리 전용** 모듈입니다.
 *  · 기존 GanttTable.ts 에 분산돼 있던 색상 상수‧할당 로직을
 *    재사용성이 높도록 별도 파일로 분리했습니다.
 *
 *  📌 주요 구성
 *    1) 기본 팔레트 상수       –  DEFAULT_DARK / DEFAULT_LIGHT
 *    2) pickPalette()          –  테마(라이트/다크) + 사용자 설정
 *    3) GanttPalette class     –  노트 제목 ↔ 색상 매핑 헬퍼
 * =============================================================== */

/*───────────────────────────────────────────────────────────────
  1.  기본 팔레트 상수
───────────────────────────────────────────────────────────────*/
/** 다크 테마 기본 팔레트 */
export const DEFAULT_DARK: string[] = [
  "#ff6363", "#ffa600", "#ffcf00", "#8aff80", "#2effd3",
  "#00ffff", "#25c6fc", "#3399ff", "#9975e2", "#cc66cc",
  "#ff66ff", "#ff66cc", "#ff6699", "#ff6666", "#f06b60",
  "#ed7732", "#de9f00", "#afff68", "#53ffb4", "#2f9eff",
];

/** 라이트 테마 기본 팔레트 */
export const DEFAULT_LIGHT: string[] = [
  "#ff9999", "#ffc04d", "#ffe680", "#b3ffb3", "#80fff2",
  "#80ffff", "#99daff", "#99c2ff", "#c2a3e8", "#df9edf",
  "#ff99ff", "#ff99e6", "#ff99c2", "#ff9999", "#f4a38c",
  "#f1b066", "#eec900", "#c5ff8a", "#84ffc9", "#74baff",
];

/*───────────────────────────────────────────────────────────────
  2.  pickPalette()
  ───────────────────────────────────────────────────────────────
  · 라이트/다크 모드 + 사용자 정의 팔레트 설정을 조합하여
    최종 팔레트(string[])를 반환합니다.
───────────────────────────────────────────────────────────────*/
export interface PaletteSettings {
  /** 라이트/다크 공통 팔레트(우선순위 2) */
  colorPalette?: string[];
  /** 다크 모드 전용 사용자 팔레트(우선순위 1) */
  colorPaletteDark?: string[];
  /** 라이트 모드 전용 사용자 팔레트(우선순위 1) */
  colorPaletteLight?: string[];
}

/**
 * @param isDark   현재 Obsidian 테마가 다크인지 여부
 * @param opts     GanttSettings 일부(colorPalette 관련) 구조체
 * @returns        최종 색상 배열(방어적 복사본)
 */
export function pickPalette(
  isDark: boolean,
  opts: PaletteSettings = {},
): string[] {
  const { colorPalette, colorPaletteDark, colorPaletteLight } = opts;

  /* 다크 모드 */
  if (isDark) {
    return (
      colorPaletteDark ??
      colorPalette ??
      DEFAULT_DARK
    ).slice();
  }

  /* 라이트 모드 */
  return (
    colorPaletteLight ??
    colorPalette ??
    DEFAULT_LIGHT
  ).slice();
}

/*───────────────────────────────────────────────────────────────
  3.  GanttPalette 클래스
  ───────────────────────────────────────────────────────────────
  · 노트(또는 Task) 이름을 팔레트 색상에 순차적으로 매핑합니다.
  · 동일 이름은 항상 동일 색상이 반환되므로 범례(legend)에
    활용할 수 있습니다.
───────────────────────────────────────────────────────────────*/
export class GanttPalette {
  private readonly noteColorMap: Record<string, { colorIndex: number | null }> = {};
  private colorPtr = 0;

  constructor(private readonly palette: string[]) {}

  /** 노트 이름을 팔레트에 등록(이미 등록되어 있으면 무시) */
  assign(note: string): void {
    if (this.noteColorMap[note]) return;
    if (this.palette.length === 0) {
      this.noteColorMap[note] = { colorIndex: null };
      return;
    }
    const idx = this.colorPtr % this.palette.length;
    this.noteColorMap[note] = { colorIndex: idx };
    this.colorPtr++;
  }

  /** 등록된 노트 이름의 색상을 반환(없으면 기본 #999) */
  colorOf(note: string): string {
    const entry = this.noteColorMap[note];
    if (!entry || entry.colorIndex == null) return "#999";
    return this.palette[entry.colorIndex];
  }

  /** 현재 매핑 정보를 객체 형태({ note: hex })로 반환 */
  legend(): Record<string, string> {
    const res: Record<string, string> = {};
    Object.keys(this.noteColorMap).forEach(note => {
      res[note] = this.colorOf(note);
    });
    return res;
  }

  /** 전체 매핑‧색상 포인터 초기화 */
  reset(): void {
    this.colorPtr = 0;
    Object.keys(this.noteColorMap).forEach(k => delete this.noteColorMap[k]);
  }
}

/* ───────────────────────── 참고 원본 코드 ─────────────────────────
 * · 기본 팔레트 배열과 색상 할당 로직은 legacy GanttTable.ts
 *   에서 1:1 포팅하였습니다. :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
 * ─────────────────────────────────────────────────────────────── */
