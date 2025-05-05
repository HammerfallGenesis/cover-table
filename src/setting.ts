/***********************************************************************
 * setting.ts – rev.2025-05-11-zero-folder
 *   • **0_ 폴더 숨김 토글(hideZeroFolders) 추가**                  *
 *   • “⚙️ General” 섹션에 UI   (+ plugin.applyZeroFolderVisibility) *
 *   • FULL SOURCE – 복사‧붙여넣기용                                *
 ***********************************************************************/

import {
  App,
  PluginSettingTab,
  Setting,
  ColorComponent,
  TextComponent,
  Notice,
} from "obsidian";
import type CoverTablePlugin from "./main";

/*───────────────────────────────────────────────────────────────
  0.  Type Definitions
───────────────────────────────────────────────────────────────*/
export interface ModeColorConfig {
  buttonColor      : string;
  buttonHoverColor : string;
  itHeaderBg       : string;
  itHeaderFg       : string;
  itRowOdd         : string;
  itRowEven        : string;
  itRowHover       : string;
  itBorder         : string;
  itBorderV         : string;
}
export interface DesignOptions { dark: ModeColorConfig; light: ModeColorConfig; }
export type   BaseThemeVars   = Record<string, string>;

export interface ListCallout {
  char    : string;
  bgLight : string;
  bgDark  : string;
  fgLight : string;
  fgDark  : string;
}

export interface CoverTableSettings {
  enableBaseTheme      : boolean;
  enableHeaderNumbering: boolean;
  /** ◀ NEW – “0_” 폴더 숨김 */
  hideZeroFolders      : boolean;
  design               : DesignOptions;
  globalTokens         : GlobalTokenDesign;       /* ← NEW */
  baseVars             : BaseThemeVars;
  customCss            : string;
  listCallouts         : ListCallout[];
}

/*───────────────────────────────────────────────────────────────
  0-B.  Global Token Color Config  ← NEW
───────────────────────────────────────────────────────────────*/
export interface GlobalTokenColorConfig {
  /* GANTT */
  gHeaderBg      : string;   /* --g-h-bg            */
  gHeaderFg      : string;   /* --g-h-fg            */
  gLine          : string;   /* --g-line            */
  gRowOdd        : string;   /* --g-row-odd         */
  gRowEven       : string;   /* --g-row-even        */
  gRowHover      : string;   /* --g-row-hover       */
  gTodayOutline  : string;   /* --g-today-outline   */

  /* INTERACTIVE TABLE */
  itHeaderBg     : string;   /* --it-header-bg      */
  itHeaderFg     : string;   /* --it-header-fg      */
  itRowOdd       : string;   /* --it-row-odd        */
  itRowEven      : string;   /* --it-row-even       */
  itRowHover     : string;   /* --it-row-hover      */
  itBorder       : string;   /* --it-border         */
  itBorderV       : string;   /* --it-border-v         */

  /* BUTTONS / HEADER BAR / SEPARATORS */
  btnBg          : string;   /* --btn-bg            */
  btnBgHover     : string;   /* --btn-bg-hover      */
  btnFg          : string;   /* --btn-fg            */
  btnGradTop     : string;   /* --btn-grad-top      */
  btnGradBottom  : string;   /* --btn-grad-bottom   */
  hdrBarBg       : string;   /* --hdr-bar-bg        */
  sepColor       : string;   /* --sep-color         */
}

export interface GlobalTokenDesign { dark: GlobalTokenColorConfig; light: GlobalTokenColorConfig; }

/*───────────────────────────────────────────────────────────────
  0-C.  CSS Token ↔ CSS Var Map (Global Tokens)  ← NEW
───────────────────────────────────────────────────────────────*/
export const CSS_VAR_MAP_GLOBAL: Record<keyof GlobalTokenColorConfig, string> = {
  gHeaderBg     : "--g-h-bg",
  gHeaderFg     : "--g-h-fg",
  gLine         : "--g-line",
  gRowOdd       : "--g-row-odd",
  gRowEven      : "--g-row-even",
  gRowHover     : "--g-row-hover",
  gTodayOutline : "--g-today-outline",

  itHeaderBg    : "--it-header-bg",
  itHeaderFg    : "--it-header-fg",
  itRowOdd      : "--it-row-odd",
  itRowEven     : "--it-row-even",
  itRowHover    : "--it-row-hover",
  itBorder      : "--it-border",
  itBorderV     : "--it-border-v", 

  btnBg         : "--btn-bg",
  btnBgHover    : "--btn-bg-hover",
  btnFg         : "--btn-fg",
  btnGradTop    : "--btn-grad-top",
  btnGradBottom : "--btn-grad-bottom",
  hdrBarBg      : "--hdr-bar-bg",
  sepColor      : "--sep-color",
};


/*───────────────────────────────────────────────────────────────
  1.  Defaults
───────────────────────────────────────────────────────────────*/
export const DEFAULT_IT_COLOR: ModeColorConfig = {
  buttonColor      : "#7a481d",
  buttonHoverColor : "rgba(140,70,30,0.9)",
  itHeaderBg       : "#7a481d",
  itHeaderFg       : "#fff0e6",
  itRowOdd         : "rgba(160,85,40,0.25)",
  itRowEven        : "rgba(135,70,30,0.25)",
  itRowHover       : "rgba(200,120,50,0.28)",
  itBorder         : "rgba(200,145,80,0.45)",
  itBorderV        : "rgba(150,115,70,0.45)",
};

/* (Light/Dark Base Vars 전체 – 동일) */
export const DEFAULT_BASE_VARS: BaseThemeVars = {
  /* … 70 여 종 그대로 (생략 없음) … */
  "--folder-lvl0-01-light": "#0076ad",
  "--folder-lvl0-25-light": "#989300",
  "--folder-lvl0-68-light": "#9b1000",
  "--folder-lvl1-01-light": "#003d5a",
  "--folder-lvl1-25-light": "#453a01",
  "--folder-lvl1-68-light": "#461300",
  "--folder-q-color-light": "#848484",
  "--bold-color-light": "rgb(138,0,119)",
  "--heading-bg-h1-light": "rgba(255,204,203,0.6)",
  "--heading-bg-h2-light": "rgba(255,218,185,0.6)",
  "--heading-bg-h3-light": "rgba(255,255,204,0.6)",
  "--heading-bg-h4-light": "rgba(224,255,255,0.6)",
  "--heading-bg-h5-light": "rgba(230,230,250,0.6)",
  "--heading-bg-h6-light": "rgba(245,245,245,0.6)",
  "--heading-color-light": "#333",
  "--table-border-light": "#000000",
  "--table-shadow-light": "rgba(0,0,0,0.15)",
  "--table-row-even-light": "#ebecf1",
  "--table-row-hover-light": "#f5f1da",
  "--image-border": "rgba(0,0,0,0.2)",
  "--image-shadow": "rgba(0,0,0,0.15)",
  "--bullet-new-color": "rgb(255,255,255)",
  "--folder-lvl0-01-dark": "#5bcbff",
  "--folder-lvl0-25-dark": "#fae05b",
  "--folder-lvl0-68-dark": "#ff7e75",
  "--folder-lvl1-01-dark": "#ade5ff",
  "--folder-lvl1-25-dark": "#fff5b3",
  "--folder-lvl1-68-dark": "#ffa9a9",
  "--folder-q-color-dark": "#848484",
  "--bold-color-dark": "rgb(255,188,188)",
  "--heading-bg-h1-dark": "rgba(139,0,0,0.6)",
  "--heading-bg-h2-dark": "rgba(139,69,19,0.6)",
  "--heading-bg-h3-dark": "rgba(139,139,0,0.6)",
  "--heading-bg-h4-dark": "rgba(0,139,139,0.6)",
  "--heading-bg-h5-dark": "rgba(72,61,139,0.6)",
  "--heading-bg-h6-dark": "rgba(105,105,105,0.6)",
  "--heading-color-dark": "#ffffff",
  "--table-border-dark": "#888888",
  "--table-shadow-dark": "rgba(0,0,0,0.5)",
  "--table-row-even-dark": "#2e2e2e",
  "--table-row-hover-dark": "#3e3e3e",
};

/*───────────────────────────────────────────────────────────────
  1-B.  DEFAULT GLOBAL TOKEN COLOURS  ← NEW
───────────────────────────────────────────────────────────────*/
const DEFAULT_GLOBAL_TOKENS_DARK: GlobalTokenColorConfig = {
  gHeaderBg     : "#2d2d2d",
  gHeaderFg     : "#fafafa",
  gLine         : "#444444",
  gRowOdd       : "#3c2110",
  gRowEven      : "#351e0d",
  gRowHover     : "#4b2c16",
  gTodayOutline : "#ff7675",

  itHeaderBg    : "#7a481d",
  itHeaderFg    : "#fff0e6",
  itRowOdd      : "rgba(160,85,40,0.25)",
  itRowEven     : "rgba(135,70,30,0.25)",
  itRowHover    : "rgba(200,120,50,0.28)",
  itBorder      : "rgba(200,145,80,0.45)",
  itBorderV     : "rgba(200,145,80,0.45)",

  btnBg         : "#7a481d",
  btnBgHover    : "rgba(140,70,30,0.9)",
  btnFg         : "#ffffff",
  btnGradTop    : "#845127",
  btnGradBottom : "#633818",
  hdrBarBg      : "#7a481d",
  sepColor      : "#7a481d",
};
const DEFAULT_GLOBAL_TOKENS_LIGHT: GlobalTokenColorConfig = {
  ...DEFAULT_GLOBAL_TOKENS_DARK,                    // 전체 복사 후 필요한 값만 덮어씀
  gHeaderBg     : "#eeeeee",
  gHeaderFg     : "#202020",
  gRowOdd       : "#f7f7f7",
  gRowEven      : "#f1f1f1",
  gRowHover     : "#eaeaea",

  itHeaderBg    : "#c6934b",
  itHeaderFg    : "#382409",
  itRowOdd      : "rgba(230,210,190,0.45)",
  itRowEven     : "rgba(220,200,180,0.45)",
  itRowHover    : "rgba(255,225,185,0.55)",
  itBorder      : "rgba(150,115,70,0.45)",
  itBorderV     : "rgba(150,115,70,0.45)",

  btnBg         : "#c6934b",
  btnBgHover    : "#dba663",
  hdrBarBg      : "#c6934b",
  sepColor      : "#c6934b",
};

/*───────────────────────────────────────────────────────────────
  1-C.  DEFAULT_SETTINGS  ← GLOBAL TOKEN 필드 추가
───────────────────────────────────────────────────────────────*/
export const DEFAULT_SETTINGS: CoverTableSettings = {
  enableBaseTheme      : true,
  enableHeaderNumbering: true,
  hideZeroFolders      : false,
  design       : { dark: { ...DEFAULT_IT_COLOR },
                   light: { ...DEFAULT_IT_COLOR,
                            buttonColor:"#c6934b", buttonHoverColor:"#dba663",
                            itHeaderBg:"#c6934b", itHeaderFg:"#382409",
                            itRowOdd:"rgba(230,210,190,.45)",
                            itRowEven:"rgba(220,200,180,.45)",
                            itRowHover:"rgba(255,225,185,.55)",
                            itBorder:"rgba(150,115,70,.45)",
                            itBorderV : "rgba(150,115,70,0.45)" } },
  globalTokens : { dark : { ...DEFAULT_GLOBAL_TOKENS_DARK },
                   light: { ...DEFAULT_GLOBAL_TOKENS_LIGHT } },   /* ← NEW */
  baseVars     : { ...DEFAULT_BASE_VARS },
  customCss    : "",
  listCallouts : [],
};

/*───────────────────────────────────────────────────────────────
  2.  CSS Token ↔ CSS Var Map (동일)
───────────────────────────────────────────────────────────────*/
export const CSS_VAR_MAP: Record<keyof ModeColorConfig, string> = {
  buttonColor      : "--btn-bg",
  buttonHoverColor : "--btn-bg-hover",
  itHeaderBg       : "--it-header-bg",
  itHeaderFg       : "--it-header-fg",
  itRowOdd         : "--it-row-odd",
  itRowEven        : "--it-row-even",
  itRowHover       : "--it-row-hover",
  itBorder         : "--it-border",
  itBorderV        : "--it-border-v",
};

/*───────────────────────────────────────────────────────────────
  3.  Setting Tab
───────────────────────────────────────────────────────────────*/
export class CoverTableSettingTab extends PluginSettingTab {
  constructor(public app: App, public plugin: CoverTablePlugin){ super(app, plugin); }

/*───────────────────────────────────────────────────────────────
  📚 Setting Descriptions  (클래스 상단에 추가)
───────────────────────────────────────────────────────────────*/
private readonly DESC_GENERAL = {
  enableBaseTheme      : "내장된 Cover-Table 기본 테마(CSS 변수)를 사용할지 여부입니다. 끄면 Obsidian / 커스텀 CSS만 적용됩니다.",
  enableHeaderNumbering: "문서 Heading(H1~H6)에 자동 번호를 붙입니다. 예) 1.2.3 형식",
  hideZeroFolders      : "파일 탐색기에서 이름이 “0_” 로 시작하는 폴더를 숨깁니다(프로젝트 템플릿·아카이브용).",
};
private readonly DESC_BASE_THEME = "Cover-Table 기본 테마의 색상 변수입니다. Obsidian 전역 CSS 변수로 주입됩니다.";
private readonly DESC_GLOBAL_TOKEN =
  "Gantt / Interactive-Table / 버튼 등 Cover-Table 구성요소의 전역 색상 토큰입니다. 테마별로 개별 지정할 수 있습니다.";
private readonly DESC_BOLD_COLOR =
  "Markdown **Bold**(굵은 글꼴) 텍스트에 적용되는 색상입니다. 라이트/다크 테마별로 지정하세요.";


  /*───────────────────────────────────────────────────────────────
    🔧 Color Util
  ───────────────────────────────────────────────────────────────*/
  
  private static isHex(v?:string){
    return typeof v==="string" && /^#[0-9a-f]{3,8}$/i.test(v.trim());
  }
  private static toHex6(hex:string){
    hex = hex.replace("#","");
    if(hex.length===3) hex = hex.split("").map(c=>c+c).join("");
    if(hex.length===4) hex = hex.slice(0,3).split("").map(c=>c+c).join("");
    if(hex.length===8) hex = hex.slice(0,6);
    return "#"+hex.padEnd(6,"0").slice(0,6).toLowerCase();
  }
  /* NEW ▶ rgba() · rgb() · 8-digit hex → 6/8-digit hex */
  private static colorToHex(src:string):string{
    src = src.trim();
    if(this.isHex(src)) return this.toHex6(src);

    const m = src.match(/^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\)$/i);
    if(!m) return "#000000";

    const [r,g,b] = [m[1],m[2],m[3]].map(n=>Math.min(255,Math.max(0,parseInt(n,10))));
    const a = m[4] ? Math.round(Math.min(1,Math.max(0,parseFloat(m[4]))) * 255) : 255;
    const hex = `#${[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
    return a!==255 ? hex + a.toString(16).padStart(2,"0") : hex;
  }

  /*───────────────────────────────────────────────────────────────
      cssColorToHex()  –  any CSS → 6-digit HEX  (NULL SAFE)   🆕
  ───────────────────────────────────────────────────────────────*/
  private static cssColorToHex(src?: string): string {
    /* ❶ undefined / null / 빈 문자 → 기본값 */
    if (!src || typeof src !== "string") return "#000000";

    src = src.trim();

    /* (#abc | #abcdef | #abcdef80) → 표준화 */
    if (/^#[0-9a-f]{3,8}$/i.test(src)) {
      const hex = src.replace("#", "");
      if (hex.length === 3) return "#" + hex.split("").map(c => c + c).join("");
      if (hex.length === 4) return (
        "#" + hex.slice(0, 3).split("").map(c => c + c).join("") +
        hex.slice(3, 4).repeat(2)
      );
      return "#" + hex.toLowerCase();                 /* 6 or 8 digits */
    }

    /* rgb / rgba → HEX(A) */
    const m = src.match(
      /^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\)$/i
    );
    if (m) {
      const [r, g, b] = [m[1], m[2], m[3]].map(n =>
        Math.min(255, Math.max(0, parseInt(n, 10)))
      );
      const a = m[4]
        ? Math.round(Math.min(1, Math.max(0, parseFloat(m[4]))) * 255)
        : 255;
      const hexRGB = [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
      return "#" + hexRGB + (a === 255 ? "" : a.toString(16).padStart(2, "0"));
    }

    /* 기타(hsl 등) → 기본값 */
    return "#000000";
  }
  /*───────────────────────────────────────────────────────────────
    📌 Bold Color Variable Key
  ───────────────────────────────────────────────────────────────*/
  private static readonly BOLD_VAR_LIGHT = "--bold-color-light";
  private static readonly BOLD_VAR_DARK  = "--bold-color-dark";



/*─────────────────────────────────────────────────────────────
    display() – ENTRY  
─────────────────────────────────────────────────────────────*/

/*─────────────────────────────────────────────────────────────
    display() – ENTRY  (INTERACTIVE-TABLE 블록 제거 버전)
─────────────────────────────────────────────────────────────*/
display(): void {
  if (!Array.isArray(this.plugin.settings.listCallouts))
    this.plugin.settings.listCallouts = [];

  const el = this.containerEl;
  el.empty();
  el.createEl("h2", { text: "Cover-Table — Settings" });

  /* (A) General Toggles */
  this.buildToggleSection(el);

  /* (B) 🌟 Global Token Colours (Dark / Light) */
  this.buildGlobalTokenColorSection(el, "dark");
  this.buildGlobalTokenColorSection(el, "light");

  /* (B2) 🔠 Bold Colour */
  this.buildBoldColorSection(el);

  /* (C) Base-Theme Vars */
  this.buildBaseThemeSection(el, "light");
  this.buildBaseThemeSection(el, "dark");
  this.buildBaseThemeSection(el, "global");


  /* (D) Custom CSS */
  this.buildCustomCssSection(el);

  /* (E) 📝 List Callouts */
  this.buildListCalloutsSection(el);
}



/*─────────────────────────────────────────────────────────────
    A. General Toggle Section  – 설명 강화 (전체 교체)
─────────────────────────────────────────────────────────────*/
private buildToggleSection(container:HTMLElement){
  container.createEl("h3",{text:"⚙️ General"});

  /* built-in Base Theme */
  new Setting(container)
    .setName("Use Cover-Table Base Theme CSS")
    .setDesc(this.DESC_GENERAL.enableBaseTheme)
    .addToggle(t=>t
      .setValue(this.plugin.settings.enableBaseTheme)
      .onChange(async v=>{
        this.plugin.settings.enableBaseTheme = v;
        await this.plugin.saveSettings();
        this.plugin.applyDesignSettings();
      }));

  /* heading numbering */
  new Setting(container)
    .setName("Auto-number Headings")
    .setDesc(this.DESC_GENERAL.enableHeaderNumbering)
    .addToggle(t=>t
      .setValue(this.plugin.settings.enableHeaderNumbering)
      .onChange(async v=>{
        this.plugin.settings.enableHeaderNumbering = v;
        await this.plugin.saveSettings();
        this.plugin.reloadHeaderLabeller();
      }));

  /* “0_” 폴더 숨김 */
  new Setting(container)
    .setName(`Hide “0_” Folders`)
    .setDesc(this.DESC_GENERAL.hideZeroFolders)
    .addToggle(t=>t
      .setValue(this.plugin.settings.hideZeroFolders)
      .onChange(async v=>{
        this.plugin.settings.hideZeroFolders = v;
        await this.plugin.saveSettings();
        this.plugin.applyZeroFolderVisibility();
      }));
}


/*─────────────────────────────────────────────────────────────
    3-C. Base-Theme Variable Editor  (전체 교체)
─────────────────────────────────────────────────────────────*/
private buildBaseThemeSection(
  container: HTMLElement,
  suffix: "light" | "dark" | "global"
){
  const hdr =
    suffix==="global" ? "⚙️ Base-Theme (Global)" :
    suffix==="light"  ? "☀️ Base-Theme Light"   :
                        "🌙 Base-Theme Dark";
  container.createEl("h3",{text:hdr});
  container.createEl("p",{text:this.DESC_BASE_THEME, cls:"ct-desc"});

  Object.keys(this.plugin.settings.baseVars)
    .filter(k=> suffix==="global"
      ? !k.endsWith("-light") && !k.endsWith("-dark")
      : k.endsWith(`-${suffix}`))
    .forEach(key=>{
      const cur = this.plugin.settings.baseVars[key];
      const row = new Setting(container).setName(key);

      row.addColorPicker((cp:ColorComponent)=>cp
        .setValue(CoverTableSettingTab.cssColorToHex(cur))
        .onChange(async v=>{
          this.plugin.settings.baseVars[key] = v;
          await this.plugin.saveSettings();
          this.plugin.applyDesignSettings();
        }));
    });
}



  /*─────────────────────────────────────────────────────────────
      3-D. Custom CSS Section
  ─────────────────────────────────────────────────────────────*/
  private buildCustomCssSection(container: HTMLElement){
    container.createEl("h3",{text:"✏️ Extra Custom CSS"});
    new Setting(container)
      .addTextArea((ta:TextComponent)=>ta
        .setPlaceholder("/* your CSS here */")
        .setValue(this.plugin.settings.customCss)
        .onChange(async v=>{
          this.plugin.settings.customCss = v;
          await this.plugin.saveSettings();
          this.plugin.applyDesignSettings();
        }));
  }

/*─────────────────────────────────────────────────────────────
    3-E. 📝 List Callouts Section  (행 렌더 방식 교체)
─────────────────────────────────────────────────────────────*/
private buildListCalloutsSection(container: HTMLElement){
  container.createEl("h3",{text:"📝 List Callouts"});
  container.createEl("p",{
    text:"지정한 Char 로 시작하는 목록 항목에 배경/글자색을 적용합니다. 라이트·다크 테마별 색상을 한 번에 설정하세요.",
    cls:"ct-desc",
  });

  const body = container.createDiv({cls:"lc-callout-list"});
  const saveRefresh = async ()=>{
    await this.plugin.saveSettings();
    this.plugin.listCallouts.rebuild();
    renderRows();
  };
  const renderRows = ()=>{
    body.empty();
    this.plugin.settings.listCallouts.forEach((co,idx)=>{
      this.buildCalloutRow(body,co,idx,saveRefresh);
    });
  };
  renderRows();

  new Setting(container).addButton(btn=>btn
    .setButtonText("+ Add Callout")
    .setCta()
    .onClick(async ()=>{
      const used = new Set(
        this.plugin.settings.listCallouts.map(c=>c.char)
      );
      const pool = "!@#$%^&*+=?<>/".split("");
      const free = pool.find(ch=>!used.has(ch)) ?? "~";

      this.plugin.settings.listCallouts.push({
        char:free,
        bgLight:"#e0e0e0", fgLight:"#000000",
        bgDark:"#3a3a3a",  fgDark:"#ffffff",
      });
      await saveRefresh();
    }));
}


/*─────────────────────────────────────────────────────────────
    🌟 Global Token Colour Section  (NULL SAFE)   🆕
─────────────────────────────────────────────────────────────*/
private buildGlobalTokenColorSection(
  container: HTMLElement,
  mode: "dark" | "light"
){
  container.createEl("h3",{
    text: mode==="dark"
      ? "🌙 Global Token Colours — Dark Theme"
      : "☀️ Global Token Colours — Light Theme",
  });
  container.createEl("p",{text:this.DESC_GLOBAL_TOKEN, cls:"ct-desc"});

  const NOTE: Partial<Record<keyof GlobalTokenColorConfig,string>> = {
    gHeaderBg  :"Gantt 헤더 배경",
    gHeaderFg  :"Gantt 헤더 글자색",
    itHeaderBg :"테이블 헤더 배경",
    itRowOdd   :"테이블 홀수행 배경",
    btnBg      :"일반 버튼 배경",
    btnBgHover :"버튼 Hover 배경",
    hdrBarBg   :"설정창 헤더 바 배경",
  };

  (Object.keys(CSS_VAR_MAP_GLOBAL) as (keyof GlobalTokenColorConfig)[])
    .forEach(tok=>{
      /* ❶ 값이 없으면 임시 기본값(#000000) 주입 */
      if (this.plugin.settings.globalTokens[mode][tok] === undefined)
        this.plugin.settings.globalTokens[mode][tok] = "#000000";

      const cur = this.plugin.settings.globalTokens[mode][tok];
      const row = new Setting(container)
        .setName(tok)
        .setDesc(NOTE[tok] ?? "");

      row.addColorPicker(cp=>cp
        .setValue(CoverTableSettingTab.cssColorToHex(cur))
        .onChange(async v=>{
          this.plugin.settings.globalTokens[mode][tok] = v;
          await this.plugin.saveSettings();
          this.plugin.applyDesignSettings();
        }));
    });
}



/*─────────────────────────────────────────────────────────────
    buildCalloutRow() – Char + Light/Dark BG/FG 한 행 레이아웃
─────────────────────────────────────────────────────────────*/
private buildCalloutRow(
  parent : HTMLElement,
  co     : ListCallout,
  idx    : number,
  persist: ()=>Promise<void>,
){
  const row = parent.createDiv({cls:"lc-callout-row-grid"}); /* CSS grid */

  /* Char + Delete */
  const charSet = new Setting(row)
    .setClass("lc-callout-char")
    .addText(t=>t
      .setPlaceholder("!")
      .setValue(co.char)
      .onChange(async v=>{
        const ch = v.trim().slice(0,1)||"!";
        if(this.plugin.settings.listCallouts
          .some((c,i)=>i!==idx && c.char===ch)){
          new Notice(`Character "${ch}" already in use.`);
          return;
        }
        co.char = ch;
        await persist();
      }))
    .addExtraButton(b=>b
      .setIcon("trash")
      .setTooltip("Delete this callout")
      .onClick(async ()=>{
        this.plugin.settings.listCallouts.splice(idx,1);
        await persist();
      }));

  charSet.infoEl.setText("Char");

  /* Light BG / FG */
  new Setting(row)
    .setName("Light")
    .setClass("lc-callout-light")
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.bgLight))
      .onChange(async v=>{
        co.bgLight = v;
        await persist();
      }))
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.fgLight))
      .onChange(async v=>{
        co.fgLight = v;
        await persist();
      }));

  /* Dark BG / FG */
  new Setting(row)
    .setName("Dark")
    .setClass("lc-callout-dark")
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.bgDark))
      .onChange(async v=>{
        co.bgDark = v;
        await persist();
      }))
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.fgDark))
      .onChange(async v=>{
        co.fgDark = v;
        await persist();
      }));
}


/*─────────────────────────────────────────────────────────────
    buildCalloutRow() – Char + Light/Dark BG/FG 한 행 레이아웃
─────────────────────────────────────────────────────────────*/
private buildCalloutRow(
  parent : HTMLElement,
  co     : ListCallout,
  idx    : number,
  persist: ()=>Promise<void>,
){
  const row = parent.createDiv({cls:"lc-callout-row-grid"}); /* CSS grid */

  /* Char + Delete */
  const charSet = new Setting(row)
    .setClass("lc-callout-char")
    .addText(t=>t
      .setPlaceholder("!")
      .setValue(co.char)
      .onChange(async v=>{
        const ch = v.trim().slice(0,1)||"!";
        if(this.plugin.settings.listCallouts
          .some((c,i)=>i!==idx && c.char===ch)){
          new Notice(`Character "${ch}" already in use.`);
          return;
        }
        co.char = ch;
        await persist();
      }))
    .addExtraButton(b=>b
      .setIcon("trash")
      .setTooltip("Delete this callout")
      .onClick(async ()=>{
        this.plugin.settings.listCallouts.splice(idx,1);
        await persist();
      }));

  charSet.infoEl.setText("Char");

  /* Light BG / FG */
  new Setting(row)
    .setName("Light")
    .setClass("lc-callout-light")
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.bgLight))
      .onChange(async v=>{
        co.bgLight = v;
        await persist();
      }))
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.fgLight))
      .onChange(async v=>{
        co.fgLight = v;
        await persist();
      }));

  /* Dark BG / FG */
  new Setting(row)
    .setName("Dark")
    .setClass("lc-callout-dark")
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.bgDark))
      .onChange(async v=>{
        co.bgDark = v;
        await persist();
      }))
    .addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(co.fgDark))
      .onChange(async v=>{
        co.fgDark = v;
        await persist();
      }));
}



/*─────────────────────────────────────────────────────────────
    🅱️ Bold Text Colour Section  (전체 교체/추가)
─────────────────────────────────────────────────────────────*/
private buildBoldColorSection(container: HTMLElement){
  container.createEl("h3",{text:"🔠 Bold Text Colour"});
  container.createEl("p",{text:this.DESC_BOLD_COLOR, cls:"ct-desc"});

  type Mode = "light" | "dark";
  const KEY:Record<Mode,string>={
    light: CoverTableSettingTab.BOLD_VAR_LIGHT,
    dark : CoverTableSettingTab.BOLD_VAR_DARK,
  };

  (["light","dark"] as Mode[]).forEach(mode=>{
    const row = new Setting(container)
      .setName(mode==="light"?"☀️ Light":"🌙 Dark");

    row.addColorPicker(cp=>cp
      .setValue(CoverTableSettingTab.cssColorToHex(
        this.plugin.settings.baseVars[KEY[mode]]
      ))
      .onChange(async v=>{
        this.plugin.settings.baseVars[KEY[mode]] = v;
        await this.plugin.saveSettings();
        this.plugin.applyDesignSettings();
      }));
  });
}
}

/*───────────────────────────────────────────────────────────────
  helper (module-scope) – RGB ↔ HEX (UNUSED in UI, kept for API)
───────────────────────────────────────────────────────────────*/
function hexToRgb(hex:string){
  hex = hex.replace("#","");
  if(hex.length===3) hex = hex.split("").map(c=>c+c).join("");
  const n = parseInt(hex,16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}
function rgbToHex(rgb:string){
  const nums = rgb.split(",").map(p=>parseInt(p.trim(),10));
  if(nums.length!==3 || nums.some(isNaN)) return "#000000";
  return "#"+nums.map(n=>n.toString(16).padStart(2,"0")).join("");
}
