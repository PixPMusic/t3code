import type * as Path from "effect/Path";

export function isInHomeFolder(path: Path.Path, baseDir: string, candidate: string) {
  const relative = path.relative(path.resolve(baseDir, "home"), path.resolve(candidate));
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
