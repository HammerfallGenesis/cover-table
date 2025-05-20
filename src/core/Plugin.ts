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

import BASE_THEME_CSS from "../theme/css/base.css";

/* ── Feature 모듈 ─────────────────────────────────────────────── */
import { TabManager }           from "../features/tab-manager/TabManager";
import { InteractiveTableController as InteractiveTable } from "../features/interactive-table/InteractiveTableController";
import { GanttController        } from "../features/gantt/GanttController";

/* ── Theme / Service 모듈 ─────────────────────────────────────── */
import { HeaderNumberingService } from "../features/header-numbering/HeaderNumberingService";
import { ListCalloutManager    } from "../theme/ListCalloutManager";
import {
  EmbedService,
  DEFAULT_EMBED_SETTINGS,
} from "../features/embed/EmbedService";
import { DesignService } from "./theme/DesignService"; 

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

/* ▼ 모든 노트 숨김용 상수 ------------------------------------ */
const HIDE_NOTES_CLASS = "ct-hide-notes";          // body 클래스
const HIDE_NOTES_STYLE = `
/* Cover-Table → hide ALL notes */
body.${HIDE_NOTES_CLASS} .nav-file{ display:none !important; }
`;


/* ===============================================================
 *  2. Plugin 클래스 (Obsidian core)
 * =============================================================== */
export default class CoverTablePlugin extends Plugin {
  /* ── 필드 ─────────────────────────────────────────────────── */
  static readonly ZERO_FOLDER_STYLE_ID = "ct-hide-zero-folders";

  /** UI / Helper 싱글턴 */
  private tabManager!: TabManager;
  private headerNumbering: HeaderNumberingService | null = null;
  private listCallouts!: ListCalloutManager;
  private embed!: EmbedService;
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
.nav-file-title[data-path^="0_"],
.nav-folder-title[data-path^="0_"],
.nav-file-title[data-path*="/0_"],
.nav-folder-title[data-path*="/0_"]{ display:none!important; }`;
        document.head.appendChild(tag);
      }
    } else {
      tag?.remove();
    }
  }
/* -----------------------------------------------------------
 *  applyExplorerHide()
 *  · 모든 파일(nav-file)을 숨기거나 표시
 * ----------------------------------------------------------- */
applyExplorerHide(): void {
  /* <style> 최초 1회 삽입 */
  if (!this.explorerStyleEl) {
    this.explorerStyleEl = document.createElement("style");
    this.explorerStyleEl.id = "ct-hide-notes-style";
    this.explorerStyleEl.textContent = HIDE_NOTES_STYLE;
    document.head.appendChild(this.explorerStyleEl);
  }

  /* body 클래스 토글 */
  document.body.classList.toggle(
    HIDE_NOTES_CLASS,
    this.settings.hideAllNotes,
  );
}

  /* ===========================================================
   *  onload()
   * -----------------------------------------------------------
   *  · 플러그인 초기화 & 각 서브-모듈 부트스트랩
   * =========================================================== */
  async onload() {


    console.log("[Cover-Table] ▶ onload");
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
      console.log("[Cover-Table] fallback style injected ✔");
    } catch (e) {
      console.error("[Cover-Table] fallback style inject FAIL", e);
    }




    /* (1) 탭 관리 – “한 파일 = 한 탭” */
    this.tabManager = new TabManager(this.app);

    /* (2) InteractiveTable / Gantt 싱글턴 확보 */
    if (!ct.engine)              ct.engine = new InteractiveTable(this.app);
    if (!ct.ganttController)     ct.ganttController = new GanttController(this.app);
    /* Obsidian 헬퍼 Expose */
    ct.obsidian = { Notice, Modal, SuggestModal };

    /* (3) Settings */
   await this.loadSettings();

    /* ▼▼  예외 가드 ▼▼ */
    try {
      const st = new CoverTableSettingTab(this.app, this);
      this.addSettingTab(st);
      console.log("🆗 CoverTableSettingTab 등록 완료");
    } catch (e) {
      console.error("❌ SettingTab 생성 실패:", e);
      new Notice("Cover-Table 설정 UI 로드 실패 — 콘솔(DevTools)을 확인하세요.");
    }

    this.applyZeroFolderVisibility();
    this.applyExplorerHide();          // ← 신규 토글 초기 상태 적용


    /* (4) 📎 Embed (Drag / Paste) */
    this.embed = new EmbedService(this, () => this.settings.embed);
    this.embed.enable();

    /* (5) List-Callout & Header-Numbering */
    this.listCallouts = new ListCalloutManager(this);
    this.registerEditorExtension(this.listCallouts.editorExtensions());
    this.registerMarkdownPostProcessor(this.listCallouts.postProcessor(), 10_000);
    this.reloadHeaderNumbering();

/* (6) 테마 변경 → DesignService 내부에서 자동 처리 */
this.design = new DesignService(this.app, () => this.settings);

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
          console.warn("[Cover-Table] Dataview API not found");
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
            console.error("[Cover-Table] render error:", e);
          }
        }
      }
    );

    console.log("[Cover-Table] ▶ onload done");
  }

  /* ===========================================================
   *  onunload()
   * -----------------------------------------------------------
   *  · 리스너 / 싱글턴 해제
   * =========================================================== */
  onunload() {
    console.log("[Cover-Table] ▶ onunload");
    this.tabManager.destroy();
    this.embed.destroy();
  }

  /* ===========================================================
   *  Settings helpers
   * =========================================================== */
  async loadSettings() {
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    /* ↳ Embed 기본값 병합 */
    this.settings.embed = Object.assign({}, DEFAULT_EMBED_SETTINGS, this.settings.embed);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyZeroFolderVisibility();
    this.applyExplorerHide();          // 신규

    this.embed.reload();
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
   *  Header Numbering(Toggle)
   * =========================================================== */
  reloadHeaderNumbering() {
    /* (A) 기존 제거 */
    this.headerNumbering = null;

    /* (B) 토글 OFF → 숨김 CSS 유지 & 종료 */
    if (!this.settings.enableHeaderNumbering) {
      if (!document.getElementById("ct-hn-hide")) {
        const st = document.createElement("style");
        st.id = "ct-hn-hide";
        st.textContent = `.ct-hn-label{ display:none!important; }`;
        document.head.appendChild(st);
      }
      return;
    }

    /* (C) 토글 ON → 서비스 재등록 */
    document.getElementById("ct-hn-hide")?.remove();
    this.headerNumbering = new HeaderNumberingService(this);
    this.headerNumbering.register();
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

}

/* ===============================================================
 *                      ⛔  END OF FILE  ⛔
 * =============================================================== */
