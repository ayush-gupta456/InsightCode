import { randomUUID } from "node:crypto";
import type { Finding, SourceFile } from "../shared/types.js";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function blockEnd(source: string, open: number) {
  let depth = 1;
  for (let i = open + 1; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return i;
  }
  return source.length;
}

/** Bounded pattern checks on masked Java, scoped to a priority-queue relaxation method.
 * Findings are source evidence, never a claim of general Java semantic analysis. */
export function shortestPathFindings(
  file: SourceFile,
  source: string,
): Finding[] {
  const findings: Finding[] = [];
  const report = (
    offset: number,
    title: string,
    description: string,
    recommendation: string,
    severity: Finding["severity"] = "high",
    confidence = 0.9,
  ) => {
    const line = source.slice(0, offset).split("\n").length;
    findings.push({
      id: randomUUID(),
      file: file.path,
      title,
      description,
      recommendation,
      startLine: line,
      endLine: line,
      category: "reliability",
      severity,
      confidence,
      impact:
        "May return incorrect shortest-path distances for the triggering input described above.",
      evidence: file.content.split(/\r?\n/)[line - 1],
      engine: "Java shortest-path heuristics",
      verification: "static-evidence",
      status: "open",
    });
  };
  for (const method of source.matchAll(
    /\b(?:int|long)\s*\[\s*\]\s+\w+\s*\(([^)]*)\)\s*\{/g,
  )) {
    const start = method.index! + method[0].length;
    const body = source.slice(start, blockEnd(source, start - 1));
    const queue =
      /\bPriorityQueue\s*<[^;=]+>\s+(\w+)\s*=\s*new\s+PriorityQueue\s*</.exec(
        body,
      );
    const fill =
      /\bArrays\s*\.\s*fill\s*\(\s*(\w+)\s*,\s*(Integer|Long)\s*\.\s*MAX_VALUE\s*\)/.exec(
        body,
      );
    if (!queue || !fill) continue;
    const distance = escape(fill[1]);
    const poll = new RegExp(
      String.raw`\b(\w+)\s*=\s*${escape(queue[1])}\s*\.\s*poll\s*\(`,
    ).exec(body);
    const relaxation = new RegExp(
      String.raw`\b${distance}\s*\[\s*(\w+)\s*\]\s*=\s*(\w+)\s*;`,
    ).exec(body.slice(fill.index + fill[0].length));
    // A priority queue and infinity fill alone could describe many other algorithms.
    if (
      !poll ||
      !relaxation ||
      !new RegExp(String.raw`\b\w+\s*<\s*${distance}\s*\[`).test(body)
    )
      continue;

    for (const initial of body
      .slice(0, poll.index)
      .matchAll(
        new RegExp(
          String.raw`\b${distance}\s*\[\s*(\w+)\s*\]\s*=\s*(-?\d+)[lL]?\s*;`,
          "g",
        ),
      )) {
      if (
        Number(initial[2]) === 0 ||
        !new RegExp(String.raw`\bint\s+${escape(initial[1])}\b`).test(method[1])
      )
        continue;
      report(
        start + initial.index!,
        "Shortest-path source distance must start at zero",
        `The source distance is initialized to ${initial[2]}. Even a single vertex with no edges should have distance 0 to itself; this returns ${initial[2]}. Reachable distances inherit this offset. Initialize the source label and its initial queue entry consistently.`,
        `Set ${fill[1]}[${initial[1]}] = 0 and seed the priority queue with distance 0. Test a singleton graph and a graph with a cheaper indirect path.`,
      );
    }

    for (const comparator of body
      .slice(queue.index, poll.index)
      .matchAll(
        /\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*->\s*\1\s*\.\s*(\w+)\s*-\s*\2\s*\.\s*\3\b/g,
      )) {
      if (
        !new RegExp(
          String.raw`\bint\s+(?:\w+\s*,\s*)*${escape(comparator[3])}\b`,
        ).test(source)
      )
        continue;
      report(
        start + queue.index + comparator.index!,
        "Priority-queue comparator subtracts integer distances",
        "Subtracting signed int priorities can overflow and reverse their order: MIN_VALUE - 1 becomes MAX_VALUE. This is a conditional ordering risk, not an observed failure on the small sample. Subtraction is safe if all priorities stay in the nonnegative int range; unchecked distance addition can break that invariant. The premature visited mark also masks later queue processing in this example.",
        `Use Integer.compare(a.${comparator[3]}, b.${comparator[3]}) or Comparator.comparingInt; use Long.compare/comparingLong after migrating distance storage to long. Independently prevent arithmetic overflow.`,
        "medium",
        0.85,
      );
    }

    for (const addition of body.matchAll(
      new RegExp(
        String.raw`\bint\s+(\w+)\s*=\s*${distance}\s*\[\s*(\w+)\s*\]\s*\+\s*(\w+)\s*\.\s*(\w+)\s*;`,
        "g",
      ),
    )) {
      if (
        fill[2] !== "Integer" ||
        !new RegExp(String.raw`\bint\s*\[\s*\]\s*${distance}\b`).test(body)
      )
        continue;
      const label = String.raw`${distance}\s*\[\s*${escape(addition[2])}\s*\]`;
      const weight = String.raw`${escape(addition[3])}\s*\.\s*${escape(addition[4])}`;
      // Only suppress a guard enclosing the addition, rather than an unrelated check.
      let guarded = false;
      for (const guard of body
        .slice(0, addition.index)
        .matchAll(
          new RegExp(
            String.raw`if\s*\([^{};]*${label}\s*<=\s*Integer\.MAX_VALUE\s*-\s*${weight}[^{};]*\)\s*\{`,
            "g",
          ),
        )) {
        const open = guard.index! + guard[0].length - 1;
        if (blockEnd(body, open) > addition.index!) guarded = true;
      }
      if (guarded) continue;
      report(
        start + addition.index!,
        "Shortest-path distance addition can overflow",
        "Both the distance label and candidate are int. A label 2147483646 plus weight 2 wraps to -2147483648, which can look like an improvement. This is latent for large weights; the supplied small-weight graph does not itself overflow. An exact distance Integer.MAX_VALUE also collides with the unreachable sentinel.",
        "Store distances and queue priorities as long and widen before addition, or use checked arithmetic and a deliberate out-of-range policy. Validate nonnegative weights for Dijkstra. Test multi-edge paths exceeding Integer.MAX_VALUE and an edge weighing exactly Integer.MAX_VALUE.",
      );
    }

    const currentVertex = new RegExp(
      String.raw`\b(\w+)\s*=\s*${escape(poll[1])}\s*\.\s*\w+\s*;`,
    ).exec(body.slice(poll.index));
    if (!currentVertex) continue;
    for (const loop of body.matchAll(
      /for\s*\(\s*\w+\s+(\w+)\s*:\s*\w+\s*\.\s*get\s*\(\s*(\w+)\s*\)\s*\)\s*\{/g,
    )) {
      if (loop[2] !== currentVertex[1]) continue;
      const loopStart = loop.index! + loop[0].length;
      const loopBody = body.slice(loopStart, blockEnd(body, loopStart - 1));
      const neighbor = new RegExp(
        String.raw`\b(\w+)\s*=\s*${escape(loop[1])}\s*\.\s*\w+\s*;`,
      ).exec(loopBody);
      if (!neighbor) continue;
      const v = escape(neighbor[1]);
      for (const mark of loopBody.matchAll(
        new RegExp(String.raw`\b(\w+)\s*\[\s*${v}\s*\]\s*=\s*true\s*;`, "g"),
      )) {
        const visited = escape(mark[1]),
          u = escape(loop[2]);
        const skip = new RegExp(
          String.raw`if\s*\(\s*${visited}\s*\[\s*${u}\s*\]\s*\)\s*(?:\{\s*)?continue\s*;`,
        );
        const update = new RegExp(
          String.raw`\b${distance}\s*\[\s*${v}\s*\]\s*=\s*\w+\s*;`,
        );
        const enqueue = new RegExp(
          String.raw`\b${escape(queue[1])}\s*\.\s*(?:add|offer)\s*\(`,
        );
        if (
          !skip.test(body.slice(poll.index, loop.index)) ||
          !update.test(loopBody.slice(0, mark.index)) ||
          !enqueue.test(loopBody)
        )
          continue;
        report(
          start + loopStart + mark.index!,
          "Vertex finalized while relaxing an edge",
          `The neighbor ${neighbor[1]} is marked visited as soon as it is enqueued, but the poll loop skips visited vertices. Its outgoing edges are therefore never relaxed. For a chain 0 -> 1 -> 2 with source 0, vertex 1 is skipped after discovery, leaving reachable vertex 2 at infinity.`,
          `Remove this neighbor visited assignment. Finalize a vertex only when its minimum-distance entry is polled, after the visited/stale-entry guard. Alternatively use a lazy queue with a stale-distance check. Test a chain and a cheaper indirect path.`,
        );
      }
    }
  }
  return findings;
}
