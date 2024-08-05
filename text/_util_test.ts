// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { assertEquals } from "@std/assert";
import { splitToWords } from "./_util.ts";

Deno.test({
  name: "split() returns an empty array for an empty string",
  fn() {
    const result = splitToWords("");
    assertEquals(result.length, 0);
  },
});

Deno.test({
  name:
    "split() returns an empty array when input has no alphanumeric characters",
  fn() {
    const result = splitToWords("🦕♥️ 🦕♥️ 🦕♥️");
    assertEquals(result.length, 0);
  },
});

Deno.test({
  name: "split() ignores non-alphanumeric characters mixed with words",
  fn() {
    const result = splitToWords("🦕deno♥️wuv");
    const expected = ["deno", "wuv"];

    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles whitespace",
  fn() {
    const result = splitToWords("deno Is AWESOME");
    const expected = ["deno", "Is", "AWESOME"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles whitespace at string end and start",
  fn() {
    const result = splitToWords("  deno Is AWESOME ");
    const expected = ["deno", "Is", "AWESOME"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles mixed delimiters",
  fn() {
    const result = splitToWords("I am up-to-date!");
    const expected = ["I", "am", "up", "to", "date"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles a delimiter sequence",
  fn() {
    const result = splitToWords("I am   -> thirsty!");
    const expected = ["I", "am", "thirsty"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles upper case delimiter",
  fn() {
    const result = splitToWords("denoIsAwesome");
    const expected = ["deno", "Is", "Awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles hyphen delimiter",
  fn() {
    const result = splitToWords("deno-is-awesome");
    const expected = ["deno", "is", "awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles casing",
  fn() {
    const result = splitToWords("denoIsAwesome");
    const expected = ["deno", "Is", "Awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles unicode",
  fn() {
    const result = splitToWords("шруберри IsAwesome");
    const expected = ["шруберри", "Is", "Awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles unicode casing",
  fn() {
    const result = splitToWords("шруберриШруберри");
    const expected = ["шруберри", "Шруберри"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles languages without casing",
  fn() {
    const result = splitToWords("אין_על דינו");
    const expected = ["אין", "על", "דינו"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles screaming snake case",
  fn() {
    const result = splitToWords("DENO_IS_AWESOME");
    const expected = ["DENO", "IS", "AWESOME"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles acronym followed by a capitalized word",
  fn() {
    const result = splitToWords("I Love HTMLDivElement");
    const expected = ["I", "Love", "HTML", "Div", "Element"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles underscore delimiter",
  fn() {
    const result = splitToWords("deno_is_awesome");
    const expected = ["deno", "is", "awesome"];
    assertEquals(result, expected);
  },
});

Deno.test({
  name: "split() handles acronym followed by a capitalized word",
  fn() {
    const result = splitToWords("I Love HTMLDivElement");
    const expected = ["I", "Love", "HTML", "Div", "Element"];
    assertEquals(result, expected);
  },
});
