import { useEffect, useRef, useState } from "preact/hooks";
import { fileContextMenu, formatFullChangeId, formatShortChangeId, idContextMenu, postMessage } from "../signals";
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

// Remote refs of the git remote duplicate local refs, so hide those (mirroring the graph
// view's commit tooltip).
function filterRemoteRefs(localRefs: LogEntryLocalRef[], remoteRefs: LogEntryRemoteRef[]): LogEntryRemoteRef[] {
  const localNames = new Set(localRefs.map((r) => r.name));
  return remoteRefs.filter((r) => !(r.remote === "git" && localNames.has(r.name)));
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
  return (
    <span class="detailsPillList">
      {localRefs.map((r) => (
        <RefPill key={`local:${r.name}`} kind={kind} name={r.name} conflicted={r.conflict} unsynced={!r.synced} />
      ))}
      {remoteRefs.map((r) => (
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
        fileContextMenu.value = { change, file, clientX: e.clientX, clientY: e.clientY };
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
  const remoteBookmarks = filterRemoteRefs(change.localBookmarks, change.remoteBookmarks);
  const remoteTags = filterRemoteRefs(change.localTags, change.remoteTags);
  return (
    <div class="detailsContent">
      <div class="detailsFields">
        <FieldRow label="Commit ID">
          <span
            class="detailsId"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              idContextMenu.value = {
                kind: "commit",
                fullId: change.commitId,
                shortId: change.commitIdShort,
                clientX: e.clientX,
                clientY: e.clientY,
              };
            }}
          >
            {change.commitId}
          </span>
          <CopyIdButton label="Commit ID" value={change.commitId} />
        </FieldRow>
        <FieldRow label="Change ID">
          <span
            class="detailsId"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              idContextMenu.value = {
                kind: "change",
                fullId: formatFullChangeId(change.changeId),
                shortId: shortChangeId,
                clientX: e.clientX,
                clientY: e.clientY,
              };
            }}
          >
            {formatFullChangeId(change.changeId)}
          </span>
          <CopyIdButton label="Change ID" value={formatFullChangeId(change.changeId)} />
        </FieldRow>
        {(change.localBookmarks.length > 0 || remoteBookmarks.length > 0) && (
          <FieldRow label="Bookmarks">
            <RefPills localRefs={change.localBookmarks} remoteRefs={remoteBookmarks} kind="bookmark" />
          </FieldRow>
        )}
        {(change.localTags.length > 0 || remoteTags.length > 0) && (
          <FieldRow label="Tags">
            <RefPills localRefs={change.localTags} remoteRefs={remoteTags} kind="tag" />
          </FieldRow>
        )}
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
