// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
import { assert } from "../assert/mod.ts";
import { isOperator } from "./is_operator.ts";

Deno.test({
  name: "valid_operators",
  fn: async (t) => {
    const operators: unknown[] = [
      "",
      "=",
      "==",
      "===",
      "!=",
      "!==",
      ">",
      ">=",
      "<",
      "<=",
    ];
    for (const op of operators) {
      await t.step(`valid operator ${op}`, () => {
        const actual = isOperator(op);
        assert(actual);
      });
    }
  },
});
