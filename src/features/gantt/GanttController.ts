/*****************************************************************
 * src/features/gantt/GanttController.ts – auto-generated from
 * legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

import {
  App,
  MarkdownPostProcessorContext,
  TFile
} from "obsidian";
import { EventBus } from "../../core/events/EventBus";
import { GanttModel, GanttSettings, GanttDataPack } from "./GanttModel";
import { GanttUIManager } from "../../ui/gantt/GanttUIManager";
import { Log } from "../interactive-table/utils/log";

/*───────────────────────────────────────────────────────────────
  📡  GanttController
  -------------------------------------------------------------
  · Model-View 중재 계층
    ① GanttModel 로 데이터 계산
    ② GanttUIManager 로 DOM 구축
    ③ 셀 색상 · 오늘 강조 · InteractiveTable 연동
───────────────────────────────────────────────────────────────*/
export class GanttController {
  private readonly ui = new GanttUIManager();
  private _rendering = false;
  private readonly busCb: (file?: TFile) => void;

  constructor(private readonly app: App) {
    this.busCb = this.refreshByBus.bind(this);
    EventBus.i.on(this.busCb);
    (this as any).__cover_unload__ = () => EventBus.i.off(this.busCb);
  }

  /*=============================================================
   *  renderView()
   * ------------------------------------------------------------
   *  @param dv        Dataview API
   *  @param settings  코드펜스 옵션 (GanttSettings)
   *  @param ctx       MarkdownPostProcessorContext
   *  @param hostPre   ```dataviewjs``` <pre> 엘리먼트
   *===========================================================*/
  public async renderView(
    dv       : any,
    settings : GanttSettings = {},
    ctx?     : MarkdownPostProcessorContext,
    hostPre? : HTMLElement,
  ): Promise<void> {
    if (this._rendering) return;
    this._rendering = true;

    try {
      /* 0) 옵션 기본값 확정 – legacy 규칙과 동일 */               /* :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1} */
      settings.renderInteractiveBelow ??= true;
      settings.showLegend             ??= true;
      settings.forceInteractiveBelow  ??= false;
      if (settings.forceInteractiveBelow) settings.renderInteractiveBelow = true;

      /* 1) current page 확보(canvas 지원) */                      /* :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3} */
      let cur = dv.current?.();
      if ((!cur || !cur.file) && ctx?.sourcePath) cur = dv.page(ctx.sourcePath);
      if (!cur?.file) {
        Log.w("[Gantt] current page not found – abort");
        return;
      }

      /* DataviewJS 에서 canvas 지원을 위해 dv.current 임시 패치 */  /* :contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5} */
      const origCurrent = dv.current;
      (dv as any).current = () => cur;

      /* 2) Model 계산 */
      const model = new GanttModel(this.app, dv, settings, ctx);
      const pack  = model.compute();

      /* 3) UI 컨테이너 결정 */
      let host: HTMLElement;
      if (hostPre) {
        /* 코드펜스일 때 – <pre> 바로 위에 삽입 */
        host = hostPre;
      } else {
        /* Dataview 블록일 때 – dv.container 사용 */
        host = dv.container;
      }

      /* 4) 월·연 헤더 텍스트 */
      const monthName = new Intl.DateTimeFormat("en", {
        month: "long",
      }).format(new Date(pack.year, pack.month, 1));
      const headerText = `${monthName} ${pack.year}`;

      /* 5) Gantt UI 빌드 */
      const wrap = this.ui.buildGantt(
        host,
        headerText,
        this.buildTableHTML(pack),
        pack.legend,
        (settings.showLegend ?? true),
        settings.renderInteractiveBelow /* divider 표시 여부 */
      );

      /* 6) 셀 색칠 & 오늘 강조 */
      this.ui.colorize(
        (title, d) => model.colorFor(title, d, pack),
        (title, d) => {
          const { startField, endField, pages, year, month } = pack;
          const pg = pages.find(p => (p.title || p.file?.name) === title);
          if (!pg) return null;

const sDt = dv.date(pg[startField]);
const eDt = dv.date(pg[endField]);

// DateTime → day 추출 (해당 월·연도도 함께 비교)
if (sDt && sDt.year === year && sDt.month - 1 === month && sDt.day === d)
  return "start";
if (eDt && eDt.year === year && eDt.month - 1 === month && eDt.day === d)
  return "end";
return null;
        }
      );

      this.ui.highlightToday();

      /* 7) InteractiveTable 연동 */
      if (settings.renderInteractiveBelow) {
        const engine = (window as any).coverTable?.engine;
        if (engine) {
          // await engine.renderAutoView(
          //   dv,
          //   settings.interactiveOptions ?? {},
          //   ctx,
          //   wrap /* hostPre 대신 wrap 아래에 렌더 */
          // );
          const itMount = wrap.createDiv({ cls: "ct-it-mount" }); /* 💡 전용 컨테이너 */
          if (ctx)
            await engine.renderAutoView(
              dv,
              settings.interactiveOptions ?? {},
              ctx,
              itMount
            );
        }
      }

      /* 8) 디버그 – legend JSON 프린트 */
      if (settings.debugLegend) {
        const pre = wrap.createEl("pre", { cls: "gantt-debug" });
        pre.innerText = JSON.stringify(pack.legend, null, 2);
      }

      /* restore */
      (dv as any).current = origCurrent;
    } finally {
      this._rendering = false;
    }
  }

  /*─────────────────────────────────────────────────────────────
    🔧  내부 헬퍼 – 테이블 HTML 생성
    · Model ←→ UI 경계에 남겨두면 Controller 테스트가 쉬워짐
  ─────────────────────────────────────────────────────────────*/
  private buildTableHTML(pack: GanttDataPack): string {
    const { pages, daysInMonth } = pack;

    /* ── thead ── */
    const headCols = Array.from({ length: daysInMonth }, (_, i) =>
      `<th class="gantt-day-col">${String(i + 1).padStart(2, "0")}</th>`
    ).join("");
    const thead = `<thead><tr><th class="gantt-corner-col"></th>${headCols}</tr></thead>`;

    /* ── tbody ── */
    let tbody = "<tbody>";
    pages.forEach(pg => {
      const title = pg.title || pg.file?.name || "Untitled";
      tbody += `<tr><td class="gantt-note-col">${title}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        tbody += `<td class="gantt-cell" data-note="${title}" data-day="${d}"></td>`;
      }
      tbody += "</tr>";
    });
    tbody += "</tbody>";

    return `<table class="gantt-table">${thead}${tbody}</table>`;
  }

private refreshByBus(file?: TFile) {
  if (this._rendering) return;


 // ── Canvas 파일은 프론트매터·날짜필드가 없으므로 Gantt 새로고침 대상에서 제외
 if (file?.extension === "canvas") return;


  const dv = (this.app as any).plugins?.plugins?.dataview?.api;
  if (!dv) {
    Log.w("[Gantt] Dataview API not available.");
    return;
  }

  const activeFile = this.app.workspace.getActiveFile();
  if (!activeFile || activeFile.extension === "canvas") return;
  if (!activeFile) {
    Log.w("[Gantt] No active file found.");
    return;
  }

  // 변경된 파일과 활성 파일이 다르면 무시
  if (file && file.path !== activeFile.path) return;

  const settings: GanttSettings = {
    renderInteractiveBelow: true,
    showLegend: true
  };

  const existingGanttView = document.querySelector(".gantt-view") as HTMLElement | null;
  if (!existingGanttView) {
    Log.w("[Gantt] Gantt host container not found.");
    return;
  }

  const host = existingGanttView.parentElement;
  if (!host) {
    Log.w("[Gantt] Gantt host parent element not found.");
    return;
  }

  existingGanttView.remove(); // 기존 DOM 제거 (중요)

  // 정상 출력을 위해서 최소한의 ctx 제공 (타입 오류 우회)
  const ctx = {
    sourcePath: activeFile.path,
    frontmatter: this.app.metadataCache.getFileCache(activeFile)?.frontmatter ?? {},
    getSectionInfo: () => null,
    docId: "",              // 필수 요소 추가 (빈 문자열 제공으로 해결)
    addChild: () => null    // 필수 메서드 추가
  } as unknown as MarkdownPostProcessorContext;  // 타입 문제 안전하게 우회

  this.renderView(dv, settings, ctx, host);
}






}

/*───────────────────────────────────────────────────────────────
  🎓  주석
  -------------------------------------------------------------
  · buildTableHTML · 색칠 로직 등은 legacy GanttTable.ts 의
    E(HTML 빌드) – F(페인팅) 구역을 재구성하여 Controller 책임에
    맞게 옮겨온 것입니다.
:contentReference[oaicite:6]{index=6}
───────────────────────────────────────────────────────────────*/
