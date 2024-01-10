// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import {
  assertArrayIncludes,
  assertEquals,
  assertNotEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "./mod.ts";

Deno.test({
  name: "assert* functions with specified type parameter",
  fn() {
    assertEquals<string>("hello", "hello");
    assertNotEquals<number, number>(1, 2);
    assertArrayIncludes<boolean>([true, false], [true]);
    const value = { x: 1 };
    assertStrictEquals<typeof value>(value, value);
    assertNotStrictEquals<object, object>(value, { x: 1 });
  },
});
