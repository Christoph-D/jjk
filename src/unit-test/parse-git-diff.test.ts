/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGitDiffLineCounts } from "../parse-git-diff";

describe("parseGitDiffLineCounts Test Suite", () => {
  it("counts added and removed lines per file", () => {
    const output = [
      "diff --git a/a.txt b/a.txt",
      "index 1..2 100644",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,3 +1,4 @@",
      " context",
      "-removed",
      "+added",
      "+added 2",
      "diff --git a/b.txt b/b.txt",
      "--- a/b.txt",
      "+++ b/b.txt",
      "@@ -2,1 +2,1 @@",
      "-old",
      "+new",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("a.txt"), { added: 2, removed: 1, binary: false });
    assert.deepEqual(counts.get("b.txt"), { added: 1, removed: 1, binary: false });
    assert.equal(counts.size, 2);
  });

  it("keys added files by their +++ path", () => {
    const output = [
      "diff --git a/dir/new.txt b/dir/new.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/dir/new.txt",
      "@@ -0,0 +1,2 @@",
      "+one",
      "+two",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("dir/new.txt"), { added: 2, removed: 0, binary: false });
  });

  it("keys deleted files by their --- path", () => {
    const output = [
      "diff --git a/gone.txt b/gone.txt",
      "deleted file mode 100644",
      "--- a/gone.txt",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-one",
      "-two",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("gone.txt"), { added: 0, removed: 2, binary: false });
  });

  it("keys renamed files by the rename-to path and counts their content changes", () => {
    const output = [
      "diff --git a/old.txt b/dir/new.txt",
      "similarity index 90%",
      "rename from old.txt",
      "rename to dir/new.txt",
      "--- a/old.txt",
      "+++ b/dir/new.txt",
      "@@ -1,2 +1,3 @@",
      " keep",
      "+added",
      " context",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("dir/new.txt"), { added: 1, removed: 0, binary: false });
    assert.equal(counts.has("old.txt"), false);
  });

  it("counts pure renames as zero-line changes", () => {
    const output = [
      "diff --git a/old.txt b/dir/new.txt",
      "similarity index 100%",
      "rename from old.txt",
      "rename to dir/new.txt",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("dir/new.txt"), { added: 0, removed: 0, binary: false });
  });

  it("flags binary files instead of counting lines", () => {
    const output = [
      "diff --git a/data.bin b/data.bin",
      "index 1..2 100644",
      "Binary files a/data.bin and b/data.bin differ",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("data.bin"), { added: 0, removed: 0, binary: true });
  });

  it("flags binary additions with a /dev/null left side", () => {
    const output = [
      "diff --git a/data.bin b/data.bin",
      "new file mode 100644",
      "Binary files /dev/null and b/data.bin differ",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("data.bin"), { added: 0, removed: 0, binary: true });
  });

  it("handles mode-only changes with no ---/+++ lines", () => {
    const output = ["diff --git a/script.sh b/script.sh", "old mode 100644", "new mode 100755"].join("\n");
    const counts = parseGitDiffLineCounts(output);
    // The path falls back to the header's b-side; a mode change carries no line counts.
    assert.deepEqual(counts.get("script.sh"), { added: 0, removed: 0, binary: false });
  });

  it("ignores the no-newline marker", () => {
    const output = [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,1 +1,1 @@",
      "-old",
      "\\ No newline at end of file",
      "+new",
    ].join("\n");
    const counts = parseGitDiffLineCounts(output);
    assert.deepEqual(counts.get("a.txt"), { added: 1, removed: 1, binary: false });
  });

  it("returns an empty map for empty output", () => {
    assert.equal(parseGitDiffLineCounts("").size, 0);
  });
});
