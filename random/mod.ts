// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/**
 * Utilities for generating random numbers.
 *
 * ```ts
 * import { randomIntegerBetween } from "@std/random";
 * import { SeededRandom } from "@std/random";
 * import { assertEquals } from "@std/assert";
 *
 * const r = new SeededRandom(new Uint8Array([
 *  0xa6, 0x25, 0xd9, 0xbf, 0xc9, 0x1e, 0xfb, 0x5c,
 *  0xba, 0x4a, 0x86, 0x3c, 0xa4, 0xda, 0x89, 0x72,
 * ]));
 *
 * assertEquals(randomIntegerBetween(1, 10, { prng: r.random }), 5);
 * ```
 *
 * @module
 */

export * from "./between.ts";
export * from "./integer_between.ts";
export * from "./sample.ts";
export * from "./seeded_random.ts";
export * from "./shuffle.ts";
export type * from "./_types.ts";
