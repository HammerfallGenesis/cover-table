/*****************************************************************
 * src/setting.ts – Cover-Table v3 (error-free, dual-picker UI)
 *****************************************************************/
import {
  DEFAULT_TOKENS,
  injectTokens,
  type AppDesignTokens,
} from "./theme/tokens";

import { App, PluginSettingTab, Setting } from "obsidian";
import type CoverTablePlugin from "./core/Plugin";   // 플러그인 클래스
import { Log } from "./features/interactive-table/utils/log";

/*────────────── 1. List-callout 정의 ─────────────*/
export interface ListCallout {
  char    : string;
  bgLight : string; fgLight : string;
  bgDark  : string; fgDark  : string;
}

/*────────────── 2. 설정 스키마 / 기본값 ──────────*/
export interface CoverTableSettings {
  hideZeroFolders      : boolean;
  hideAllNotes         : boolean;
  listCallouts         : ListCallout[];

  baseVars  : Record<string,string>;
  tokens    : AppDesignTokens;
  customCss : string;
  debugLog: boolean;
}

export const DEFAULT_SETTINGS: CoverTableSettings = {
  hideZeroFolders      : true,
  hideAllNotes         : true,
  listCallouts         : [],


  tokens   : structuredClone(DEFAULT_TOKENS),
  baseVars : {},
  customCss: "",
  debugLog: false,
};

/*────────────── 3. 라벨 사전 (UI 텍스트) ─────────*/
const LABEL = {
  /* Base */
  baseWhite : "Base ‧ 배경(흰색)",
  baseBlack : "Base ‧ 글자(검정)",
  /* Heading */
  h1:"H1 (Red)", h2:"H2 (Orange)", h3:"H3 (Yellow)",
  h4:"H4 (Green)", h5:"H5 (Blue)", h6:"H6 (Violet)",
  /* List */
  bullet:"List Bullet", olMarker:"Ordered-list Number",
  /* Explorer – folders */
  lvl0_01:"Folder L0 - 0~1", lvl0_25:"Folder L0 - 2~5", lvl0_68:"Folder L0 - 6~8",
  lvl1_01:"Folder L1 - 0~1", lvl1_25:"Folder L1 - 2~5", lvl1_68:"Folder L1 - 6~8",
  folderQ :"Folder “Q)”",
  /* Table / Image */
  tBorder:"Table Border", tShadow:"Table Shadow",
  tRowEven:"Table Row (even)", tRowHover:"Table Row (hover)",
  iBorder:"Image Border", iShadow:"Image Shadow",
} as const;
const CALLOUT_LIMIT = 5;

/*────────────── 4. SettingTab 클래스 ────────────*/
type ModeKey = keyof AppDesignTokens;    // "dark" | "light"

export class CoverTableSettingTab extends PluginSettingTab {
  private plugin: CoverTablePlugin;

  constructor(app: App, plugin: CoverTablePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

private async commit() {
  await this.plugin.saveSettings();

  injectTokens("dark",  this.plugin.settings.tokens);
  injectTokens("light", this.plugin.settings.tokens);

  /* ✅ 플러그인 공개 메서드 호출만 남김 */
  this.plugin.rebuildListCallouts();
}



/*───────────────────────────────────────────────────────────────
  fillMissing() – 누락값 보충
───────────────────────────────────────────────────────────────*/
private fillMissing(tokens: AppDesignTokens) {
  (["dark","light"] as const).forEach(mode => {
    const def = DEFAULT_TOKENS[mode];
    const tgt = tokens[mode];

    tgt.base    = { ...def.base,    ...tgt.base    };
    tgt.heading = { ...def.heading, ...tgt.heading };
    tgt.list    = { ...def.list,    ...tgt.list    };
    tgt.bold  = { ...def.bold, ...tgt.bold };

    /* ▲ ① 기본 블록은 전부 OK — 아래 merge 함수만 수정 */

    /** d(기본)에서 존재하는 key 를 t(현재)로 채워 넣는다 */
    const merge = <O extends { [K in keyof O]: string }>(d: O, t: O): void => {
      (Object.keys(d) as (keyof O)[]).forEach(k => {
        t[k] ??= d[k];
      });
    };

    /* Folder - L0 · L1 */
    merge(def.folder.lvl0, tgt.folder.lvl0);
    merge(def.folder.lvl1, tgt.folder.lvl1);
    tgt.folder.q ??= def.folder.q;

    /* Table / Image */
    tgt.table = { ...def.table, ...tgt.table };
    tgt.image = { ...def.image, ...tgt.image };
  });
}


/** 1 행에 ☀(Light) + 🌙(Dark) 두 컬러피커를 그린다 – 안전 버전 */
private addDualPicker(
  host        : HTMLElement,
  label       : string,
  lightGetter : () => string,
  darkGetter  : () => string,
  lightSetter : (v: string) => void,
  darkSetter  : (v: string) => void,
) {
  const row = new Setting(host).setName(label).setDesc("☀ Light ▸ left   ·   🌙 Dark ▸ right");


  

  /* 내부 헬퍼: 컬러피커 공통 초기화 -------------------------------- */
  const initPicker = (
    cp  : any,                    // ColorComponent (런타임 구조 이용)
    get : () => string,
    set : (v: string) => void,
    tip : string,
  ) => {
    cp.setValue(get())
      .onChange(async (v: string) => { set(v); await this.commit(); });

    /* ① inputEl 이 있으면 바로 */
    let inp: HTMLInputElement | null =
      (cp as any).inputEl ?? null;

    /* ② 아직 없으면 다음 tick 에 containerEl 로 조회 */
    if (!inp) {
      queueMicrotask(() => {
        inp = cp.containerEl?.querySelector("input[type='color']") as HTMLInputElement | null;

        inp?.setAttribute("title", tip);
      });
    } else {
      inp.setAttribute("title", tip);
    }
  };

  /* ☀ Light ---------------------------------------------------------- */
  row.addColorPicker(cp =>
    initPicker(cp, lightGetter, lightSetter, "Light mode colour (☀)"),
  );

  /* 🌙 Dark ----------------------------------------------------------- */
  row.addColorPicker(cp =>
    initPicker(cp, darkGetter, darkSetter, "Dark mode colour (🌙)"),
  );
}

/* === List-Callout 한 행 생성 === */
private buildCalloutRow(
  host : HTMLElement,     // Setting 컨테이너
  co   : ListCallout,     // 현재 데이터
  idx  : number,          // 배열 인덱스
  S    : CoverTableSettings,   // settings 객체 (저장용)
){
  const row = new Setting(host);

  /* ① 글머리 기호 입력 ─────────────────────────── */
  row.addText(t =>
    t.setPlaceholder("★")
     .setValue(co.char)
     .onChange(async v => {
       co.char = v.trim().charAt(0) || "•";
       await this.commit();
       this.display();          // 중복 검사 위해 전체 재렌더
     }),
  ).setName(`Marker ${idx + 1}`);

  /* ② 4 개 컬러피커 (bgLight / fgLight / bgDark / fgDark) */
/* ② 4 개 컬러피커 (bgLight / fgLight / bgDark / fgDark) */
/* ───────────────────────────────────────────────────────── */
/* ② 4 개 컬러피커 (bgLight / fgLight / bgDark / fgDark) */
/* ───────────────────────────────────────────────────────── */
const addClr = (
  lab : string,
  get : () => string,
  set : (v: string) => void,
) => {
  row.addColorPicker(cp => {
    cp.setValue(get())
      .onChange(async v => { set(v); await this.commit(); });

    /* tooltip 부여 — 타입 오류 없이 */
    const setTip = () => {
      const anyCp = cp as any;                     // 런타임 객체
      const inp = (anyCp.containerEl as HTMLElement | null)
                    ?.querySelector("input[type='color']") as HTMLInputElement | null;
      inp?.setAttribute("title", lab);
    };
    setTip();
    queueMicrotask(setTip);    // 지연 생성 대비
  });
};




  addClr("bgLight", () => co.bgLight, v => (co.bgLight = v));
  addClr("fgLight", () => co.fgLight, v => (co.fgLight = v));
  addClr("bgDark" , () => co.bgDark , v => (co.bgDark  = v));
  addClr("fgDark" , () => co.fgDark , v => (co.fgDark  = v));

  /* ③ 삭제 버튼 ─────────────────────────────────── */
/* ③ 삭제 버튼 ------------------------------------------- */
row.addExtraButton(btn =>
  btn.setIcon("trash")
     .setTooltip("Delete")
     .onClick(async () => {
       S.listCallouts.splice(idx, 1);
       await this.commit();
       this.display();                  // 행 재그리기
     }),
);

}

/* === 새 Callout 기본값 반환 === */
private newCallout(): ListCallout {
  return {
    char   : "★",
    bgLight: "#dbeafe",
    fgLight: "#1e40af",
    bgDark : "#1e3a8a",
    fgDark : "#dbeafe",
  };
}



/*──────── 5. UI 렌더링 ────────*/
override display(): void {
  const c = this.containerEl;
  c.empty();
  const S = this.plugin.settings;
  this.fillMissing(S.tokens);

/* ===================== General options ===================== */
// e.g. SettingTab.ts
new Setting(c)
  .setName("Debug 로그 표시")
  .addToggle(t =>
    t.setValue(this.plugin.settings.debugLog)
     .onChange(async (v) => {
        this.plugin.settings.debugLog = v;
        await this.plugin.saveSettings();
        Log.setDebug(v);       // <— 토글 즉시 반영
     }));

/* (A) _0  On / Off  → hideZeroFolders 토글 */
new Setting(c)
  .setName("_0  On / Off")
  .setDesc('Hide every folder or file whose name starts with "0_" in Explorer')
  .addToggle(t =>
    t.setValue(S.hideZeroFolders)
     .onChange(async v => {
       S.hideZeroFolders = v;
       await this.commit();
       this.plugin.applyZeroFolderVisibility();   // 즉시 반영
     }),
  );

/* (B) 모든 노트 숨김 토글 (hideAllNotes) */
new Setting(c)
  .setName("Hide all notes in Explorer")
  .setDesc("Temporarily hide every file (nav-file); folders stay visible.")
  .addToggle(t =>
    t.setValue(S.hideAllNotes)
     .onChange(async v => {
       S.hideAllNotes = v;
       await this.commit();
       this.plugin.applyExplorerHide();
     }),
  );



/* ===================== 이하 기존 팔레트 코드 등 그대로 ===================== */


    /*-- Palette headline --*/
    c.createEl("h3", { text: "🎨 Color palette – Light / Dark" });


    /* 🆕 안내 문구 -------------------------------------------------- */
c.createEl("p", {
  text: "Each row shows two colour pickers:  ☀  = Light mode   ·   🌙  = Dark mode.",
  cls : "ct-tip",
});

    /* 1) Base */
    this.addDualPicker(
      c, LABEL.baseWhite,
      () => S.tokens.light.base.white, () => S.tokens.dark.base.white,
      v  => S.tokens.light.base.white = v, v  => S.tokens.dark.base.white = v,
    );
    this.addDualPicker(
      c, LABEL.baseBlack,
      () => S.tokens.light.base.black, () => S.tokens.dark.base.black,
      v  => S.tokens.light.base.black = v, v  => S.tokens.dark.base.black = v,
    );

    /* 2) Headings */
    c.createEl("h4", { text: "Headings (H1–H6)" });
    (["h1","h2","h3","h4","h5","h6"] as const).forEach(k =>
      this.addDualPicker(
        c, LABEL[k],
        () => S.tokens.light.heading[k], () => S.tokens.dark.heading[k],
        v  => S.tokens.light.heading[k] = v, v  => S.tokens.dark.heading[k]  = v,
      )
    );

    /* 3) List / Bold */
    c.createEl("h4", { text: "List / Bold" });
    (["bullet","olMarker"] as const).forEach(k =>
      this.addDualPicker(
        c, LABEL[k],
        () => S.tokens.light.list[k], () => S.tokens.dark.list[k],
        v  => S.tokens.light.list[k] = v, v  => S.tokens.dark.list[k]  = v,
      )
    );
/* bold (NEW) */
this.addDualPicker(
  c, "Bold text",
  () => S.tokens.light.bold.bold,  () => S.tokens.dark.bold.bold,
  v  => S.tokens.light.bold.bold = v, v => S.tokens.dark.bold.bold = v,
);
    /* 4) Explorer folders – Level 0 */
    c.createEl("h4", { text: "Explorer folders – Level 0" });
    (["_01","_25","_68"] as const).forEach(k =>
      this.addDualPicker(
        c, LABEL[`lvl0_${k.slice(1)}` as keyof typeof LABEL],
        () => S.tokens.light.folder.lvl0[k],
        () => S.tokens.dark .folder.lvl0[k],
        v  => S.tokens.light.folder.lvl0[k] = v,
        v  => S.tokens.dark .folder.lvl0[k] = v,
      )
    );

    /* 5) Explorer folders – Level 1 */
    c.createEl("h4", { text: "Explorer folders – Level 1" });
    (["_01","_25","_68"] as const).forEach(k =>
      this.addDualPicker(
        c, LABEL[`lvl1_${k.slice(1)}` as keyof typeof LABEL],
        () => S.tokens.light.folder.lvl1[k],
        () => S.tokens.dark .folder.lvl1[k],
        v  => S.tokens.light.folder.lvl1[k] = v,
        v  => S.tokens.dark .folder.lvl1[k] = v,
      )
    );

    /* Folder “Q)” */
c.createEl("h4", { text: 'Explorer folder – "Q)"' });    
    this.addDualPicker(
      c, LABEL.folderQ,
      () => S.tokens.light.folder.q, () => S.tokens.dark.folder.q,
      v  => S.tokens.light.folder.q = v, v  => S.tokens.dark.folder.q = v,
    );


/* 6) 📝 List Callouts --------------------------------------- */
c.createEl("h3", { text: "📝 List Callouts" });

/* (A) 기존 Callout 행 렌더 */
S.listCallouts.forEach((co, i) => this.buildCalloutRow(c, co, i, S));

/* (B) + Add 버튼 – 최대 5개 제한 */
new Setting(c)
  .addButton(btn => {
    const full = S.listCallouts.length >= CALLOUT_LIMIT;

    btn.setButtonText(full ? "Limit reached" : "+ Add")
       .setDisabled(full)               // 5개가 되면 비활성화
       .setCta()
       .setTooltip(full
         ? `You can register up to ${CALLOUT_LIMIT} callouts`
         : "Add a new callout")
       .onClick(async () => {
         /* 안전가드: 더블-클릭/레이스 컨디션 대비 */
         if (S.listCallouts.length >= CALLOUT_LIMIT) return;

         S.listCallouts.push(this.newCallout());
         await this.commit();
         this.display();                // 새 행까지 다시 그리기
       });
  })
  .setName(`새 Callout 추가 (max ${CALLOUT_LIMIT})`);

  


  }
}
