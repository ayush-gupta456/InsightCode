/** Strong Java signals only; filenames remain the fallback for ambiguous source. */
export function looksLikeJava(source: string) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ");
  if (/\busing\s+(?:System\b|[A-Za-z_]\w*(?:\.\w+)*\s*;)|\bnamespace\s+[A-Za-z_]|\bConsole\.(?:Write|Read)/.test(code)) return false;
  return /\bimport\s+java\./.test(code) || /\b(?:public\s+)?class\s+\w+/.test(code) && /\b(?:static\s+(?:void|boolean|int)|System\.out\.)/.test(code);
}
export function javaFilename(source: string) {
  return `${source.match(/\bpublic\s+class\s+(\w+)/)?.[1] || "Main"}.java`;
}
