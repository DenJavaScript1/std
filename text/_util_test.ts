// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { assertEquals } from "../assert/assert_equals.ts";
import { split } from "./_util.ts";

Deno.test({
  name: "split() handles whitespace",
  fn() {
    const result = split("deno Is AWESOME");
    const expected = ["deno", "Is", "AWESOME"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles singleDelimiter option",
  fn() {
    const result = split("I am up-to-date!", { singleDelimiter: false });
    const expected = ["I", "am", "up", "to", "date!"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles removeSpecialCharacters option",
  fn() {
    const result = split("I am up-to-date!", { removeSpecialCharacters: true });
    const expected = ["I", "am", "up", "to", "date"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles singleDelimiter and removeSpecialCharacters option",
  fn() {
    const result = split("I am up-to-date!", {
      singleDelimiter: true,
      removeSpecialCharacters: true,
    });
    const expected = ["I", "am", "up-to-date"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles upper case delimiter",
  fn() {
    const result = split("denoIsAwesome");
    const expected = ["deno", "Is", "Awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles hyphen delimiter",
  fn() {
    const result = split("deno-is-awesome");
    const expected = ["deno", "is", "awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles screaming snake case",
  fn() {
    const result = split("DENO_IS_AWESOME");
    const expected = ["DENO", "IS", "AWESOME"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles underscore delimiter",
  fn() {
    const result = split("deno_is_awesome");
    const expected = ["deno", "is", "awesome"];
    assertEquals(result, expected);
  },
});
