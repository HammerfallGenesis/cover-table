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
  baseVars             : BaseThemeVars;
  customCss            : string;
  listCallouts         : ListCallout[];
}

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

export const DEFAULT_SETTINGS: CoverTableSettings = {
  enableBaseTheme      : true,
  enableHeaderNumbering: true,
  /** ◀ NEW – “0_” 폴더 숨김 기본값 */
  hideZeroFolders      : false,
  design: {
    dark : { ...DEFAULT_IT_COLOR },
    light: {
      ...DEFAULT_IT_COLOR,
      buttonColor      : "#c6934b",
      buttonHoverColor : "#dba663",
      itHeaderBg       : "#c6934b",
      itHeaderFg       : "#382409",
      itRowOdd         : "rgba(230,210,190,0.45)",
      itRowEven        : "rgba(220,200,180,0.45)",
      itRowHover       : "rgba(255,225,185,0.55)",
      itBorder         : "rgba(150,115,70,0.45)",
    },
  },
  baseVars     : { ...DEFAULT_BASE_VARS },
  customCss    : "",
  listCallouts : [],
};

/*───────────────────────────────────────────────────────────────
  2.  CSS Token ↔ CSS Var Map (동일)
───────────────────────────────────────────────────────────────*/
export const CSS_VAR_MAP: Record<keyof ModeColorConfig, string> = {
  buttonColor      : "--ct-btn-bg",
  buttonHoverColor : "--ct-btn-bg-hover",
  itHeaderBg       : "--ct-it-header-bg",
  itHeaderFg       : "--ct-it-header-fg",
  itRowOdd         : "--ct-it-row-odd",
  itRowEven        : "--ct-it-row-even",
  itRowHover       : "--ct-it-row-hover",
  itBorder         : "--ct-it-border",
};

/*───────────────────────────────────────────────────────────────
  3.  Setting Tab
───────────────────────────────────────────────────────────────*/
export class CoverTableSettingTab extends PluginSettingTab {
  constructor(public app: App, public plugin: CoverTablePlugin){ super(app, plugin); }

  private static isHex(v?:string){ return typeof v==="string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()); }
  private static toHex6(hex:string){
    hex = hex.replace("#","");
    if(hex.length===3) hex=hex.split("").map(c=>c+c).join("");
    if(hex.length===4) hex=hex.slice(0,3).split("").map(c=>c+c).join("");
    if(hex.length===8) hex=hex.slice(0,6);
    return "#"+hex.padEnd(6,"0").slice(0,6).toLowerCase();
  }

  /*─────────────────────────────────────────────────────────────
      display() – ENTRY
  ─────────────────────────────────────────────────────────────*/
  display(): void {
    if(!Array.isArray(this.plugin.settings.listCallouts))
      this.plugin.settings.listCallouts = [];

    const el = this.containerEl;
    el.empty();
    el.createEl("h2",{text:"Cover-Table — Settings"});

    /* ── (A) General Toggles ─────────────────────────────── */
    this.buildToggleSection(el);

    /* ── (B) Interactive-Table Colors ────────────────────── */
    this.buildInteractiveTableColorSection(el,"dark");
    this.buildInteractiveTableColorSection(el,"light");

    /* ── (C) Base-Theme Vars ─────────────────────────────── */
    this.buildBaseThemeSection(el,"light");
    this.buildBaseThemeSection(el,"dark");
    this.buildBaseThemeSection(el,"global");

    /* ── (D) Custom CSS ──────────────────────────────────── */
    this.buildCustomCssSection(el);

    /* ── (E) 📝 List Callouts ────────────────────────────── */
    this.buildListCalloutsSection(el);
  }

  /*─────────────────────────────────────────────────────────────
      A. General Toggle Section   ← NEW 토글 포함
  ─────────────────────────────────────────────────────────────*/
  private buildToggleSection(container:HTMLElement){
    container.createEl("h3",{text:"⚙️ General"});

    /* built-in theme */
    new Setting(container)
      .setName("Enable built-in Base Theme CSS")
      .addToggle(t=>t
        .setValue(this.plugin.settings.enableBaseTheme)
        .onChange(async v=>{
          this.plugin.settings.enableBaseTheme = v;
          await this.plugin.saveSettings();
          this.plugin.applyDesignSettings();
        }));

    /* heading numbering */
    new Setting(container)
      .setName("Auto-number headings (Header Labeller)")
      .addToggle(t=>t
        .setValue(this.plugin.settings.enableHeaderNumbering)
        .onChange(async v=>{
          this.plugin.settings.enableHeaderNumbering = v;
          await this.plugin.saveSettings();
          this.plugin.reloadHeaderLabeller();
        }));

    /* ◀ NEW ─ “0_” 폴더 숨김 */
    new Setting(container)
      .setName(`Hide folders whose name starts with "0_" in File Explorer`)
      .addToggle(t=>t
        .setValue(this.plugin.settings.hideZeroFolders)
        .onChange(async v=>{
          this.plugin.settings.hideZeroFolders = v;
          await this.plugin.saveSettings();
          this.plugin.applyZeroFolderVisibility();   // ◀── NEW
        }));
  }




  /*─────────────────────────────────────────────────────────────
      3-B. Interactive-Table Color Tokens
  ─────────────────────────────────────────────────────────────*/
  private buildInteractiveTableColorSection(container: HTMLElement, mode:"dark"|"light"){
    container.createEl("h3",{text: mode==="dark" ? "🌙 Interactive-Table — Dark" : "☀️ Interactive-Table — Light"});
    (Object.keys(CSS_VAR_MAP) as (keyof ModeColorConfig)[]).forEach(tok=>{
      const cur = this.plugin.settings.design[mode][tok];
      const row = new Setting(container).setName(tok);

      if(CoverTableSettingTab.isHex(cur))
        row.addColorPicker(cp=>cp
          .setValue(CoverTableSettingTab.toHex6(cur))
          .onChange(async v=>{
            this.plugin.settings.design[mode][tok]=v;
            await this.plugin.saveSettings();
            this.plugin.applyDesignSettings();
          }));
      else
        row.addText(t=>t
          .setPlaceholder("CSS colour")
          .setValue(cur)
          .onChange(async v=>{
            this.plugin.settings.design[mode][tok]=v;
            await this.plugin.saveSettings();
            this.plugin.applyDesignSettings();
          }));
    });
  }

  /*─────────────────────────────────────────────────────────────
      3-C. Base-Theme Variable Editor
  ─────────────────────────────────────────────────────────────*/
  private buildBaseThemeSection(container: HTMLElement, suffix:"light"|"dark"|"global"){
    const hdr =
      suffix==="global" ? "⚙️ Base-Theme (Global)" :
      suffix==="light"  ? "☀️ Base-Theme Light"    :
                          "🌙 Base-Theme Dark";
    container.createEl("h3",{text:hdr});

    Object.keys(this.plugin.settings.baseVars)
      .filter(k=> suffix==="global"
        ? !k.endsWith("-light") && !k.endsWith("-dark")
        : k.endsWith(`-${suffix}`))
      .forEach(key=>{
        const val = this.plugin.settings.baseVars[key];
        const row = new Setting(container).setName(key);

        row.addText(t=>t
          .setPlaceholder(val)
          .setValue(val)
          .onChange(async v=>{
            this.plugin.settings.baseVars[key]=v;
            await this.plugin.saveSettings();
            this.plugin.applyDesignSettings();
          }));

        if(CoverTableSettingTab.isHex(val))
          row.addColorPicker((cp:ColorComponent)=>cp
            .setValue(CoverTableSettingTab.toHex6(val))
            .onChange(async v=>{
              this.plugin.settings.baseVars[key]=v;
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
      3-E. 📝 List Callouts Section
  ─────────────────────────────────────────────────────────────*/
  private buildListCalloutsSection(container: HTMLElement){
    /* 1) Section Header */
    container.createEl("h3",{text:"📝 List Callouts"});

    /* 2) Wrapper & util */
    const body = container.createDiv({cls:"lc-callout-list"});

    const saveRefresh = async ()=>{
      await this.plugin.saveSettings();       // disk
      this.plugin.listCallouts.rebuild();     // CSS / regex
      renderRows();                           // UI
    };

    /* 3) Row Renderer (λ) */
    const renderRows = ()=>{
      body.empty();
      this.plugin.settings.listCallouts.forEach((co,idx)=>{
        this.buildCalloutRow(body,co,idx,saveRefresh);
      });
    };
    renderRows();

    /* 4) [+] New Callout Button */
    new Setting(container).addButton(btn=>btn
      .setButtonText("+ Add Callout")
      .setCta()
      .onClick(async ()=>{
        const used = new Set(this.plugin.settings.listCallouts.map(c=>c.char));
        const pool = "!@#$%^&*+=?<>/".split("");
        const free = pool.find(ch=>!used.has(ch)) ?? "!";

        this.plugin.settings.listCallouts.push({
          char   : free,
          bgLight: "#e0e0e0",
          fgLight: "#000000",
          bgDark : "#3a3a3a",
          fgDark : "#ffffff",
        });
        await saveRefresh();
      }));
  }

  /*─────────────────────────────────────────────────────────────
      buildCalloutRow() – 단일 Callout 행 생성
  ─────────────────────────────────────────────────────────────*/
  private buildCalloutRow(
    parent:HTMLElement,
    co:ListCallout,
    idx:number,
    persist:()=>Promise<void>,
  ){
    const row = parent.createDiv({cls:"lc-callout-row"});

    /* A. Trigger Char */
    new Setting(row)
      .setName("Char")
      .setDesc("1-byte trigger character")
      .addText(t=>t
        .setPlaceholder("!")
        .setValue(co.char)
        .onChange(async v=>{
          const ch = v.trim().slice(0,1)||"!";
          /* 중복 방지 */
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

    /* B. Light Colors */
    this.buildColorPair(row,"Light",co,"bgLight","fgLight",persist);

    /* C. Dark Colors */
    this.buildColorPair(row,"Dark",co,"bgDark","fgDark",persist);
  }

  /*─────────────────────────────────────────────────────────────
      buildColorPair() – BG/FG ColorPicker 셀 생성
  ─────────────────────────────────────────────────────────────*/
  private buildColorPair(
    row:HTMLElement,
    label:string,
    obj:Record<string,string>,
    bgKey:keyof ListCallout,
    fgKey:keyof ListCallout,
    persist:()=>Promise<void>,
  ){
    new Setting(row)
      .setName(label)
      .setDesc("BG / FG")
      .addColorPicker(cp=>cp
        .setValue(CoverTableSettingTab.toHex6(obj[bgKey] as string))
        .onChange(async v=>{
          obj[bgKey] = v;
          await persist();
        }))
      .addColorPicker(cp=>cp
        .setValue(CoverTableSettingTab.toHex6(obj[fgKey] as string))
        .onChange(async v=>{
          obj[fgKey] = v;
          await persist();
        }));
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
