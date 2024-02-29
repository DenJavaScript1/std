// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { assert } from "../assert/mod.ts";
import { ALL, MIN } from "./constants.ts";
import { formatRange } from "./format_range.ts";
import { isRange } from "./is_range.ts";
import { Range } from "./types.ts";

Deno.test({
  name: "isRange()",
  fn: async (t) => {
    const ranges: Range[] = [[
      [ALL],
      [{
        operator: ">=",
        major: 0,
        minor: 0,
        patch: 0,
        prerelease: [],
        build: [],
        semver: { major: 0, minor: 0, patch: 0, prerelease: [], build: [] },
      }],
      [{
        operator: "<",
        semver: MIN,
        ...MIN,
      }],
      [{
        operator: ">=",
        major: 0,
        minor: 0,
        patch: 0,
        prerelease: [],
        build: [],
      }],
      [{ operator: "<", ...MIN }],
    ]];
    for (const r of ranges) {
      await t.step(`${formatRange(r)}`, () => {
        const actual = isRange(r);
        assert(actual);
      });
    }
  },
});
