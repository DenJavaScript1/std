// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { SemVerRange } from "./types.ts";
import { parseRange } from "./parse_range.ts";

/**
 * A tries to parse a valid SemVerRange string or returns undefined
 * @param range The range string
 * @returns A SemVerRange object if valid otherwise `undefined`
 * @deprecated (will be removed after 0.213.0) Use {@linkcode parseRange} inside a try-catch statement instead.
 */
export function tryParseRange(
  range: string,
): SemVerRange | undefined {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return parseRange(range);
  } catch {
    return undefined;
  }
}
