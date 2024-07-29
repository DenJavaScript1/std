// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { AssertionError, assertIsError, assertStrictEquals } from "./mod.ts";

Deno.test("AssertionError", () => {
  const errorCause = { bar: "baz" };
  const error = new AssertionError("foo", { cause: errorCause });
  assertIsError(error, AssertionError, "foo");
  assertStrictEquals(error.cause, errorCause);
});
