// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

const hexTable: string[] = [];

for (let i = 0; i < 256; ++i) {
  hexTable.push(i < 0x10 ? "0" + i.toString(16) : i.toString(16));
}

/**
 * Converts the byte array to a UUID string
 * @param bytes Used to convert Byte to Hex
 */
export function bytesToUuid(bytes: number[] | Uint8Array): string {
  return (
    hexTable[bytes[0]!]! +
    hexTable[bytes[1]!]! +
    hexTable[bytes[2]!]! +
    hexTable[bytes[3]!]! +
    "-" +
    hexTable[bytes[4]!]! +
    hexTable[bytes[5]!]! +
    "-" +
    hexTable[bytes[6]!]! +
    hexTable[bytes[7]!]! +
    "-" +
    hexTable[bytes[8]!]! +
    hexTable[bytes[9]!]! +
    "-" +
    hexTable[bytes[10]!]! +
    hexTable[bytes[11]!]! +
    hexTable[bytes[12]!]! +
    hexTable[bytes[13]!]! +
    hexTable[bytes[14]!]! +
    hexTable[bytes[15]!]!
    // Use .toLowerCase() to avoid the v8 engine memory issue
    // when concatenating strings with "+" operator. See:
    // - https://issues.chromium.org/issues/42206473
    // - https://github.com/uuidjs/uuid/pull/434
  ).toLowerCase();
}

/**
 * Converts a string to a byte array by converting the hex value to a number.
 * @param uuid Value that gets converted.
 */
export function uuidToBytes(uuid: string): Uint8Array {
  const bytes = uuid
    .replaceAll("-", "")
    .match(/.{1,2}/g)!
    .map((byte) => parseInt(byte, 16));
  return new Uint8Array(bytes);
}
