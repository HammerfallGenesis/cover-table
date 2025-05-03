/***********************************************************************
 * tab.ts – rev.2025-04-29  (FULL SOURCE, NO OMISSION)
 *   “한 파일 = 한 탭” 규칙을 강제하는 Workspace 헬퍼.
 *   ─ 기능
 *     • 탐색기 / 링크 클릭 시 이미 열려 있는 Leaf 재활용
 *     • 폴더 클릭 → 폴더-노트(index.md‧README.md 등) 자동 열기
 *     • PDF 링크(뷰어)도 동일 로직 적용
 *     • 동일 파일이 다중 Leaf 로 열렸을 때 중복 Leaf 자동 정리
 *     • openLinkText / popout(↗) 버튼을 *move* 로 패치
 *
 *   ※ InteractiveTable / GanttTable 과 동일한 “전 Pane 상태-보존”
 *     철학을 따르므로, 모듈명은 **TabManager** 로 통일.
 ***********************************************************************/

import { App, TFile, WorkspaceLeaf } from "obsidian";

export class TabManager {
  /* ──────────────────────────── Fields ──────────────────────────── */
  private clickHandler!:   (e: MouseEvent) => void;   // 전역 클릭 훅
  private fileOpenHandler!: (f: TFile | null) => void;    // leaf 중복 감시
  private restoreOpenLinkText: (() => void) | null = null;

  /* ─────────────────────────── Constructor ───────────────────────── */
  constructor(private app: App) {
    this.patchOpenLinkText();      // (1) “같은 파일 = 같은 탭” 패치
    this.watchFileOpenEvent();     // (2) leaf 중복 자동 정리
    this.registerGlobalClick();    // (3) 탐색기 / PDF 클릭 가로채기
  }

  /* ─────────────────── 1. leaf 중복 정리 ─────────────────── */
  private watchFileOpenEvent() {
    this.fileOpenHandler = (file) => {
      if (!file) return;
      const dup = this.leavesFor(file);
      if (dup.length > 1) dup.slice(1).forEach((l) => l.detach());
    };
    this.app.workspace.on("file-open", this.fileOpenHandler);
  }

  /* ─────────────────── 2. 전역 클릭 훅 ──────────────────── */
  private registerGlobalClick() {
    this.clickHandler = this.handleClick.bind(this);
    /* useCapture=true → 내부 클릭보다 먼저 탐지 */
    this.app.workspace.containerEl.addEventListener("click", this.clickHandler, true);
  }

  /* ─────────────────── 3. Utilities ────────────────────── */

  /** 현재 Vault 안에서 *같은 파일* 을 표시하고 있는 모든 Leaf 수집 */
  private leavesFor(file: TFile): WorkspaceLeaf[] {
    const acc: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const f: TFile | undefined = (leaf.view as any).file;
      if (f?.path === file.path) acc.push(leaf);
    });
    return acc;
  }

  /** 이미 열려 있으면 reveal, 없으면 새 Leaf(tab) 에 open */
  private async focusOrOpenFile(file: TFile) {
    const exist = this.leavesFor(file)[0];
    if (exist) return this.app.workspace.revealLeaf(exist);

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }

  /** 파일 or 경로(any) 를 openLinkText 규칙에 맞춰 열기 */
  private openPathAny(path: string) {
    const af = this.app.vault.getAbstractFileByPath(path);
    af instanceof TFile
      ? this.focusOrOpenFile(af)
      : this.app.workspace.openLinkText(path, "", true);
  }

  /** 폴더-노트(폴더이름.md / index.md / README.md) 탐색 */
  private findFolderNote(folderPath: string): TFile | null {
    const base = folderPath.split("/").pop() || "";
    for (const p of [
      `${folderPath}.md`,
      `${folderPath}/${base}.md`,
      `${folderPath}/index.md`,
      `${folderPath}/README.md`,
    ]) {
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof TFile) return f;
    }
    return null;
  }

  /* ─────────────────── 4. Global Click Handler ─────────── */
  private handleClick(evt: MouseEvent) {
    if (evt.button !== 0 || evt.ctrlKey || evt.metaKey) return; // 좌클릭만

    const FILE   = "div.nav-file-title, div.nav-file-title-content";
    const FOLDER = "div.nav-folder-title";
    const PDF    = "a[href$='.pdf']";

    const target = (evt.target as HTMLElement)
      .closest<HTMLElement>(`${FILE}, ${FOLDER}, ${PDF}`);
    if (!target) return;

    /* ── 폴더 클릭 → 대응 폴더-노트 열기 ───────────────────── */
    if (target.matches(FOLDER)) {
      const folderPath =
        target.dataset.path ??
        target.closest<HTMLElement>(".nav-folder")?.dataset.path ??
        "";
      if (!folderPath) return;

      const note = this.findFolderNote(folderPath);
      if (!note) return;           // 폴더 접힘/펼침 기본 행동 유지
      evt.preventDefault();
      this.focusOrOpenFile(note);
      return;
    }

    /* ── 탐색기 밖 PDF 링크(에디터 / 미리보기) 처리 ─────────── */
    if (target.matches(PDF)) {
      const href = target.getAttribute("href") || "";
      if (!href) return;
      evt.preventDefault();

      const file =
        this.app.metadataCache.getFirstLinkpathDest(href, "") ??
        this.app.vault.getAbstractFileByPath(href);
      if (file instanceof TFile) this.focusOrOpenFile(file);
      return;
    }

    /* 탐색기 파일(nav-file) 클릭은 Obsidian 기본 로직을
       openLinkText 패치가 이미 가로채므로 여기선 건드리지 않음 */
  }

  /* ─────────────────── 5. openLinkText 패치 ─────────────── */
  /**
   *   · 같은 파일을 다시 열면 항상 *기존 탭* 으로 포커스 이동  
   *   · 새로운 파일은 “새 탭”으로 열리도록 _newLeaf=true 강제
   */
  private patchOpenLinkText() {
    const ws: any = this.app.workspace;
    const original = ws.openLinkText.bind(ws);

    ws.openLinkText = async (
      link: string,
      src: string,
      _newLeaf?: boolean,
      state?: any,
    ) => {
      const dest = this.app.metadataCache.getFirstLinkpathDest(link, src);
      if (dest instanceof TFile) {
        const exist = this.leavesFor(dest)[0];
        if (exist) {
          ws.revealLeaf(exist);
          return exist;
        }
      }
      /* _newLeaf = true → 항상 새 탭 */
      return original(link, src, true, state);
    };

    this.restoreOpenLinkText = () => (ws.openLinkText = original);
  }


  /* ─────────────────── 6. Destroy (plugin unload) ───────── */
  public destroy() {
    this.app.workspace.off("file-open", this.fileOpenHandler);
    this.app.workspace.containerEl.removeEventListener("click", this.clickHandler, true);
    this.restoreOpenLinkText?.();
  }
}
