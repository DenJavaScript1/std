// Documentation and interface for walk were adapted from Go
// https://golang.org/pkg/path/filepath/#Walk
// Copyright 2009 The Go Authors. All rights reserved. BSD license.
import { assert } from "../_util/assert.ts";
import { basename, join, normalize } from "../path/mod.ts";

/** Create WalkEntry for the `path` synchronously */
export function _createWalkEntrySync(path: string): WalkEntry {
  path = normalize(path);
  const name = basename(path);
  const info = Deno.statSync(path);
  return {
    path,
    name,
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
  };
}

/** Create WalkEntry for the `path` asynchronously */
export async function _createWalkEntry(path: string): Promise<WalkEntry> {
  path = normalize(path);
  const name = basename(path);
  const info = await Deno.stat(path);
  return {
    path,
    name,
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
  };
}

export interface WalkOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  includeDirs?: boolean;
  followSymlinks?: boolean;
  exts?: string[];
  match?: RegExp[];
  skip?: RegExp[];
}

function include(
  path: string,
  exts?: string[],
  match?: RegExp[],
  skip?: RegExp[],
): boolean {
  if (exts && !exts.some((ext): boolean => path.endsWith(ext))) {
    return false;
  }
  if (match && !match.some((pattern): boolean => !!path.match(pattern))) {
    return false;
  }
  if (skip && skip.some((pattern): boolean => !!path.match(pattern))) {
    return false;
  }
  return true;
}

function wrapErrorWithRootPath(err: Error & { root: string }, root: string) {
  if (err.root) return err;
  err.root = root;
  err.message = `${err.message} for path "${root}"`;
  return err;
}

export interface WalkEntry extends Deno.DirEntry {
  path: string;
}

/** Walks the file tree rooted at root, yielding each file or directory in the
 * tree filtered according to the given options. The files are walked in lexical
 * order, which makes the output deterministic but means that for very large
 * directories walk() can be inefficient.
 *
 * Options:
 * - maxDepth?: number = Infinity;
 * - includeFiles?: boolean = true;
 * - includeDirs?: boolean = true;
 * - followSymlinks?: boolean = false;
 * - exts?: string[];
 * - match?: RegExp[];
 * - skip?: RegExp[];
 *
 *
 *       for await (const entry of walk(".")) {
 *         console.log(entry.path);
 *         assert(entry.isFile);
 *       }
 */
export async function* walk(
  root: string,
  {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = true,
    followSymlinks = false,
    exts = undefined,
    match = undefined,
    skip = undefined,
  }: WalkOptions = {},
): AsyncIterableIterator<WalkEntry> {
  if (maxDepth < 0) {
    return;
  }
  if (includeDirs && include(root, exts, match, skip)) {
    yield await _createWalkEntry(root);
  }
  if (maxDepth < 1 || !include(root, undefined, undefined, skip)) {
    return;
  }
  try {
    for await (const entry of Deno.readDir(root)) {
      assert(entry.name != null);
      let path = join(root, entry.name);

      if (entry.isSymlink) {
        if (followSymlinks) {
          path = await Deno.realPath(path);
        } else {
          continue;
        }
      }

      if (entry.isFile) {
        if (includeFiles && include(path, exts, match, skip)) {
          yield { path, ...entry };
        }
      } else {
        yield* walk(path, {
          maxDepth: maxDepth - 1,
          includeFiles,
          includeDirs,
          followSymlinks,
          exts,
          match,
          skip,
        });
      }
    }
  } catch (err) {
    throw wrapErrorWithRootPath(err, normalize(root));
  }
}

/** Same as walk() but uses synchronous ops */
export function* walkSync(
  root: string,
  {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = true,
    followSymlinks = false,
    exts = undefined,
    match = undefined,
    skip = undefined,
  }: WalkOptions = {},
): IterableIterator<WalkEntry> {
  if (maxDepth < 0) {
    return;
  }
  if (includeDirs && include(root, exts, match, skip)) {
    yield _createWalkEntrySync(root);
  }
  if (maxDepth < 1 || !include(root, undefined, undefined, skip)) {
    return;
  }
  let entries;
  try {
    entries = Deno.readDirSync(root);
  } catch (err) {
    throw wrapErrorWithRootPath(err, normalize(root));
  }
  for (const entry of entries) {
    assert(entry.name != null);
    let path = join(root, entry.name);

    if (entry.isSymlink) {
      if (followSymlinks) {
        path = Deno.realPathSync(path);
      } else {
        continue;
      }
    }

    if (entry.isFile) {
      if (includeFiles && include(path, exts, match, skip)) {
        yield { path, ...entry };
      }
    } else {
      yield* walkSync(path, {
        maxDepth: maxDepth - 1,
        includeFiles,
        includeDirs,
        followSymlinks,
        exts,
        match,
        skip,
      });
    }
  }
}
