import Editor, { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import { useEffect, useRef } from "react";
import { looksLikeJava } from "../shared/language";
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
const lang = (path: string) =>
  ({
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    java: "java",
    json: "json",
    css: "css",
    html: "html",
  })[path.split(".").pop() || ""] || "plaintext";
export function CodeEditor({
  path,
  value,
  onChange,
  line,
  readOnly = false,
}: {
  path: string;
  value: string;
  onChange?: (s: string) => void;
  line?: number;
  readOnly?: boolean;
}) {
  const ref = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(
    null,
  );
  const highlight = () => {
    if (!ref.current) return;
    decorations.current?.clear();
    if (line) {
      ref.current.revealLineInCenter(line);
      decorations.current = ref.current.createDecorationsCollection([
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "issue-highlight",
            glyphMarginClassName: "issue-glyph",
          },
        },
      ]);
    }
  };
  useEffect(highlight, [line, path, value]);
  return (
    <Editor
      height="100%"
      path={path}
      language={looksLikeJava(value) ? "java" : lang(path)}
      value={value}
      onChange={(v) => onChange?.(v || "")}
      theme={
        document.documentElement.dataset.theme === "light" ? "vs" : "vs-dark"
      }
      onMount={(editor) => {
        ref.current = editor;
        highlight();
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: '"JetBrains Mono", Consolas, monospace',
        lineHeight: 23,
        padding: { top: 18 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        glyphMargin: true,
        wordWrap: "on",
      }}
    />
  );
}
export function CodeDiff({
  original,
  modified,
}: {
  original: string;
  modified: string;
}) {
  return (
    <DiffEditor
      height="390px"
      original={original}
      modified={modified}
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        fontSize: 12,
        automaticLayout: true,
      }}
    />
  );
}
