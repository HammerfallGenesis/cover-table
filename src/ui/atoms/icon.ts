/*****************************************************************
 * src/ui/atoms/icon.ts – auto-generated from legacy Cover-Table v2025‑05
 *   • 전체 이관 코드 – 수정 금지
 *   • "아이콘" 원본 소스는 ui.ts 내부에 하드코딩(문자) 되어 있었으나,
 *     리팩터링 구조에서는 재사용성을 높이기 위해 전용 Atom 으로 분리했습니다.
 *   • Obsidian 내장 lucide‑icon(또는 외부 스크립트) 가 존재할 경우 SVG 경로를
 *     우선 사용하고, 그렇지 않으면 UNICODE 문자로 대체합니다.
 *****************************************************************/

import { Dom } from "./dom";

/**
 * Cover‑Table 공용 아이콘 이름 집합
 * (※ 기존 ui.ts 하드코딩 문자열 ↗︎ 1 : 1 매핑)
 */
export type CTIconName =
  | "search"        // "⌕"
  | "refresh"       // "↻"
  | "open-folder"   // "↪"
  | "new-note"      // "＋"
  | "chevron-left"  // "«"
  | "chevron-right" // "»"
  | "tag"           // "#"
  | "unknown";      // fallback

/*──────────────────────────────────────────────────────────────
  ①  Fallback UNICODE 문자 매핑
──────────────────────────────────────────────────────────────*/
const CHAR_MAP: Record<CTIconName, string> = {
  search        : "⌕",
  refresh       : "↻",
  "open-folder": "↪",
  "new-note"   : "＋",
  "chevron-left" : "«",
  "chevron-right": "»",
  tag           : "#",
  unknown       : "?",
};

/*──────────────────────────────────────────────────────────────
  ②  lucide‑icon SVG 경로 (필수 최소 subset)
      – Obsidian 내장 아이콘 팩과 동일한 path 데이터를 사용함
──────────────────────────────────────────────────────────────*/
const SVG_PATHS: Partial<Record<CTIconName, string>> = {
  search : "M11 2a9 9 0 1 1 0 18a9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14a7 7 0 0 0 0-14zm10.29 15.29l5 5", // Lucide: search
  refresh: "M17 1v6h6M7 23v-6H1M23 7a11 11 0 0 0-19 8M1 17a11 11 0 0 0 19-8",                     // Lucide: refresh-cw
  "open-folder": "M3 8l4-4h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z",                          // simplified
  "new-note": "M3 4a2 2 0 0 1 2-2h10l6 6v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12 0v6h6",            // file-plus
  "chevron-left" : "M15 18l-6-6 6-6",                                                                // chevron-left
  "chevron-right": "M9 6l6 6-6 6",                                                                  // chevron-right
  tag: "M17 3a2 2 0 0 1 2 2v3.17a2 2 0 0 1-.59 1.42l-7.88 7.88a2 2 0 0 1-2.83 0l-5.17-5.17a2 2 0 0 1 0-2.83l7.88-7.88A2 2 0 0 1 10.83 3H17z", // tag
};

/*──────────────────────────────────────────────────────────────
  ③  SVG 헬퍼 – XMLNS ⇢ <svg>/<path> 생성
──────────────────────────────────────────────────────────────*/
const SVG_NS = "http://www.w3.org/2000/svg";
function makeSvg(pathData: string, cls = ""): SVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (cls) svg.classList.add(cls);

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  return svg;
}

/*──────────────────────────────────────────────────────────────
  ④  팩토리 진입점 – createIcon()
──────────────────────────────────────────────────────────────*/
export function createIcon(name: CTIconName, cls = "ct-icon"): Element {
  // ❶  lucide 팩(또는 Obsidian 내부)의 SVG 생성 함수 우선
  try {
    const lucide: any = (window as any).lucide;
    if (lucide && typeof lucide.createElement === "function") {
      // lucide 1.x – createIcon(name) → SVG Element 반환
      const svg: SVGSVGElement = lucide.createElement(name.replace(/-/g, "-"));
      if (cls) svg.classList.add(cls);
      return svg;
    }
  } catch {/* 무시 – fallback 진행 */}

  // ❷  직접 내장해둔 SVG_PATHS 사용
  const d = SVG_PATHS[name];
  if (d) return makeSvg(d, cls);

  // ❸  최종: 유니코드 문자 <span>
  const span = Dom.el("span", cls, CHAR_MAP[name] || CHAR_MAP.unknown);
  return span;
}

/*──────────────────────────────────────────────────────────────
  ⑤  Wrapper 클래스 – 기존 코드 호환용
──────────────────────────────────────────────────────────────*/
export class IconFactory {
  /** @deprecated 신규 코드에서는 createIcon() 사용 권장 */
  static create(name: CTIconName, cls = "ct-icon"): Element {
    return createIcon(name, cls);
  }
}
