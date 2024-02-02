// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Range, SemVer, SemVerRange } from "./types.ts";
import { lessThan } from "./less_than.ts";
import { rangeMin } from "./range_min.ts";

/**
 *  Less than range comparison
 * @deprecated (will be removed after 0.217.0) Use `lessThan(version, rangeMin(range))` instead.
 */
export function ltr(
  version: SemVer,
  range: SemVerRange | Range,
): boolean {
  return lessThan(version, rangeMin(range));
}
