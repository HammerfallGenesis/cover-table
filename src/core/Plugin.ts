/*****************************************************************
 * src/core/Plugin.ts – auto-generated from legacy Cover-Table v2025-05
 *****************************************************************/

/* ===============================================================
 *  0. 외부 모듈 & 타입
 * ---------------------------------------------------------------
 *  · Obsidian 플러그인 API
 *  · Cover-Table 서브-모듈(새 디렉터리 구조 기준 import)
 * =============================================================== */
import {
  App,
  MarkdownPostProcessorContext,
  Modal,
  Notice,
  Plugin,
  SuggestModal,
} from "obsidian";
import { readFileSync } from "fs";
import { join } from "path";
import { FileSystemAdapter } from "obsidian";   // ← 추가


/* ── 공통 설정 & CSS 변수 맵 ──────────────────────────────────── */
import {
  DEFAULT_SETTINGS,
  CoverTableSettings,
  CoverTableSettingTab,
} from "../setting";

/* ── Feature 모듈 ─────────────────────────────────────────────── */
import { InteractiveTableController as InteractiveTable } from "../features/interactive-table/InteractiveTableController";
import { GanttController        } from "../features/gantt/GanttController";

/* ── Theme / Service 모듈 ─────────────────────────────────────── */
import { ListCalloutManager    } from "../theme/ListCalloutManager";
import { DesignService } from "./theme/DesignService"; 
import { EventBus } from "./events/EventBus";

import { Log } from "../features/interactive-table/utils/log";

import { cloneRootStyleToLeaves } from "../features/interactive-table/utils/cloneRootStyle";

/* ===============================================================
 *  1. 전역 네임스페이스(window.coverTable)
 *    · InteractiveTable 싱글턴 & 헬퍼 노출
 * =============================================================== */
declare global { interface Window { coverTable: any } }
window.coverTable ??= {};
const ct = window.coverTable;

/** 엔진(Renderer) 초기화 대기 – 다른 모듈에서 await 가능 */
ct.waitForEngine ??= async (timeout = 4_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (ct.engine) return ct.engine;
    await new Promise(r => setTimeout(r, 40));
  }
  throw new Error("coverTable.waitForEngine → timeout");
};



/* ===============================================================
 *  2. Plugin 클래스 (Obsidian core)
 * =============================================================== */
export default class CoverTablePlugin extends Plugin {
  /* ── 필드 ─────────────────────────────────────────────────── */
  static readonly ZERO_FOLDER_STYLE_ID = "ct-hide-zero-folders";

  /** UI / Helper 싱글턴 */

  private listCallouts!: ListCalloutManager;
  private design!: DesignService;
  private explorerStyleEl: HTMLStyleElement | null = null;


  /** 사용자 설정(SettingTab → 저장/로드) */
  public settings!: CoverTableSettings;

  /* -----------------------------------------------------------
   *  applyZeroFolderVisibility()
   *  · “0_” prefix 폴더를 탐색기에서 숨김
   * ----------------------------------------------------------- */
  applyZeroFolderVisibility(): void {
    const id = CoverTablePlugin.ZERO_FOLDER_STYLE_ID;
    let tag = document.getElementById(id) as HTMLStyleElement | null;

    if (this.settings.hideZeroFolders) {
      if (!tag) {
        tag = document.createElement("style");
        tag.id = id;
        tag.textContent = `
/* Cover-Table ► hide 0_ folders */

.nav-folder-title[data-path^="0_"],

.nav-folder-title[data-path*="/0_"]{ display:none!important; }`;
        document.head.appendChild(tag);
      }
    } else {
      tag?.remove();
    }
  }
/** 
 * Explorer 노트 숨김 
 * 단, data-path^="0_" 으로 시작하는 폴더 내부는 제외 
 */
applyExplorerHide(): void {
  if (!this.explorerStyleEl) {
    this.explorerStyleEl = document.createElement("style");
    this.explorerStyleEl.id = "ct-hide-notes-style";
    this.explorerStyleEl.textContent = `
/* hide all files except under "0_" folders */
.nav-file-title:not([data-path^="0_"]):not([data-path*="/0_"]) {
  display: none !important;
}
`;
    document.head.appendChild(this.explorerStyleEl);
  }
}


  /* ===========================================================
   *  onload()
   * -----------------------------------------------------------
   *  · 플러그인 초기화 & 각 서브-모듈 부트스트랩
   * =========================================================== */
  async onload() {
    EventBus.init(this.app);


    Log.d("[Cover-Table] ▶ onload");
    /* ▼ ① style.css 강제 주입 (manifest 경로 버그 우회) */
    try {
      /* ‣ getBasePath() 는 FileSystemAdapter 에만 존재 → 타입 캐스팅 */
      const base =
        this.app.vault.adapter instanceof FileSystemAdapter
          ? (this.app.vault.adapter as FileSystemAdapter).getBasePath()
          : "";                         // Web-/Mobile 환경일 때는 빈 문자열


      const pluginDir = this.manifest.dir || "";
      const absPath = join(base, pluginDir, "style.css");

      const cssText = readFileSync(absPath, "utf8");
      const tag = document.createElement("style");
      tag.id = "ct-style-fallback";
      tag.textContent = cssText;
      document.head.appendChild(tag);
      /* 플러그인 언로드 시 자동 제거 */
      this.register(() => tag.remove());
      Log.d("[Cover-Table] fallback style injected ✔");
    } catch (e) {
      Log.d("[Cover-Table] fallback style inject FAIL", e);
    }





    /* (2) InteractiveTable / Gantt 싱글턴 확보 */
    if (!ct.engine)              ct.engine = new InteractiveTable(this.app);
    if (!ct.ganttController)     ct.ganttController = new GanttController(this.app);
    /* Obsidian 헬퍼 Expose */
    ct.obsidian = { Notice, Modal, SuggestModal };

    /* (3) Settings */
   await this.loadSettings();
   Log.setDebug(this.settings.debugLog);

    /* ▼▼  예외 가드 ▼▼ */
    try {
      const st = new CoverTableSettingTab(this.app, this);
      this.addSettingTab(st);
      Log.d("🆗 CoverTableSettingTab 등록 완료");
    } catch (e) {
      Log.e("❌ SettingTab 생성 실패:", e);
      new Notice("Cover-Table 설정 UI 로드 실패 — 콘솔(DevTools)을 확인하세요.");
    }

    this.applyZeroFolderVisibility();
    this.applyExplorerHide();          // ← 신규 토글 초기 상태 적용

    /* (5) List-Callout & Header-Numbering */
    this.listCallouts = new ListCalloutManager(this);
    this.registerEditorExtension(this.listCallouts.editorExtensions());
    this.registerMarkdownPostProcessor(this.listCallouts.postProcessor(), 10_000);

/* (6) 테마 변경 → DesignService 내부에서 자동 처리 */
this.design = new DesignService(this.app, () => this.settings);


    /* Tag prefix colours inside notes */
    const ctTagColoursDark: Record<string, string> = {
      topic: "#ff5555",
      method: "#ff9900",
      project: "#ffeb3b",
      region: "#55ff55",
      type: "#55ffdd",
      person: "#5574ff",
    };
    const ctTagColoursLight: Record<string, string> = {
      topic: "#8b0000",
      method: "#8b4500",
      project: "#666600",
      region: "#006400",
      type: "#006661",
      person: "#000266",
    };

    const ctTagStyleId = "ct-tag-colors";
    const ctApplyTagStyles = (doc: Document = document) => {
      const rules: string[] = [];
      for (const p of Object.keys(ctTagColoursDark)) {
        const dark = ctTagColoursDark[p];
        const light = ctTagColoursLight[p];
        rules.push(
          `.tag[href^="#${p}"]{color:${dark};}`,
          `.multi-select-pill[data-value^="#${p}"], .multi-select-pill[data-value^="${p}"]{background:${dark};border-color:${dark};color:black;}`,
          `.multi-select-pill[data-value^="#${p}"] svg.svg-icon.lucide-x, .multi-select-pill[data-value^="${p}"] svg.svg-icon.lucide-x { color:black; }`,
          `.markdown-source-view.mod-cm6 span.cm-hashtag[data-tag^="#${p}"]{color:${dark};}`,
          `.theme-light .tag[href^="#${p}"]{color:${light};}`,
          `.theme-light .multi-select-pill[data-value^="#${p}"], .theme-light .multi-select-pill[data-value^="${p}"]{background:${light};border-color:${light};color:white;}`,
          `.theme-light .multi-select-pill[data-value^="#${p}"] svg.svg-icon.lucide-x, .theme-light .multi-select-pill[data-value^="${p}"] svg.svg-icon.lucide-x { color:white; }`,
          `.theme-light .markdown-source-view.mod-cm6 span.cm-hashtag[data-tag^="#${p}"]{color:${light};}`
        );
      }
      let st = doc.getElementById(ctTagStyleId) as HTMLStyleElement | null;
      if (!st) {
        st = doc.createElement("style");
        st.id = ctTagStyleId;
        doc.head.appendChild(st);
      }
      st.textContent = rules.join("\n");
    };

    const ctApplyTagPillValues = () => {
      document.querySelectorAll<HTMLElement>(".multi-select-pill").forEach((p) => {
        const s = p.querySelector<HTMLSpanElement>(".multi-select-pill-content span");
        if (!s) return;
        const value = s.textContent || "";
        p.setAttribute("data-value", value);
      });
    };

    ctApplyTagStyles();
    ctApplyTagPillValues();
    const ctPillObserver = new MutationObserver(() => {
      ctApplyTagPillValues();
      ctApplyTagStyles();
    });
    ctPillObserver.observe(document.body, { childList: true, subtree: true });
    this.register(() => ctPillObserver.disconnect());
    cloneRootStyleToLeaves(this.app);






    /* (7) Dataview 코드펜스 렌더러 */
    this.registerMarkdownPostProcessor(
      async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const codes = el.querySelectorAll<HTMLPreElement>(
          "pre > code.language-ct, pre > code.language-cover-table"
        );
        if (codes.length === 0) return;

        const dv =
          (window as any).dataviewApi ||
          (window as any).DataviewAPI ||
          (window as any).dvAPI;
        if (!dv) {
          Log.w("[Cover-Table] Dataview API not found");
          return;
        }
        await ct.waitForEngine();

        /* 각 코드펜스 처리 */
        for (const code of Array.from(codes)) {
          try {
            const opts: any = JSON.parse(code.textContent || "{}");
            const container = code.parentElement as HTMLElement;

            /* --- Gantt --- */
            if (opts.type === "gantt") {
              opts.renderInteractiveBelow ??= true;
              await ct.ganttController.renderView(dv, opts, ctx, container);
              continue;
            }

            /* --- InteractiveTable --- */
            if (ctx)
              await ct.engine.renderAutoView(dv, opts, ctx, container);
          } catch (e) {
            Log.e("[Cover-Table] render error:", e);
          }
        }
      }
    );

    Log.d("[Cover-Table] ▶ onload done");


/* === Cover-Table: suppress benign vault-delete console noise ========== */
window.addEventListener("unhandledrejection", (ev) => {
  /* 필터링하고 싶은 메시지를 여기에 추가 */
  const msg = String(ev.reason?.message || ev.reason || "").toLowerCase();

  /* 1) 노트 삭제·휴지통 이동 중 발생하는 children TypeError */
  if (msg.includes("cannot read properties of null") &&
      msg.includes("children")) {
    ev.preventDefault();               // 콘솔 오류 숨김
    return;
  }
  /* 2) 일부 환경에서 노트 이동·삭제 시 뜨는 illegal access */
  if (msg.includes("illegal access")) {
    ev.preventDefault();               // 콘솔 오류 숨김
  }
});
/* ===================================================================== */

/* onload() 마지막에 */
  this.registerEvent(
    this.app.workspace.on("layout-change", () => {
      cloneRootStyleToLeaves(this.app);
    })
  );
  this.registerEvent(
    this.app.workspace.on("css-change", () => {
      cloneRootStyleToLeaves(this.app);
      ctApplyTagStyles();
    })
  );
  this.registerEvent(
    this.app.workspace.on("window-open", (_leaf, win) => {
      cloneRootStyleToLeaves(this.app);
      ctApplyTagStyles(win.document);
    })
  );


  }

  /* ===========================================================
   *  onunload()
   * -----------------------------------------------------------
   *  · 리스너 / 싱글턴 해제
   * =========================================================== */
  onunload() {
    Log.d("[Cover-Table] ▶ onunload");


    EventBus.i.off(ct.ganttController.refreshByBus.bind(ct.ganttController));
  }

  /* ===========================================================
   *  Settings helpers
   * =========================================================== */
  async loadSettings() {
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    /* ↳ Embed 기본값 병합 */
  }

  async saveSettings() {
    await this.saveData(this.settings);
    Log.setDebug(this.settings.debugLog);
    this.applyZeroFolderVisibility();

    this.applyDesignSettings();

    cloneRootStyleToLeaves(this.app);
  }

  /* ===========================================================
   *  Theme / Design 적용
   * =========================================================== */
  /* ===========================================================
   *  Theme / Design 적용
   * =========================================================== */
  applyDesignSettings() {
    const mode = this.app.getTheme() === "obsidian-dark" ? "dark" : "light";
    const root = document.documentElement;


    /* (4) Base-Theme 변수 오버라이드 */
    const idVars = "ct-base-vars";
    let stVars = document.getElementById(idVars) as HTMLStyleElement | null;
    if (!stVars) {
      stVars = document.createElement("style");
      stVars.id = idVars;
      document.head.appendChild(stVars);
    }
    const vars = this.settings.baseVars;
    const rootBlock: string[] = [];
    const darkBlock: string[] = [];
    Object.entries(vars).forEach(([k, v]) => {
      (k.endsWith("-dark") ? darkBlock : rootBlock).push(`${k}:${v};`);
    });
    stVars.textContent = `
      :root{${rootBlock.join("")}}
      .theme-dark{${darkBlock.join("")}}
    `;

    /* (5) Custom CSS */
    const idCustom = "ct-custom-css";
    let stCustom = document.getElementById(idCustom) as HTMLStyleElement | null;
    if (!stCustom) {
      stCustom = document.createElement("style");
      stCustom.id = idCustom;
      document.head.appendChild(stCustom);
    }
    stCustom.textContent = this.settings.customCss || "";
  }


  /* ===========================================================
 *  List-Callout helpers
 *  · SettingTab → commit() 에서 호출
 * =========================================================== */
public rebuildListCallouts(): void {
  /* listCallouts 가 초기화된 뒤에만 동작 */
  if (this.listCallouts) {
    this.listCallouts.rebuild();
  }
}

public reloadEmbed(): void {
}
}

/* ===============================================================
 *                      ⛔  END OF FILE  ⛔
 * =============================================================== */
