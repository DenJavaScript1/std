// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** {@linkcode parse} function for parsing
 * [JSONC](https://code.visualstudio.com/docs/languages/json#_json-with-comments)
 * (JSON with Comments) strings.
 *
 * This module is browser compatible.
 *
 * @module
 */

import { assert } from "../assert/assert.ts";

import type { JsonValue } from "../json/common.ts";
export type { JsonValue } from "../json/common.ts";

export interface ParseOptions {
  /** Allow trailing commas at the end of arrays and objects.
   *
   * @default {true}
   */
  allowTrailingComma?: boolean;
}

/**
 * Converts a JSON with Comments (JSONC) string into an object.
 * If a syntax error is found, throw a SyntaxError.
 *
 * @example
 *
 * ```ts
 * import * as JSONC from "https://deno.land/std@$STD_VERSION/jsonc/mod.ts";
 *
 * console.log(JSONC.parse('{"foo": "bar", } // comment')); //=> { foo: "bar" }
 * console.log(JSONC.parse('{"foo": "bar", } /* comment *\/')); //=> { foo: "bar" }
 * console.log(JSONC.parse('{"foo": "bar" } // comment', {
 *   allowTrailingComma: false,
 * })); //=> { foo: "bar" }
 * ```
 *
 * @param text A valid JSONC string.
 */
export function parse(
  text: string,
  { allowTrailingComma = true }: ParseOptions = {},
): JsonValue {
  if (new.target) {
    throw new TypeError("parse is not a constructor");
  }
  return new JSONCParser(text, { allowTrailingComma }).parse();
}

const TokenTypeMap = {
  BeginObject: "BeginObject",
  EndObject: "EndObject",
  BeginArray: "BeginArray",
  EndArray: "EndArray",
  NameSeparator: "NameSeparator",
  ValueSeparator: "ValueSeparator",
  NullOrTrueOrFalseOrNumber: "NullOrTrueOrFalseOrNumber",
  String: "String",
} as const;

type TokenType = keyof typeof TokenTypeMap;

type Token = {
  type: Exclude<
    TokenType,
    "String" | "NullOrTrueOrFalseOrNumber"
  >;
  sourceText?: undefined;
  position: number;
} | {
  type: "String";
  sourceText: string;
  position: number;
} | {
  type: "NullOrTrueOrFalseOrNumber";
  sourceText: string;
  position: number;
};

const originalJSONParse = globalThis.JSON.parse;

// First tokenize and then parse the token.
class JSONCParser {
  readonly #whitespace = new Set(" \t\r\n");
  readonly #numberEndToken = new Set([..."[]{}:,/", ...this.#whitespace]);
  #text: string;
  #length: number;
  #tokenized: Generator<Token, void>;
  #options: ParseOptions;
  constructor(text: string, options: ParseOptions) {
    this.#text = `${text}`;
    this.#length = this.#text.length;
    this.#tokenized = this.#tokenize();
    this.#options = options;
  }
  parse(): JsonValue {
    const token = this.#getNext();
    const res = this.#parseJsonValue(token);

    // make sure all characters have been read
    const { done, value } = this.#tokenized.next();
    if (!done) {
      throw new SyntaxError(buildErrorMessage(value));
    }

    return res;
  }
  /** Read the next token. If the token is read to the end, it throws a SyntaxError. */
  #getNext(): Token {
    const { done, value } = this.#tokenized.next();
    if (done) {
      throw new SyntaxError("Unexpected end of JSONC input");
    }
    return value;
  }
  /** Split the JSONC string into token units. Whitespace and comments are skipped. */
  *#tokenize(): Generator<Token, void> {
    for (let i = 0; i < this.#length; i++) {
      // skip whitespace
      if (this.#whitespace.has(this.#text[i])) {
        continue;
      }

      // skip multi line comment (`/*...*/`)
      if (this.#text[i] === "/" && this.#text[i + 1] === "*") {
        i += 2;
        let hasEndOfComment = false;
        for (; i < this.#length; i++) { // read until find `*/`
          if (this.#text[i] === "*" && this.#text[i + 1] === "/") {
            hasEndOfComment = true;
            break;
          }
        }
        if (!hasEndOfComment) {
          throw new SyntaxError("Unexpected end of JSONC input");
        }
        i++;
        continue;
      }

      // skip single line comment (`//...`)
      if (this.#text[i] === "/" && this.#text[i + 1] === "/") {
        i += 2;
        for (; i < this.#length; i++) { // read until find `\n` or `\r`
          if (this.#text[i] === "\n" || this.#text[i] === "\r") {
            break;
          }
        }
        continue;
      }

      switch (this.#text[i]) {
        case "{":
          yield { type: TokenTypeMap.BeginObject, position: i };
          break;
        case "}":
          yield { type: TokenTypeMap.EndObject, position: i };
          break;
        case "[":
          yield { type: TokenTypeMap.BeginArray, position: i };
          break;
        case "]":
          yield { type: TokenTypeMap.EndArray, position: i };
          break;
        case ":":
          yield { type: TokenTypeMap.NameSeparator, position: i };
          break;
        case ",":
          yield { type: TokenTypeMap.ValueSeparator, position: i };
          break;
        case '"': { // parse string token
          const startIndex = i;
          // Need to handle consecutive backslashes correctly
          // '"\\""' => '"'
          // '"\\\\"' => '\\'
          // '"\\\\\\""' => '\\"'
          // '"\\\\\\\\"' => '\\\\'
          let shouldEscapeNext = false;
          i++;
          for (; i < this.#length; i++) { // read until find `"`
            if (this.#text[i] === '"' && !shouldEscapeNext) {
              break;
            }
            shouldEscapeNext = this.#text[i] === "\\" && !shouldEscapeNext;
          }
          yield {
            type: TokenTypeMap.String,
            sourceText: this.#text.substring(startIndex, i + 1),
            position: startIndex,
          };
          break;
        }
        default: { // parse null, true, false or number token
          const startIndex = i;
          for (; i < this.#length; i++) { // read until find numberEndToken
            if (this.#numberEndToken.has(this.#text[i])) {
              break;
            }
          }
          i--;
          yield {
            type: TokenTypeMap.NullOrTrueOrFalseOrNumber,
            sourceText: this.#text.substring(startIndex, i + 1),
            position: startIndex,
          };
        }
      }
    }
  }
  #parseJsonValue(value: Token): JsonValue {
    switch (value.type) {
      case TokenTypeMap.BeginObject:
        return this.#parseObject();
      case TokenTypeMap.BeginArray:
        return this.#parseArray();
      case TokenTypeMap.NullOrTrueOrFalseOrNumber:
        return this.#parseNullOrTrueOrFalseOrNumber(value);
      case TokenTypeMap.String:
        return this.#parseString(value);
      default:
        throw new SyntaxError(buildErrorMessage(value));
    }
  }
  #parseObject(): { [key: string]: JsonValue | undefined } {
    const target: { [key: string]: JsonValue | undefined } = {};
    //   ┌─token1
    // { }
    //      ┌─────────────token1
    //      │   ┌─────────token2
    //      │   │   ┌─────token3
    //      │   │   │   ┌─token4
    //  { "key" : value }
    //      ┌───────────────token1
    //      │   ┌───────────token2
    //      │   │   ┌───────token3
    //      │   │   │   ┌───token4
    //      │   │   │   │ ┌─token1
    //  { "key" : value , }
    //      ┌─────────────────────────────token1
    //      │   ┌─────────────────────────token2
    //      │   │   ┌─────────────────────token3
    //      │   │   │   ┌─────────────────token4
    //      │   │   │   │   ┌─────────────token1
    //      │   │   │   │   │   ┌─────────token2
    //      │   │   │   │   │   │   ┌─────token3
    //      │   │   │   │   │   │   │   ┌─token4
    //  { "key" : value , "key" : value }
    for (let isFirst = true;; isFirst = false) {
      const token1 = this.#getNext();
      if (
        (isFirst || this.#options.allowTrailingComma) &&
        token1.type === TokenTypeMap.EndObject
      ) {
        return target;
      }
      if (token1.type !== TokenTypeMap.String) {
        throw new SyntaxError(buildErrorMessage(token1));
      }
      const key = this.#parseString(token1);

      const token2 = this.#getNext();
      if (token2.type !== TokenTypeMap.NameSeparator) {
        throw new SyntaxError(buildErrorMessage(token2));
      }

      const token3 = this.#getNext();
      Object.defineProperty(target, key, {
        value: this.#parseJsonValue(token3),
        writable: true,
        enumerable: true,
        configurable: true,
      });

      const token4 = this.#getNext();
      if (token4.type === TokenTypeMap.EndObject) {
        return target;
      }
      if (token4.type !== TokenTypeMap.ValueSeparator) {
        throw new SyntaxError(buildErrorMessage(token4));
      }
    }
  }
  #parseArray(): JsonValue[] {
    const target: JsonValue[] = [];
    //   ┌─token1
    // [ ]
    //      ┌─────────────token1
    //      │   ┌─────────token2
    //  [ value ]
    //      ┌───────token1
    //      │   ┌───token2
    //      │   │ ┌─token1
    //  [ value , ]
    //      ┌─────────────token1
    //      │   ┌─────────token2
    //      │   │   ┌─────token1
    //      │   │   │   ┌─token2
    //  [ value , value ]
    for (let isFirst = true;; isFirst = false) {
      const token1 = this.#getNext();
      if (
        (isFirst || this.#options.allowTrailingComma) &&
        token1.type === TokenTypeMap.EndArray
      ) {
        return target;
      }
      target.push(this.#parseJsonValue(token1));

      const token2 = this.#getNext();
      if (token2.type === TokenTypeMap.EndArray) {
        return target;
      }
      if (token2.type !== TokenTypeMap.ValueSeparator) {
        throw new SyntaxError(buildErrorMessage(token2));
      }
    }
  }
  #parseString(value: {
    type: typeof TokenTypeMap.String;
    sourceText: string;
    position: number;
  }): string {
    let parsed;
    try {
      // Use JSON.parse to handle `\u0000` etc. correctly.
      parsed = originalJSONParse(value.sourceText);
    } catch {
      throw new SyntaxError(buildErrorMessage(value));
    }
    assert(typeof parsed === "string");
    return parsed;
  }
  #parseNullOrTrueOrFalseOrNumber(value: {
    type: typeof TokenTypeMap.NullOrTrueOrFalseOrNumber;
    sourceText: string;
    position: number;
  }): null | boolean | number {
    if (value.sourceText === "null") {
      return null;
    }
    if (value.sourceText === "true") {
      return true;
    }
    if (value.sourceText === "false") {
      return false;
    }
    let parsed;
    try {
      // Use JSON.parse to handle `+100`, `Infinity` etc. correctly.
      parsed = originalJSONParse(value.sourceText);
    } catch {
      throw new SyntaxError(buildErrorMessage(value));
    }
    assert(typeof parsed === "number");
    return parsed;
  }
}

function buildErrorMessage({ type, sourceText, position }: Token): string {
  let token = "";
  switch (type) {
    case TokenTypeMap.BeginObject:
      token = "{";
      break;
    case TokenTypeMap.EndObject:
      token = "}";
      break;
    case TokenTypeMap.BeginArray:
      token = "[";
      break;
    case TokenTypeMap.EndArray:
      token = "]";
      break;
    case TokenTypeMap.NameSeparator:
      token = ":";
      break;
    case TokenTypeMap.ValueSeparator:
      token = ",";
      break;
    case TokenTypeMap.NullOrTrueOrFalseOrNumber:
    case TokenTypeMap.String:
      // Truncate the string so that it is within 30 lengths.
      token = 30 < sourceText.length
        ? `${sourceText.slice(0, 30)}...`
        : sourceText;
      break;
    default:
      throw new Error("unreachable");
  }
  return `Unexpected token ${token} in JSONC at position ${position}`;
}
