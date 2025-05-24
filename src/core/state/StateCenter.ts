/* 
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  Path     : src/core/state/StateCenter.ts                                                                       | 
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

/* 
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Purpose   : Import 구문                                                                                          │ 
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  | - Obsidian 코어가 마크다운 내부 코드펜스를 렌더링할 때 넘겨주는 "컨텍스트 객체" 타입을 호출
  | - `type` 키워드를 붙여 "타입 선언"만 가져오므로 번들 결과 파일에는 포함되지 않음
 */
import type { MarkdownPostProcessorContext } from "obsidian";
import { Log } from "../../features/interactive-table/utils/log";

/* 
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Purpose   : 전역 상수 정의                                                                                        │ 
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * * 2) Global Tab 식별자 `TAB_ID`
 * - 같은 노트(URL)이라도 탭(Leaf)마다 고유 문자열을 생성
 * - BroadcastChannel을 통해 서로 메시지를 주고 받을 때 “내가 보낸 메시지”인지 “다른 탭이 보낸 메시지”인지 구별해야 에코(무한 루프)를 방지 가능
 */
const TAB_ID: string = (crypto as any)?.randomUUID
  ? crypto.randomUUID()
  : `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/* 
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Purpose   : 전역 함수 정의                                                                                         │ 
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
/**
 * * 1) ViewInst
 * - 한 개의 ‘렌더 뷰(코드펜스)’를 화면에 그릴 때마다 이 구조체가 하나씩 생성
 */
export interface ViewInst {
  viewId      : string;                               // * 동일 노트 안 여러 코드펜스가 있을 때 각기 다른 식별자
  notePath    : string;                               // * 노트(마크다운 파일) 경로
  dv          : any;                                  // * Dataview API (타입 미정)
  settings    : any;                                  // * 프론트매터 + 사용자 설정
  ctx         : MarkdownPostProcessorContext;         // * Obsidian이 제공하는 렌더링 컨텍스트
  container   : HTMLElement;                          // * 실제 표가 그려질 DOM 컨테이너
  leafEl      : HTMLElement;                          // * 탭 (Leaf)의 최상위 DOM. 탭이 닫힐 때 감지용
  rerender    : (passive?: boolean) => Promise<void>; // * 상태 변경 시 전체 리렌더 함수
  refreshView : (passive?: boolean) => Promise<void>; // * 외부 이벤트로 부분 새로고침 함수
}
/**
 * * 2) Listener
 * - 사용자 인터페이스의 상태가 바뀔때, 상태에 반응해서 실행되는 함수 (상태변화 콜백)
 * - 반환되는 값이 없도록 설정
 */
type Listener = (next: Record<string, any>) => void;

/* 
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Purpose   : Class 선언                                                                                           │ 
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export class StateCenter {
  /**
   * * 1) 내부 저장소 구조
   */
  /**
   * * 1.1) viewId별 화면(Pane) 목록 저장소 
   * - 전역함수 호출
   */
  private paneMap = new Map<string, ViewInst[]>();
  /**
   * * 1.2) viewId별 BroadcastChannel 저장소
   * - 내부함수 호출
   */
  private bcMap   = new Map<string, BroadcastChannel>();
  /**
   * * 1.3) viewId별 Listener 함수 목록
   * - 전역함수 호출
   */
  private subs    = new Map<string, Set<Listener>>();
  /**
   * * 1.4) [유틸 함수] 화면(Pane)이 DOM에서 사라졌는지 검사 후 제거
   */
  private sweep(viewId: string) {
    const alive = (this.paneMap.get(viewId) ?? []).filter(p => document.body.contains(p.leafEl));
    this.paneMap.set(viewId, alive);
  }

  /**
   * * 2) Constructor (생성자)
   * - 브라우저의 localStorage 및 팝업 메시지를 수신하여 상태를 동기화하는 역할
   */
  constructor() {
    /**
     * * 2.1) localStorage 변경 감지: 다른 탭에서 상태 변경 시
     */
    window.addEventListener("storage", e => {
      if (!e.key?.startsWith("coverTable::") || e.newValue == null) return;
      const [, notePath, viewId] = e.key.split("::");
      try { this.applyRemote(viewId, JSON.parse(e.newValue)); } catch {}
    });
    /**
     * * 2.2) Electron 팝업 메시지 수신: 팝아웃된 창과 동기화
     */
    window.addEventListener("message", ev => {
      if (!ev.data?.__coverTable) return;
      const { viewId, payload } = ev.data;
      if (payload.sender === TAB_ID) return;
      this.applyRemote(viewId, payload.state);
    });
  }

  /**
   * * 3) 전역 함수 목록
   */
  /**
   * * 3.1) addPane
   * - 목적 : 새로운 Inst를 화면에 등록하고, 상태 변화를 감지해서 자동으로 갱신
   * - 입력 : inst
   * - 출력 : x
   */
  addPane(inst: ViewInst) {
    const list = this.paneMap.get(inst.viewId) ?? [];
    if (list.some(p => p.container === inst.container)) { return; }
    list.push(inst);
    this.paneMap.set(inst.viewId, list);
    Log.d("addPane ▶", inst.viewId, "현재 Pane 수:", list.length);
    this.sweep(inst.viewId);
    const fn: Listener = async () => {
      Log.d("listener 호출 ▶", inst.viewId);
      await inst.refreshView(true);
      const evt = new CustomEvent("__cover_refresh", { detail: inst.viewId });
      window.dispatchEvent(evt);
    };
    this.subscribe(inst.viewId, fn);
    if (inst.leafEl) {
      const ob = new MutationObserver(() => {
        if (inst.leafEl && !document.body.contains(inst.leafEl)) {
          this.unsubscribe(inst.viewId, fn);
          const remain = (this.paneMap.get(inst.viewId) ?? []).filter(p => p !== inst);
          this.paneMap.set(inst.viewId, remain);
          Log.d("Pane 제거 ▶", inst.viewId, "남은 Pane:", remain.length);
          ob.disconnect();
        }
      });
      ob.observe(document.body, { childList: true, subtree: true });
    }
    this.ensureChannel(inst.viewId);
  }
  /**
   * * 3.2) removePane
   * - 목적 : 등록된 Inst를 제거하고 자원 정리
   * - 입력 : notePath, viewId
   * - 출력 : x
   */
  removePane(notePath: string, viewId: string) {
    this.sweep(viewId);
    const remain = (this.paneMap.get(viewId) ?? []).filter(p => p.notePath !== notePath);
    this.paneMap.set(viewId, remain);
    Log.d("removePane ▶", viewId, "남은 Pane:", remain.length);
    if (remain.length === 0) {
      this.subs.get(viewId)?.clear();
      this.subs.delete(viewId);
      this.bcMap.get(viewId)?.close();
      this.bcMap.delete(viewId);
      try { localStorage.removeItem(this.makeKey(notePath, viewId));} catch {}
    }
  }

  /**
   * * 4) 내부 함수 목록
   */
  /**
   * * 4.1) get
   * - 목적 : 저장된 상태값 가져오기 (localStorage)
   * - 입력 : notePath, viewId
   * - 출력 : Record
   */
  get(notePath: string, viewId: string): Record<string, any> {
    const raw = localStorage.getItem(this.makeKey(notePath, viewId));
    try { return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  }
  /**
   * * 4.2) set
   * - 목적 : 상태를 저장하고, 다른 탭에게도 전달하고, 리스너 실행
   * - 입력 : inst, patch, wipe, silent
   * - 출력 : x
   */
  set(inst: ViewInst, patch: Record<string, any>, wipe = false, silent = false) {
    Log.d("set ▶", inst.viewId, { patch, wipe, silent });
    if ((window as any).__COVER_TABLE_DISABLE_BC) silent = true;
    const key    = this.makeKey(inst.notePath, inst.viewId);
    const before = this.get(inst.notePath, inst.viewId);
    const next   = wipe ? patch : { ...before, ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (e: any) {
      if (e?.name === "QuotaExceededError") {
        console.warn("[Cover-Table] localStorage quota exceeded → using memory only");
      } else {
        throw e; 
      }
    }
    if (!silent) {
      const payload = { sender: TAB_ID, state: next };
      this.bcMap.get(inst.viewId)?.postMessage(payload);
      window.postMessage({ __coverTable: true, viewId: inst.viewId, payload }, "*");
    }
    this.emit(inst.viewId, next);
  }
  /**
   * * 4.3) subscribe
   * - 목적 : 특정 viewId 상태가 바뀔 때 실행될 함수 등록
   * - 입력 : viewId, fn
   * - 출력 : x
   */
  subscribe(viewId: string, fn: Listener) {
    const set = this.subs.get(viewId) ?? new Set<Listener>();
    set.add(fn);
    this.subs.set(viewId, set);
  }
  /**
   * * 4.4) unsubscribe
   * - 목적 : 등록된 리스너 제거
   * - 입력 : viewId, fn
   * - 출력 : x
   */
  unsubscribe(viewId: string, fn: Listener) {
    this.subs.get(viewId)?.delete(fn);
  }
  /**
   * * 4.5) emit
   * - 목적 : 등록된 리스너들 실행 (상태 반영)
   * - 입력 : viewId, state
   * - 출력 : x
   */
  private emit(viewId: string, state: Record<string, any>) {
    this.subs.get(viewId)?.forEach(cb => {
      try { cb(state); } catch (e) { console.error(e); }
    });
  }
  /**
   * * 4.6) ensureChannel
   * - 목적 : 탭 간 통신 채널 생성 및 메시지 수신 설정
   * - 입력 : viewId
   * - 출력 : x
   */
  private ensureChannel( viewId: string ) {
    if ( this.bcMap.has( viewId ) ) return;
    const bc = new BroadcastChannel(`coverTable-${viewId}`);
    bc.onmessage = ev => {
      const { sender, state } = ev.data || {};
      if ( sender === TAB_ID ) return;
      this.applyRemote( viewId, state );
    };
    this.bcMap.set(viewId, bc);
  }
  /**
   * * 4.7) applyRemote
   * - 목적 : 다른 탭에서 받은 상태를 적용하고 반영
   * - 입력 : viewId, newState
   * - 출력 : x
   */
  private applyRemote(viewId: string, newState: any) {
    const panes = this.paneMap.get(viewId) ?? [];
    if (panes.length === 0) return;               

    const notePath = panes[0].notePath;
    const key      = this.makeKey(notePath, viewId);
    const cur      = this.get(notePath, viewId);
    if (JSON.stringify(cur) === JSON.stringify(newState)) return;

    localStorage.setItem(key, JSON.stringify(newState));
    this.emit(viewId, newState);
  }
  /**
   * * 4.8) makeKey
   * - 목적 : 상태 저장 키 문자열 생성
   * - 입력 : notePath, viewId
   * - 출력 : `coverTable::${notePath}::${viewId}` (string)
   */
  private makeKey(notePath: string, viewId: string) {
    return `coverTable::${notePath}::${viewId}`;
  }
  /**
   * * 4.9) hasLivePane
   * - 목적 : 해당 viewId가 현재 DOM에 존재하는지 확인
   * - 입력 : vid
   * - 출력 : boolean
   */
  public hasLivePane(vid: string): boolean {
    const arr = this.paneMap.get(vid)??[];
    return arr.some(p => p.leafEl && document.body.contains(p.leafEl));
  }
}

/* 
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Purpose   : Singleton 인스턴스 생성                                                                               │ 
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const tableState = new StateCenter();

