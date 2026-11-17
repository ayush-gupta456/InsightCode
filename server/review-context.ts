import type { SourceFile } from "../shared/types.js";

export type ReviewChunk = { path: string; startLine: number; endLine: number; text: string };
/** Ordered, bounded batches; no keyword ranking may discard a file during an audit. */
export function reviewBatches(files: SourceFile[], maxChars = 24000) {
  if (maxChars < 1000) throw new Error("Review context budget is too small");
  const batches: ReviewChunk[][] = [];
  let batch: ReviewChunk[] = [], size = 0;
  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    let start = 0;
    while (start < lines.length) {
      let end = start, length = 0;
      while (end < lines.length && length + lines[end].length + 1 <= maxChars - 500) {
        length += lines[end].length + 1; end++;
      }
      // A single oversized line is represented as its own chunk, never silently dropped.
      if (end === start) end++;
      const chunk = { path: file.path, startLine: start + 1, endLine: end, text: lines.slice(start, end).join("\n") };
      const cost = JSON.stringify(chunk).length;
      if (batch.length && size + cost > maxChars) { batches.push(batch); batch = []; size = 0; }
      batch.push(chunk); size += cost;
      if (end === lines.length) break;
      // Retain neighboring lines for control-flow context across boundaries.
      start = end - start > 20 ? end - 20 : end;
    }
  }
  if (batch.length) batches.push(batch);
  return batches;
}
