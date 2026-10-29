import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  type ModelSelection,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  resolveNewThreadModelSelectionOverride,
  resolveThreadActionProjectRef,
} from "./chatThreadActions";

const PROJECT_DEFAULT_SELECTION: ModelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "project-default",
};
const CARRIED_SELECTION: ModelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "carried-model",
};

describe("chatThreadActions", () => {
  it("starts ordinary work outside Home's managed project", () => {
    const environmentId = EnvironmentId.make("environment");
    const projectId = ProjectId.make("home-project");
    const defaultProjectRef = { environmentId, projectId: ProjectId.make("app") };
    const context = {
      activeThread: { id: "home:active", environmentId, projectId },
      activeDraftThread: { environmentId, projectId },
      defaultProjectRef,
      handleNewThread: async () => undefined,
    };
    expect(resolveThreadActionProjectRef(context)).toEqual(defaultProjectRef);
    expect(resolveThreadActionProjectRef({ ...context, defaultProjectRef: null })).toBeNull();
    expect(
      resolveThreadActionProjectRef({
        ...context,
        activeThread: { ...context.activeThread, id: "ordinary" },
      }),
    ).toEqual({ environmentId, projectId });
  });
  it("does not carry a non-explicit model from the destination draft back into itself", () => {
    expect(
      resolveNewThreadModelSelectionOverride({
        projectDefaultSelection: null,
        carrySelection: CARRIED_SELECTION,
        carrySourceDraftId: "draft-a",
        destinationDraftId: "draft-a",
      }),
    ).toBeNull();
  });

  it("keeps the project default above any carried selection", () => {
    expect(
      resolveNewThreadModelSelectionOverride({
        projectDefaultSelection: PROJECT_DEFAULT_SELECTION,
        carrySelection: CARRIED_SELECTION,
        carrySourceDraftId: "draft-a",
        destinationDraftId: "draft-b",
      }),
    ).toEqual(PROJECT_DEFAULT_SELECTION);
  });
});
