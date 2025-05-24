/* utils/log.ts ------------------------------------------------ */
type CMethod = "debug" | "info" | "warn" | "error";

function make(method: CMethod) {
  return (...a: any[]) => DEBUG && (console as any)[method]("[CT]", ...a);
}

let DEBUG = true;                              // 기본 ON

export const Log = {
  /* 토글 스위치 (SettingTab 등에서 호출) */
  setDebug(v: boolean) { DEBUG = v; },

  /* 레벨별 래퍼 */
  d : make("debug"),   // = debug / log / info → 전부 여기로 통합
  w : make("warn"),
  e : make("error"),

  /* 시간 계측 */
  time(label: string)    { DEBUG && console.time(`[CT] ${label}`); },
  timeEnd(label: string) { DEBUG && console.timeEnd(`[CT] ${label}`); },
} as const;
