/*──────────────────────────────────────────────────────────────
  #0  import 구문
──────────────────────────────────────────────────────────────*/
import type { MarkdownPostProcessorContext } from "obsidian"; // obsidian 플러그인 API에서 코드펜스 컨텍스트(MarkdownPostProcessorContext)

/* ──────────────  DEBUG  ────────────── */
// - 일반 console.log를 래핑하는 헬퍼 함수.
const COVER_DEBUG = true;
function clog(...args: any[]) {
  if (!COVER_DEBUG) return;
  console.log("[Cover-Table]", ...args);
}

/*──────────────────────────────────────────────────────────────
  #1  128-bit 식별자 생성자
  - BroadcastChannel에서 자신을 식별하는 용도
  - 충돌 확률이 극히 낮은 128-bit 식별자를 간단히 생성
──────────────────────────────────────────────────────────────*/
const TAB_ID = crypto.randomUUID();

/*──────────────────────────────────────────────────────────────
  #2  타입 선언
  - 객체가 이 구조를 만족해야만 컴파일 오류가 없음
──────────────────────────────────────────────────────────────*/
export interface ViewInst {
  viewId      : string;                               // 한 코드펜스(테이블)마다 고유한 식별자
  notePath    : string;                               // 노트 파일 경로
  dv          : any;                                  // Dataview JS API 인스턴스
  setting     : any;                                  // 프론트매터(YAML), 파싱된 테이블 설정
  ctx         : MarkdownPostProcessorContext;         // Obsidian이 코드펜스를 렌더링할 때 주는 컨텍스트 객체
  container   : HTMLElement;                          // 렌더링 결과가 삽입될 부모 DOM (디자인)
  rerender    : (passive?: boolean) => Promise<void>; // passive = true 일 경우 localStorage 재저장 없이 화면만 업데이트
}

/*──────────────────────────────────────────────────────────────
  #3  콜백 함수 타입
  - next 파라미터로 ‘변경된 상태 객체’를 받고, 반환값은 없음(void)
──────────────────────────────────────────────────────────────*/
type Listener = (next: Record<string, any>) => void;

/* ──────────────  CLASS  ────────────── */
class StateCenter {
/*──────────────────────────────────────────────────────────────
  #4  세 가지 Map
  - paneMap : 현재 열려 있는 모든 창을 관리 (동일 view-id 라도 팝-아웃 창이 2개면 배열 길이 2) []
  - bcMap   : 같은 viewId를 공유하는 다른 브라우저 탭/창에 메시지를 전달
  - subs    : 상태가 바뀔 때 콜백을 호출해서 화면을 받아서 다시 그리도록 함
──────────────────────────────────────────────────────────────*/
  private paneMap = new Map<string, ViewInst[]>();       // viewId → Pane 배열 (동시에 여러 Pane 유지)
  private bcMap   = new Map<string, BroadcastChannel>(); // viewId → BroadcastChannel
  private subs    = new Map<string, Set<Listener>>();    // viewId → listener 집합(Set)

  /*───────────────────────────────────────────────
   * addPane()  – viewId 당 여러 Pane 누적
   *──────────────────────────────────────────────*/
  addPane(inst: ViewInst) {

    /* 1) paneMap 누적 */
    const list = this.paneMap.get(inst.viewId) ?? [];
    list.push(inst);
    this.paneMap.set(inst.viewId, list);
    clog("addPane ▶", inst.viewId, "현재 Pane 수:", list.length);

    /* 2) Pane 전용 listener 등록 (중복 방지) */
    const fn: Listener = async () => {
      clog("listener 호출 ▶", inst.viewId);
      await inst.rerender(true);                // passive
    };
    this.subscribe(inst.viewId, fn);
    clog("subscribe ▶", inst.viewId, "listener 수:", this.subs.get(inst.viewId)?.size);

    /* 3) Pane 제거 감시 */
    const ob = new MutationObserver(() => {
      if (!document.body.contains(inst.container)) {
        this.unsubscribe(inst.viewId, fn);
        const remain = (this.paneMap.get(inst.viewId) ?? []).filter(p => p !== inst);
        this.paneMap.set(inst.viewId, remain);
        clog("Pane 제거 ▶", inst.viewId, "남은 Pane:", remain.length);
        ob.disconnect();
      }
    });
    ob.observe(document.body, { childList: true, subtree: true });

    /* 4) BroadcastChannel 확보 */
    this.ensureChannel(inst.viewId);
  }

  /* ============= ② 상태 조회 ============= */
  get(notePath: string, viewId: string) {
    const raw = localStorage.getItem(this.makeKey(notePath, viewId));
    try { return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  }

  /* ============= ③ 상태 갱신 & 전파 ============= */
  set(
    inst   : ViewInst,
    patch  : Record<string, any>,
    wipe   = false,
    silent = false
  ) {
    clog("set ▶", inst.viewId, { patch, wipe, silent });

    if ((window as any).__COVER_TABLE_DISABLE_BC) silent = true;

    const key    = this.makeKey(inst.notePath, inst.viewId);
    const before = this.get(inst.notePath, inst.viewId);
    const next   = wipe ? patch : { ...before, ...patch };

    /* 1) localStorage */
    localStorage.setItem(key, JSON.stringify(next));
    clog("localStorage 저장", key);

    /* 2) 브로드캐스트 */
    if (!silent) {
      const payload = { sender: TAB_ID, state: next };
      this.bcMap.get(inst.viewId)?.postMessage(payload);
      window.postMessage(
        { __coverTable: true, viewId: inst.viewId, payload },
        "*"
      );
      clog("broadcast ▶", inst.viewId);
    }

    /* 3) 로컬 listener 호출 */
    this.emit(inst.viewId, next);
  }

  /* ============= ④ 구독 / 해제 ============= */
  subscribe(viewId: string, fn: Listener) {
    const set = this.subs.get(viewId) ?? new Set<Listener>();
    set.add(fn);
    this.subs.set(viewId, set);
  }
  unsubscribe(viewId: string, fn: Listener) {
    this.subs.get(viewId)?.delete(fn);
  }

  /* ============= ⑤ emit ============= */
  private emit(viewId: string, state: Record<string, any>) {
    const size = this.subs.get(viewId)?.size ?? 0;
    clog("emit ▶", viewId, "listener 수:", size);
    this.subs.get(viewId)?.forEach(cb => {
      try { cb(state); } catch (e) { console.error(e); }
    });
  }

  /* ============= ⑥ BroadcastChannel 관리 ============= */
  private ensureChannel(viewId: string) {
    if (this.bcMap.has(viewId)) return;

    const bc = new BroadcastChannel(`coverTable-${viewId}`);
    clog("BroadcastChannel open ▶", viewId);
    bc.onmessage = ev => {
      const { sender, state } = ev.data || {};
      clog("BC 수신 ▶", viewId, "sender:", sender);
      if (sender === TAB_ID) return;            // echo 차단
      this.applyRemote(viewId, state);
    };
    this.bcMap.set(viewId, bc);
  }

  private applyRemote(viewId: string, newState: any) {
    clog("applyRemote ▶", viewId);
    const panes = this.paneMap.get(viewId) ?? [];
    if (panes.length === 0) return;

    const notePath = panes[0].notePath;
    const key      = this.makeKey(notePath, viewId);
    const cur      = this.get(notePath, viewId);
    if (JSON.stringify(cur) === JSON.stringify(newState)) return;

    localStorage.setItem(key, JSON.stringify(newState));
    this.emit(viewId, newState);
  }

  /* ============= ⑦ 생성자 – storage / postMessage 수신 ============= */
  constructor() {
    /* storage 이벤트 */
    window.addEventListener("storage", e => {
      if (!e.key?.startsWith("coverTable::") || e.newValue == null) return;
      const parts  = e.key.split("::");           // ["coverTable", notePath, viewId]
      const viewId = parts[2];
      clog("storage 이벤트 ▶", viewId);
      try { this.applyRemote(viewId, JSON.parse(e.newValue)); } catch {}
    });

    /* Electron 팝아웃 fallback */
    window.addEventListener("message", ev => {
      if (!ev.data?.__coverTable) return;
      const { viewId, payload } = ev.data;
      clog("postMessage 수신 ▶", viewId);
      if (payload.sender === TAB_ID) return;      // echo 차단
      this.applyRemote(viewId, payload.state);
    });
  }

  /* ============= ⑧ key 유틸 ============= */
  private makeKey(notePath: string, viewId: string) {
    return `coverTable::${notePath}::${viewId}`;
  }
}

/* ──────────────────────────────────────────────────────────────
   3.  전역 인스턴스
────────────────────────────────────────────────────────────── */
export const tableState = new StateCenter();
