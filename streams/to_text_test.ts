// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { assertEquals } from "@std/assert/assert-equals";
import { toText } from "./to_text.ts";

Deno.test("toText()", async () => {
  const byteStream = ReadableStream.from(["hello", " js ", "fans"])
    .pipeThrough(new TextEncoderStream());

  assertEquals(await toText(byteStream), "hello js fans");

  const stringStream = ReadableStream.from(["hello", " deno ", "world"]);

  assertEquals(await toText(stringStream), "hello deno world");
});
