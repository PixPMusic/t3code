import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodePath from "@effect/platform-node/NodePath";
import * as ProjectStore from "../ProjectStore.ts";
import * as ServerConfig from "../../config.ts";

export const layer = Layer.mergeAll(
  Layer.mock(ProjectStore.ProjectStoreV2)({ get: () => Effect.succeedNone }),
  Layer.succeed(ServerConfig.ServerConfig, {
    baseDir: "/managed",
  } as ServerConfig.ServerConfig["Service"]),
  NodePath.layer,
);
