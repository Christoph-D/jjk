import { useEffect } from "preact/hooks";
import { applyExtensionMessage, detailsState, postMessage } from "./signals";
import { ChangeDetailsView } from "./components/change-details";
import { FileContextMenu } from "./components/file-context-menu";
import type { DetailsExtensionToWebviewMessage } from "../../details-protocol";

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
    postMessage({ command: "webviewReady" });
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
    </div>
  );
}
