// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Helper functions for working with
 * {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array | Uint8Array}
 * byte slices.
 *
 * ```ts
 * import { concat, equals, endsWith } from "@std/bytes";
 *
 * const a = new Uint8Array([0, 1, 2]);
 * const b = new Uint8Array([3, 4, 5]);
 *
 * const c = concat([a, b]); // Uint8Array(6) [ 0, 1, 2, 3, 4, 5 ]
 *
 * equals(c, new Uint8Array([0, 1, 2, 3, 4, 5])); // true
 *
 * endsWith(c, b); // true
 * ```
 */
export * from "./concat.ts";
export * from "./copy.ts";
export * from "./ends_with.ts";
export * from "./equals.ts";
export * from "./includes_needle.ts";
export * from "./index_of_needle.ts";
export * from "./last_index_of_needle.ts";
export * from "./repeat.ts";
export * from "./starts_with.ts";
