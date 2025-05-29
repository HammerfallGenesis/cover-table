/*****************************************************************
 * EmbedCm6.ts – CodeMirror-6 level drag / paste handler
 *****************************************************************/
import { EditorView, ViewUpdate } from "@codemirror/view";
import type { EmbedFileHandlerSettings } from "./EmbedService";

export function makeEmbedExtension(
  getCfg: () => EmbedFileHandlerSettings,
) {
  /* 내부 헬퍼 : File[] 또는 경로 문자열 배열 ➜ 위/임베드 문자열 */
  const buildInsert = (names: string[], exts: string[]) =>
    names.map(n => {
      const ext = n.slice(n.lastIndexOf(".")).toLowerCase();
      return exts.includes(ext) ? `[[${n}]]` : `![[${n}]]`;
    }).join("\n");

  return EditorView.domEventHandlers({
    drop(evt, view) {
      const cfg  = getCfg();
      if (!cfg.enableEmbedNoPreview) return false;

      const exts = cfg.nonPreviewExtensions.map(e => e.toLowerCase());

      /* ① File 객체 있는 경우 ------------------------------------ */
      if (evt.dataTransfer?.files?.length) {
        const files = Array.from(evt.dataTransfer.files);
        if (!files.some(f => exts.includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase())))
          return false;                            // 대상 확장자 아님

        evt.preventDefault();
        evt.stopPropagation();

        const insert = buildInsert(files.map(f => f.name), exts);
        view.dispatch({ changes:{from:view.state.selection.main.from, insert} });
        return true;
      }

      /* ② plain-text 경로만 있는 경우 --------------------------- */
      const txt = evt.dataTransfer?.getData("text/plain") ?? "";
      if (!txt) return false;

      const paths = txt.split(/\r?\n/).filter(Boolean);
      if (!paths.some(p => exts.includes(p.slice(p.lastIndexOf(".")).toLowerCase())))
        return false;

      evt.preventDefault();
      evt.stopPropagation();

      const names  = paths.map(p => p.split(/[\\/]/).pop()!);
      const insert = buildInsert(names, exts);
      view.dispatch({ changes:{from:view.state.selection.main.from, insert} });
      return true;
    },

    /* paste 이벤트까지 동일 규칙 적용 ---------------------------- */
    paste(evt, view) {
      const cfg  = getCfg();
      if (!cfg.enableEmbedNoPreview) return false;

      const exts = cfg.nonPreviewExtensions.map(e => e.toLowerCase());
      const files = Array.from(evt.clipboardData?.files ?? []);
      if (!files.length) return false;

      if (!files.some(f => exts.includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase())))
        return false;

      evt.preventDefault();
      evt.stopPropagation();

      const insert = buildInsert(files.map(f => f.name), exts);
      view.dispatch({ changes:{from:view.state.selection.main.from, insert} });
      return true;
    }
  });
}
