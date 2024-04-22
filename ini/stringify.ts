// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { IniMap, type StringifyOptions } from "./ini_map.ts";

/** Compile an object into an INI config string. Provide formatting options to modify the output. */
export function stringify(
  // deno-lint-ignore no-explicit-any
  object: any,
  options?: StringifyOptions,
): string {
  return IniMap.from(object, options).toString(options?.replacer);
}
