// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import type { Writer } from "../io/types.ts";
import { toWritableStream } from "../io/to_writable_stream.ts";

/**
 * Options for {@linkcode writableStreamFromWriter}.
 *
 * @deprecated (will be removed in 0.215.0) Use
 * {@linkcode https://deno.land/std/io/to_writable_stream.ts | toWritableStream}
 * instead.
 */
export interface WritableStreamFromWriterOptions {
  /**
   * If the `writer` is also a `Closer`, automatically close the `writer`
   * when the stream is closed, aborted, or a write error occurs.
   *
   * @default {true}
   */
  autoClose?: boolean;
}

/**
 * Create a {@linkcode WritableStream} from a {@linkcode Writer}.
 *
 * @deprecated (will be removed in 0.215.0) Use
 * {@linkcode https://deno.land/std/io/to_writable_stream.ts | toWritableStream}
 * instead.
 */
export function writableStreamFromWriter(
  writer: Writer,
  options: WritableStreamFromWriterOptions = {},
): WritableStream<Uint8Array> {
  return toWritableStream(writer, options);
}
