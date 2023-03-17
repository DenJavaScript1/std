import { assert } from "../testing/asserts.ts";
import { ALL } from "./comparator.ts";
import { INVALID, MAX, MIN } from "./semver.ts";
import {
  isSemVer,
  isSemVerComparator,
  isSemVerRange,
  isValidOperator,
} from "./validity.ts";

Deno.test({
  name: "invalid_semver",
  fn: async (t) => {
    let i = 0;
    const versions: [unknown][] = [
      [null],
      [undefined],
      [{}],
      [[]],
      [true],
      [false],
      [0],
      ["1.2.3"],
      [{ major: 0, minor: 0, patch: 0, prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: [] }],
      [{ major: 0, minor: 0, build: [], prerelease: [] }],
      [{ major: 0, patch: 0, build: [], prerelease: [] }],
      [{ minor: 0, patch: 0, build: [], prerelease: [] }],
      [{ major: "", minor: 0, patch: 0, build: [], prerelease: [] }],
      [{ major: 0, minor: "", patch: 0, build: [], prerelease: [] }],
      [{ major: 0, minor: 0, patch: "", build: [], prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: {}, prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: {} }],
      [{ major: 0, minor: 0, patch: 0, build: [{}], prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: [{}] }],
      [{ major: 0, minor: 0, patch: 0, build: [""], prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: [""] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: [-1] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: [Number.NaN] }],
    ];
    for (const [v] of versions) {
      await t.step(`invalid_${(i++).toString().padStart(2, "0")}`, () => {
        const actual = isSemVer(v);
        assert(!actual);
      });
    }
  },
});

Deno.test({
  name: "valid_semver",
  fn: async (t) => {
    let i = 0;
    const versions: [unknown][] = [
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: [] }],
      [{ extra: 1, major: 0, minor: 0, patch: 0, build: [], prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: ["abc"], prerelease: [] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: ["abc"] }],
      [{ major: 0, minor: 0, patch: 0, build: [], prerelease: ["abc", 0] }],
      [MIN],
      [MAX],
    ];
    for (const [v] of versions) {
      await t.step(`valid_${(i++).toString().padStart(2, "0")}`, () => {
        const actual = isSemVer(v);
        assert(actual);
      });
    }
  },
});

Deno.test({
  name: "valid_comparator",
  fn: async (t) => {
    let i = 0;
    const comparators: unknown[] = [
      {
        operator: ">=",
        semver: { major: 0, minor: 0, patch: 0, prerelease: [], build: [] },
        min: { major: 0, minor: 0, patch: 0, prerelease: [], build: [] },
        max: { major: 0, minor: 0, patch: 0, prerelease: [], build: [] },
      },
      {
        operator: "<",
        semver: MIN,
        min: INVALID,
        max: INVALID,
      },
    ];
    for (const c of comparators) {
      await t.step(
        `valid_comparator_${(i++).toString().padStart(2, "0")}`,
        () => {
          const actual = isSemVerComparator(c);
          assert(actual);
        },
      );
    }
  },
});

Deno.test({
  name: "valid_range",
  fn: async (t) => {
    let i = 0;
    const ranges: unknown[] = [
      {
        ranges: [
          [ALL],
        ],
      },
    ];
    for (const r of ranges) {
      await t.step(`valid_range_${(i++).toString().padStart(2, "0")}`, () => {
        const actual = isSemVerRange(r);
        assert(actual);
      });
    }
  },
});

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
        const actual = isValidOperator(op);
        assert(actual);
      });
    }
  },
});
