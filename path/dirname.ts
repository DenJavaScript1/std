// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { isWindows } from "./_os.ts";
import { dirname as posixDirname } from "./posix/dirname.ts";
import { dirname as windowsDirname } from "./windows/dirname.ts";

/**
 * Return the directory path of a path.
 *
 * @example Usage
 * ```ts
 * import { dirname } from "@std/path/dirname";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(dirname("C:\\home\\user\\Documents\\image.png"), "C:\\home\\user\\Documents");
 * } else {
 *   assertEquals(dirname("/home/user/Documents/image.png"), "/home/user/Documents");
 * }
 * ```
 *
 * @param path Path to extract the directory from.
 * @returns The directory path.
 */
export function dirname(path: string): string;
/**
 * Return the directory path of a file URL.
 *
 * @experimental **UNSTABLE**: New API, yet to be vetted.
 *
 * @example Usage
 * ```ts
 * import { dirname } from "@std/path/dirname";
 * import { assertEquals } from "@std/assert";
 *
 * if (Deno.build.os === "windows") {
 *   assertEquals(dirname(new URL("file:///C:/home/user/Documents/image.png")), "C:\\home\\user\\Documents");
 * } else {
 *   assertEquals(dirname(new URL("file:///home/user/Documents/image.png")), "/home/user/Documents");
 * }
 * ```
 *
 * @param path Path to extract the directory from.
 * @returns The directory path.
 */
export function dirname(path: URL): string;
export function dirname(path: string | URL): string {
  // deno-lint-ignore no-explicit-any
  return isWindows ? windowsDirname(path as any) : posixDirname(path as any);
}
