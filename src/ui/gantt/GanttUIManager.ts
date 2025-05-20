/*****************************************************************
 * src/ui/gantt/GanttUIManager.ts – minimal port for v3.0.0
 *****************************************************************/

export class GanttUIManager {
  /** build wrapper, inject table + legend, return container */
  buildGantt(
    host: HTMLElement,
    headerText: string,
    tableHTML: string,
    legend: Record<string, string>,
    showLegend = true,
    showDivider = false,
  ): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "gantt-view";

    /* header */
    const h = document.createElement("div");
    h.className = "gantt-month-year";
    h.textContent = headerText;
    wrap.appendChild(h);

    /* table */
    const container = document.createElement("div");
    container.className = "gantt-container";
    container.innerHTML = tableHTML;
    wrap.appendChild(container);

    /* legend */
    if (showLegend) {
      const lg = document.createElement("div");
      lg.className = "gantt-legend";
      Object.entries(legend).forEach(([note, color]) => {
        const item = document.createElement("div");
        item.className = "gantt-legend-item";

        const sw = document.createElement("span");
        sw.className = "gantt-legend-color";
        sw.style.background = color;
        item.appendChild(sw);

        const lbl = document.createElement("span");
        lbl.textContent = note;
        item.appendChild(lbl);

        lg.appendChild(item);
      });
      wrap.appendChild(lg);
    }



    host.appendChild(wrap);
    return wrap;
  }

/** cell painter – controller supplies callback */
colorize(
  fn:     (note: string, day: number) => string | null,
  isEdge: (note: string, day: number) => "start" | "end" | null
) {
  document
    .querySelectorAll<HTMLTableCellElement>(".gantt-table td[data-note]")
    .forEach(td => {
      const note = td.dataset.note!;
      const day  = Number(td.dataset.day);

      /* ── 1) 배경색 지정 ───────────────────────── */
      const col = fn(note, day);
      if (col) {
        /* ① CSS 변수 주입 ② is-filled 클래스 부여 */
        td.style.setProperty("--gantt-color", col);
        td.classList.add("is-filled");
      } else {
        /* 색이 없을 때는 투명 → is-filled 제거 */
        td.classList.remove("is-filled");
        td.style.removeProperty("--gantt-color");
      }

      /* ── 2) 시작/끝 포인트 표시 ───────────────── */
      const edge = isEdge(note, day);
      if (edge) td.classList.add(`gantt-${edge}`);
    });
}



  /** highlight today column */
  highlightToday() {
    const d = new Date().getDate();
    document
      .querySelectorAll<HTMLTableCellElement>(`.gantt-table td[data-day='${d}']`)
      .forEach((td) => td.classList.add("is-today"));
  }
}
