import { useEffect, useRef, useState } from "preact/hooks";
import { fileContextMenu, formatFullChangeId, formatShortChangeId, postMessage } from "../signals";
import { RefPill } from "./ref-pill";
import type {
  ChangeDetails,
  ChangedFileDelta,
  LogEntryLocalRef,
  LogEntryRemoteRef,
  SignatureWithTimestamp,
} from "../../../types";

const COPY_FEEDBACK_MS = 1500;

function CopyIdButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      class="detailsCopyIdButton"
      title={copied ? "Copied!" : `Copy ${label}`}
      data-role="copy-id"
      onClick={() => {
        postMessage({ command: "copyId", id: value });
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
      }}
    >
      <span class={`codicon codicon-${copied ? "check" : "copy"}`} aria-hidden="true" />
    </button>
  );
}

function FieldRow({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div class="detailsFieldRow">
      <div class="detailsFieldLabel">{label}</div>
      <div class="detailsFieldValue">{children}</div>
    </div>
  );
}

function Signature({ signature }: { signature: SignatureWithTimestamp }) {
  return (
    <span>
      {signature.name}{" "}
      {signature.email ? (
        <>
          {"<"}
          <a class="detailsEmailLink" href={`mailto:${signature.email}`}>
            {signature.email}
          </a>
          {">"}
        </>
      ) : null}
      {signature.timestamp ? ` (${signature.timestamp})` : ""}
    </span>
  );
}

function RefPills({
  localRefs,
  remoteRefs,
  kind,
}: {
  localRefs: LogEntryLocalRef[];
  remoteRefs: LogEntryRemoteRef[];
  kind: "bookmark" | "tag";
}) {
  // Remote refs of the git remote duplicate local refs, so hide those (mirroring the graph
  // view's commit tooltip).
  const localNames = new Set(localRefs.map((r) => r.name));
  const filteredRemoteRefs = remoteRefs.filter((r) => !(r.remote === "git" && localNames.has(r.name)));
  if (localRefs.length === 0 && filteredRemoteRefs.length === 0) {
    return <span class="detailsNoValue">(none)</span>;
  }
  return (
    <span class="detailsPillList">
      {localRefs.map((r) => (
        <RefPill key={`local:${r.name}`} kind={kind} name={r.name} conflicted={r.conflict} unsynced={!r.synced} />
      ))}
      {filteredRemoteRefs.map((r) => (
        <RefPill key={`remote:${r.name}@${r.remote}`} kind={kind} name={r.name} remote={r.remote} />
      ))}
    </span>
  );
}

function Description({ description }: { description: string }) {
  if (!description) {
    return <span class="detailsNoValue">(no description set)</span>;
  }
  return <span class="detailsDescription">{description}</span>;
}

function ChangedFiles({ change }: { change: ChangeDetails }) {
  if (change.changedFiles.length === 0) {
    return <div class="detailsNoValue">(no changed files)</div>;
  }
  return (
    <div class="detailsChangedFiles">
      {change.changedFiles.map((file) => (
        <ChangedFileRow key={file.path} change={change} file={file} />
      ))}
    </div>
  );
}

function ChangedFilesHeader({ change }: { change: ChangeDetails }) {
  if (change.filesChanged === 0) {
    return <div class="detailsChangedFilesHeader">Changed Files</div>;
  }
  return (
    <div class="detailsChangedFilesHeader">
      Changed Files ({change.filesChanged} File{change.filesChanged !== 1 ? "s" : ""},{" "}
      <span class="detailsAdded">+{change.linesAdded}</span> <span class="detailsRemoved">-{change.linesRemoved}</span>)
    </div>
  );
}

function ChangedFileRow({ change, file }: { change: ChangeDetails; file: ChangedFileDelta }) {
  return (
    <div
      class="detailsChangedFile"
      title="Open diff"
      data-role="changed-file"
      data-path={file.path}
      data-status={file.type.toLowerCase()}
      data-conflict={file.conflict ? "" : undefined}
      onClick={() => {
        postMessage({
          command: "openFileDiff",
          commitId: change.commitId,
          shortChangeId: formatShortChangeId(change.changeId),
          path: file.path,
          status: file.type,
          ...(file.renamedFrom !== undefined ? { renamedFrom: file.renamedFrom } : {}),
        });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fileContextMenu.value = { change, file, pageX: e.pageX, pageY: e.pageY };
      }}
    >
      <span class="detailsFileStatus">
        {file.type}
        {file.conflict ? "!" : ""}
      </span>
      <span class="detailsFilePath">{file.path}</span>
      {file.renamedFrom !== undefined && <span class="detailsFileDetail">← {file.renamedFrom}</span>}
      {file.binary && <span class="detailsFileDetail">binary</span>}
      {file.linesAdded !== undefined && file.linesAdded > 0 && (
        <span class="detailsFileDetail detailsAdded">+{file.linesAdded}</span>
      )}
      {file.linesRemoved !== undefined && file.linesRemoved > 0 && (
        <span class="detailsFileDetail detailsRemoved">-{file.linesRemoved}</span>
      )}
    </div>
  );
}

export function ChangeDetailsView({ change }: { change: ChangeDetails }) {
  const shortChangeId = formatShortChangeId(change.changeId);
  return (
    <div class="detailsContent">
      <div class="detailsHeader">
        <span class="detailsHeaderChangeId" title={change.changeId.changeId}>
          {shortChangeId}
        </span>
        <span class="detailsHeaderDescription">
          {change.description.split("\n")[0].trim() || "(no description set)"}
        </span>
      </div>
      <div class="detailsFields">
        <FieldRow label="Change ID">
          <span class="detailsId">{formatFullChangeId(change.changeId)}</span>
          <CopyIdButton label="Change ID" value={change.changeId.changeId} />
        </FieldRow>
        <FieldRow label="Commit ID">
          <span class="detailsId">{change.commitId}</span>
          <CopyIdButton label="Commit ID" value={change.commitId} />
        </FieldRow>
        <FieldRow label="Bookmarks">
          <RefPills localRefs={change.localBookmarks} remoteRefs={change.remoteBookmarks} kind="bookmark" />
        </FieldRow>
        <FieldRow label="Tags">
          <RefPills localRefs={change.localTags} remoteRefs={change.remoteTags} kind="tag" />
        </FieldRow>
        <FieldRow label="Author">
          <Signature signature={change.author} />
        </FieldRow>
        <FieldRow label="Committer">
          <Signature signature={change.committer} />
        </FieldRow>
      </div>
      <div class="detailsDescriptionSection">
        <Description description={change.description} />
      </div>
      <div class="detailsChangedFilesSection">
        <ChangedFilesHeader change={change} />
        <ChangedFiles change={change} />
      </div>
    </div>
  );
}
