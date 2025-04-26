import { App } from "obsidian";

/***********************************************************************
 * gantt_table.ts (최종 수정안)
 * 
 * 주요 변경 사항:
 * 1) gatherData()에서 확정된 colorPalette를 data.finalColorPalette에 저장.
 * 2) buildLegendHTML, buildLegendData에서 data.finalColorPalette를 사용해,
 *    범례 색상이 실제 표시 색상과 동일하게 맞춤.
 * 3) renderInteractiveBelow=true 시,
 *    - createResponsiveHR(dv.container)을 호출로 구분선 출력
 *    - engine.renderAutoView()로 InteractiveTable 제대로 표시.
 * 4) createResponsiveHR()가 실제 DOM 요소(dv.container)를 받아
 *    parentEl.createEl("hr")가 동작하도록 수정
 ***********************************************************************/

export class GanttTable {
  private noteColorMap: Record<string, { colorIndex: number | null }>;
  private colorIndex: number;
  private legendData: Record<string, string>;

  private isDarkMode: boolean;

  constructor(private app: App) {
    this.noteColorMap = {};
    this.colorIndex = 0;
    this.legendData = {};

    this.isDarkMode = document.body.classList.contains("theme-dark");
  }

  /**
   * (A) createResponsiveHR
   *    - Gantt 아래에 InteractiveTable을 붙일 때 시각적 구분선 사용
   *    - parentEl: 실제 DOM 컨테이너(예: dv.container)
   */
  private createResponsiveHR(parentEl: HTMLElement) {
    const hr = document.createElement("hr");
    if (this.isDarkMode) {
      hr.style.border = "1px solid #fff";
    } else {
      hr.style.border = "1px solid #000";
    }
    hr.style.margin = "10px 0";
    parentEl.appendChild(hr);
    return hr;
  }

  /**
   * (B) 다크/라이트 모드용 기본 팔레트
   */
  private defaultDarkPalettes: string[] = [
    "#ff6363", "#ffa600", "#ffcf00", "#8aff80", "#2effd3",
    "#00ffff", "#25c6fc", "#3399ff", "#9975e2", "#cc66cc",
    "#ff66ff", "#ff66cc", "#ff6699", "#ff6666", "#f06b60",
    "#ed7732", "#de9f00", "#afff68", "#53ffb4", "#2f9eff"
  ];
  private defaultLightPalettes: string[] = [
    "#ff9999", "#ffc04d", "#ffe680", "#b3ffb3", "#80fff2",
    "#80ffff", "#99daff", "#99c2ff", "#c2a3e8", "#df9edf",
    "#ff99ff", "#ff99e6", "#ff99c2", "#ff9999", "#f4a38c",
    "#f1b066", "#eec900", "#c5ff8a", "#84ffc9", "#74baff"
  ];

  /**
   * (C) 노트 → 색상 인덱스 할당
   */
  private assignColorToNote(noteTitle: string, colorPalette: string[]) {
    if (!this.noteColorMap[noteTitle]) {
      if (!Array.isArray(colorPalette) || colorPalette.length === 0) {
        this.noteColorMap[noteTitle] = { colorIndex: null };
      } else {
        const idx = this.colorIndex % colorPalette.length;
        this.noteColorMap[noteTitle] = { colorIndex: idx };
        this.colorIndex++;
      }
    }
  }
  private getNoteColor(noteTitle: string, colorPalette: string[]) {
    const entry = this.noteColorMap[noteTitle];
    if (!entry || entry.colorIndex === null) return "#999";
    return colorPalette[entry.colorIndex];
  }

  /**
   * (D) 데이터 수집: 다크/라이트 모드별 팔레트 확정 + 페이지 필터링
   */
  private gatherData(dv: any, settings: any) {
    this.isDarkMode = document.body.classList.contains("theme-dark");

    let finalColorPalette: string[];
    if (this.isDarkMode) {
      if (Array.isArray(settings.colorPaletteDark) && settings.colorPaletteDark.length > 0) {
        finalColorPalette = settings.colorPaletteDark;
      } else if (Array.isArray(settings.colorPalette) && settings.colorPalette.length > 0) {
        finalColorPalette = settings.colorPalette;
      } else {
        finalColorPalette = this.defaultDarkPalettes;
      }
    } else {
      // 라이트 모드
      if (Array.isArray(settings.colorPaletteLight) && settings.colorPaletteLight.length > 0) {
        finalColorPalette = settings.colorPaletteLight;
      } else if (Array.isArray(settings.colorPalette) && settings.colorPalette.length > 0) {
        finalColorPalette = settings.colorPalette;
      } else {
        finalColorPalette = this.defaultLightPalettes;
      }
    }

    const curr = dv.current?.();
    if (!curr?.file) {
      return {
        dv,
        allPages: [],
        year: 0,
        month: 0,
        totalDays: 0,
        finalColorPalette
      };
    }
    const currentFile = curr.file;

    let basePages: any[] = [];
    if (settings.customPages && Array.isArray(settings.customPages)) {
      basePages = settings.customPages;
    } else if (settings.path && typeof settings.path === "string") {
      basePages = dv.pages(`"${settings.path}"`)
        .where((p: any) => p.file.path !== currentFile.path)
        .array();
    } else {
      basePages = dv.pages()
        .where((p: any) => p.file.folder === currentFile.folder)
        .where((p: any) => p.file.path !== currentFile.path)
        .array();
    }

    let allPages = basePages.filter((p: any) => {
      let s = p.situation;
      if (s === "작업완료") return false;
      if (!p.created || !p.end) return false;
      return true;
    });

    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let totalDays = new Date(year, month + 1, 0).getDate();

    return { dv, allPages, year, month, totalDays, finalColorPalette };
  }

  /**
   * (E) 간트 테이블 생성
   */
  private buildGanttTable(settings: any, data: any) {
    const { allPages, totalDays } = data;

    let theadHTML = `
      <thead>
        <tr>
          <th class="gantt-corner-col"></th>
          ${
            Array.from({ length: totalDays }, (_, i) => {
              let d = i + 1;
              let dayStr = String(d).padStart(2, "0");
              return `<th class="gantt-day-col">${dayStr}</th>`;
            }).join("")
          }
        </tr>
      </thead>`;

    let tbodyHTML = "<tbody>";
    for (let page of allPages) {
      let fmTitle = page.title || page.file.name || "Untitled";
      let situation = page.situation || "";

      if (situation === "일시중지") {
        this.noteColorMap[fmTitle] = { colorIndex: null };
      } else {
        this.assignColorToNote(fmTitle, data.finalColorPalette);
      }

      tbodyHTML += `<tr>`;
      tbodyHTML += `<td class="gantt-note-col">${fmTitle}</td>`;

      for (let d = 1; d <= totalDays; d++) {
        tbodyHTML += `
          <td class="gantt-cell"
              data-note-title="${fmTitle}"
              data-day="${d}"
              data-situation="${situation}"></td>`;
      }
      tbodyHTML += `</tr>`;
    }
    tbodyHTML += "</tbody>";

    return `<table class="gantt-table">${theadHTML}${tbodyHTML}</table>`;
  }

  /**
   * (F) 범례
   */
  private getLegendColor(title: string, palette: string[]) {
    const entry = this.noteColorMap[title];
    if (!entry) return "#999";
    if (entry.colorIndex === null) return "#888";
    return palette[entry.colorIndex] || "#999";
  }
  private buildLegendHTML(settings: any, data: any) {
    // 이제 data.finalColorPalette에 실제 사용된 색상 배열이 있음
    const palette = data.finalColorPalette;
    let noteTitles = Object.keys(this.noteColorMap);
    if (noteTitles.length === 0) return "";

    noteTitles.sort();
    let legendItems = noteTitles.map(title => {
      let c = this.getLegendColor(title, palette);
      return `
        <div class="gantt-legend-item">
          <span class="gantt-legend-color" style="background-color:${c};"></span>
          <span class="gantt-legend-text">${title}</span>
        </div>`;
    }).join("");

    return `<div class="gantt-legend">${legendItems}</div>`;
  }
  private buildLegendData(data: any) {
    const palette = data.finalColorPalette;
    let result: Record<string, string> = {};
    for (const title in this.noteColorMap) {
      const entry = this.noteColorMap[title];
      if (!entry) {
        result[title] = "#999";
        continue;
      }
      if (entry.colorIndex === null) {
        result[title] = "#888";
      } else {
        result[title] = palette[entry.colorIndex] || "#999";
      }
    }
    return result;
  }
  public getLegendDataFromData(data: any) {
    return this.buildLegendData(data);
  }

  /**
   * (G) 렌더 함수
   */
  public async renderView(dv: any, settings: any = {}) {
    if (!dv.current?.() || !dv.current()?.file) {
      console.warn("GanttTable: No current file - returning quietly.");
      return;
    }
    if (!settings["id"] || typeof settings["id"] !== "string") {
      settings["id"] = "gantt-auto-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6);
    }

    this.isDarkMode = document.body.classList.contains("theme-dark");

    let now = new Date();
    let monthName = new Intl.DateTimeFormat("en", { month: "long" }).format(now);
    dv.paragraph(`🗓️ **${monthName}**`);

    // state 리셋
    this.noteColorMap = {};
    this.colorIndex = 0;
    this.legendData = {};

    // (1) 데이터 수집
    let data = this.gatherData(dv, settings);
    if (!data || data.year === 0 || data.totalDays === 0) {
      dv.paragraph("*(No Gantt data)*");
      return;
    }

    // (2) 테이블 + 범례
    let tableHTML = this.buildGanttTable(settings, data);
    let legendHTML = (settings.showLegend === false)
      ? ""
      : this.buildLegendHTML(settings, data);

    const container = document.createElement("div");
    container.classList.add("gantt-container");
    container.innerHTML = tableHTML + legendHTML;
    dv.container.appendChild(container);

    // (3) 색상 적용 + 오늘 강조
    this.applyNoteColors(container, data);
    this.highlightToday(container, data);

    // (4) legend data
    this.legendData = this.buildLegendData(data);
    if (settings.debugLegend === true) {
      dv.paragraph("**[Legend Data]**");
      dv.paragraph(JSON.stringify(this.legendData, null, 2));
    }

    // (5) renderInteractiveBelow
    if (settings.renderInteractiveBelow) {
      this.createResponsiveHR(dv.container);

      // 아래쪽 InteractiveTable
      const engine = (globalThis as any).coverTable.engine as any;
      if (engine?.renderAutoView) {
        await engine.renderAutoView(dv, settings.interactiveOptions ?? {});
      }
    }
  }

  /**
   * (H) applyNoteColors
   */
  private applyNoteColors(container: HTMLElement, data: any) {
    const { dv, allPages, year, month, finalColorPalette } = data;

    allPages.forEach((page: any) => {
      let fmTitle = page.title || page.file.name || "Untitled";
      let situation = page.situation || "";

      let noteColor = "#999";
      if (situation === "일시중지") noteColor = "#888";
      else noteColor = this.getNoteColor(fmTitle, finalColorPalette);

      let startDV = dv.date(page.created);
      let endDV   = dv.date(page.end);
      if (!startDV || !endDV) return;

      let startJS = startDV.toJSDate();
      let endJS   = endDV.toJSDate();

      let tds = container.querySelectorAll(`td[data-note-title="${fmTitle}"]`);
      tds.forEach((td: any) => {
        let d = parseInt(td.getAttribute("data-day"), 10);
        let thisDay = new Date(year, month, d);
        if (thisDay >= startJS && thisDay <= endJS) {
          td.style.setProperty("background-color", noteColor, "important");
        }
      });
    });
  }

  /**
   * (I) highlightToday
   */
  private highlightToday(container: HTMLElement, data: any) {
    let now = new Date();
    let todayDay = now.getDate();

    let dayCells = container.querySelectorAll(`td[data-day="${todayDay}"]`);
    dayCells.forEach(td => td.classList.add("gantt-today-col"));
  }
}
