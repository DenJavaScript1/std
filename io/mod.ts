// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

/**
 * Utilities for working with Deno's readers, writers, and web streams.
 *
 * `Reader` and `Writer` interfaces are deprecated in Deno, and so many of these
 * utilities are also deprecated. Consider using web streams instead.
 *
 * ```ts ignore
 * import { toReadableStream, toWritableStream } from "@std/io";
 *
 * await toReadableStream(Deno.stdin)
 *   .pipeTo(toWritableStream(Deno.stdout));
 * ```
 *
 * @module
 */

export * from "./buf_reader.ts";
export * from "./buf_writer.ts";
export * from "./buffer.ts";
export * from "./copy.ts";
export * from "./iterate_reader.ts";
export * from "./limited_reader.ts";
export * from "./multi_reader.ts";
export * from "./read_all.ts";
export * from "./reader_from_stream_reader.ts";
export * from "./string_reader.ts";
export * from "./string_writer.ts";
export * from "./to_readable_stream.ts";
export * from "./to_writable_stream.ts";
export * from "./types.ts";
export * from "./write_all.ts";
