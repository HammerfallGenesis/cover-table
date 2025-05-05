/***********************************************************************
 * src/main.ts – rev.2025-05-03 (FULL SOURCE, NO OMISSION)
 *   · 플러그인 Entry-Point
 *   · TabManager / InteractiveTable / GanttTable 부트스트랩
 *   · HeaderLabeller(번호매기기) & BaseTheme 주입
 ***********************************************************************/

import { CSS_VAR_MAP, CSS_VAR_MAP_GLOBAL } from "./setting";
import type { ModeColorConfig,
              CoverTableSettings }  from "./setting";
import {
  App, MarkdownPostProcessorContext, Modal,
  Notice, Plugin, SuggestModal
} from "obsidian";

import { TabManager }           from "./default/tab";
import { InteractiveTable }     from "./table/InteractiveTable";
import { GanttTable }           from "./table/GanttTable";
import {
  DEFAULT_SETTINGS,
  CoverTableSettingTab
} from "./setting";
import { BASE_THEME_CSS }       from "./theme/base";
import { HeaderLabeller }       from "./theme/headerLabeller";
import { ListCalloutManager } from "./theme/list";

/*──────────────────────────────────────────────────────────────
  0)  전역 네임스페이스(window.coverTable)
──────────────────────────────────────────────────────────────*/
declare global { interface Window { coverTable:any } }
(window as any).coverTable ??= {};
const ct = window.coverTable;
ct.waitForEngine ??= async (timeout=4_000)=>{
  const t0 = Date.now();
  while(Date.now()-t0<timeout){
    if(ct.engine) return ct.engine;
    await new Promise(r=>setTimeout(r,40));
  }
  throw new Error("coverTable.waitForEngine → timeout");
};

/*──────────────────────────────────────────────────────────────
   1)  플러그인 클래스
──────────────────────────────────────────────────────────────*/
export default class CoverTablePlugin extends Plugin{
  static readonly ZERO_FOLDER_STYLE_ID = "ct-hide-zero-folders";
  private tabManager!        : TabManager;
  private headerLabeller     : HeaderLabeller|null = null;
  private listCallouts!: ListCalloutManager;
  settings!                  : CoverTableSettings;

    /*───────────────────────────────────────────────────────────────
      applyZeroFolderVisibility()
      · File-Explorer에서 ‘0_’ prefix 폴더/파일을 display:none 처리
    ───────────────────────────────────────────────────────────────*/
    applyZeroFolderVisibility(): void {
      const styleId = CoverTablePlugin.ZERO_FOLDER_STYLE_ID;
      let tag = document.getElementById(styleId) as HTMLStyleElement | null;

      if (this.settings.hideZeroFolders) {
        if (!tag) {
          tag = document.createElement("style");
          tag.id = styleId;
          tag.textContent = `
    /* Cover-Table ► hide 0_ folders */
    .nav-file-title[data-path^="0_"],
    .nav-folder-title[data-path^="0_"],
    .nav-file-title[data-path*="/0_"],
    .nav-folder-title[data-path*="/0_"]{
      display:none!important;
    }`;
          document.head.appendChild(tag);
        }
      } else {
        tag?.remove();
      }
    }


  /* ─────────────── onload ─────────────── */
  async onload(){
    console.log("[Cover-Table] ▶ onload");

    /* (1) 한 파일-한 탭 관리 */
    this.tabManager = new TabManager(this.app);

    /* (2) InteractiveTable / GanttTable 싱글턴 */
    if(!ct.engine || typeof ct.engine.rerender!=="function"){
      ct.engine = new InteractiveTable(this.app);
    }
    if(!ct.gantt){
      ct.gantt  = new GanttTable(this.app);
    }

    /* (3) Obsidian helper 노출 */
    ct.obsidian = { Notice, Modal, SuggestModal };

    /* (4) 설정 로드 & Setting 탭 */
    await this.loadSettings();
    this.addSettingTab(new CoverTableSettingTab(this.app,this));
    this.applyDesignSettings();
    this.applyZeroFolderVisibility(); 
    this.listCallouts = new ListCalloutManager(this);
    this.registerEditorExtension(this.listCallouts.editorExtensions());
    this.registerMarkdownPostProcessor(this.listCallouts.postProcessor(), 10_000);
    this.reloadHeaderLabeller();             // ← 헤더 라벨러 적용/해제
    this.applyZeroFolderVisibility();

    /* 테마 변경 이벤트 → CSS 재주입 */
    this.registerEvent(
      this.app.workspace.on("css-change", () => this.applyDesignSettings())
    );

    /* (5) Markdown Post-Processor */
    this.registerMarkdownPostProcessor(
      async (el:HTMLElement, ctx:MarkdownPostProcessorContext) => {
        const codes = el.querySelectorAll<HTMLPreElement>(
          "pre > code.language-ct, pre > code.language-cover-table"
        );
        if(codes.length===0) return;

        const dv =
          (window as any).dataviewApi ||
          (window as any).DataviewAPI  ||
          (window as any).dvAPI;
        if(!dv){
          console.warn("[Cover-Table] Dataview API not found");
          return;
        }
        await ct.waitForEngine();

        for(const code of Array.from(codes)){
          try{
            const opts:any   = JSON.parse(code.textContent||"{}");
            const container  = code.parentElement as HTMLElement;

            /* Gantt view */
            if(opts.type==="gantt"){
              opts.renderInteractiveBelow ??= true;
              await ct.gantt.renderView(dv,opts,ctx,container);
              continue;
            }

            /* InteractiveTable view */
            const it = new InteractiveTable(this.app);
            await it.renderAutoView(dv,opts,ctx,container);
          }catch(e){ console.error("[Cover-Table] render error:", e); }
        }
      }
    );

    console.log("[Cover-Table] ▶ onload done");
  }

  /* ─────────────── onunload ─────────────── */
  onunload(){
    console.log("[Cover-Table] ▶ onunload");
    this.tabManager.destroy();
  }

  /*───────── Setting helpers ─────────*/
  async loadSettings(){
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings(){ 
    await this.saveData(this.settings);
    this.applyZeroFolderVisibility();
  }

  /*───────── Design & Theme 주입 ─────────*/
  applyDesignSettings() {
    /* ① Interactive-Table 색상 → CSS 변수(:root) */
    const mode = this.app.getTheme() === "obsidian-dark" ? "dark" : "light";
    const itCfg = this.settings.design[mode];
    const gCfg  = this.settings.globalTokens[mode];
    const root  = document.documentElement;

    /* Interactive-Table 전용 변수 */
    (Object.keys(CSS_VAR_MAP) as (keyof ModeColorConfig)[])
      .forEach(tok => root.style.setProperty(CSS_VAR_MAP[tok], itCfg[tok]));

    /* 🌟 Global Token 변수 */
    (Object.keys(CSS_VAR_MAP_GLOBAL) as (keyof GlobalTokenColorConfig)[])
      .forEach(tok => root.style.setProperty(CSS_VAR_MAP_GLOBAL[tok], gCfg[tok]));

    /* ② Base Theme CSS (전체 스타일 시트) */
    const idBase = "ct-base-theme";
    let stBase   = document.getElementById(idBase) as HTMLStyleElement | null;
    if (!stBase && this.settings.enableBaseTheme) {
      stBase    = document.createElement("style");
      stBase.id = idBase;
      document.head.appendChild(stBase);
    }
    if (stBase)
      stBase.textContent = this.settings.enableBaseTheme ? BASE_THEME_CSS : "";

    /* ③ Base-Theme 변수 오버라이드 (:root / .theme-dark) */
    const idVars = "ct-base-vars";
    let stVars   = document.getElementById(idVars) as HTMLStyleElement | null;
    if (!stVars) {
      stVars    = document.createElement("style");
      stVars.id = idVars;
      document.head.appendChild(stVars);
    }
    const vars      = this.settings.baseVars;
    const rootBlock : string[] = [];
    const darkBlock : string[] = [];
    Object.entries(vars).forEach(([k, v]) => {
      if (k.endsWith("-dark")) darkBlock.push(`${k}:${v};`);
      else                     rootBlock.push(`${k}:${v};`);
    });
    stVars.textContent = `
      :root{${rootBlock.join("")}}
      .theme-dark{${darkBlock.join("")}}
    `;

    /* ④ Custom CSS */
    const idCustom = "ct-custom-css";
    let stCustom   = document.getElementById(idCustom) as HTMLStyleElement | null;
    if (!stCustom) {
      stCustom    = document.createElement("style");
      stCustom.id = idCustom;
      document.head.appendChild(stCustom);
    }
    stCustom.textContent = this.settings.customCss || "";

    /* ⚠️ ⑤ Interactive-Table 전용 CSS  블록 제거
          ─ style.css 에 통합되므로 더 이상 주입하지 않습니다. */
  }




/*───────── HeaderLabeller 적용/해제 ─────────*/
reloadHeaderLabeller() {
  /* ① 기존 라벨러 해제 (Obsidian postProcessor 자동 소멸) */
  this.headerLabeller = null;

  /* ② 토글 OFF → 숨김 CSS 유지 & 라벨러 미생성 */
  if (!this.settings.enableHeaderNumbering) {
    /* 숨김 스타일이 없다면 추가 (헤더라벨러 인스턴스가 없어도 필요) */
    const id = "ct-hl-hide";
    if (!document.getElementById(id)) {
      const st = document.createElement("style");
      st.id = id;
      st.textContent = `.ct-hl-label{ display:none!important; }`;
      document.head.appendChild(st);
    }
    return;
  }

  /* ③ 토글 ON → 숨김 CSS 제거 & 라벨러 재등록 */
  const st = document.getElementById("ct-hl-hide");
  st?.remove();

  this.headerLabeller = new HeaderLabeller(this);
  this.headerLabeller.register();
}
}
