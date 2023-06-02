// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Order */
export type Order = "asc" | "desc";

/** Options for sortBy */
export type SortByOptions = {
  order: Order;
};

/**
 * Returns all elements in the given collection, sorted by their result using
 * the given selector. The selector function is called only once for each
 * element. Ascending or descending order can be specified.
 *
 * @example
 * ```ts
 * import { sortBy } from "https://deno.land/std@$STD_VERSION/collections/sort_by.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * const people = [
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 *   { name: "John", age: 23 },
 * ];
 * const sortedByAge = sortBy(people, (it) => it.age);
 *
 * assertEquals(sortedByAge, [
 *   { name: "John", age: 23 },
 *   { name: "Anna", age: 34 },
 *   { name: "Kim", age: 42 },
 * ]);
 *
 * const sortedByAgeDesc = sortBy(people, (it) => it.age, { order: "desc" });
 *
 * assertEquals(sortedByAgeDesc, [
 *   { name: "Kim", age: 42 },
 *   { name: "Anna", age: 34 },
 *   { name: "John", age: 23 },
 * ]);
 * ```
 */
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => number,
  options?: SortByOptions,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => string,
  options?: SortByOptions,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => bigint,
  options?: SortByOptions,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector: (el: T) => Date,
  options?: SortByOptions,
): T[];
export function sortBy<T>(
  array: readonly T[],
  selector:
    | ((el: T) => number)
    | ((el: T) => string)
    | ((el: T) => bigint)
    | ((el: T) => Date),
  options?: SortByOptions,
): T[] {
  const len = array.length;
  const indexes = new Array<number>(len);
  const selectors = new Array<ReturnType<typeof selector> | null>(len);
  const order = options?.order ?? "asc";

  const comparator = (() =>
    order === "asc"
      ? (
        a: ReturnType<typeof selector>,
        b: ReturnType<typeof selector>,
      ) => a > b ? 1 : a < b ? -1 : 0
      : (
        a: ReturnType<typeof selector>,
        b: ReturnType<typeof selector>,
      ) => a > b ? -1 : a < b ? 1 : 0)();

  for (let i = 0; i < len; i++) {
    indexes[i] = i;
    const s = selector(array[i]);
    selectors[i] = Number.isNaN(s) ? null : s;
  }

  const aIsNull = order === "asc" ? 1 : -1;
  const bIsNull = order === "asc" ? -1 : 1;

  indexes.sort((ai, bi) => {
    const a = selectors[ai];
    const b = selectors[bi];
    if (a === null) return aIsNull;
    if (b === null) return bIsNull;
    return comparator(a, b);
  });

  for (let i = 0; i < len; i++) {
    (indexes as unknown as T[])[i] = array[indexes[i]];
  }

  return indexes as unknown as T[];
}
