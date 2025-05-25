/* utils/cloneRootStyle.ts */
import { App, WorkspaceLeaf } from "obsidian";

/** 메인 document 의 CSS 변수 → 모든 Leaf 로 복사 */
export function cloneRootStyleToLeaves(app: App) {
  const src = document.documentElement.style.cssText;

  app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
    const doc = leaf.view?.containerEl?.ownerDocument;
    if (doc && doc !== document) {
      doc.documentElement.style.cssText = src;
    }
  });
}
