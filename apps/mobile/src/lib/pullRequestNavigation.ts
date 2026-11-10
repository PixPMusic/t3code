import { resolveChangeRequestLinkTarget } from "@t3tools/client-runtime/change-request-links";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

/** The PullRequest route for a change request link from a project, or null for the browser. */
export function nativePullRequestDestination(
  url: string,
  context: { environmentId: string; projectId: string } | null,
  projects: ReadonlyArray<Pick<EnvironmentProject, "id" | "environmentId" | "repositoryIdentity">>,
  configLoaded: (environmentId: EnvironmentId) => boolean,
) {
  if (!context) return null;
  const target = resolveChangeRequestLinkTarget({
    url,
    projects,
    configLoaded,
    environmentId: EnvironmentId.make(context.environmentId),
    projectId: ProjectId.make(context.projectId),
    lendHostProject: true,
  });
  if (target === null) return null;
  return {
    environmentId: context.environmentId,
    projectId: String(target.project.id),
    repository: target.repository,
    number: target.number,
    ...(target.host === undefined ? {} : { host: target.host }),
  };
}

export function pullRequestOverviewRoute(
  routes: readonly { readonly name: string; readonly params?: object }[],
) {
  const detail = routes.findLast(
    (route) =>
      route.name === "PullRequest" ||
      route.name === "PullRequestInspectorFullscreen" ||
      route.name === "Thread",
  );
  return detail?.name === "Thread" &&
    detail.params &&
    "inspector" in detail.params &&
    detail.params.inspector &&
    typeof detail.params.inspector === "object" &&
    "type" in detail.params.inspector &&
    detail.params.inspector.type === "pullRequest"
    ? "Thread"
    : detail?.name === "PullRequestInspectorFullscreen"
      ? "PullRequestInspectorFullscreen"
      : "PullRequest";
}
