// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * Functions for console-related tasks such as TTY text layout.
 *
 * ## Unicode width
 *
 * {@linkcode unicodeWidth} calculates the physical width of a string in a
 * TTY-like environment.
 *
 * ```ts
 * import { unicodeWidth } from "https://deno.land/std@$STD_VERSION/console/unicode_width.ts";
 *
 * unicodeWidth("天地玄黃宇宙洪荒"); // 16
 * ```
 *
 * @deprecated Use {@link https://jsr.io/@std/cli | std/cli} instead. This
 * module will be removed once the Standard Library migrates to
 * {@link https://jsr.io/ | JSR}.
 *
 * @module
 */

export * from "./unicode_width.ts";
