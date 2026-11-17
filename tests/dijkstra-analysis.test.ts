import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { analyze } from "../server/analysis.js";
const buggy = await fs.readFile(
  new URL("./fixtures/BuggyDijkstra.java", import.meta.url),
  "utf8",
);
const corrected = await fs.readFile(
  new URL("../docs/examples/CorrectedDijkstra.java", import.meta.url),
  "utf8",
);
const titles = [
  "Shortest-path source distance must start at zero",
  "Priority-queue comparator subtracts integer distances",
  "Shortest-path distance addition can overflow",
  "Vertex finalized while relaxing an edge",
];
const review = (content: string, path = "BuggyDijkstra.java") =>
  analyze([{ path, content }]).filter(
    (f) => f.engine === "Java shortest-path heuristics",
  );

test("Dijkstra review reports all four independent risks with exact evidence", () => {
  for (const path of ["BuggyDijkstra.java", "main.ts"]) {
    const findings = review(buggy, path);
    assert.deepEqual(new Set(findings.map((f) => f.title)), new Set(titles));
    for (const f of findings) {
      assert.equal(f.evidence, buggy.split(/\r?\n/)[f.startLine - 1]);
      assert.equal(f.verification, "static-evidence");
      assert.ok(f.confidence < 1);
    }
    const expectedEvidence = [
      "distance[source] = 1",
      "a.distance - b.distance",
      "distance[u] + edge.weight",
      "visited[v] = true",
    ];
    titles.forEach((title, i) =>
      assert.ok(
        findings
          .find((f) => f.title === title)!
          .evidence.includes(expectedEvidence[i]),
      ),
    );
    assert.match(
      findings.find((f) => f.title === titles[1])!.description,
      /nonnegative/,
    );
  }
});

test("correcting each defect removes only its corresponding finding", () => {
  const mutations = [
    buggy
      .replace("distance[source] = 1", "distance[source] = 0")
      .replace("Node(source, 1)", "Node(source, 0)"),
    buggy.replace(
      "a.distance - b.distance",
      "Integer.compare(a.distance, b.distance)",
    ),
    buggy.replace(
      "distance[u] + edge.weight",
      "Math.addExact(distance[u], edge.weight)",
    ),
    buggy.replace("                    visited[v] = true;", ""),
  ];
  mutations.forEach((code, i) => {
    const found = review(code).map((f) => f.title);
    assert.equal(found.length, 3);
    assert.ok(!found.includes(titles[i]));
  });
});

test("corrected Dijkstra, comments, strings and unrelated graph code are not flagged", () => {
  assert.deepEqual(review(corrected), []);
  assert.deepEqual(
    review(
      `class Example { String text = "a.distance - b.distance"; /* ${buggy} */ }`,
    ),
    [],
  );
  assert.deepEqual(
    review(
      "class Dijkstra { static int[] copy(int[] distance) { distance[0] = 1; return distance; } }",
    ),
    [],
  );
});

test("Dijkstra matching is independent of method and variable names and newline style", () => {
  const renamed = buggy
    .replaceAll("dijkstra", "shortestPaths")
    .replaceAll("distance", "cost")
    .replaceAll("visited", "settled")
    .replaceAll("source", "origin")
    .replaceAll("newDistance", "candidate")
    .replaceAll("pq", "frontier")
    .replaceAll("\n", "\r\n");
  assert.equal(review(renamed).length, 4);
});

test("only enclosing range guards suppress overflow; infinity checks alone do not", () => {
  const guarded = buggy.replace(
    "int newDistance = distance[u] + edge.weight;",
    "if (distance[u] <= Integer.MAX_VALUE - edge.weight) { int newDistance = distance[u] + edge.weight; }",
  );
  assert.ok(!review(guarded).some((f) => f.title === titles[2]));
  const unrelated = buggy.replace(
    "int newDistance =",
    "if (distance[u] <= Integer.MAX_VALUE - edge.weight) { System.out.println(u); } int newDistance =",
  );
  assert.ok(review(unrelated).some((f) => f.title === titles[2]));
  const sentinelOnly = buggy.replace(
    "int newDistance =",
    "if (distance[u] == Integer.MAX_VALUE) continue; int newDistance =",
  );
  assert.ok(review(sentinelOnly).some((f) => f.title === titles[2]));
});

test("method scoping prevents mixing unrelated queues and distance arrays", () => {
  const content = `import java.util.*; class Separate {
    static int[] a(int source) { int[] distance = new int[5]; Arrays.fill(distance, Integer.MAX_VALUE); distance[source] = 1; return distance; }
    static int[] b(int source) { PriorityQueue<Integer> pq = new PriorityQueue<>(); int u = pq.poll(); return new int[]{u}; }
  }`;
  assert.deepEqual(review(content), []);
});

test("several defects on one line and visit-before-enqueue keep separate evidence", () => {
  assert.equal(review(buggy.replaceAll("\n", " ")).length, 4);
  const earlierMark = buggy.replace(
    "pq.add(new Node(v, newDistance));\n                    visited[v] = true;",
    "visited[v] = true;\n                    pq.add(new Node(v, newDistance));",
  );
  assert.equal(review(earlierMark).length, 4);
});
