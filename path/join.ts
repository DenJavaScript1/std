import { assertPath, isPathSeparator } from "./_util.ts";
import { assert } from "../_util/assert.ts";
import { normalize } from "./normalize.ts";
import { separators } from "./separator.ts";

/**
 * Join all given a sequence of `paths`,then normalizes the resulting path.
 * @param paths to be joined and normalized
 */
export function join(
  paths: string[],
  { os = Deno.build.os }: { os?: typeof Deno.build.os } = {},
): string {
  if (paths.length === 0) return ".";
  let joined: string | undefined;
  let firstPart: string | null = null;
  for (let i = 0, len = paths.length; i < len; ++i) {
    const path = paths[i];
    assertPath(path);
    if (path.length > 0) {
      if (!joined) joined = firstPart = path;
      else {
        joined += `${
          os === "windows" ? separators.win32 : separators.posix
        }${path}`;
      }
    }
  }
  if (!joined) return ".";

  if (os === "windows") {
    // Make sure that the joined path doesn't start with two slashes, because
    // normalize() will mistake it for an UNC path then.
    //
    // This step is skipped when it is very clear that the user actually
    // intended to point at an UNC path. This is assumed when the first
    // non-empty string arguments starts with exactly two slashes followed by
    // at least one more non-slash character.
    //
    // Note that for normalize() to treat a path as an UNC path it needs to
    // have at least 2 components, so we don't filter for that here.
    // This means that the user can use join to construct UNC paths from
    // a server name and a share name; for example:
    //   path.join('//server', 'share') -> '\\\\server\\share\\')
    let needsReplace = true;
    let slashCount = 0;
    assert(firstPart != null);
    if (isPathSeparator(firstPart!.charCodeAt(0))) {
      ++slashCount;
      const firstLen = firstPart!.length;
      if (firstLen > 1) {
        if (isPathSeparator(firstPart!.charCodeAt(1))) {
          ++slashCount;
          if (firstLen > 2) {
            if (isPathSeparator(firstPart!.charCodeAt(2))) ++slashCount;
            else {
              // We matched a UNC path in the first part
              needsReplace = false;
            }
          }
        }
      }
    }
    if (needsReplace) {
      // Find any more consecutive slashes we need to replace
      for (; slashCount < joined.length; ++slashCount) {
        if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
      }

      // Replace the slashes if needed
      if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
    }
  }

  return normalize(joined, { os });
}
