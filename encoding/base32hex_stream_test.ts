// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { assertEquals } from "@std/assert";
import { encodeBase32Hex } from "./base32hex.ts";
import {
  Base32HexDecoderStream,
  Base32HexEncoderStream,
} from "./base32hex_stream.ts";
import { RandomSliceStream } from "./_random_slice_stream.ts";
import { toText } from "@std/streams/to-text";
import { concat } from "@std/bytes/concat";

Deno.test("Base32EncoderStream() encodes stream", async () => {
  const stream = (await Deno.open("./deno.lock"))
    .readable
    .pipeThrough(new RandomSliceStream())
    .pipeThrough(new Base32HexEncoderStream());

  assertEquals(
    await toText(stream),
    encodeBase32Hex(await Deno.readFile("./deno.lock")),
  );
});

Deno.test("Base32DecoderStream() decodes stream", async () => {
  const stream = (await Deno.open("./deno.lock"))
    .readable
    .pipeThrough(new Base32HexEncoderStream())
    .pipeThrough(new RandomSliceStream())
    .pipeThrough(new Base32HexDecoderStream());

  assertEquals(
    concat(await Array.fromAsync(stream)),
    await Deno.readFile("./deno.lock"),
  );
});
