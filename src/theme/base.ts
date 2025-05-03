/***********************************************************************
 * src/theme/base.ts – rev.2025‑05‑04  (FULL SOURCE, NO OMISSION)
 *   • Cover‑Table built‑in “Base Theme”
 *   • This file contains the FULL CSS snippet provided by the user.
 *   • **Do NOT** edit anywhere else – modify this file only when the
 *     global appearance tokens need to change.
 ***********************************************************************/

export const BASE_THEME_CSS = String.raw`
/* ════════════════════════════════════════════════════════════════════════════
   🎨  색상 변수(Color Variables)
   ────────────────────────────────────────────────────────────────────────────
   ▸ 아래 변수(—)만 수정하면 모든 색을 일괄 변경할 수 있습니다.
   ▸ 변수 설명
     ■ 폴더 색상
       · --folder-lvl0-[01|25|68]-light / --folder-lvl0-[01|25|68]-dark
         0단계(최상위) 폴더 번호대별 색상
       · --folder-lvl1-[01|25|68]-light / --folder-lvl1-[01|25|68]-dark
         1단계(내부) 폴더 번호대별 색상
       · --folder-q-color                 “Q)” 접두 폴더 및 폴더노트 회색
     ■ 볼드 텍스트
       · --bold-color-light / --bold-color-dark
     ■ 헤딩(Heading) 배경 & 글자
       · --heading-bg-h[1‥6]-light / --heading-bg-h[1‥6]-dark
       · --heading-color-light / --heading-color-dark
     ■ 테이블(Table)
       · --table-[border|shadow]-light / --table-[border|shadow]-dark
       · --table-row-[even|hover]-light / --table-row-[even|hover]-dark
     ■ 이미지(Image)
       · --image-border / --image-shadow
     ■ 리스트(List)
       · --bullet-new-color              사용자 지정 기본 불릿 색
       · --ul/ol-color-d[1‥3]-(light|dark) UL/OL 깊이별 색
   ══════════════════════════════════════════════════════════════════════════ */

:root {
  /* ── 폴더: Light ─────────────────────────────── */
  --folder-lvl0-01-light: #0076ad;  /* 0_,1_ */
  --folder-lvl0-25-light: #989300;  /* 2_~5_ */
  --folder-lvl0-68-light: #9b1000;  /* 6_~8_ */
  --folder-lvl1-01-light: #003d5a;  /* 내부 0_,1_ */
  --folder-lvl1-25-light: #453a01;  /* 내부 2_~5_ */
  --folder-lvl1-68-light: #461300;  /* 내부 6_~8_ */

  /* ── “Q)” 접두 폴더 ───────────────────────────── */
  --folder-q-color-light: #848484;

  /* ── 볼드 텍스트 ─────────────────────────────── */
  --bold-color-light:    rgb(138, 0, 119);

  /* ── 헤딩: Light ─────────────────────────────── */
  --heading-bg-h1-light: rgba(255, 204, 203, 0.6);
  --heading-bg-h2-light: rgba(255, 218, 185, 0.6);
  --heading-bg-h3-light: rgba(255, 255, 204, 0.6);
  --heading-bg-h4-light: rgba(224, 255, 255, 0.6);
  --heading-bg-h5-light: rgba(230, 230, 250, 0.6);
  --heading-bg-h6-light: rgba(245, 245, 245, 0.6);
  --heading-color-light: #333;

  /* ── 테이블: Light ───────────────────────────── */
  --table-border-light:  black;
  --table-shadow-light:  rgba(0, 0, 0, 0.15);
  --table-row-even-light:#ebecf1;
  --table-row-hover-light:#f5f1da;

  /* ── 이미지 공통 ─────────────────────────────── */
  --image-border:        rgba(0,0,0,0.2);
  --image-shadow:        rgba(0,0,0,0.15);

  /* ── 기본 불릿 색 ────────────────────────────── */
  --bullet-new-color:    rgb(255, 255, 255);
}

.theme-dark{
  /* ── 폴더: Dark ──────────────────────────────── */
  --folder-lvl0-01-dark: #5bcbff;
  --folder-lvl0-25-dark: #fae05b;
  --folder-lvl0-68-dark: #ff7e75;
  --folder-lvl1-01-dark: #ade5ff;
  --folder-lvl1-25-dark: #fff5b3;
  --folder-lvl1-68-dark: #ffa9a9;

  /* ── “Q)” 접두 폴더 ───────────────────────────── */
  --folder-q-color-dark: #848484;

  /* ── 볼드 텍스트 ─────────────────────────────── */
  --bold-color-dark:     rgb(255, 188, 188);

  /* ── 헤딩: Dark ──────────────────────────────── */
  --heading-bg-h1-dark:  rgba(139, 0, 0, 0.6);
  --heading-bg-h2-dark:  rgba(139, 69, 19, 0.6);
  --heading-bg-h3-dark:  rgba(139, 139, 0, 0.6);
  --heading-bg-h4-dark:  rgba(0, 139, 139, 0.6);
  --heading-bg-h5-dark:  rgba(72, 61, 139, 0.6);
  --heading-bg-h6-dark:  rgba(105, 105, 105, 0.6);
  --heading-color-dark:  #fff;

  /* ── 테이블: Dark ────────────────────────────── */
  --table-border-dark:   #888;
  --table-shadow-dark:   rgba(0, 0, 0, 0.5);
  --table-row-even-dark: #2e2e2e;
  --table-row-hover-dark:#3e3e3e;
}

/* ════════════════════════════════════════════════════════════════════════════
   1▸ 폴더 색상(Folder Colors)
   ──────────────────────────────────────────────────────────────────────────── */

/* ■ 0단계(최상위) 폴더 – Light */
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="1_"]{
  color: var(--folder-lvl0-01-light) !important;
}
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="2_"],
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="3_"],
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="4_"],
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="5_"]{
  color: var(--folder-lvl0-25-light) !important;
}
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="6_"],
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="7_"],
.theme-light .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="8_"]{
  color: var(--folder-lvl0-68-light) !important;
}

/* ■ 0단계 폴더 – Dark */
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="1_"]{
  color: var(--folder-lvl0-01-dark) !important;
}
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="2_"],
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="3_"],
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="4_"],
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="5_"]{
  color: var(--folder-lvl0-25-dark) !important;
}
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="6_"],
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="7_"],
.theme-dark .nav-files-container .tree-item.nav-folder > .tree-item-self[data-path^="8_"]{
  color: var(--folder-lvl0-68-dark) !important;
}

/* ■ 1단계(내부) 폴더 – Light */
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="1_"]{
  color: var(--folder-lvl1-01-light) !important;
}
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="2_"],
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="3_"],
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="4_"],
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="5_"]{
  color: var(--folder-lvl1-25-light) !important;
}
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="6_"],
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="7_"],
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="8_"]{
  color: var(--folder-lvl1-68-light) !important;
}

/* ■ 1단계 폴더 – Dark */
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="1_"]{
  color: var(--folder-lvl1-01-dark) !important;
}
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="2_"],
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="3_"],
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="4_"],
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="5_"]{
  color: var(--folder-lvl1-25-dark) !important;
}
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="6_"],
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="7_"],
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self[data-path^="8_"]{
  color: var(--folder-lvl1-68-dark) !important;
}

/* ▸ 폴더노트 “Q)” (기존 기능 유지) */
.theme-dark .nav-files-container .tree-item.nav-folder .tree-item-children
  .tree-item-self.is-clickable.mod-collapsible.has-folder-note[data-path*="Q)"]{
  color: var(--folder-q-color-dark) !important;
}
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children
  .tree-item-self.is-clickable.mod-collapsible.has-folder-note[data-path*="Q)"]{
  color: var(--folder-q-color-light) !important;
}

/* ▸ 1단계 폴더 collapse 아이콘 숨김 */
.theme-light .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self .collapse-icon,
.theme-dark  .nav-files-container .tree-item.nav-folder .tree-item-children .tree-item.nav-folder
  > .tree-item-self .collapse-icon{
  display:none!important;
}

/* ▸ 폴더노트 아이콘 숨김 */
.tree-item-self.nav-folder-title.has-folder-note::before{
  content:none!important;
  display:none!important;
}

/* ════════════════════════════════════════════════════════════════════════════
   2▸ 파일(노트) 표시/숨김
   ──────────────────────────────────────────────────────────────────────────── */

/* 기본: 모든 파일 숨김 */
.nav-file-title{display:none!important;}
/* 기본: 0_ 가 붙는 폴더 숨김 */
.nav-folder[data-path^="0_"]{display:none!important;}

/* ════════════════════════════════════════════════════════════════════════════
   3▸ 볼드 텍스트
   ──────────────────────────────────────────────────────────────────────────── */
.theme-dark .markdown-preview-view strong,
.theme-dark .markdown-preview-view b,
.theme-dark .markdown-source-view.mod-cm6 .cm-content strong,
.theme-dark .markdown-source-view.mod-cm6 .cm-content b,
.theme-dark .markdown-source-view.mod-cm6 .cm-content .cm-strong{
  font-weight:normal!important;
  color:var(--bold-color-dark)!important;
}
.theme-light .markdown-preview-view strong,
.theme-light .markdown-preview-view b,
.theme-light .markdown-source-view.mod-cm6 .cm-content strong,
.theme-light .markdown-source-view.mod-cm6 .cm-content b,
.theme-light .markdown-source-view.mod-cm6 .cm-content .cm-strong{
  font-weight:normal!important;
  color:var(--bold-color-light)!important;
}

/* ════════════════════════════════════════════════════════════════════════════
   4▸ 메타데이터(Front-Matter) & 헤딩 공통 스타일
   ──────────────────────────────────────────────────────────────────────────── */

/* ▸ 읽기모드 기본: Properties 보이기, hide_properties 클래스 있으면 숨김 */
.workspace-leaf-content[data-mode="preview"]
  .markdown-preview-view.hide_properties .metadata-container{display:none;}
/* ▸ 메타데이터 아이콘 완전 제거 */
.metadata-property-icon,span.metadata-property-icon,
.metadata-style-icon,.clickable-icon.metadata-style-icon,
.metadata-property-icon *,.metadata-style-icon *{display:none!important;}

/* ▸ 헤딩 공통(편집·미리보기) */
:is(h1,h2,h3,h4,h5,h6){
  font-size:1.2em!important;
  padding:5px!important;
  border-radius:5px!important;
  width:100%!important;
  display:block!important;
  box-sizing:border-box!important;
  margin:0.2em 0!important;
}

/* ▸ 헤딩 배경 & 글자색 – Light */
.theme-light :is(h1){background:var(--heading-bg-h1-light)!important;color:var(--heading-color-light)!important;}
.theme-light :is(h2){background:var(--heading-bg-h2-light)!important;color:var(--heading-color-light)!important;}
.theme-light :is(h3){background:var(--heading-bg-h3-light)!important;color:var(--heading-color-light)!important;}
.theme-light :is(h4){background:var(--heading-bg-h4-light)!important;color:var(--heading-color-light)!important;}
.theme-light :is(h5){background:var(--heading-bg-h5-light)!important;color:var(--heading-color-light)!important;}
.theme-light :is(h6){background:var(--heading-bg-h6-light)!important;color:var(--heading-color-light)!important;}

/* ▸ 헤딩 배경 & 글자색 – Dark */
.theme-dark :is(h1){background:var(--heading-bg-h1-dark)!important;color:var(--heading-color-dark)!important;}
.theme-dark :is(h2){background:var(--heading-bg-h2-dark)!important;color:var(--heading-color-dark)!important;}
.theme-dark :is(h3){background:var(--heading-bg-h3-dark)!important;color:var(--heading-color-dark)!important;}
.theme-dark :is(h4){background:var(--heading-bg-h4-dark)!important;color:var(--heading-color-dark)!important;}
.theme-dark :is(h5){background:var(--heading-bg-h5-dark)!important;color:var(--heading-color-dark)!important;}
.theme-dark :is(h6){background:var(--heading-bg-h6-dark)!important;color:var(--heading-color-dark)!important;}

/* ▸ 헤딩 collapse-indicator 위치 조정 */
.markdown-preview-view h1,.markdown-preview-view h2,.markdown-preview-view h3,
.markdown-preview-view h4,.markdown-preview-view h5,.markdown-preview-view h6{
  display:inline-flex!important;align-items:center;position:relative;
}
.markdown-preview-view .heading-collapse-indicator{
  position:static!important;margin-left:0.3em;order:1;transform:none!important;
}

/* ════════════════════════════════════════════════════════════════════════════
   5▸ 테이블 스타일
   ──────────────────────────────────────────────────────────────────────────── */

/* Light */
@media (prefers-color-scheme: light){
  .el-table table{
    border-collapse:collapse;border-spacing:0;width:100%!important;
    border-top:2.27px solid var(--table-border-light);
    border-bottom:2.27px solid var(--table-border-light);
    box-shadow:0 0 20px var(--table-shadow-light);
  }
  .el-table th,.el-table td{border:none;padding:0.51rem;line-height:1.1;}
  .el-table table>tbody>tr:first-child>th,
  .el-table table>tbody>tr:first-child>td{border-top:1.36px solid var(--table-border-light);}
  .el-table table>tbody>tr:last-child>th,
  .el-table table>tbody>tr:last-child>td{border-bottom:1.36px solid var(--table-border-light);}
  .el-table thead th{background:white!important;font-weight:700;padding:8px 9px 5px;}
  .el-table tbody tr:nth-child(even){background:var(--table-row-even-light);}
  .el-table tbody tr:hover td{background:var(--table-row-hover-light);}
}

/* Dark */
@media (prefers-color-scheme: dark){
  .el-table table{
    border-collapse:collapse;border-spacing:0;width:100%!important;
    border-top:2.27px solid var(--table-border-dark);
    border-bottom:2.27px solid var(--table-border-dark);
    box-shadow:0 0 20px var(--table-shadow-dark);
  }
  .el-table th,.el-table td{border:none;padding:0.51rem;line-height:1.1;}
  .el-table table>tbody>tr:first-child>th,
  .el-table table>tbody>tr:first-child>td{border-top:1.36px solid var(--table-border-dark);}
  .el-table table>tbody>tr:last-child>th,
  .el-table table>tbody>tr:last-child>td{border-bottom:1.36px solid var(--table-border-dark);}
  .el-table thead th{background:var(--background-primary)!important;font-weight:700;padding:8px 9px 5px;}
  .el-table tbody tr:nth-child(even){background:var(--table-row-even-dark);}
  .el-table tbody tr:hover td{background:var(--table-row-hover-dark);}
}


/* ════════════════════════════════════════════════════════════════════════════
   6▸ 이미지(Embeds) & 리스트 내 이미지 보호
   ──────────────────────────────────────────────────────────────────────────── */

.el-p.el-embed-image img,
li .el-p.el-embed-image img,
ul li img,ol li img,
.tab-content img,.tabs img{
  display:block;width:700px;max-width:100%;height:auto;margin:1rem auto;
  border:1px solid var(--image-border);box-shadow:0 4px 10px var(--image-shadow);border-radius:4px;
}
/* 리스트 항목 내 이미지 */
li img{display:block;max-width:100%;height:auto;margin:0.5rem auto;}

/* ════════════════════════════════════════════════════════════════════════════
   7▸ 리스트(Bullet & Numbered)
   ──────────────────────────────────────────────────────────────────────────── */

/* 기본 사용자 지정 불릿 */
ul:not(li>*)>li>.list-bullet::after,
.HyperMD-list-line-1 .list-bullet:after{
  height:5px;width:5px;border-radius:50%;background:var(--bullet-new-color);
}
ul:not(li>*)>li>ul>li>.list-bullet::after,
.HyperMD-list-line-2 .list-bullet:after{
  height:1px;width:7px;border-radius:0;background:var(--bullet-new-color);
}
ul:not(li>*)>li>ul>li>ul>li>.list-bullet::after,
.HyperMD-list-line-3 .list-bullet:after{
  height:4px;width:4px;background:transparent;border:1px solid var(--bullet-new-color);border-radius:50%;
}

/* Collapse-indicator 제거 */
.markdown-preview-view li>span.list-collapse-indicator{display:none!important;}

/* ▸ 리스트 전용 색상 변수 (깊이별) */
@media (prefers-color-scheme: light){
  :root{
    --ul-color-d1:#e06c75;--ul-color-d2:#98c379;--ul-color-d3:#61afef;
    --ol-color-d1:#d19a66;--ol-color-d2:#56b6c2;--ol-color-d3:#c678dd;
  }
}
@media (prefers-color-scheme: dark){
  :root{
    --ul-color-d1:#ff7f7f;--ul-color-d2:#7fff7f;--ul-color-d3:#7f7fff;
    --ol-color-d1:#ffd75f;--ol-color-d2:#5fd7d7;--ol-color-d3:#d75fd7;
  }
}

/* ── Unordered List (UL) ───────────────────────── */
.markdown-preview-view ul.has-list-bullet{list-style:none;padding-left:0;}
.markdown-preview-view ul.has-list-bullet>li{color:var(--ul-color-d1);}
.markdown-preview-view ul.has-list-bullet>li span.list-bullet::after{
  height:5px;width:5px;border-radius:50%;background:var(--ul-color-d1);}
.markdown-preview-view ul.has-list-bullet>li>ul.has-list-bullet>li{color:var(--ul-color-d2);}
.markdown-preview-view ul.has-list-bullet>li>ul.has-list-bullet>li span.list-bullet::after{
  height:1px;width:7px;background:var(--ul-color-d2);}
.markdown-preview-view ul.has-list-bullet>li>ul.has-list-bullet>li>ul.has-list-bullet>li{color:var(--ul-color-d3);}
.markdown-preview-view ul.has-list-bullet>li>ul.has-list-bullet>li>ul.has-list-bullet>li span.list-bullet::after{
  border-color:var(--ul-color-d3);}

/* ── Ordered List (OL) ─────────────────────────── */
.markdown-preview-view ol{counter-reset:ol-counter-d1;list-style:none;padding-left:0;}
.markdown-preview-view ol>li{
  counter-increment:ol-counter-d1;position:relative;color:var(--ol-color-d1);padding-left:1.5em;}
.markdown-preview-view ol>li::before{
  content:counter(ol-counter-d1)".";position:absolute;left:0;width:1.5em;text-align:right;color:var(--ol-color-d1);}
.markdown-preview-view ol>li>ol{counter-reset:ol-counter-d2;padding-left:0;}
.markdown-preview-view ol>li>ol>li{
  counter-increment:ol-counter-d2;position:relative;color:var(--ol-color-d2);padding-left:1.5em;}
.markdown-preview-view ol>li>ol>li::before{
  content:counter(ol-counter-d2)")";position:absolute;left:0;width:1.5em;text-align:right;color:var(--ol-color-d2);}
.markdown-preview-view ol>li>ol>li>ol{counter-reset:ol-counter-d3;padding-left:0;}
.markdown-preview-view ol>li>ol>li>ol>li{
  counter-increment:ol-counter-d3;position:relative;color:var(--ol-color-d3);padding-left:1.5em;}
.markdown-preview-view ol>li>ol>li>ol>li::before{
  content:counter(ol-counter-d3)")";position:absolute;left:0;width:1.5em;text-align:right;color:var(--ol-color-d3);}

/* ── 노트 제목( .inline-title ) 글자 크기 조정 ─────────────────────────── */
.inline-title {
  font-size: 1.2em !important;
}

  /* ═════════ List Callout (Global CSS) ═════════ */

  /* li 공통 – 불릿 제거 + 여백 정리 */
  li.lc-list-callout{
    list-style:none!important;
    margin:4px 0!important;
    padding-left:0!important;
    position:relative;
  }

  /* 기본·사용자 지정 불릿(span.list-bullet) 및 ::marker 완전 숨김 */
  li.lc-list-callout > .list-bullet,
  li.lc-list-callout > .list-bullet::after,
  li.lc-list-callout::marker{
    display:none!important;
    content:none!important;
  }

  /* pill 박스 */
  .lc-pill{
    display:inline-block;
    background:rgb(var(--lc-callout-color,158,158,158));
    padding:4px 10px;
    border-radius:6px;
    font-weight:600;
  }



`;
