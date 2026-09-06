import path from "path";
import { toForwardSlashes } from "./utils";

export interface GitDiffLineCounts {
  added: number;
  removed: number;
  binary: boolean;
}

const DIFF_HEADER_PREFIX = "diff --git ";
const RENAME_TO_PREFIX = "rename to ";
const COPY_TO_PREFIX = "copy to ";
const BINARY_FILES_PREFIX = "Binary files ";
const GIT_BINARY_PATCH_PREFIX = "GIT binary patch";

interface FileSection {
  renamedTo: string | undefined;
  plusPath: string | undefined;
  minusPath: string | undefined;
  headerPath: string | undefined;
  added: number;
  removed: number;
  binary: boolean;
}

/**
 * Parses `jj diff --git` output into per-file added/removed line counts, keyed by the
 * repository-relative path (forward slashes) of the file's right side. Binary files carry
 * no counts and are flagged instead. A file whose path cannot be recovered from the header
 * lines (e.g. quoted paths with control characters) is omitted; callers then show no
 * per-file delta for it.
 */
export function parseGitDiffLineCounts(output: string): Map<string, GitDiffLineCounts> {
  const result = new Map<string, GitDiffLineCounts>();
  let section: FileSection | undefined;

  const commitSection = () => {
    if (!section) {
      return;
    }
    // The right-side path is exact in the rename/copy header; otherwise it comes from the
    // +++ line, and only a deletion falls back to the --- line. Sections without any of
    // those (binary files, mode-only changes) fall back to the b-side path of the
    // `diff --git` header.
    const target = section.renamedTo ?? section.plusPath ?? section.minusPath ?? section.headerPath;
    if (target !== undefined) {
      result.set(toForwardSlashes(path.normalize(target)), {
        added: section.added,
        removed: section.removed,
        binary: section.binary,
      });
    }
    section = undefined;
  };

  for (const line of output.split("\n")) {
    if (line.startsWith(DIFF_HEADER_PREFIX)) {
      commitSection();
      section = {
        renamedTo: undefined,
        plusPath: undefined,
        minusPath: undefined,
        headerPath: headerTargetPath(line),
        added: 0,
        removed: 0,
        binary: false,
      };
      continue;
    }
    if (!section) {
      continue;
    }
    if (line.startsWith(RENAME_TO_PREFIX)) {
      section.renamedTo = line.slice(RENAME_TO_PREFIX.length);
      continue;
    }
    if (line.startsWith(COPY_TO_PREFIX)) {
      section.renamedTo = line.slice(COPY_TO_PREFIX.length);
      continue;
    }
    if (line.startsWith("+++ ")) {
      section.plusPath = stripBPath(line);
      continue;
    }
    if (line.startsWith("--- ")) {
      section.minusPath = stripXPath(line);
      continue;
    }
    if (line.startsWith(BINARY_FILES_PREFIX) || line.startsWith(GIT_BINARY_PATCH_PREFIX)) {
      section.binary = true;
      continue;
    }
    if (line.startsWith("+")) {
      section.added++;
      continue;
    }
    if (line.startsWith("-")) {
      section.removed++;
      continue;
    }
  }
  commitSection();

  return result;
}

function stripBPath(line: string): string | undefined {
  return line.startsWith("+++ b/") ? line.slice("+++ b/".length) : undefined;
}

function stripXPath(line: string): string | undefined {
  return line.startsWith("--- a/") ? line.slice("--- a/".length) : undefined;
}

/**
 * Extracts the b-side path from a `diff --git a/<A> b/<B>` header, used only for sections
 * without ---/+++/rename lines (binary files, mode-only changes). Splitting at the last
 * " b/" recovers <B> for regular paths; quoted or otherwise ambiguous paths yield a wrong
 * key, which simply matches no file. Quoted headers return undefined.
 */
function headerTargetPath(line: string): string | undefined {
  const rest = line.slice(DIFF_HEADER_PREFIX.length);
  if (rest.startsWith('"')) {
    return undefined;
  }
  const separator = rest.lastIndexOf(" b/");
  if (separator === -1) {
    return undefined;
  }
  const bPath = rest.slice(separator + " b/".length);
  return bPath.length > 0 ? bPath : undefined;
}
