import { test, expect } from "./base-test";
import type { Frame, Page } from "@playwright/test";

async function findDetailsFrame(workbox: Page): Promise<Frame> {
  let detailsFrame: Frame | undefined;
  await expect(async () => {
    for (const frame of workbox.frames()) {
      try {
        const content = await frame.content();
        if (content.includes('id="details"')) {
          detailsFrame = frame;
          return;
        }
      } catch {
        // The frame can be mid-navigation while the webview (re)loads; the
        // content read throws while it is settling, so just try the next.
      }
    }
    throw new Error("Details frame not ready");
  }).toPass();
  return detailsFrame!;
}

test("details view shows the selected change and follows the graph selection", async ({
  scmView,
  graphFrame,
  testRepo,
  workbox,
  electronApp,
}) => {
  await testRepo.commitFile("a.txt", "content a", "commit A");
  await testRepo.commitFile("b.txt", "content b", "commit B");

  const nodes = graphFrame.locator("#nodes > div");
  await expect(nodes).toHaveCount(4); // @, commit B, commit A, root

  const graphPaneHeader = scmView.locator(".pane-header", { hasText: "JJ Graph" }).first();
  const detailsButton = graphPaneHeader.getByRole("button", { name: "Show Details of Selected Change" });
  const fetchButton = graphPaneHeader.getByRole("button", { name: /Fetch from Default Remote/ });
  const undoButton = graphPaneHeader.getByRole("button", { name: "Undo", exact: true });

  await test.step("info button is the left-most button in the graph toolbar", async () => {
    const detailsBox = await detailsButton.boundingBox();
    const fetchBox = await fetchButton.boundingBox();
    const undoBox = await undoButton.boundingBox();
    expect(detailsBox).not.toBeNull();
    expect(fetchBox).not.toBeNull();
    expect(undoBox).not.toBeNull();
    expect(detailsBox!.x).toBeLessThan(fetchBox!.x);
    expect(detailsBox!.x).toBeLessThan(undoBox!.x);
  });

  await detailsButton.click();
  const detailsFrame = await findDetailsFrame(workbox);

  await test.step("no selection prompts to select a change", async () => {
    await expect(detailsFrame.getByText("Select a change in the graph")).toBeVisible();
  });

  const commitB = (await testRepo.log("@-"))[0];
  const commitBFullChangeId = commitB.change_id + (commitB.change_offset ? `/${commitB.change_offset}` : "");

  await test.step("single selection shows the change's details", async () => {
    await nodes.nth(1).click();
    await expect(nodes.nth(1)).toHaveAttribute("data-selected");

    await expect(detailsFrame.locator(".detailsHeaderChangeId")).toHaveAttribute("title", commitBFullChangeId);
    const changeId = detailsFrame.locator(".detailsId").filter({ hasText: commitBFullChangeId });
    await expect(changeId).toHaveText(commitBFullChangeId);
    const commitId = detailsFrame.locator(".detailsId").filter({ hasText: commitB.commit_id });
    await expect(commitId).toHaveText(commitB.commit_id);
    await expect(detailsFrame.locator(".detailsHeaderDescription")).toHaveText("commit B");
    await expect(detailsFrame.getByText("Test User <test@example.com>").first()).toBeVisible();

    const changedFile = detailsFrame.locator('[data-role="changed-file"][data-path="b.txt"]');
    await expect(changedFile).toBeVisible();
    await expect(changedFile.locator(".detailsAdded")).toHaveText("+1");
    await expect(changedFile.locator(".detailsRemoved")).toHaveCount(0);
  });

  await test.step("copy buttons copy the full change and commit IDs", async () => {
    const changeIdCopy = detailsFrame
      .locator(".detailsFieldRow")
      .filter({ hasText: "Change ID" })
      .locator('[data-role="copy-id"]');
    const commitIdCopy = detailsFrame
      .locator(".detailsFieldRow")
      .filter({ hasText: "Commit ID" })
      .locator('[data-role="copy-id"]');

    await changeIdCopy.click();
    await expect(changeIdCopy.locator(".codicon")).toHaveClass(/codicon-check/);
    await expect
      .poll(() =>
        electronApp.evaluate(({ clipboard }: { clipboard: { readText: () => string } }) => clipboard.readText()),
      )
      .toBe(commitBFullChangeId);

    await commitIdCopy.click();
    await expect
      .poll(() =>
        electronApp.evaluate(({ clipboard }: { clipboard: { readText: () => string } }) => clipboard.readText()),
      )
      .toBe(commitB.commit_id);
  });

  await test.step("clicking a changed file opens its diff", async () => {
    await detailsFrame.locator('[data-role="changed-file"][data-path="b.txt"]').click();

    const diffEditor = workbox.locator(".editor-instance");
    await expect(diffEditor).toBeVisible();
    // b.txt is added in commit B: original is empty, modified contains the content.
    const original = workbox.locator(".editor.original .view-lines");
    const modified = workbox.locator(".editor.modified .view-lines");
    await expect(original).toHaveText(/^\s*$/);
    await expect(modified.getByText("content b", { exact: true }).first()).toBeVisible();

    // The diff replaced the Details tab in the editor group; bring it back.
    await workbox.getByRole("tab", { name: "JJ Commit Details", exact: true }).click();
  });

  await test.step("changed files have the same context menu as the graph view", async () => {
    const changedFile = detailsFrame.locator('[data-role="changed-file"][data-path="b.txt"]');
    await changedFile.click({ button: "right" });
    const menu = detailsFrame.locator("#file-context-menu");
    await expect(menu).toBeVisible();
    // commit B is not the working copy, so it also offers "Open File in Working Copy".
    await expect(menu.locator("[data-action]")).toHaveText([
      "View as Diff",
      "Open File",
      "Open File in Working Copy",
      "Copy Path",
      "Copy Relative Path",
    ]);
    await detailsFrame.locator('[data-role="changed-file"][data-path="b.txt"]').click();
    await expect(menu).not.toBeVisible();
  });

  await test.step("multiple selections report that they are not implemented yet", async () => {
    await nodes.nth(0).click();
    await nodes.nth(1).click({ modifiers: ["Shift"] });
    await expect(nodes.nth(0)).toHaveAttribute("data-selected");
    await expect(nodes.nth(1)).toHaveAttribute("data-selected");

    await expect(detailsFrame.getByText("Multiple changes selected")).toBeVisible();
  });

  await test.step("changing the selection updates the details view", async () => {
    await nodes.nth(2).click();
    await expect(nodes.nth(2)).toHaveAttribute("data-selected");

    await expect(detailsFrame.locator(".detailsHeaderDescription")).toHaveText("commit A");
    const changedFileA = detailsFrame.locator('[data-role="changed-file"][data-path="a.txt"]');
    await expect(changedFileA).toBeVisible();
    await expect(changedFileA.locator(".detailsAdded")).toHaveText("+1");
  });
});
