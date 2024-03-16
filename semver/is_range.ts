// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import type { Comparator, Range } from "./types.ts";
import { OPERATORS } from "./_constants.ts";
import { ALL, NONE } from "./constants.ts";
import { isSemVer } from "./is_semver.ts";

function isComparator(value: unknown): value is Comparator {
  if (
    value === null || value === undefined || Array.isArray(value) ||
    typeof value !== "object"
  ) return false;
  if (value === NONE || value === ALL) return true;
  const { operator, semver } = value as Comparator;
  return (
    (operator === undefined ||
      OPERATORS.includes(operator)) &&
    isSemVer(semver)
  );
}

/**
 * Does a deep check on the object to determine if its a valid range.
 *
 * Objects with extra fields are still considered valid if they have at
 * least the correct fields.
 *
 * Adds a type assertion if true.
 * @param value The value to check if its a valid Range
 * @returns True if its a valid Range otherwise false.
 */
export function isRange(value: unknown): value is Range {
  return Array.isArray(value) &&
    value.every((r) => Array.isArray(r) && r.every((c) => isComparator(c)));
}
