// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible. Do not rely on good formatting of values
// for AssertionError messages in browsers.

import { red, stripColor } from "../fmt/colors.ts";
import { buildMessage, diff, diffstr } from "./_diff.ts";
import { format } from "./_format.ts";

const CAN_NOT_DISPLAY = "[Cannot display]";

export class AssertionError extends Error {
  override name = "AssertionError";
  constructor(message: string) {
    super(message);
  }
}

function isKeyedCollection(x: unknown): x is Set<unknown> {
  return [Symbol.iterator, "size"].every((k) => k in (x as Set<unknown>));
}

/**
 * Deep equality comparison used in assertions
 * @param c actual value
 * @param d expected value
 */
export function equal(c: unknown, d: unknown): boolean {
  const seen = new Map();
  return (function compare(a: unknown, b: unknown): boolean {
    // Have to render RegExp & Date for string comparison
    // unless it's mistreated as object
    if (
      a &&
      b &&
      ((a instanceof RegExp && b instanceof RegExp) ||
        (a instanceof URL && b instanceof URL))
    ) {
      return String(a) === String(b);
    }
    if (a instanceof Date && b instanceof Date) {
      const aTime = a.getTime();
      const bTime = b.getTime();
      // Check for NaN equality manually since NaN is not
      // equal to itself.
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return true;
      }
      return aTime === bTime;
    }
    if (typeof a === "number" && typeof b === "number") {
      return Number.isNaN(a) && Number.isNaN(b) || a === b;
    }
    if (Object.is(a, b)) {
      return true;
    }
    if (a && typeof a === "object" && b && typeof b === "object") {
      if (a && b && !constructorsEqual(a, b)) {
        return false;
      }
      if (a instanceof WeakMap || b instanceof WeakMap) {
        if (!(a instanceof WeakMap && b instanceof WeakMap)) return false;
        throw new TypeError("cannot compare WeakMap instances");
      }
      if (a instanceof WeakSet || b instanceof WeakSet) {
        if (!(a instanceof WeakSet && b instanceof WeakSet)) return false;
        throw new TypeError("cannot compare WeakSet instances");
      }
      if (seen.get(a) === b) {
        return true;
      }
      if (Object.keys(a || {}).length !== Object.keys(b || {}).length) {
        return false;
      }
      seen.set(a, b);
      if (isKeyedCollection(a) && isKeyedCollection(b)) {
        if (a.size !== b.size) {
          return false;
        }

        let unmatchedEntries = a.size;

        for (const [aKey, aValue] of a.entries()) {
          for (const [bKey, bValue] of b.entries()) {
            /* Given that Map keys can be references, we need
             * to ensure that they are also deeply equal */
            if (
              (aKey === aValue && bKey === bValue && compare(aKey, bKey)) ||
              (compare(aKey, bKey) && compare(aValue, bValue))
            ) {
              unmatchedEntries--;
              break;
            }
          }
        }

        return unmatchedEntries === 0;
      }
      const merged = { ...a, ...b };
      for (
        const key of [
          ...Object.getOwnPropertyNames(merged),
          ...Object.getOwnPropertySymbols(merged),
        ]
      ) {
        type Key = keyof typeof merged;
        if (!compare(a && a[key as Key], b && b[key as Key])) {
          return false;
        }
        if (((key in a) && (!(key in b))) || ((key in b) && (!(key in a)))) {
          return false;
        }
      }
      if (a instanceof WeakRef || b instanceof WeakRef) {
        if (!(a instanceof WeakRef && b instanceof WeakRef)) return false;
        return compare(a.deref(), b.deref());
      }
      return true;
    }
    return false;
  })(c, d);
}

// deno-lint-ignore ban-types
function constructorsEqual(a: object, b: object) {
  return a.constructor === b.constructor ||
    a.constructor === Object && !b.constructor ||
    !a.constructor && b.constructor === Object;
}

/** Make an assertion, error will be thrown if `expr` does not have truthy value. */
export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new AssertionError(msg);
  }
}

/** Make an assertion, error will be thrown if `expr` have truthy value. */
export function assertFalse(expr: unknown, msg = ""): asserts expr is false {
  if (expr) {
    throw new AssertionError(msg);
  }
}

/**
 * Make an assertion that `actual` and `expected` are equal, deeply. If not
 * deeply equal, then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertEquals } from "./asserts.ts";
 *
 * assertEquals<number>(1, 2)
 * ```
 */
export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (equal(actual, expected)) {
    return;
  }
  let message = "";
  const actualString = format(actual);
  const expectedString = format(expected);
  try {
    const stringDiff = (typeof actual === "string") &&
      (typeof expected === "string");
    const diffResult = stringDiff
      ? diffstr(actual as string, expected as string)
      : diff(actualString.split("\n"), expectedString.split("\n"));
    const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
    message = `Values are not equal:\n${diffMsg}`;
  } catch {
    message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
  }
  if (msg) {
    message = msg;
  }
  throw new AssertionError(message);
}

/**
 * Make an assertion that `actual` and `expected` are not equal, deeply.
 * If not then throw.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 * ```ts
 * import { assertNotEquals } from "./asserts.ts";
 *
 * assertNotEquals<number>(1, 2)
 * ```
 */
export function assertNotEquals<T>(actual: T, expected: T, msg?: string): void {
  if (!equal(actual, expected)) {
    return;
  }
  let actualString: string;
  let expectedString: string;
  try {
    actualString = String(actual);
  } catch {
    actualString = "[Cannot display]";
  }
  try {
    expectedString = String(expected);
  } catch {
    expectedString = "[Cannot display]";
  }
  if (!msg) {
    msg = `actual: ${actualString} expected not to be: ${expectedString}`;
  }
  throw new AssertionError(msg);
}

/**
 * Make an assertion that `actual` and `expected` are strictly equal. If
 * not then throw.
 *
 * ```ts
 * import { assertStrictEquals } from "./asserts.ts";
 *
 * assertStrictEquals(1, 2)
 * ```
 */
export function assertStrictEquals<T>(
  actual: unknown,
  expected: T,
  msg?: string,
): asserts actual is T {
  if (Object.is(actual, expected)) {
    return;
  }

  let message: string;

  if (msg) {
    message = msg;
  } else {
    const actualString = format(actual);
    const expectedString = format(expected);

    if (actualString === expectedString) {
      const withOffset = actualString
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      message =
        `Values have the same structure but are not reference-equal:\n\n${
          red(withOffset)
        }\n`;
    } else {
      try {
        const stringDiff = (typeof actual === "string") &&
          (typeof expected === "string");
        const diffResult = stringDiff
          ? diffstr(actual as string, expected as string)
          : diff(actualString.split("\n"), expectedString.split("\n"));
        const diffMsg = buildMessage(diffResult, { stringDiff }).join("\n");
        message = `Values are not strictly equal:\n${diffMsg}`;
      } catch {
        message = `\n${red(CAN_NOT_DISPLAY)} + \n\n`;
      }
    }
  }

  throw new AssertionError(message);
}

/**
 * Make an assertion that `actual` and `expected` are not strictly equal.
 * If the values are strictly equal then throw.
 *
 * ```ts
 * import { assertNotStrictEquals } from "./asserts.ts";
 *
 * assertNotStrictEquals(1, 1)
 * ```
 */
export function assertNotStrictEquals<T>(
  actual: T,
  expected: T,
  msg?: string,
): void {
  if (!Object.is(actual, expected)) {
    return;
  }

  throw new AssertionError(
    msg ?? `Expected "actual" to be strictly unequal to: ${format(actual)}\n`,
  );
}

/**
 * Make an assertion that `actual` and `expected` are almost equal numbers through
 * a given tolerance. It can be used to take into account IEEE-754 double-precision
 * floating-point representation limitations.
 * If the values are not almost equal then throw.
 *
 * ```ts
 * import { assertAlmostEquals, assertThrows } from "./asserts.ts";
 *
 * assertAlmostEquals(0.1, 0.2);
 *
 * // Using a custom tolerance value
 * assertAlmostEquals(0.1 + 0.2, 0.3, 1e-16);
 * assertThrows(() => assertAlmostEquals(0.1 + 0.2, 0.3, 1e-17));
 * ```
 */
export function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance = 1e-7,
  msg?: string,
) {
  if (Object.is(actual, expected)) {
    return;
  }
  const delta = Math.abs(expected - actual);
  if (delta <= tolerance) {
    return;
  }
  const f = (n: number) => Number.isInteger(n) ? n : n.toExponential();
  throw new AssertionError(
    msg ??
      `actual: "${f(actual)}" expected to be close to "${f(expected)}": \
delta "${f(delta)}" is greater than "${f(tolerance)}"`,
  );
}

// deno-lint-ignore no-explicit-any
type AnyConstructor = new (...args: any[]) => any;
type GetConstructorType<T extends AnyConstructor> = T extends // deno-lint-ignore no-explicit-any
new (...args: any) => infer C ? C
  : never;

/**
 * Make an assertion that `obj` is an instance of `type`.
 * If not then throw.
 */
export function assertInstanceOf<T extends AnyConstructor>(
  actual: unknown,
  expectedType: T,
  msg = "",
): asserts actual is GetConstructorType<T> {
  if (!msg) {
    const expectedTypeStr = expectedType.name;

    let actualTypeStr = "";
    if (actual === null) {
      actualTypeStr = "null";
    } else if (actual === undefined) {
      actualTypeStr = "undefined";
    } else if (typeof actual === "object") {
      actualTypeStr = actual.constructor?.name ?? "Object";
    } else {
      actualTypeStr = typeof actual;
    }

    if (expectedTypeStr == actualTypeStr) {
      msg = `Expected object to be an instance of "${expectedTypeStr}".`;
    } else if (actualTypeStr == "function") {
      msg =
        `Expected object to be an instance of "${expectedTypeStr}" but was not an instanced object.`;
    } else {
      msg =
        `Expected object to be an instance of "${expectedTypeStr}" but was "${actualTypeStr}".`;
    }
  }
  assert(actual instanceof expectedType, msg);
}

/**
 * Make an assertion that actual is not null or undefined.
 * If not then throw.
 */
export function assertExists<T>(
  actual: T,
  msg?: string,
): asserts actual is NonNullable<T> {
  if (actual === undefined || actual === null) {
    if (!msg) {
      msg = `actual: "${actual}" expected to not be null or undefined`;
    }
    throw new AssertionError(msg);
  }
}

/**
 * Make an assertion that actual includes expected. If not
 * then throw.
 */
export function assertStringIncludes(
  actual: string,
  expected: string,
  msg?: string,
): void {
  if (!actual.includes(expected)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to contain: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}

/**
 * Make an assertion that `actual` includes the `expected` values.
 * If not then an error will be thrown.
 *
 * Type parameter can be specified to ensure values under comparison have the same type.
 * For example:
 *
 * ```ts
 * import { assertArrayIncludes } from "./asserts.ts";
 *
 * assertArrayIncludes<number>([1, 2], [2])
 * ```
 */
export function assertArrayIncludes<T>(
  actual: ArrayLike<T>,
  expected: ArrayLike<T>,
  msg?: string,
): void {
  const missing: unknown[] = [];
  for (let i = 0; i < expected.length; i++) {
    let found = false;
    for (let j = 0; j < actual.length; j++) {
      if (equal(expected[i], actual[j])) {
        found = true;
        break;
      }
    }
    if (!found) {
      missing.push(expected[i]);
    }
  }
  if (missing.length === 0) {
    return;
  }
  if (!msg) {
    msg = `actual: "${format(actual)}" expected to include: "${
      format(expected)
    }"\nmissing: ${format(missing)}`;
  }
  throw new AssertionError(msg);
}

/**
 * Make an assertion that `actual` match RegExp `expected`. If not
 * then throw.
 */
export function assertMatch(
  actual: string,
  expected: RegExp,
  msg?: string,
): void {
  if (!expected.test(actual)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to match: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}

/**
 * Make an assertion that `actual` not match RegExp `expected`. If match
 * then throw.
 */
export function assertNotMatch(
  actual: string,
  expected: RegExp,
  msg?: string,
): void {
  if (expected.test(actual)) {
    if (!msg) {
      msg = `actual: "${actual}" expected to not match: "${expected}"`;
    }
    throw new AssertionError(msg);
  }
}

/**
 * Make an assertion that `actual` object is a subset of `expected` object, deeply.
 * If not, then throw.
 */
export function assertObjectMatch(
  // deno-lint-ignore no-explicit-any
  actual: Record<PropertyKey, any>,
  expected: Record<PropertyKey, unknown>,
): void {
  type loose = Record<PropertyKey, unknown>;

  function filter(a: loose, b: loose) {
    const seen = new WeakMap();
    return fn(a, b);

    function fn(a: loose, b: loose): loose {
      // Prevent infinite loop with circular references with same filter
      if ((seen.has(a)) && (seen.get(a) === b)) {
        return a;
      }
      seen.set(a, b);
      // Filter keys and symbols which are present in both actual and expected
      const filtered = {} as loose;
      const entries = [
        ...Object.getOwnPropertyNames(a),
        ...Object.getOwnPropertySymbols(a),
      ]
        .filter((key) => key in b)
        .map((key) => [key, a[key as string]]) as Array<[string, unknown]>;
      for (const [key, value] of entries) {
        // On array references, build a filtered array and filter nested objects inside
        if (Array.isArray(value)) {
          const subset = (b as loose)[key];
          if (Array.isArray(subset)) {
            filtered[key] = fn({ ...value }, { ...subset });
            continue;
          }
        } // On regexp references, keep value as it to avoid loosing pattern and flags
        else if (value instanceof RegExp) {
          filtered[key] = value;
          continue;
        } // On nested objects references, build a filtered object recursively
        else if (typeof value === "object") {
          const subset = (b as loose)[key];
          if ((typeof subset === "object") && (subset)) {
            // When both operands are maps, build a filtered map with common keys and filter nested objects inside
            if ((value instanceof Map) && (subset instanceof Map)) {
              filtered[key] = new Map(
                [...value].filter(([k]) => subset.has(k)).map((
                  [k, v],
                ) => [k, typeof v === "object" ? fn(v, subset.get(k)) : v]),
              );
              continue;
            }
            // When both operands are set, build a filtered set with common values
            if ((value instanceof Set) && (subset instanceof Set)) {
              filtered[key] = new Set([...value].filter((v) => subset.has(v)));
              continue;
            }
            filtered[key] = fn(value as loose, subset as loose);
            continue;
          }
        }
        filtered[key] = value;
      }
      return filtered;
    }
  }
  return assertEquals(
    // get the intersection of "actual" and "expected"
    // side effect: all the instances' constructor field is "Object" now.
    filter(actual, expected),
    // set (nested) instances' constructor field to be "Object" without changing expected value.
    // see https://github.com/denoland/deno_std/pull/1419
    filter(expected, expected),
  );
}

/**
 * Forcefully throws a failed assertion
 */
export function fail(msg?: string): never {
  assert(false, `Failed assertion${msg ? `: ${msg}` : "."}`);
}

/**
 * Make an assertion that `error` is an `Error`.
 * If not then an error will be thrown.
 * An error class and a string that should be included in the
 * error message can also be asserted.
 */
export function assertIsError<E extends Error = Error>(
  error: unknown,
  // deno-lint-ignore no-explicit-any
  ErrorClass?: new (...args: any[]) => E,
  msgIncludes?: string,
  msg?: string,
): asserts error is E {
  if (error instanceof Error === false) {
    throw new AssertionError(`Expected "error" to be an Error object.`);
  }
  if (ErrorClass && !(error instanceof ErrorClass)) {
    msg = `Expected error to be instance of "${ErrorClass.name}", but was "${
      typeof error === "object" ? error?.constructor?.name : "[not an object]"
    }"${msg ? `: ${msg}` : "."}`;
    throw new AssertionError(msg);
  }
  if (
    msgIncludes && (!(error instanceof Error) ||
      !stripColor(error.message).includes(stripColor(msgIncludes)))
  ) {
    msg = `Expected error message to include "${msgIncludes}", but got "${
      error instanceof Error ? error.message : "[not an Error]"
    }"${msg ? `: ${msg}` : "."}`;
    throw new AssertionError(msg);
  }
}

/** Executes a function, expecting it to throw. If it does not, then it
 * throws. */
export function assertThrows(
  fn: () => unknown,
  msg?: string,
): unknown;
/** Executes a function, expecting it to throw. If it does not, then it
 * throws. An error class and a string that should be included in the
 * error message can also be asserted. */
export function assertThrows<E extends Error = Error>(
  fn: () => unknown,
  // deno-lint-ignore no-explicit-any
  ErrorClass: new (...args: any[]) => E,
  msgIncludes?: string,
  msg?: string,
): E;
/** @deprecated Use assertThrows(fn, msg) instead, which now returns thrown
 * value and you can assert on it. */
export function assertThrows(
  fn: () => unknown,
  errorCallback: (e: Error) => unknown,
  msg?: string,
): Error;
export function assertThrows<E extends Error = Error>(
  fn: () => unknown,
  errorClassOrCallbackOrMsg?:
    // deno-lint-ignore no-explicit-any
    | (new (...args: any[]) => E)
    | ((e: Error) => unknown)
    | string,
  msgIncludesOrMsg?: string,
  msg?: string,
): E | Error | unknown {
  // deno-lint-ignore no-explicit-any
  let ErrorClass: (new (...args: any[]) => E) | undefined = undefined;
  let msgIncludes: string | undefined = undefined;
  let errorCallback: ((e: Error) => unknown) | undefined = undefined;
  let err;

  if (typeof errorClassOrCallbackOrMsg !== "string") {
    if (
      errorClassOrCallbackOrMsg === undefined ||
      errorClassOrCallbackOrMsg.prototype instanceof Error ||
      errorClassOrCallbackOrMsg.prototype === Error.prototype
    ) {
      // deno-lint-ignore no-explicit-any
      ErrorClass = errorClassOrCallbackOrMsg as new (...args: any[]) => E;
      msgIncludes = msgIncludesOrMsg;
    } else {
      errorCallback = errorClassOrCallbackOrMsg as (e: Error) => unknown;
      msg = msgIncludesOrMsg;
    }
  } else {
    msg = errorClassOrCallbackOrMsg;
  }
  let doesThrow = false;
  const msgToAppendToError = msg ? `: ${msg}` : ".";
  try {
    fn();
  } catch (error) {
    if (ErrorClass || errorCallback) {
      if (error instanceof Error === false) {
        throw new AssertionError("A non-Error object was thrown.");
      }
      assertIsError(
        error,
        ErrorClass,
        msgIncludes,
        msg,
      );
      if (typeof errorCallback === "function") {
        errorCallback(error);
      }
    }
    err = error;
    doesThrow = true;
  }
  if (!doesThrow) {
    msg = `Expected function to throw${msgToAppendToError}`;
    throw new AssertionError(msg);
  }
  return err;
}

/** Executes a function which returns a promise, expecting it to reject. */
export function assertRejects(
  fn: () => PromiseLike<unknown>,
  msg?: string,
): Promise<unknown>;
/** Executes a function which returns a promise, expecting it to reject.
 * If it does not, then it throws. An error class and a string that should be
 * included in the error message can also be asserted. */
export function assertRejects<E extends Error = Error>(
  fn: () => PromiseLike<unknown>,
  // deno-lint-ignore no-explicit-any
  ErrorClass: new (...args: any[]) => E,
  msgIncludes?: string,
  msg?: string,
): Promise<E>;
/** @deprecated Use assertRejects(fn, msg) instead, which now returns rejected value
 * and you can assert on it. */
export function assertRejects(
  fn: () => PromiseLike<unknown>,
  errorCallback: (e: Error) => unknown,
  msg?: string,
): Promise<Error>;
export async function assertRejects<E extends Error = Error>(
  fn: () => PromiseLike<unknown>,
  errorClassOrCallbackOrMsg?:
    // deno-lint-ignore no-explicit-any
    | (new (...args: any[]) => E)
    | ((e: Error) => unknown)
    | string,
  msgIncludesOrMsg?: string,
  msg?: string,
): Promise<E | Error | unknown> {
  // deno-lint-ignore no-explicit-any
  let ErrorClass: (new (...args: any[]) => E) | undefined = undefined;
  let msgIncludes: string | undefined = undefined;
  let errorCallback: ((e: Error) => unknown) | undefined = undefined;
  let err;

  if (typeof errorClassOrCallbackOrMsg !== "string") {
    if (
      errorClassOrCallbackOrMsg === undefined ||
      errorClassOrCallbackOrMsg.prototype instanceof Error ||
      errorClassOrCallbackOrMsg.prototype === Error.prototype
    ) {
      // deno-lint-ignore no-explicit-any
      ErrorClass = errorClassOrCallbackOrMsg as new (...args: any[]) => E;
      msgIncludes = msgIncludesOrMsg;
    } else {
      errorCallback = errorClassOrCallbackOrMsg as (e: Error) => unknown;
      msg = msgIncludesOrMsg;
    }
  } else {
    msg = errorClassOrCallbackOrMsg;
  }
  let doesThrow = false;
  let isPromiseReturned = false;
  const msgToAppendToError = msg ? `: ${msg}` : ".";
  try {
    const possiblePromise = fn();
    if (
      possiblePromise &&
      typeof possiblePromise === "object" &&
      typeof possiblePromise.then === "function"
    ) {
      isPromiseReturned = true;
      await possiblePromise;
    }
  } catch (error) {
    if (!isPromiseReturned) {
      throw new AssertionError(
        `Function throws when expected to reject${msgToAppendToError}`,
      );
    }
    if (ErrorClass || errorCallback) {
      if (error instanceof Error === false) {
        throw new AssertionError("A non-Error object was rejected.");
      }
      assertIsError(
        error,
        ErrorClass,
        msgIncludes,
        msg,
      );
      if (typeof errorCallback == "function") {
        errorCallback(error);
      }
    }
    err = error;
    doesThrow = true;
  }
  if (!doesThrow) {
    throw new AssertionError(
      `Expected function to reject${msgToAppendToError}`,
    );
  }
  return err;
}

/** Use this to stub out methods that will throw when invoked. */
export function unimplemented(msg?: string): never {
  throw new AssertionError(msg || "unimplemented");
}

/** Use this to assert unreachable code. */
export function unreachable(): never {
  throw new AssertionError("unreachable");
}
