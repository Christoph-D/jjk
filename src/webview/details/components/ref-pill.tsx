import { cx, escapeInvisibleChars } from "../../graph/utils";

interface PillProps {
  kind: "bookmark" | "tag";
  name: string;
  remote?: string;
  conflicted?: boolean;
  unsynced?: boolean;
}

/**
 * A bookmark/tag pill mirroring the look of the graph view's pills: local refs are labeled
 * by name, remote refs by name@remote, and conflicts/unsynced state are marked by suffixes.
 */
export function RefPill({ kind, name, remote, conflicted, unsynced }: PillProps) {
  const label = remote !== undefined ? `${name}@${remote}` : name;
  return (
    <span
      class={cx(
        "detailsPill",
        kind === "bookmark" ? "detailsBookmarkPill" : "detailsTagPill",
        conflicted && "detailsPillConflicted",
        !conflicted && unsynced && "detailsPillUnsynced",
      )}
      title={label}
    >
      {escapeInvisibleChars(label)}
    </span>
  );
}
