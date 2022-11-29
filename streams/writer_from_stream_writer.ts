// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** Create a `Writer` from a `WritableStreamDefaultWriter`.
 *
 * @example
 * ```ts
 * import { copy } from "https://deno.land/std@$STD_VERSION/streams/copy.ts";
 * import { writerFromStreamWriter } from "https://deno.land/std@$STD_VERSION/streams/writer_from_stream_writer.ts";
 *
 * const file = await Deno.open("./deno.land.html", { read: true });
 *
 * const writableStream = new WritableStream({
 *   write(chunk): void {
 *     console.log(chunk);
 *   },
 * });
 * const writer = writerFromStreamWriter(writableStream.getWriter());
 * await copy(file, writer);
 * file.close();
 * ```
 */
export function writerFromStreamWriter(
  streamWriter: WritableStreamDefaultWriter<Uint8Array>,
): Deno.Writer {
  return {
    async write(p: Uint8Array): Promise<number> {
      await streamWriter.ready;
      await streamWriter.write(p);
      return p.length;
    },
  };
}
