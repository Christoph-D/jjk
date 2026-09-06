import { useEffect } from "preact/hooks";
import { applyExtensionMessage, closeFileContextMenu, detailsState, postMessage, textContextMenu } from "./signals";
import { ChangeDetailsView } from "./components/change-details";
import { FileContextMenu } from "./components/file-context-menu";
import { TextContextMenu } from "./components/text-context-menu";
import type { DetailsExtensionToWebviewMessage } from "../../details-protocol";

// The default (Electron) Cut/Copy/Paste menu is replaced by custom menus: right-clicking
// inside an active text selection shows the text context menu (whose only entry copies
// the selection), and every other right-click shows nothing. Custom menus (e.g. the file
// context menu) already call preventDefault()/stopPropagation() on their rows, so those
// events never reach this document-level handler.
function isContextMenuWithinSelection(e: MouseEvent): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  // Resolve the caret position at the click point (caretRangeFromPoint in Chromium,
  // caretPositionFromPoint in Firefox).
  let node: Node | null;
  let offset: number;
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  } else if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(e.clientX, e.clientY);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else {
    return true;
  }
  if (!node) {
    return false;
  }
  for (let i = 0; i < selection.rangeCount; i++) {
    try {
      if (selection.getRangeAt(i).isPointInRange(node, offset)) {
        return true;
      }
    } catch {
      // Node lives outside the range's tree; treat as not in range.
    }
  }
  return false;
}

function StateMessage({ icon, message }: { icon?: string; message: string }) {
  return (
    <div class="detailsStateDisplay" data-role="message">
      {icon && <i class={`codicon codicon-${icon}`} aria-hidden="true" />}
      <div class="detailsStateMessage">{message}</div>
    </div>
  );
}

export function App() {
  useEffect(() => {
    window.addEventListener("message", (event) => {
      applyExtensionMessage(event.data as DetailsExtensionToWebviewMessage);
    });
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      closeFileContextMenu();
      if (isContextMenuWithinSelection(e)) {
        const selection = window.getSelection();
        textContextMenu.value = {
          text: selection?.toString() ?? "",
          pageX: e.pageX,
          pageY: e.pageY,
        };
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    postMessage({ command: "webviewReady" });
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const state = detailsState.value;

  return (
    <div id="details" class="detailsRoot">
      {state.kind === "loading" && <StateMessage message="Loading..." />}
      {state.kind === "noSelection" && (
        <StateMessage icon="info" message="Select a change in the graph to show its details." />
      )}
      {state.kind === "multipleSelection" && (
        <StateMessage icon="split" message="Multiple changes selected: Please select a single change." />
      )}
      {state.kind === "error" && <StateMessage icon="error" message="Failed to load change details." />}
      {state.kind === "single" && <ChangeDetailsView change={state.change} />}
      <FileContextMenu />
      <TextContextMenu />
    </div>
  );
}
