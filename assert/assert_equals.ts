// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { equal } from "./equal.ts";
import { buildMessage, diff, diffStr, format } from "@std/internal";
import { AssertionError } from "./assertion_error.ts";

/** The option object for {@linkcode assertEquals}. */
export type AssertEqualsOption = {
  /** The option for formatting the values.
   *
   * Note: This option is experimental and may be removed in the future.
   */
  formatter?: (value: unknown) => string;
};

/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the
 * same type.
 *
 * @example Usage
 * ```ts no-eval
 * import { assertEquals } from "@std/assert/assert-equals";
 *
 * assertEquals("world", "world"); // Doesn't throw
 * assertEquals("hello", "world"); // Throws
 * ```
 *
 * Note: formatter option is experimental and may be removed in the future.
 *
 * @typeParam T The type of the values to compare. This is usually inferred.
 * @param actual The actual value to compare.
 * @param expected The expected value to compare.
 * @param msg The optional message to display if the assertion fails.
 * @param options The optional object for the assertion.
 */
export function assertEquals<T>(
  actual: T,
  expected: T,
  msg?: string,
  options: AssertEqualsOption = {},
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
    ? diffStr(actual as string, expected as string)
    : diff(actualString.split("\n"), expectedString.split("\n"));
  const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
  message = `${message}\n${diffMsg}`;
  throw new AssertionError(message);
}
