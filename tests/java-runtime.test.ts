import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const available = spawnSync("javac", ["-version"], {encoding:"utf8",windowsHide:true}).status === 0;
test("Java runtime reproduces reported behavior and validates corrected edge cases", {skip:!available,timeout:60000}, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),"insightcode-java-test-"));
  try {
    await fs.copyFile(new URL("./fixtures/LinkedListCycle.java",import.meta.url),path.join(directory,"LinkedListCycle.java"));
    await fs.copyFile(new URL("../docs/examples/CorrectedLinkedListCycle.java",import.meta.url),path.join(directory,"CorrectedLinkedListCycle.java"));
    await fs.writeFile(path.join(directory,"CycleProbe.java"), `
public class CycleProbe {
  public static void main(String[] args) {
    if (args[0].equals("original")) {
      try { LinkedListCycle.hasCycle(null); throw new AssertionError("expected null error"); }
      catch (NullPointerException expected) { }
      Node a = new Node(1), b = new Node(2), c = new Node(3);
      a.next=b; b.next=c; c.next=a;
      if (LinkedListCycle.getCycleLength(a)!=0) throw new AssertionError("expected zero length");
      LinkedListCycle.removeCycle(a);
      if (a.next!=null) throw new AssertionError("expected truncated list");
      System.out.println("Original null error, zero length, and head-cycle truncation reproduced");
      return;
    }
    for (int n=0;n<=6;n++) for(int entry=-1;entry<n;entry++) {
      CorrectedLinkedListCycle.Node[] nodes=new CorrectedLinkedListCycle.Node[n];
      for(int i=0;i<n;i++) nodes[i]=new CorrectedLinkedListCycle.Node(i);
      for(int i=1;i<n;i++) nodes[i-1].next=nodes[i];
      if(n>0 && entry>=0) nodes[n-1].next=nodes[entry];
      CorrectedLinkedListCycle.Node head=n==0?null:nodes[0];
      if(CorrectedLinkedListCycle.hasCycle(head)!=(entry>=0)) throw new AssertionError("detection");
      if(CorrectedLinkedListCycle.getCycleLength(head)!=(entry<0?-1:n-entry)) throw new AssertionError("length");
      CorrectedLinkedListCycle.removeCycle(head);
      for(int i=0;i<n;i++) { if(head!=nodes[i]) throw new AssertionError("node loss"); head=head.next; }
      if(head!=null) throw new AssertionError("cycle retained");
    }
    System.out.println("All corrected empty, acyclic, self-loop, head-cycle and internal-cycle cases passed");
  }
}`);
    const compile=spawnSync("javac",["LinkedListCycle.java","CorrectedLinkedListCycle.java","CycleProbe.java"],{cwd:directory,encoding:"utf8",windowsHide:true,timeout:30000});
    assert.equal(compile.status,0,compile.stderr);
    for(const mode of ["original","corrected"]) {
      const result=spawnSync("java",["-cp",directory,"CycleProbe",mode],{encoding:"utf8",windowsHide:true,timeout:10000});
      assert.equal(result.status,0,result.stderr);
    }
    const original=spawnSync("java",["-cp",directory,"LinkedListCycle"],{encoding:"utf8",windowsHide:true,timeout:4000});
    assert.equal((original.error as NodeJS.ErrnoException)?.code,"ETIMEDOUT","original sample must fail to terminate");
    const corrected=spawnSync("java",["-cp",directory,"CorrectedLinkedListCycle"],{encoding:"utf8",windowsHide:true,timeout:10000});
    assert.equal(corrected.status,0,corrected.stderr);
    assert.match(corrected.stdout,/Cycle Length: 3/);
    assert.match(corrected.stdout,/10 -> 20 -> 30 -> 40 -> 50 -> NULL/);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
