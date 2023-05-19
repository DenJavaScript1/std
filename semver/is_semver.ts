// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
import { ANY, INVALID } from "./constants.ts";
import type { SemVer } from "./types.ts";
import { isValidNumber } from "./is_valid_number.ts";
import { isValidString } from "./is_valid_string.ts";

export const MAX_LENGTH = 256;

/**
 * Checks to see if value is a valid SemVer object. It does a check
 * into each field including prerelease and build.
 *
 * Some invalid SemVer sentinals can still return true such as ANY and INVALID.
 * An object which has the same value as a sentinal but isn't reference equal
 * will still fail.
 *
 * Objects which are valid SemVer objects but have _extra_ fields are still
 * considered SemVer objects and this will return true.
 *
 * A type assertion is added to the value.
 * @param value The value to check to see if its a valid SemVer object
 * @returns True if value is a valid SemVer otherwise false
 */
export function isSemVer(value: unknown): value is SemVer {
  if (value == null) return false;
  if (Array.isArray(value)) return false;
  if (typeof value !== "object") return false;
  if (value === INVALID) return true;
  if (value === ANY) return true;

  const { major, minor, patch, build, prerelease } = value as Record<
    string,
    unknown
  >;
  const result = typeof major === "number" && isValidNumber(major) &&
    typeof minor === "number" && isValidNumber(minor) &&
    typeof patch === "number" && isValidNumber(patch) &&
    Array.isArray(prerelease) &&
    Array.isArray(build) &&
    prerelease.every((v) => typeof v === "string" || typeof v === "number") &&
    prerelease.filter((v) => typeof v === "string").every((v) =>
      isValidString(v)
    ) &&
    prerelease.filter((v) => typeof v === "number").every((v) =>
      isValidNumber(v)
    ) &&
    build.every((v) => typeof v === "string" && isValidString(v));
  return result;
}
