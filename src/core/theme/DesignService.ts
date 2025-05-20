import { App } from "obsidian";
import {
  injectTokens,
  DEFAULT_TOKENS,
  type AppDesignTokens,
} from "../../theme/tokens";
import BASE_THEME_CSS from "../../theme/css/base.css";
import type { CoverTableSettings } from "../../setting";

export class DesignService {
  private readonly root   = document.documentElement;
  private readonly cfg: () => CoverTableSettings;

  /* style 태그 id */
  private static BASE  = "ct-base-theme";
  private static CUSTOM= "ct-custom-css";

  constructor(app:App, cfgGetter:()=>CoverTableSettings){
    this.cfg = cfgGetter;
    this.applyAll();
    app.workspace.on("css-change", () => this.applyAll());
  }

  applyAll():void{
    const { tokens, customCss } = this.cfg();
    const mode = document.body.classList.contains("theme-dark") ? "dark":"light";

    /* ① design tokens → :root */
    injectTokens(mode, tokens ?? DEFAULT_TOKENS);

    /* ② base-theme css (사용자 토글) */
    this.upsertStyle(DesignService.BASE, BASE_THEME_CSS);

    /* ③ 사용자 custom css */
    this.upsertStyle(DesignService.CUSTOM, customCss || "");
  }

  /* util */
  private upsertStyle(id:string, css:string){
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if(!el && css){
      el = Object.assign(document.createElement("style"),{ id }) as HTMLStyleElement;
      document.head.appendChild(el);
    }
    if(el) el.textContent = css;
  }
}
