/*****************************************************************
 * src/features/gantt/GanttModel.ts – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

/* ===============================================================
 *  📦 GanttModel  (순수 Model 계층)
 * ---------------------------------------------------------------
 *  · Dataview 페이지를 분석하여 **월간 Gantt 차트**에 필요한
 *    모든 데이터를 계산합니다.
 *  · UI 코드는 GanttController / GanttUIManager 로 분리되며,
 *    Model 은 다음만 담당합니다.
 *      ① 대상 page 수집 & 필터
 *      ② 시작-종료일 계산
 *      ③ 팔레트(color) 결정 & 범례(legend) 매핑
 *      ④ 결과 구조체(DataPack) 반환
 * =============================================================== */

import type { App, MarkdownPostProcessorContext } from "obsidian";
import { pickPalette, GanttPalette, PaletteSettings } from "./palette";

/*───────────────────────────────────────────────────────────────
  1. 타입 정의
───────────────────────────────────────────────────────────────*/
export interface GanttSettings extends PaletteSettings {
  /* Dataview 범위 */
  id?: string;              // future use – multiple gantt on one note
  path?: string;            // "\"Projects\"" 형태
  customPages?: any[];      // 외부에서 직접 주입한 page 배열

  /* 상태 필터 */
  statusField?: string;     // default: "status"
  statusDoneValue?: string; // default: "done"
  excludeDone?: boolean;    // default: true

  /* 날짜 필드 */
  startField?: string;      // default: "dataAdded"
  endField?: string;        // default: "dataEnded"

  /* 표시 옵션 (UI 전용, Model 은 그대로 전달) */
  showLegend?: boolean;
  renderInteractiveBelow?: boolean;
  forceInteractiveBelow?: boolean;
  interactiveOptions?: any;
  props?: any[];
  debugLegend?: boolean;
}

/**  Model → Controller 로 전달되는 완성 데이터 */
export interface GanttDataPack {
  /** 최종 page 배열(필터 적용 후) */
  pages: any[];
  /** 범위: 기준 연도 & 월(0-based) */
  year: number;
  month: number;
  /** 이번달 총 일 수 */
  daysInMonth: number;
  /** “노트 제목 → 팔레트 색상(hex)” 매핑 */
  legend: Record<string, string>;
  /** 팔레트 전체 배열(방어적 사본) */
  palette: string[];
  /** 필드 이름(시작/종료) 캐시 */
  startField: string;
  endField: string;
}

/*───────────────────────────────────────────────────────────────
  2. GanttModel
───────────────────────────────────────────────────────────────*/
export class GanttModel {
  /*──────── 필드 ────────*/
  private readonly dv: any;
  private readonly app: App;
  private readonly settings: GanttSettings;
  private readonly isDark: boolean;
  private readonly palette: string[];
  private readonly gPalette: GanttPalette;

  /*──────── ctor ────────*/
  constructor(
    app: App,
    dv: any,
    settings: GanttSettings = {},
    /** ctx 필요 시 외부에서 전달(페이지 판단용) */
    ctx?: MarkdownPostProcessorContext,
  ) {
    /* (0) 기본값 보정 */
    settings.statusField     ??= "obsidianUIMode";
    settings.statusDoneValue ??= "preview";
    settings.excludeDone     ??= true;
    settings.startField      ??= "dataAdded";
    settings.endField        ??= "dataEnded";

    this.app      = app;
    this.dv       = dv;
    this.settings = settings;

    /* (1) 테마(light/dark) 결정 */
    this.isDark = document.body.classList.contains("theme-dark");

    /* (2) 색상 팔레트 준비 */
    this.palette   = pickPalette(this.isDark, settings);
    this.gPalette  = new GanttPalette(this.palette);

    /* (3) current page 폴백 – canvas 지원 위해 ctx 사용 */
    if (!dv.current?.() && ctx?.sourcePath)
      (dv as any).current = () => dv.page(ctx.sourcePath);
  }

  /* ===========================================================
   *  compute() – 모든 계산 수행 후 DataPack 반환
   * =========================================================== */
  compute(): GanttDataPack {
    const { pages, year, month, daysInMonth } = this.collectPages();
    const legend = this.gPalette.legend();

    return {
      pages,
      year,
      month,
      daysInMonth,
      legend,
      palette     : [...this.palette], // 방어적 복사
      startField  : this.settings.startField!,
      endField    : this.settings.endField!,
    };
  }

  /*───────────────────────────────────────────────────────────────
    2-A. 페이지 수집 + 필터
  ──────────────────────────────────────────────────────────────*/
  private collectPages() {
    /* (A-1) 기준 연/월 */
    const now         = new Date();
    const year        = now.getFullYear();
    const month       = now.getMonth();          // 0-based
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    /* (A-2) 베이스 pages – customPages > path > same-folder */
    const cur   = this.dv.current?.();
    const base: any[] = Array.isArray(this.settings.customPages)
      ? this.settings.customPages
      : this.settings.path
        ? this.dv.pages(`"${this.settings.path}"`).array()
        : cur?.file
          ? this.dv.pages().where((p: any) =>
              p.file.folder === cur.file.folder && p.file.path !== cur.file.path,
            ).array()
          : [];

    /* (A-3) 상태/날짜 필터 */
    const sKey   = this.settings.statusField!;
    const doneV  = this.settings.statusDoneValue!.toLowerCase();
    const excl   = this.settings.excludeDone !== false;
    const sField = this.settings.startField!;
    const eField = this.settings.endField!;



    const pages = base.filter((p: any) => {

      // Canvas 페이지(.canvas) → Gantt 대상 제외
      if (p.file?.extension === "canvas") return false;

      /* 상태값 필터 */
      if (excl) {
        const stat = (p[sKey] ?? "").toString().toLowerCase();
        if (stat === doneV) return false;
      }
      /* 날짜 필드 존재 여부 */
      return !!p[sField] && !!p[eField];
    });

    /* (A-4) 팔레트용 제목 등록 */
    pages.forEach(pg => {
      const title = pg.title || pg.file?.name || "Untitled";
      this.gPalette.assign(title);
    });

    return { pages, year, month, daysInMonth };
  }

  /*───────────────────────────────────────────────────────────────
    2-B. 셀 색상 판단 헬퍼
    Controller → UI 단계에서 td 마다 호출해 배경색 결정
  ──────────────────────────────────────────────────────────────*/
  /**
   * note 제목과 날짜(1-based) → 팔레트 색상 or null
   * Controller → UIManager.colorize() 에서 사용
   */
  colorFor(note: string, day: number, pack: GanttDataPack): string | null {
    const { pages, year, month, startField, endField } = pack;
    const pg = pages.find(p => (p.title || p.file?.name || "Untitled") === note);
    if (!pg) return null;

    const sDate = this.dv.date(pg[startField])?.toJSDate();
    const eDate = this.dv.date(pg[endField])?.toJSDate();
    if (!sDate || !eDate) return null;

    /* 현재 셀에 대응하는 날짜 */
    const cur = new Date(year, month, day);
    if (cur >= sDate && cur <= eDate)
      return this.gPalette.colorOf(note);

    return null;
  }
}

/*───────────────────────────────────────────────────────────────
  🔍  참고
      • gather-filter-palette 로직은 legacy GanttTable.ts 의
        C(팔레트) + D(데이터 수집) 구역을 그대로 분리-포팅했습니다. :contentReference[oaicite:0]{index=0}
      • colorFor() 판단 로직은 F(셀 색칠) 구역을 Model 용도로
        재구성한 것입니다. :contentReference[oaicite:1]{index=1}:contentReference[oaicite:2]{index=2}
───────────────────────────────────────────────────────────────*/
