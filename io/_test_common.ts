// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import type { Reader } from "./types.ts";

export const MIN_READ_BUFFER_SIZE = 16;
export const bufsizes = [
  0,
  MIN_READ_BUFFER_SIZE,
  23,
  32,
  46,
  64,
  93,
  128,
  1024,
  4096,
];

export class BinaryReader implements Reader {
  index = 0;
  #bytes: Uint8Array;

  constructor(bytes = new Uint8Array(0)) {
    this.#bytes = bytes;
  }

  read(p: Uint8Array): Promise<number | null> {
    p.set(this.#bytes.subarray(this.index, p.byteLength));
    this.index += p.byteLength;
    return Promise.resolve(p.byteLength);
  }
}

// N controls how many iterations of certain checks are performed.
const N = 100;

export function init(): Uint8Array {
  const testBytes = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    testBytes[i] = "a".charCodeAt(0) + (i % 26);
  }
  return testBytes;
}
