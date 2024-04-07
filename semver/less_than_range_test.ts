// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright Isaac Z. Schlueter and npm contributors. All rights reserved. ISC license.

import { assert, assertFalse } from "../assert/mod.ts";
import {
  format,
  formatRange,
  lessThanRange,
  parse,
  parseRange,
} from "./mod.ts";

Deno.test("lessThanRange() checks if the semver is less than the range", async (t) => {
  // From https://github.com/npm/node-semver/blob/692451bd6f75b38a71a99f39da405c94a5954a22/test/fixtures/version-lt-range.js
  const versionLtRange = [
    ["~1.2.2", "1.2.1"],
    ["~0.6.1-1", "0.6.1-0"],
    ["1.0.0 - 2.0.0", "0.0.1"],
    ["1.0.0-beta.2", "1.0.0-beta.1"],
    ["1.0.0", "0.0.0"],
    [">=2.0.0", "1.1.1"],
    [">=2.0.0", "1.2.9"],
    [">2.0.0", "2.0.0"],
    ["0.1.20 || 1.2.4", "0.1.5"],
    ["2.x.x", "1.0.0"],
    ["1.2.x", "1.1.0"],
    ["1.2.x || 2.x", "1.0.0"],
    ["2.*.*", "1.0.1"],
    ["1.2.*", "1.1.3"],
    ["1.2.* || 2.*", "1.1.9999"],
    ["2", "1.0.0"],
    ["2.3", "2.2.2"],
    ["~2.4", "2.3.0"], // >=2.4.0 <2.5.0
    ["~2.4", "2.3.5"],
    ["~>3.2.1", "3.2.0"], // >=3.2.1 <3.3.0
    ["~1", "0.2.3"], // >=1.0.0 <2.0.0
    ["~>1", "0.2.4"],
    ["~> 1", "0.2.3"],
    ["~1.0", "0.1.2"], // >=1.0.0 <1.1.0
    // ["~ 1.0", "0.1.0"], TODO(kt3k): Enable this. The parsing of `~ 1.0` seems broken now.
    [">1.2", "1.2.0"],
    ["> 1.2", "1.2.1"],
    ["~v0.5.4-pre", "0.5.4-alpha"],
    ["=0.7.x", "0.6.0"],
    ["=0.7.x", "0.6.0-asdf"],
    [">=0.7.x", "0.6.0"],
    ["1.0.0 - 2.0.0", "0.2.3"],
    ["1.0.0", "0.0.1"],
    [">=2.0.0", "1.0.0"],
    [">=2.0.0", "1.9999.9999"],
    [">2.0.0", "1.2.9"],
    ["2.x.x", "1.1.3"],
    ["1.2.x", "1.1.3"],
    ["1.2.x || 2.x", "1.1.3"],
    ["2.*.*", "1.1.3"],
    ["1.2.* || 2.*", "1.1.3"],
    ["2", "1.9999.9999"],
    ["2.3", "2.2.1"],
    ["~>3.2.1", "2.3.2"], // >=3.2.1 <3.3.0
    ["~>1", "0.2.3"],
    ["~1.0", "0.0.0"], // >=1.0.0 <1.1.0
    [">1", "1.0.0"],
    ["=0.7.x", "0.6.2"],
    ["=0.7.x", "0.7.0-asdf"],
    ["^1", "1.0.0-0"],
    [">=0.7.x", "0.7.0-asdf"],
    [">=0.7.x", "0.6.2"],
    [">1.2.3", "1.3.0-alpha"],
  ] as const;

  for (const [range, version] of versionLtRange) {
    const v = parse(version);
    const r = parseRange(range);
    const testName = `${format(v)} should be less than ${formatRange(r)}`;
    await t.step(testName, () => {
      assert(lessThanRange(v, r), testName);
    });
  }

  // From https://github.com/npm/node-semver/blob/692451bd6f75b38a71a99f39da405c94a5954a22/test/fixtures/version-not-lt-range.js
  const versionNotLtRange = [
    ["~ 1.0", "1.1.0"],
    ["~0.6.1-1", "0.6.1-1"],
    ["1.0.0 - 2.0.0", "1.2.3"],
    ["1.0.0 - 2.0.0", "2.9.9"],
    ["1.0.0", "1.0.0"],
    [">=*", "0.2.4"],
    ["", "1.0.0", true],
    ["*", "1.2.3"],
    [">=1.0.0", "1.0.0"],
    [">=1.0.0", "1.0.1"],
    [">=1.0.0", "1.1.0"],
    [">1.0.0", "1.0.1"],
    [">1.0.0", "1.1.0"],
    ["<=2.0.0", "2.0.0"],
    ["<=2.0.0", "1.9999.9999"],
    ["<=2.0.0", "0.2.9"],
    ["<2.0.0", "1.9999.9999"],
    ["<2.0.0", "0.2.9"],
    [">= 1.0.0", "1.0.0"],
    [">=  1.0.0", "1.0.1"],
    [">=   1.0.0", "1.1.0"],
    ["> 1.0.0", "1.0.1"],
    [">  1.0.0", "1.1.0"],
    ["<=   2.0.0", "2.0.0"],
    ["<= 2.0.0", "1.9999.9999"],
    ["<=  2.0.0", "0.2.9"],
    ["<    2.0.0", "1.9999.9999"],
    ["<\t2.0.0", "0.2.9"],
    [">=0.1.97", "v0.1.97"],
    [">=0.1.97", "0.1.97"],
    ["0.1.20 || 1.2.4", "1.2.4"],
    ["0.1.20 || >1.2.4", "1.2.4"],
    ["0.1.20 || 1.2.4", "1.2.3"],
    ["0.1.20 || 1.2.4", "0.1.20"],
    [">=0.2.3 || <0.0.1", "0.0.0"],
    [">=0.2.3 || <0.0.1", "0.2.3"],
    [">=0.2.3 || <0.0.1", "0.2.4"],
    ["||", "1.3.4"],
    ["2.x.x", "2.1.3"],
    ["1.2.x", "1.2.3"],
    ["1.2.x || 2.x", "2.1.3"],
    ["1.2.x || 2.x", "1.2.3"],
    ["x", "1.2.3"],
    ["2.*.*", "2.1.3"],
    ["1.2.*", "1.2.3"],
    ["1.2.* || 2.*", "2.1.3"],
    ["1.2.* || 2.*", "1.2.3"],
    ["2", "2.1.2"],
    ["2.3", "2.3.1"],
    ["~2.4", "2.4.0"], // >=2.4.0 <2.5.0
    ["~2.4", "2.4.5"],
    ["~>3.2.1", "3.2.2"], // >=3.2.1 <3.3.0
    ["~1", "1.2.3"], // >=1.0.0 <2.0.0
    ["~>1", "1.2.3"],
    ["~> 1", "1.2.3"],
    ["~1.0", "1.0.2"], // >=1.0.0 <1.1.0
    ["~ 1.0", "1.0.2"],
    [">=1", "1.0.0"],
    [">= 1", "1.0.0"],
    ["<1.2", "1.1.1"],
    ["< 1.2", "1.1.1"],
    ["~v0.5.4-pre", "0.5.5"],
    ["~v0.5.4-pre", "0.5.4"],
    ["=0.7.x", "0.7.2"],
    [">=0.7.x", "0.7.2"],
    ["<=0.7.x", "0.6.2"],
    [">0.2.3 >0.2.4 <=0.2.5", "0.2.5"],
    [">=0.2.3 <=0.2.4", "0.2.4"],
    ["1.0.0 - 2.0.0", "2.0.0"],
    ["^3.0.0", "4.0.0"],
    ["^1.0.0 || ~2.0.1", "2.0.0"],
    ["^0.1.0 || ~3.0.1 || 5.0.0", "3.2.0"],
    ["^0.1.0 || ~3.0.1 || 5.0.0", "5.0.0-0"],
    ["^0.1.0 || ~3.0.1 || >4 <=5.0.0", "3.5.0"],
    ["^1.0.0-alpha", "1.0.0-beta"],
    ["~1.0.0-alpha", "1.0.0-beta"],
    ["=0.1.0", "1.0.0"],
    // Note: maybe worth considering adding support for `includePrerelease` option
    // [">1.2.3", "1.3.0-alpha", { includePrerelease: true }],
  ] as const;

  for (const [range, version] of versionNotLtRange) {
    const v = parse(version);
    const r = parseRange(range);
    const testName = `${format(v)} should not be less than ${formatRange(r)}`;
    await t.step(testName, () => {
      assertFalse(lessThanRange(v, r), testName);
    });
  }
});
