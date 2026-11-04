import { randomUUID } from "node:crypto";
import ts from "typescript";
import { unzipSync } from "fflate";
import { filesSchema, safePath, HttpError } from "./security.js";
import type { Finding, SourceFile } from "../shared/types.js";

export function language(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return (
    (
      {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        mjs: "javascript",
        py: "python",
        java: "java",
        go: "go",
        rs: "rust",
        json: "json",
        css: "css",
        html: "html",
        md: "markdown",
        yml: "yaml",
        yaml: "yaml",
      } as Record<string, string>
    )[ext || ""] || "plaintext"
  );
}
export function importZip(buffer: Buffer): SourceFile[] {
  if (buffer.length > 5_000_000) throw new HttpError(413, "ZIP exceeds 5 MB");
  let expanded = 0,
    count = 0;
  const entries = unzipSync(buffer, {
    filter(entry) {
      count++;
      expanded += entry.originalSize;
      if (count > 1000 || expanded > 2_000_000 || entry.originalSize > 250_000)
        throw new HttpError(413, "ZIP expansion limits exceeded");
      if (entry.name.endsWith("/")) return false;
      if (!safePath(entry.name))
        throw new HttpError(400, "ZIP contains unsafe paths");
      return (
        !/(^|\/)(node_modules|\.git|dist|build|vendor|\.env)(\/|$)/.test(
          entry.name,
        ) && language(entry.name) !== "plaintext"
      );
    },
  });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return filesSchema.parse(
    Object.entries(entries).map(([path, data]) => ({
      path,
      content: decoder.decode(data),
    })),
  );
}
type Rule = {
  id: string;
  pattern: RegExp;
  title: string;
  severity: Finding["severity"];
  category: Finding["category"];
  recommendation: string;
  extensions?: string[];
};
const rules: Rule[] = [
  {
    id: "dynamic-eval",
    pattern: /\beval\s*\(/,
    title: "Dynamic code execution",
    severity: "high",
    category: "security",
    recommendation:
      "Replace eval with a parser or an explicit allowlist of operations. Verify whether untrusted input reaches this call.",
  },
  {
    id: "html-sink",
    pattern: /\.innerHTML\s*=|dangerouslySetInnerHTML/,
    title: "HTML injection sink",
    severity: "high",
    category: "security",
    recommendation:
      "Use textContent or framework escaping. If HTML is necessary, sanitize it with a maintained sanitizer.",
  },
  {
    id: "shell",
    pattern: /shell\s*=\s*True|child_process\.exec\s*\(|\bos\.system\s*\(/,
    title: "Shell execution needs input review",
    severity: "high",
    category: "security",
    recommendation:
      "Use argument arrays with shell disabled and validate every untrusted argument.",
  },
  {
    id: "secret",
    pattern:
      /\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
    title: "Possible embedded credential",
    severity: "high",
    category: "security",
    recommendation:
      "Move credentials to a secret manager. If this value is real, revoke and rotate it.",
  },
  {
    id: "tls",
    pattern: /rejectUnauthorized\s*:\s*false|verify\s*=\s*False/,
    title: "TLS certificate verification disabled",
    severity: "high",
    category: "security",
    recommendation:
      "Enable certificate verification and configure trusted certificate authorities.",
  },
  {
    id: "debugger",
    pattern: /^\s*debugger\s*;?\s*$/,
    title: "Debugger statement in source",
    severity: "low",
    category: "maintainability",
    recommendation: "Remove the debugger statement before shipping.",
    extensions: ["javascript", "typescript"],
  },
  {
    id: "empty-catch",
    pattern: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/,
    title: "Error silently discarded",
    severity: "medium",
    category: "reliability",
    recommendation: "Handle the failure explicitly or rethrow with context.",
  },
  {
    id: "weak-hash",
    pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]|hashlib\.(?:md5|sha1)\(/,
    title: "Weak cryptographic hash",
    severity: "medium",
    category: "security",
    recommendation:
      "Review the use case. Use a modern password KDF for passwords, or SHA-256 for integrity checks.",
  },
];
export function analyze(files: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((text, index) => {
      if (/^\s*(\/\/|#|\*|<!--)/.test(text)) return;
      for (const rule of rules) {
        if (rule.extensions && !rule.extensions.includes(language(file.path)))
          continue;
        if (!rule.pattern.test(text)) continue;
        findings.push({
          id: randomUUID(),
          title: rule.title,
          category: rule.category,
          severity: rule.severity,
          confidence: rule.category === "security" ? 0.7 : 0.9,
          file: file.path,
          startLine: index + 1,
          endLine: index + 1,
          description: `The ${rule.id} rule matched this source line. Context and reachability require review.`,
          impact:
            rule.category === "security"
              ? "Potential security exposure if an attacker can influence this code path."
              : "May reduce reliability or maintainability.",
          recommendation: rule.recommendation,
          evidence: text,
          engine: "InsightCode rules",
          verification:
            rule.category === "security" ? "hotspot" : "static-evidence",
          status: "open",
        });
      }
    });
  }
  return findings;
}
export function score(findings: Finding[]) {
  const weights = { critical: 20, high: 10, medium: 4, low: 1 };
  return Math.max(
    0,
    100 -
      findings
        .filter((f) => f.status === "open")
        .reduce((sum, f) => sum + weights[f.severity], 0),
  );
}
export function indexRepository(files: SourceFile[]) {
  return files.map((file) => {
    const lang = language(file.path);
    const symbols: { name: string; line: number; kind: string }[] = [];
    const imports: string[] = [];
    if (["javascript", "typescript"].includes(lang)) {
      const ast = ts.createSourceFile(
        file.path,
        file.content,
        ts.ScriptTarget.Latest,
        true,
        file.path.endsWith("x")
          ? ts.ScriptKind.TSX
          : lang === "typescript"
            ? ts.ScriptKind.TS
            : ts.ScriptKind.JS,
      );
      const visit = (node: ts.Node) => {
        if (
          (ts.isFunctionDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isInterfaceDeclaration(node) ||
            ts.isVariableDeclaration(node)) &&
          node.name
        )
          symbols.push({
            name: node.name.getText(ast),
            line:
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
            kind: ts.SyntaxKind[node.kind],
          });
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          imports.push(node.moduleSpecifier.text);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    return {
      path: file.path,
      language: lang,
      lines: file.content.split("\n").length,
      symbols,
      imports,
      frameworks: imports.filter((x) =>
        /^(react|next|vue|express|@angular|svelte)(\/|$)/.test(x),
      ),
    };
  });
}
export function contextFor(
  files: SourceFile[],
  query: string,
  maxChars = 24_000,
) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((s) => s.length > 2);
  const chunks = files.flatMap((file) => {
    const lines = file.content.split("\n");
    const result = [];
    for (let i = 0; i < lines.length; i += 60) {
      const text = lines.slice(i, i + 60).join("\n");
      result.push({
        path: file.path,
        startLine: i + 1,
        text,
        rank: terms.reduce(
          (n, term) => n + (text.toLowerCase().includes(term) ? 1 : 0),
          0,
        ),
      });
    }
    return result;
  });
  let size = 0;
  return chunks
    .sort((a, b) => b.rank - a.rank)
    .filter((c) => {
      size += c.text.length + c.path.length + 100;
      return size <= maxChars;
    })
    .map(({ rank, ...chunk }) => chunk);
}
