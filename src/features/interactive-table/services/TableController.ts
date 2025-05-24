/*****************************************************************
 * src/features/interactive-table/services/TableController.ts
 * – auto-generated from legacy Cover-Table v2025-05
 *   • 전체 이관 코드 – 수정 금지
 *****************************************************************/

import {
  App,
  TFile,
  normalizePath,
  Notice,
} from "obsidian";
import { Log } from "../utils/log";

/*──────────────────────────────────────────────────────────────
  1. 타입
──────────────────────────────────────────────────────────────*/
export interface EditPropOptions {
  /** currently only `"file name"` 지원 */
  type : "file name";
  /** 대상 파일의 *Vault-relative* 경로 */
  path : string;
  /** 프런트매터/파일속성 등 – 차후 확장용 */
  prop?: string;
}

/*──────────────────────────────────────────────────────────────
  2. 서비스 클래스
──────────────────────────────────────────────────────────────*/
export default class TableController {
  /*─────────── 필드 ───────────*/
  private readonly dateYMDRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  private readonly timeHMRegex  = /^(\d{1,2}):(\d{1,2})$/;

  constructor(private readonly app: App) {}

  /*════════════════════════════════════════════
    A.  “인라인 편집” 공용 진입점
  ════════════════════════════════════════════*/
  /**
   * 파일 이름/프런트매터 등 *단일 프로퍼티* 수정용
   *
   * @example
   *   await svc.editProp({ type: "file name", path: "Diary/2025-05-13.md" });
   */
  async editProp(opts: EditPropOptions): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(opts.path));
    if (!(file instanceof TFile)) return;

    /* ① 파일 이름 변경 -------------------------------------------------- */
    if (opts.type === "file name") {
      const oldName = file.basename;
      const next = await this.textInput(oldName);
      if (!next || next === oldName) return;

      const folder = file.parent?.path ?? "";
      const ext    = file.extension;
      const dest   = folder ? `${folder}/${next}.${ext}` : `${next}.${ext}`;

      try {
        await this.app.vault.rename(file, dest);
        new Notice("✅ File renamed");
      } catch (e) {
        Log.e(e);
        new Notice("⚠️ Failed to rename file");
      }
    }

    /* ② 차후: 프런트매터/태그 등 ------------------------------ */
    // (prop / value 처리 코드는 InteractiveTable → this service 로
    //   옮기기만 했으며, 아직 UI 에서 호출되지 않는다.)
  }

  /*────────────────────────────────────────────
    A-1. 간단 입력 모달
  ────────────────────────────────────────────*/
  private async textInput(def: string): Promise<string | null> {
    return new Promise((resolve) => {
      const { Modal } = (globalThis as any).coverTable.obsidian;

      class PromptModal extends Modal {
        result = def;

        constructor(app: App) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h1", { text: "Input" });

          const input = contentEl.createEl("input", { value: this.result });
          input.style.width = "100%";

          input.addEventListener("keydown", (ev : KeyboardEvent) => {
            if (ev.key === "Enter") {
              this.result = input.value.trim();
              this.close();
              resolve(this.result);
            }
          });

          const ok = contentEl.createEl("button", { text: "OK" });
          ok.onclick = () => {
            this.result = input.value.trim();
            this.close();
            resolve(this.result);
          };
        }

        onClose() {
          this.contentEl.empty();
        }
      }

      new PromptModal(this.app).open();
    });
  }

  /*════════════════════════════════════════════
    B. 값 추출 / 날짜·시간 파싱 유틸
  ════════════════════════════════════════════*/
  /** Dataview Page → 임의 프로퍼티 값 */
  getVal(page: any, prop: string): any {
    return prop.startsWith("file.")
      ? prop.split(".").reduce((v, k) => v?.[k], page)
      : page[prop];
  }

  /** “YYYY-MM-DD” 혹은 Date.parse 가능한 문자열 → Date|null */
  parseDateYMD(str: string): Date | null {
    if (typeof str !== "string") return null;

    const m = str.match(this.dateYMDRegex);
    if (m) {
      const [_, y, mo, d] = m.map(Number);
      if (y < 1000 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31)
        return null;
      return new Date(y, mo - 1, d);
    }
    const dt = new Date(str);
    return isNaN(dt.getTime()) ? null : dt;
  }

  /** “HH:MM” → Date(today) | null  (정렬용) */
  parseTimeHM(str: string): Date | null {
    if (typeof str !== "string") return null;
    const m = str.match(this.timeHMRegex);
    if (!m) return null;

    const [_, hh, mm] = m.map(Number);
    if (hh > 23 || mm > 59) return null;

    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  /** 문자열·숫자·날짜 → 소팅 키 */
  getSortValue(v: any): string | number {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);

    const d = this.parseDateYMD(s) || this.parseTimeHM(s);
    if (d) return d.getTime();

    const n = parseFloat(s);
    return isNaN(n) ? s.toLowerCase() : n;
  }

  /** Date|string|null → “YYYY-MM-DD” */
  formatAsDate(v: any): string {
    if (v == null) return "";
    const d = this.parseDateYMD(String(v));
    if (!d) return String(v);

    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    return `${y}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`;
  }

  /*════════════════════════════════════════════
    C. 정렬 & 필터 – (InteractiveTable 동일 로직)
  ════════════════════════════════════════════*/
  /** in-place 정렬 (mutate) */
  sortByProp(arr: any[], prop: string | null, dir: "asc" | "desc" = "asc") {
    if (!prop || prop === "title_link" || prop === "tags") return arr;

    return arr.sort((a, b) => {
      const A = this.getSortValue(this.getVal(a, prop));
      const B = this.getSortValue(this.getVal(b, prop));

      if (typeof A === "number" && typeof B === "number")
        return dir === "asc" ? A - B : B - A;

      return dir === "asc"
        ? String(A).localeCompare(String(B))
        : String(B).localeCompare(String(A));
    });
  }

  /*════════════════════════════════════════════
    D. 제너럴 헬퍼
  ════════════════════════════════════════════*/
  /**
   * 옵션 리스트 → SuggestModal
   *  ‣ InteractiveTable 및 UI 모듈에서 직접 호출
   */
  async suggester(values: string[]): Promise<string | null> {
    const { SuggestModal } = (globalThis as any).coverTable.obsidian;
    return new Promise((resolve) => {
      class Sugg extends SuggestModal<string> {
        constructor(app: App) {
          super(app);
        }

        getSuggestions(q: string) {
          const ql = q.toLowerCase();
          return values.filter((v) => v.toLowerCase().includes(ql));
        }
        renderSuggestion(v: string, el: HTMLElement) {
          el.createEl("div", { text: v });
        }
        onChooseSuggestion(v: string) {
          resolve(v);
        }
      }
      new Sugg(this.app).open();
    });
  }
}
