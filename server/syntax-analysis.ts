import ts from "typescript";
import { randomUUID } from "node:crypto";
import type { Finding, SourceFile } from "../shared/types.js";

/** Parse only: never evaluate uploaded source or resolve repository plugins. */
export function syntaxFindings(file: SourceFile, language: string): Finding[] {
  const make = (message: string, start: number, engine: string): Finding => {
    const lines = file.content.split(/\r?\n/);
    const line = file.content.slice(0, start).split("\n").length;
    return { id: randomUUID(), title: message.slice(0, 160), file: file.path,
      startLine: line, endLine: line, evidence: lines[line - 1] || "",
      category: "reliability", severity: "high", confidence: 1,
      description: message, impact: "This source cannot be parsed successfully by the indicated parser.",
      recommendation: "Correct the syntax at this location, then run the language compiler and project tests.",
      engine, verification: "static-evidence", status: "open" };
  };
  if (["javascript", "typescript"].includes(language)) {
    const kind = /\.[jt]sx$/i.test(file.path) ? (language === "typescript" ? ts.ScriptKind.TSX : ts.ScriptKind.JSX) : language === "typescript" ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const ast = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, kind);
    const diagnostics = (ast as ts.SourceFile & { parseDiagnostics: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics;
    return diagnostics.slice(0, 100).map(d => make(`TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`, d.start ?? 0, "TypeScript syntax parser"));
  }
  if (language === "json") {
    try { JSON.parse(file.content); }
    catch (error) {
      const position = (error as Error).message.match(/position (\d+)/)?.[1];
      return [make("Invalid JSON syntax", position ? Number(position) : 0, "JSON parser")];
    }
  }
  return [];
}
