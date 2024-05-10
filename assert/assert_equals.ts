// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { equal } from "./equal.ts";
import { buildMessage, diff, diffstr, format } from "@std/internal";
import { AssertionError } from "./assertion_error.ts";

/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the
 * same type.
 *
 * @example
 * ```ts
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * assertEquals("world", "world"); // Doesn't throw
 * assertEquals("hello", "world"); // Throws
 * ```
 *
 * Note: formatter option is experimental and may be removed in the future.
 */
export function assertEquals<T>(
  actual: T,
  expected: T,
  msg?: string,
  options: { formatter?: (value: unknown) => string } = {},
) {
  if (equal(actual, expected)) {
    return;
  }
  const { formatter = format } = options;
  const msgSuffix = msg ? `: ${msg}` : ".";
  let message = `Values are not equal${msgSuffix}`;

  const actualString = formatter(actual);
  const expectedString = formatter(expected);
  const stringDiff = (typeof actual === "string") &&
    (typeof expected === "string");
  const diffResult = stringDiff
    ? diffstr(actual as string, expected as string)
    : diff(actualString.split("\n"), expectedString.split("\n"));
  const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
  message = `${message}\n${diffMsg}`;
  throw new AssertionError(message);
}
