import {
  HomeSettings,
  HomeWatchInput,
  HomeWatchEventsInput,
  HomeWatchEventsResult,
  OrchestratorMcpFailure,
} from "@t3tools/contracts";
import { Tool, Toolkit } from "effect/ai";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagement.ThreadManagementService,
  ],
};
export const HomeToolkit = Toolkit.make(
  Tool.make("t3_thread_watch", {
    ...shared,
    description:
      "Home only. Watch or unwatch a thread, or watch_all / unwatch_all across this environment and its links. Watched threads wake Home when they finish, fail, ask a question or need approval. Launches are watched automatically.",
    parameters: HomeWatchInput,
    success: HomeSettings,
  }).annotate(Tool.Destructive, true),
  Tool.make("t3_thread_watch_events", {
    ...shared,
    description:
      "Read committed thread milestones after a sequence. Omit afterSequence to obtain the current cursor. Used by Home's server follower; Home receives reports automatically.",
    parameters: HomeWatchEventsInput,
    success: HomeWatchEventsResult,
  }).annotate(Tool.Readonly, true),
);
