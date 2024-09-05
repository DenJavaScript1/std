// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { assertEquals, assertThrows } from "@std/assert";
import { slidingWindows } from "./sliding_windows.ts";

function slidingWindowsTest<T>(
  input: [
    collection: T[],
    size: number,
    config?: { step?: number; partial?: boolean },
  ],
  expected: T[][],
  message?: string,
) {
  const actual = slidingWindows(...input);
  assertEquals(actual, expected, message);
}

function slidingWindowsThrowsTest<T>(
  input: [
    collection: T[],
    size: number,
    config?: { step?: number; partial?: boolean },
  ],
  ErrorClass: ErrorConstructor,
  msgIncludes?: string,
  msg?: string | undefined,
) {
  assertThrows(
    () => {
      slidingWindows(...input);
    },
    ErrorClass,
    msgIncludes,
    msg,
  );
}

Deno.test({
  name: "slidingWindows() handles no mutation",
  fn() {
    const numbers = [1, 2, 3, 4, 5];
    slidingWindows(numbers, 3);
    assertEquals(numbers, [1, 2, 3, 4, 5]);
  },
});

Deno.test({
  name: "slidingWindows() handles empty input",
  fn() {
    slidingWindowsTest([[], 3], []);
    slidingWindowsTest([[], 3, {}], []);
    slidingWindowsTest([[], 3, { step: 2 }], []);
    slidingWindowsTest([[], 3, { partial: true }], []);
    slidingWindowsTest([[], 3, { step: 2, partial: true }], []);
  },
});

Deno.test({
  name: "slidingWindows() handles default option",
  fn() {
    slidingWindowsTest([[1, 2, 3, 4, 5], 5], [
      [1, 2, 3, 4, 5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 3], [
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 1], [
      [1],
      [2],
      [3],
      [4],
      [5],
    ]);
  },
});

Deno.test({
  name: "slidingWindows() handles step option",
  fn() {
    slidingWindowsTest([[1, 2, 3, 4, 5], 5, { step: 2 }], [
      [1, 2, 3, 4, 5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 3, { step: 2 }], [
      [1, 2, 3],
      [3, 4, 5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 1, { step: 2 }], [
      [1],
      [3],
      [5],
    ]);
  },
});

Deno.test({
  name: "slidingWindows() handles partial option",
  fn() {
    slidingWindowsTest([[1, 2, 3, 4, 5], 5, { partial: true }], [
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5],
      [3, 4, 5],
      [4, 5],
      [5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 3, { partial: true }], [
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
      [4, 5],
      [5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 1, { partial: true }], [
      [1],
      [2],
      [3],
      [4],
      [5],
    ]);
  },
});

Deno.test({
  name: "slidingWindows() handles step and partial option",
  fn() {
    slidingWindowsTest([[1, 2, 3, 4, 5], 5, { step: 2, partial: true }], [
      [1, 2, 3, 4, 5],
      [3, 4, 5],
      [5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 3, { step: 2, partial: true }], [
      [1, 2, 3],
      [3, 4, 5],
      [5],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 1, { step: 2, partial: true }], [
      [1],
      [3],
      [5],
    ]);
  },
});

Deno.test({
  name: "slidingWindows() handles invalid size or step: other than number",
  fn() {
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], NaN],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: NaN }],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      // @ts-ignore: for test
      [[1, 2, 3, 4, 5], "invalid"],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      // @ts-ignore: for test
      [[1, 2, 3, 4, 5], 3, { step: "invalid" }],
      RangeError,
      "Both size and step must be positive integer.",
    );
  },
});

Deno.test({
  name: "slidingWindows() handles invalid size or step: not integer number",
  fn() {
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 0.5],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: 0.5 }],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 1.5],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: 1.5 }],
      RangeError,
      "Both size and step must be positive integer.",
    );
  },
});

Deno.test({
  name: "slidingWindows() handles invalid size or step: not positive number",
  fn() {
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 0],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: 0 }],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], -1],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: -1 }],
      RangeError,
      "Both size and step must be positive integer.",
    );
  },
});

Deno.test({
  name: "slidingWindows() handles invalid size or step: infinity",
  fn() {
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], Number.NEGATIVE_INFINITY],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: Number.NEGATIVE_INFINITY }],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], Number.POSITIVE_INFINITY],
      RangeError,
      "Both size and step must be positive integer.",
    );
    slidingWindowsThrowsTest(
      [[1, 2, 3, 4, 5], 3, { step: Number.POSITIVE_INFINITY }],
      RangeError,
      "Both size and step must be positive integer.",
    );
  },
});

Deno.test({
  name: "slidingWindows() handles large size",
  fn() {
    slidingWindowsTest([[1, 2, 3, 4, 5], 100], []);
    slidingWindowsTest([[1, 2, 3, 4, 5], 100, { step: 2 }], []);
    slidingWindowsTest([[1, 2, 3, 4, 5], 100, { step: 2, partial: true }], [
      [1, 2, 3, 4, 5],
      [3, 4, 5],
      [5],
    ]);
  },
});

Deno.test({
  name: "slidingWindows() handles large step",
  fn() {
    slidingWindowsTest([[1, 2, 3, 4, 5], 3, { step: 100 }], [
      [1, 2, 3],
    ]);
    slidingWindowsTest([[1, 2, 3, 4, 5], 3, { step: 100, partial: true }], [
      [1, 2, 3],
    ]);
  },
});

Deno.test({
  name: "slidingWindows() handles empty Array",
  fn() {
    slidingWindowsTest([Array(5), 5], [
      Array(5),
    ]);
    slidingWindowsTest([Array(5), 3], [
      Array(3),
      Array(3),
      Array(3),
    ]);
    slidingWindowsTest([Array(5), 1], [
      Array(1),
      Array(1),
      Array(1),
      Array(1),
      Array(1),
    ]);
  },
});

Deno.test("slidingWindows() handles a generator", () => {
  function* gen() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
  }
  const result = slidingWindows(gen(), 3);
  assertEquals(result, [
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5],
  ]);
});

Deno.test("slidingWindows() handles a generator with step", () => {
  function* gen() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
  }
  const result = slidingWindows(gen(), 5, { step: 2 });
  assertEquals(result, [
    [1, 2, 3, 4, 5],
  ]);
});

Deno.test("slidingWindows() handles a generator with partial", () => {
  function* gen() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
  }
  const result = slidingWindows(gen(), 3, { partial: true });
  assertEquals(result, [
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5],
    [4, 5],
    [5],
  ]);
});

Deno.test("slidingWindows() handles a Set", () => {
  const set = new Set([1, 2, 3, 4, 5]);
  const result = slidingWindows(set, 3);
  assertEquals(result, [
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5],
  ]);
});

Deno.test("slidingWindows() handles a Map", () => {
  const map = new Map([
    ["a", 1],
    ["b", 2],
    ["c", 3],
    ["d", 4],
    ["e", 5],
  ]);
  const result = slidingWindows(map, 3);
  assertEquals(result, [
    [["a", 1], ["b", 2], ["c", 3]],
    [["b", 2], ["c", 3], ["d", 4]],
    [["c", 3], ["d", 4], ["e", 5]],
  ]);
});

Deno.test("slidingWindows() handles a string", () => {
  const result = slidingWindows("abcde", 3);
  assertEquals(result, [
    ["a", "b", "c"],
    ["b", "c", "d"],
    ["c", "d", "e"],
  ]);
});

Deno.test("slidingWindows() respects handles maxWindows with an infinite iterable", () => {
  function* gen() {
    let i = 0;
    while (true) {
      yield i++;
    }
  }
  const result = slidingWindows(gen(), 3, { maxWindows: 3 });
  assertEquals(result, [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
  ]);
});
