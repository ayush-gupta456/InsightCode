import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const available =
  spawnSync("javac", ["-version"], { encoding: "utf8", windowsHide: true })
    .status === 0;

test(
  "Dijkstra runtime reproduces the sample and checks corrected graphs against an independent oracle",
  { skip: !available, timeout: 60000 },
  async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "insightcode-dijkstra-"),
    );
    try {
      await fs.copyFile(
        new URL("./fixtures/BuggyDijkstra.java", import.meta.url),
        path.join(directory, "BuggyDijkstra.java"),
      );
      await fs.copyFile(
        new URL("../docs/examples/CorrectedDijkstra.java", import.meta.url),
        path.join(directory, "CorrectedDijkstra.java"),
      );
      await fs.writeFile(
        path.join(directory, "DijkstraProbe.java"),
        `
import java.util.*;
public class DijkstraProbe {
  static List<List<CorrectedDijkstra.Edge>> graph(int n) {
    List<List<CorrectedDijkstra.Edge>> g = new ArrayList<>();
    for(int i=0;i<n;i++) g.add(new ArrayList<>());
    return g;
  }
  static long[] oracle(List<List<CorrectedDijkstra.Edge>> g, int source) {
    long[] d = new long[g.size()]; Arrays.fill(d, Long.MAX_VALUE); d[source]=0;
    for(int pass=1;pass<g.size();pass++) for(int u=0;u<g.size();u++) {
      if(d[u]==Long.MAX_VALUE) continue;
      for(CorrectedDijkstra.Edge e:g.get(u)) d[e.to]=Math.min(d[e.to],d[u]+e.weight);
    }
    return d;
  }
  public static void main(String[] args) {
    int[] original=BuggyDijkstra.dijkstra(BuggyDijkstra.sample(),0);
    if(!Arrays.equals(original,new int[]{1,5,2,Integer.MAX_VALUE,Integer.MAX_VALUE})) throw new AssertionError(Arrays.toString(original));
    List<List<CorrectedDijkstra.Edge>> sample=graph(5);
    int[][] edges={{0,1,4},{0,2,1},{1,2,2},{1,3,5},{2,3,8},{2,4,10},{3,4,2}};
    for(int[] e:edges){sample.get(e[0]).add(new CorrectedDijkstra.Edge(e[1],e[2]));sample.get(e[1]).add(new CorrectedDijkstra.Edge(e[0],e[2]));}
    if(!Arrays.equals(CorrectedDijkstra.dijkstra(sample,0),new long[]{0,3,1,8,10})) throw new AssertionError("sample");
    List<List<CorrectedDijkstra.Edge>> large=graph(3);
    large.get(0).add(new CorrectedDijkstra.Edge(1,Integer.MAX_VALUE));
    large.get(1).add(new CorrectedDijkstra.Edge(2,2));
    if(!Arrays.equals(CorrectedDijkstra.dijkstra(large,0),new long[]{0,2147483647L,2147483649L})) throw new AssertionError("overflow/sentinel");
    Comparator<BuggyDijkstra.Node> unsafe=(a,b)->a.distance-b.distance;
    if(unsafe.compare(new BuggyDijkstra.Node(0,Integer.MIN_VALUE),new BuggyDijkstra.Node(1,1))<=0) throw new AssertionError("expected reversed signed ordering");
    if(unsafe.compare(new BuggyDijkstra.Node(0,0),new BuggyDijkstra.Node(1,Integer.MAX_VALUE))>=0) throw new AssertionError("nonnegative comparison should be safe");
    Random rng=new Random(37);
    for(int n=1;n<=8;n++) for(int trial=0;trial<20;trial++) {
      List<List<CorrectedDijkstra.Edge>> g=graph(n);
      for(int u=0;u<n;u++) for(int v=0;v<n;v++) if(rng.nextInt(4)==0) g.get(u).add(new CorrectedDijkstra.Edge(v,rng.nextInt(8)));
      for(int source=0;source<n;source++) if(!Arrays.equals(CorrectedDijkstra.dijkstra(g,source),oracle(g,source))) throw new AssertionError("oracle mismatch");
    }
    List<List<CorrectedDijkstra.Edge>> negative=graph(2);negative.get(0).add(new CorrectedDijkstra.Edge(1,-1));
    try {CorrectedDijkstra.dijkstra(negative,0);throw new AssertionError("negative accepted");} catch(IllegalArgumentException expected){}
    try {CorrectedDijkstra.dijkstra(graph(0),0);throw new AssertionError("invalid source accepted");} catch(IllegalArgumentException expected){}
    System.out.println("Original [1,5,2,INF,INF]; corrected [0,3,1,8,10]; oracle and numeric boundary cases passed");
  }
}`,
      );
      const compile = spawnSync(
        "javac",
        ["BuggyDijkstra.java", "CorrectedDijkstra.java", "DijkstraProbe.java"],
        { cwd: directory, encoding: "utf8", windowsHide: true, timeout: 30000 },
      );
      assert.equal(compile.status, 0, compile.stderr);
      const result = spawnSync("java", ["-cp", directory, "DijkstraProbe"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /oracle and numeric boundary cases passed/);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
