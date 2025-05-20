/**  어떠한 태그 타입이 들어와도 `string` 으로 정규화 */
export function toTagString(raw: any): string {
  if (raw == null)          return "";
  if (typeof raw === "string") return raw.trim();
  if (raw instanceof Set)   return [...raw][0] ?? "";
  if (Array.isArray(raw))   return raw[0] ?? "";
  if (typeof raw === "object" && "tag" in raw) return String(raw.tag);
  return String(raw).trim();
}



/** raw(tag | tag[]) → “정렬·표시용” 순수 문자열 배열 */
export function normalizeTags(raw: any): string[] {
  const arr: string[] =
      raw == null             ? []
    : Array.isArray(raw)      ? raw
    : raw instanceof Set      ? [...raw]
    : typeof raw === "string" ? raw.split(/[,;]/).filter(Boolean)
                              : [];

  return arr
    .map(t => (t ?? "").trim())
    .filter(Boolean)
    .map(t => t.startsWith("#") ? t.slice(1) : t);    // “#” 제거
}

/** tags 의 첫 항목을 정렬키로 → [grp, lower, original] 튜플 반환 */
export function tagKey(raw: any): [number,string,string] {
  const first = normalizeTags(raw)
                 .sort((a,b)=>a.localeCompare(b,"ko"))[0] ?? "";
  return [0, first.toLowerCase(), first];             // grp=0 (텍스트와 동일)
}

