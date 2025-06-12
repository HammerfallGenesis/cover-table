/* utils/cloneRootStyle.ts */
import { App, WorkspaceLeaf } from "obsidian";

/** 메인 document 의 CSS 변수 → 모든 Leaf 로 복사 */
export function cloneRootStyleToLeaves(app: App) {
  const src = document.documentElement.style.cssText;
    const styleIds = [
    "ct-style-fallback",
    "ct-base-theme",
    "ct-custom-css",
    "ct-base-vars",
    "ct-hn-hide",
    "ct-tag-colors",
  ];

  app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
    const doc = leaf.view?.containerEl?.ownerDocument;
    if (doc && doc !== document) {
      doc.documentElement.style.cssText = src;

      for (const id of styleIds) {
        const srcEl = document.getElementById(id) as HTMLStyleElement | null;
        if (!srcEl) continue;

        let dest = doc.getElementById(id) as HTMLStyleElement | null;
        if (!dest) {
          dest = doc.createElement("style");
          dest.id = id;
          doc.head.appendChild(dest);
        }
        dest.textContent = srcEl.textContent;
      }


    }
  });
}
