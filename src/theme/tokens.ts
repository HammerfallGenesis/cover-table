/*****************************************************************
 * src/theme/tokens.ts – Cover-Table v3  (final, 2025-05-19)
 * · 토큰 = CSS 변수를 1:1 로 매핑하는 단일 정의소
 *****************************************************************/

/*────────────────── 1. Leaf-palette 타입 ──────────────────*/
export interface BasePalette   { white:string; black:string; }
export interface HeadingPalette{ h1:string; h2:string; h3:string;
                                 h4:string; h5:string; h6:string; }
export interface ListPalette   { bullet:string; olMarker:string; }
export interface BoldPalette { bold: string }

export interface FolderLevel   { _01:string; _25:string; _68:string; }
export interface FolderPalette { lvl0:FolderLevel; lvl1:FolderLevel; q:string; }

export interface TablePalette  { border:string; shadow:string;
                                 rowEven:string; rowHover:string; }
export interface ImagePalette  { border:string; shadow:string; }


/*────────────────── 2. 모드별 전체 팔레트 ────────────────*/
export interface ModePalette{
  base   :BasePalette;
  heading:HeadingPalette;
  list   :ListPalette;
  bold   : BoldPalette;       // ★ NEW
  folder :FolderPalette;
  table  :TablePalette;
  image  :ImagePalette;
}
export interface AppDesignTokens{ dark:ModePalette; light:ModePalette; }

/*────────────────── 3. 기본 팔레트 값 ───────────────────*/
const makeDefault = ():ModePalette => ({
  base   :{ white:"#ffffff", black:"#000000" },
  heading:{ h1:"#ff5555", h2:"#ffae42", h3:"#f7ff50",
            h4:"#4cd964", h5:"#5ac8fa", h6:"#af52de" },
  list   :{ bullet:"rgb(54,54,190)", olMarker:"red" },
  bold : { bold :"rgb(138,0,119)" },
  folder :{
    lvl0:{ _01:"#0076ad", _25:"#989300", _68:"#9b1000" },
    lvl1:{ _01:"#003d5a", _25:"#453a01", _68:"#461300" },
    q   :"#848484",
  },
  table  :{ border:"#c0c0c0", shadow:"rgba(0,0,0,.10)",
            rowEven:"rgba(0,0,0,.03)", rowHover:"rgba(0,0,0,.07)" },
  image  :{ border:"#d0d0d0", shadow:"rgba(0,0,0,.10)" },
});

export const DEFAULT_TOKENS:AppDesignTokens = {
  light: makeDefault(),
  dark : (()=>{                // ⤷ 라이트값 복사 후 몇 가지만 교체
    const d = makeDefault();
    d.list   ={ bullet:"rgb(89,89,223)", olMarker:"red" };
    d.bold  = { bold:"rgb(255,188,188)" };            // ★
    d.table  ={ border:"#444444", shadow:"rgba(0,0,0,.55)",
                rowEven:"transparent", rowHover:"rgba(255,255,255,.07)" };
    d.image  ={ border:"#555555", shadow:"rgba(0,0,0,.60)" };
    d.folder.lvl0={ _01:"#91dcff", _25:"#fffcab", _68:"#ffb3ab" };
    d.folder.lvl1={ _01:"#2ebdff", _25:"#ffdf3e", _68:"#ff7e4f" };
    return d;
  })(),
};

/*────────────────── 4. CSS 변수 이름 맵 ──────────────────*/
export const VAR = {
  /* base */         baseWhite:"--ct-base-white",   baseBlack:"--ct-base-black",
  /* heading */      h1:"--ct-h1-dark",  h2:"--ct-h2-dark",  h3:"--ct-h3-dark",
                     h4:"--ct-h4-dark",  h5:"--ct-h5-dark",  h6:"--ct-h6-dark",
  /* list */         bullet:"--bullet-new-color",   olMarker:"--ct-ol-marker-dark",
  /* bold */         bold: "--ct-bold",
  /* folders level0*/lvl0_01:"--ct-folder-lvl0-01-dark",
                     lvl0_25:"--ct-folder-lvl0-25-dark",
                     lvl0_68:"--ct-folder-lvl0-68-dark",
  /* folders level1*/lvl1_01:"--ct-folder-lvl1-01-dark",
                     lvl1_25:"--ct-folder-lvl1-25-dark",
                     lvl1_68:"--ct-folder-lvl1-68-dark",
  folderQ:"--ct-folder-q-dark",
  /* table */        tBorder:"--ct-table-border", tShadow:"--ct-table-shadow",
                     tEven:"--ct-table-row-even", tHover:"--ct-table-row-hover",
  /* image */        iBorder:"--ct-image-border",  iShadow:"--ct-image-shadow",
} as const;

/*────────────────── 5. 토큰 → :root 주입 헬퍼 ─────────────*/
export function injectTokens(
  mode:"dark"|"light",
  palette:AppDesignTokens,
  root:HTMLElement|Document = document.documentElement,
){
  const P = palette[mode];                  // 타깃 팔레트
  const el = root instanceof Document ? root.documentElement : root;
  const suf = mode === "dark" ? "dark" : "light";   // ★ NEW

  /* --base-- */
  el.style.setProperty(VAR.baseWhite, P.base.white);
  el.style.setProperty(VAR.baseBlack, P.base.black);

  /* --heading-- */
  (["h1","h2","h3","h4","h5","h6"] as const).forEach(h =>
    el.style.setProperty(`--ct-${h}-${suf}`, P.heading[h])   // ★
  );

  /* --list-- */
  el.style.setProperty(`--ct-bullet-${suf}`,   P.list.bullet);   // ★
  el.style.setProperty(`--ct-ol-marker-${suf}`, P.list.olMarker);/* ★ */

  /* ---------- bold ---------- */
el.style.setProperty(`--ct-bold-${suf}`, P.bold.bold);   // ★ NEW

  /* --folder-- */
  const { lvl0, lvl1, q } = P.folder;
  el.style.setProperty(`--ct-folder-lvl0-01-${suf}`, lvl0._01);
  el.style.setProperty(`--ct-folder-lvl0-25-${suf}`, lvl0._25);
  el.style.setProperty(`--ct-folder-lvl0-68-${suf}`, lvl0._68);
  el.style.setProperty(`--ct-folder-lvl1-01-${suf}`, lvl1._01);
  el.style.setProperty(`--ct-folder-lvl1-25-${suf}`, lvl1._25);
  el.style.setProperty(`--ct-folder-lvl1-68-${suf}`, lvl1._68);
  el.style.setProperty(`--ct-folder-q-${suf}`,        q);

  /* --table-- */
  el.style.setProperty(VAR.tBorder, P.table.border );
  el.style.setProperty(VAR.tShadow, P.table.shadow );
  el.style.setProperty(VAR.tEven ,  P.table.rowEven);
  el.style.setProperty(VAR.tHover,  P.table.rowHover);

  /* --image-- */
el.style.setProperty(`--ct-image-border`, P.image.border);
el.style.setProperty(`--ct-image-shadow`, P.image.shadow);
}
