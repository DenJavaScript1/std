// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import type { CborArrayDecodedStream } from "./array_decoded_stream.ts";
import type { CborArrayEncoderStream } from "./array_encoder_stream.ts";
import type { CborByteDecodedStream } from "./byte_decoded_stream.ts";
import type { CborByteEncoderStream } from "./byte_encoder_stream.ts";
import type { CborMapDecodedStream } from "./map_decoded_stream.ts";
import type { CborMapEncoderStream } from "./map_encoder_stream.ts";
import type { CborTag } from "./tag.ts";
import type { CborTextDecodedStream } from "./text_decoded_stream.ts";
import type { CborTextEncoderStream } from "./text_encoder_stream.ts";

/**
 * This type specifies the primitive types that the implementation can
 * encode/decode into/from.
 */
export type CborPrimitiveType =
  | undefined
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | Date;

/**
 * This type specifies the encodable and decodable values for
 * {@link encodeCbor}, {@link decodeCbor}, {@link encodeCborSequence}, and
 * {@link decodeCborSequence}.
 */
export type CborType = CborPrimitiveType | CborTag<CborType> | CborType[] | {
  [k: string]: CborType;
};

/**
 * Specifies the encodable value types for the {@link CborSequenceEncoderStream}
 * and {@link CborArrayEncoderStream}.
 */
export type CborInputStream =
  | CborPrimitiveType
  | CborTag<CborInputStream>
  | CborInputStream[]
  | { [k: string]: CborInputStream }
  | CborByteEncoderStream
  | CborTextEncoderStream
  | CborArrayEncoderStream
  | CborMapEncoderStream;

/**
 * Specifies the structure of input for the {@link CborMapEncoderStream}.
 */
export type CborMapInputStream = [string, CborInputStream];

/**
 * Specifies the decodable value types for the {@link CborSequenceDecoderStream}
 * and {@link CborMapDecodedStream}.
 */
export type CborOutputStream =
  | CborPrimitiveType
  | CborTag<CborOutputStream>
  | CborByteDecodedStream
  | CborTextDecodedStream
  | CborArrayDecodedStream
  | CborMapDecodedStream;

/**
 * Specifies the structure of the output for the {@link CborMapDecodedStream}.
 */
export type CborMapOutputStream = [string, CborOutputStream];
