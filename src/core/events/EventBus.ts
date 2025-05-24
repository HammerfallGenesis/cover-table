/*****************************************************************
 *  EventBus – Global debounced refresh dispatcher               *
 *****************************************************************/
import { App, TAbstractFile, TFile } from "obsidian";
import { Log } from "../../features/interactive-table/utils/log";

export class EventBus {
  private static _inst: EventBus | null = null;
  static get i() { return EventBus._inst!; }

public emit(file?: TFile) {
  this.broadcast(file);      // 내부 private 메서드 래핑
}


  private readonly app: App;
  private readonly ctrlSet = new Set<(file?: TFile)=>void>();

  private constructor(app: App) {
    this.app = app;
    this.attachVaultHooks();
    this.attachWorkspaceHooks();
  }

  /* ── 초기화: 플러그인 onload() 시 호출 ── */
  static init(app: App) {
    if (!EventBus._inst) EventBus._inst = new EventBus(app);
  }

  /* ── Controller 가 자신의 refresh 콜백을 등록 / 해제 ── */
  on(cb: (file?: TFile)=>void)  { this.ctrlSet.add(cb); }
  off(cb:(file?: TFile)=>void)  { this.ctrlSet.delete(cb); }

  /* ── 내부: debounced broadcast ── */
  private debounce = <F extends (...a:any[])=>void>(fn:F, ms=150) => {
    let t: number|null = null;
    return (...a: Parameters<F>) => {
      if (t) clearTimeout(t);
      t = window.setTimeout(() => fn(...a), ms);
    };
  };

  private broadcast = this.debounce((file?: TFile) => {
    this.ctrlSet.forEach(cb => cb(file));
  }, 150);

  /* ── Vault / Metadata / Workspace Hooks ── */
  private attachVaultHooks() {
    const v = this.app.vault;
    ["modify","delete","rename","create"].forEach((ev) =>
      v.on(ev as any, (f:TAbstractFile)=> {
        if (f instanceof TFile) this.broadcast(f);

        
      })
    );

    /* 📑  Dataview index 완료 → 확실히 새 페이지 포함 */
    this.app.metadataCache.on("resolved", () => this.broadcast());
  }

  private attachWorkspaceHooks() {
    /* ① 레이아웃 전체 변경 */
    this.app.workspace.on("layout-change", () => this.broadcast());

    /* ② 사용자가 다른 탭/리프로 ‘전환’할 때 */
    this.app.workspace.on("active-leaf-change", () =>
      setTimeout(() => this.broadcast(), 100)   // ← 0.1 s delay
    );
  }
    /** 👈 ➊ 외부에서 강제로 새로 고침을 요청할 때 사용 */
forceRefresh(file?: TFile) {
  Log.d("[CT] EventBus.forceRefresh()");
  this.broadcast(file);
}
}