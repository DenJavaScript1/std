// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import { assert, assertEquals } from "../testing/asserts.ts";
import { sample } from "./sample.ts";

Deno.test({
  name: "no mutation",
  fn() {
    const array = ["a", "abc", "ba"];
    sample(array);

    assertEquals(array, ["a", "abc", "ba"]);
  },
});

Deno.test({
  name: "empty input",
  fn() {
    const actual = sample([]);
    assertEquals(actual, undefined);
  },
});

Deno.test({
  name: "array of number",
  fn() {
    const input = [1, 2, 3];
    const actual = sample([1, 2, 3]);

    assert(actual && input.includes(actual));
  },
});

Deno.test({
  name: "array of objects",
  fn() {
    const input = [
      {
        name: "Anna",
        age: 18,
      },
      {
        name: "Kim",
        age: 24,
      },
    ];
    const actual = sample(input);

    assert(actual && input.includes(actual));
  },
});
