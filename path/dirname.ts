import {
  assertPath,
  isPathSeparator,
  isPosixPathSeparator,
  isWindowsDeviceRoot,
} from "./_util.ts";
import { CHAR_COLON } from "./_constants.ts";

/**
 * Return the directory name of a `path`.
 * @param path to determine name for
 */
export function dirname(
  path: string,
  { os = Deno.build.os }: { os?: typeof Deno.build.os } = {},
): string {
  assertPath(path);
  const len = path.length;
  if (len === 0) return ".";
  let end = -1;
  let matchedSlash = true;
  let rootEnd = -1;
  let offset = 0;

  if (os === "windows") {
    const code = path.charCodeAt(0);

    // Try to match a root
    if (len > 1) {
      if (isPathSeparator(code)) {
        // Possible UNC root

        rootEnd = offset = 1;

        if (isPathSeparator(path.charCodeAt(1))) {
          // Matched double path separator at beginning
          let j = 2;
          let last = j;
          // Match 1 or more non-path separators
          for (; j < len; ++j) {
            if (isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            // Matched!
            last = j;
            // Match 1 or more path separators
            for (; j < len; ++j) {
              if (!isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j < len && j !== last) {
              // Matched!
              last = j;
              // Match 1 or more non-path separators
              for (; j < len; ++j) {
                if (isPathSeparator(path.charCodeAt(j))) break;
              }
              if (j === len) {
                // We matched a UNC root only
                return path;
              }
              if (j !== last) {
                // We matched a UNC root with leftovers

                // Offset by 1 to include the separator after the UNC root to
                // treat it as a "normal root" on top of a (UNC) root
                rootEnd = offset = j + 1;
              }
            }
          }
        }
      } else if (isWindowsDeviceRoot(code)) {
        // Possible device root

        if (path.charCodeAt(1) === CHAR_COLON) {
          rootEnd = offset = 2;
          if (len > 2) {
            if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
          }
        }
      }
    } else if (isPathSeparator(code)) {
      // `path` contains just a path separator, exit early to avoid
      // unnecessary work
      return path;
    }
  } else {
    offset = 1;
  }

  for (let i = len - 1; i >= offset; --i) {
    const code = path.charCodeAt(i);
    if (os === "windows" ? isPathSeparator(code) : isPosixPathSeparator(code)) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (os === "windows") {
    if (end === -1) {
      if (rootEnd === -1) return ".";
      else end = rootEnd;
    }
  } else {
    const hasRoot = isPosixPathSeparator(path.charCodeAt(0));
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
  }
  return path.slice(0, end);
}
