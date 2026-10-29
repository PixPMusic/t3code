export function resolveHomeEnvironment<
  Environment extends {
    readonly environmentId: string;
    readonly threadId: string | null | undefined;
  },
>(environments: readonly Environment[], remembered?: string) {
  return (
    environments.find((environment) => environment.environmentId === remembered) ??
    environments.find((environment) => environment.threadId != null) ??
    environments[0]
  );
}
