// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import {
  AMPERSAND,
  ASTERISK,
  BACKSLASH,
  CARRIAGE_RETURN,
  COLON,
  COMMA,
  COMMERCIAL_AT,
  DOT,
  DOUBLE_QUOTE,
  EXCLAMATION,
  GRAVE_ACCENT,
  GREATER_THAN,
  LEFT_CURLY_BRACKET,
  LEFT_SQUARE_BRACKET,
  LINE_FEED,
  MINUS,
  PERCENT,
  PLUS,
  QUESTION,
  RIGHT_CURLY_BRACKET,
  RIGHT_SQUARE_BRACKET,
  SHARP,
  SINGLE_QUOTE,
  SMALLER_THAN,
  SPACE,
  TAB,
  VERTICAL_LINE,
} from "../_chars.ts";
import { YamlError } from "../_error.ts";
import { Mark } from "../_mark.ts";
import type { Type } from "../_type.ts";
import * as common from "../_utils.ts";
import {
  LoaderState,
  type LoaderStateOptions,
  type ResultType,
} from "./loader_state.ts";

type Any = common.Any;
type ArrayObject<T = Any> = common.ArrayObject<T>;

const CONTEXT_FLOW_IN = 1;
const CONTEXT_FLOW_OUT = 2;
const CONTEXT_BLOCK_IN = 3;
const CONTEXT_BLOCK_OUT = 4;

const CHOMPING_CLIP = 1;
const CHOMPING_STRIP = 2;
const CHOMPING_KEEP = 3;

const PATTERN_NON_PRINTABLE =
  // deno-lint-ignore no-control-regex
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
const PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
const PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
const PATTERN_TAG_URI =
  /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;

function _class(obj: unknown): string {
  return Object.prototype.toString.call(obj);
}

function isEOL(c: number): boolean {
  return c === LINE_FEED || c === CARRIAGE_RETURN;
}

function isWhiteSpace(c: number): boolean {
  return c === TAB || c === SPACE;
}

function isWsOrEol(c: number): boolean {
  return (
    c === TAB ||
    c === SPACE ||
    c === LINE_FEED ||
    c === CARRIAGE_RETURN
  );
}

function isFlowIndicator(c: number): boolean {
  return (
    c === COMMA ||
    c === LEFT_SQUARE_BRACKET ||
    c === RIGHT_SQUARE_BRACKET ||
    c === LEFT_CURLY_BRACKET ||
    c === RIGHT_CURLY_BRACKET
  );
}

function fromHexCode(c: number): number {
  if (0x30 <= /* 0 */ c && c <= 0x39 /* 9 */) {
    return c - 0x30;
  }

  const lc = c | 0x20;

  if (0x61 <= /* a */ lc && lc <= 0x66 /* f */) {
    return lc - 0x61 + 10;
  }

  return -1;
}

const ESCAPED_HEX_LENGTHS = new Map<number, number>([
  [0x78, 2], // x
  [0x75, 4], // u
  [0x55, 8], // U
]);

function fromDecimalCode(c: number): number {
  if (0x30 <= /* 0 */ c && c <= 0x39 /* 9 */) {
    return c - 0x30;
  }

  return -1;
}

const SIMPLE_ESCAPE_SEQUENCES = new Map<number, string>([
  [0x30, "\x00"], // 0
  [0x61, "\x07"], // a
  [0x62, "\x08"], // b
  [0x74, "\x09"], // t
  [0x09, "\x09"], // Tab
  [0x6e, "\x0A"], // n
  [0x76, "\x0B"], // v
  [0x66, "\x0C"], // f
  [0x72, "\x0D"], // r
  [0x65, "\x1B"], // e
  [0x20, " "], // Space
  [0x22, '"'], // "
  [0x2f, "/"], // /
  [0x5c, "\\"], // \
  [0x4e, "\x85"], // N
  [0x5f, "\xA0"], // _
  [0x4c, "\u2028"], // L
  [0x50, "\u2029"], // P
]);

function charFromCodepoint(c: number): string {
  if (c <= 0xffff) {
    return String.fromCharCode(c);
  }
  // Encode UTF-16 surrogate pair
  // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
  return String.fromCharCode(
    ((c - 0x010000) >> 10) + 0xd800,
    ((c - 0x010000) & 0x03ff) + 0xdc00,
  );
}

function generateError(state: LoaderState, message: string): YamlError {
  return new YamlError(
    message,
    new Mark(
      state.input,
      state.position,
      state.line,
      state.position - state.lineStart,
    ),
  );
}

function throwError(state: LoaderState, message: string): never {
  throw generateError(state, message);
}

function throwWarning(state: LoaderState, message: string) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}

function yamlDirectiveHandler(state: LoaderState, ...args: string[]) {
  if (state.version !== null) {
    return throwError(state, "duplication of %YAML directive");
  }

  if (args.length !== 1) {
    return throwError(state, "YAML directive accepts exactly one argument");
  }

  const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]!);
  if (match === null) {
    return throwError(state, "ill-formed argument of the YAML directive");
  }

  const major = parseInt(match[1]!, 10);
  const minor = parseInt(match[2]!, 10);
  if (major !== 1) {
    return throwError(state, "unacceptable YAML version of the document");
  }

  state.version = args[0];
  state.checkLineBreaks = minor < 2;
  if (minor !== 1 && minor !== 2) {
    return throwWarning(state, "unsupported YAML version of the document");
  }
}
function tagDirectiveHandler(state: LoaderState, ...args: string[]) {
  if (args.length !== 2) {
    return throwError(state, "TAG directive accepts exactly two arguments");
  }

  const handle = args[0]!;
  const prefix = args[1]!;

  if (!PATTERN_TAG_HANDLE.test(handle)) {
    return throwError(
      state,
      "ill-formed tag handle (first argument) of the TAG directive",
    );
  }

  if (Object.hasOwn(state.tagMap, handle)) {
    return throwError(
      state,
      `there is a previously declared suffix for "${handle}" tag handle`,
    );
  }

  if (!PATTERN_TAG_URI.test(prefix)) {
    return throwError(
      state,
      "ill-formed tag prefix (second argument) of the TAG directive",
    );
  }

  state.tagMap[handle] = prefix;
}

function captureSegment(
  state: LoaderState,
  start: number,
  end: number,
  checkJson: boolean,
) {
  let result: string;
  if (start < end) {
    result = state.input.slice(start, end);

    if (checkJson) {
      for (
        let position = 0;
        position < result.length;
        position++
      ) {
        const character = result.charCodeAt(position);
        if (
          !(character === 0x09 || (0x20 <= character && character <= 0x10ffff))
        ) {
          return throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(result)) {
      return throwError(state, "the stream contains non-printable characters");
    }

    state.result += result;
  }
}

function mergeMappings(
  state: LoaderState,
  destination: ArrayObject,
  source: ArrayObject,
  overridableKeys: ArrayObject<boolean>,
) {
  if (!common.isObject(source)) {
    return throwError(
      state,
      "cannot merge mappings; the provided source object is unacceptable",
    );
  }

  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(destination, key)) {
      Object.defineProperty(destination, key, {
        value: source[key],
        writable: true,
        enumerable: true,
        configurable: true,
      });
      overridableKeys[key] = true;
    }
  }
}

function storeMappingPair(
  state: LoaderState,
  result: ArrayObject | null,
  overridableKeys: ArrayObject<boolean>,
  keyTag: string | null,
  keyNode: Any,
  valueNode: unknown,
  startLine?: number,
  startPos?: number,
): ArrayObject {
  // The output is a plain object here, so keys can only be strings.
  // We need to convert keyNode to a string, but doing so can hang the process
  // (deeply nested arrays that explode exponentially using aliases).
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);

    for (let index = 0; index < keyNode.length; index++) {
      if (Array.isArray(keyNode[index])) {
        return throwError(state, "nested arrays are not supported inside keys");
      }

      if (
        typeof keyNode === "object" &&
        _class(keyNode[index]) === "[object Object]"
      ) {
        keyNode[index] = "[object Object]";
      }
    }
  }

  // Avoid code execution in load() via toString property
  // (still use its own toString for arrays, timestamps,
  // and whatever user schema extensions happen to have @@toStringTag)
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }

  keyNode = String(keyNode);

  if (result === null) {
    result = {};
  }

  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (
        let index = 0;
        index < valueNode.length;
        index++
      ) {
        mergeMappings(state, result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, result, valueNode as ArrayObject, overridableKeys);
    }
  } else {
    if (
      !state.json &&
      !Object.hasOwn(overridableKeys, keyNode) &&
      Object.hasOwn(result, keyNode)
    ) {
      state.line = startLine || state.line;
      state.position = startPos || state.position;
      return throwError(state, "duplicated mapping key");
    }
    Object.defineProperty(result, keyNode, {
      value: valueNode,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    delete overridableKeys[keyNode];
  }

  return result;
}

function readLineBreak(state: LoaderState) {
  const ch = state.input.charCodeAt(state.position);

  if (ch === LINE_FEED) {
    state.position++;
  } else if (ch === CARRIAGE_RETURN) {
    state.position++;
    if (state.input.charCodeAt(state.position) === LINE_FEED) {
      state.position++;
    }
  } else {
    return throwError(state, "a line break is expected");
  }

  state.line += 1;
  state.lineStart = state.position;
}

function skipSeparationSpace(
  state: LoaderState,
  allowComments: boolean,
  checkIndent: number,
): number {
  let lineBreaks = 0;
  let ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    while (isWhiteSpace(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    if (allowComments && ch === SHARP) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== LINE_FEED && ch !== CARRIAGE_RETURN && ch !== 0);
    }

    if (isEOL(ch)) {
      readLineBreak(state);

      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;

      while (ch === SPACE) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }

  if (
    checkIndent !== -1 &&
    lineBreaks !== 0 &&
    state.lineIndent < checkIndent
  ) {
    throwWarning(state, "deficient indentation");
  }

  return lineBreaks;
}

function testDocumentSeparator(state: LoaderState): boolean {
  let _position = state.position;
  let ch = state.input.charCodeAt(_position);

  // Condition state.position === state.lineStart is tested
  // in parent on each call, for efficiency. No needs to test here again.
  if (
    (ch === MINUS || ch === DOT) &&
    ch === state.input.charCodeAt(_position + 1) &&
    ch === state.input.charCodeAt(_position + 2)
  ) {
    _position += 3;

    ch = state.input.charCodeAt(_position);

    if (ch === 0 || isWsOrEol(ch)) {
      return true;
    }
  }

  return false;
}

function writeFoldedLines(state: LoaderState, count: number) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}

function readPlainScalar(
  state: LoaderState,
  nodeIndent: number,
  withinFlowCollection: boolean,
): boolean {
  const kind = state.kind;
  const result = state.result;
  let ch = state.input.charCodeAt(state.position);

  if (
    isWsOrEol(ch) ||
    isFlowIndicator(ch) ||
    ch === SHARP ||
    ch === AMPERSAND ||
    ch === ASTERISK ||
    ch === EXCLAMATION ||
    ch === VERTICAL_LINE ||
    ch === GREATER_THAN ||
    ch === SINGLE_QUOTE ||
    ch === DOUBLE_QUOTE ||
    ch === PERCENT ||
    ch === COMMERCIAL_AT ||
    ch === GRAVE_ACCENT
  ) {
    return false;
  }

  let following: number;
  if (ch === QUESTION || ch === MINUS) {
    following = state.input.charCodeAt(state.position + 1);

    if (
      isWsOrEol(following) ||
      (withinFlowCollection && isFlowIndicator(following))
    ) {
      return false;
    }
  }

  state.kind = "scalar";
  state.result = "";
  let captureEnd = state.position;
  let captureStart = state.position;
  let hasPendingContent = false;
  let line = 0;
  while (ch !== 0) {
    if (ch === COLON) {
      following = state.input.charCodeAt(state.position + 1);

      if (
        isWsOrEol(following) ||
        (withinFlowCollection && isFlowIndicator(following))
      ) {
        break;
      }
    } else if (ch === SHARP) {
      const preceding = state.input.charCodeAt(state.position - 1);

      if (isWsOrEol(preceding)) {
        break;
      }
    } else if (
      (state.position === state.lineStart && testDocumentSeparator(state)) ||
      (withinFlowCollection && isFlowIndicator(ch))
    ) {
      break;
    } else if (isEOL(ch)) {
      line = state.line;
      const lineStart = state.lineStart;
      const lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);

      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = line;
        state.lineStart = lineStart;
        state.lineIndent = lineIndent;
        break;
      }
    }

    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }

    if (!isWhiteSpace(ch)) {
      captureEnd = state.position + 1;
    }

    ch = state.input.charCodeAt(++state.position);
  }

  captureSegment(state, captureStart, captureEnd, false);

  if (state.result) {
    return true;
  }

  state.kind = kind;
  state.result = result;
  return false;
}

function readSingleQuotedScalar(
  state: LoaderState,
  nodeIndent: number,
): boolean {
  let ch;
  let captureStart;
  let captureEnd;

  ch = state.input.charCodeAt(state.position);

  if (ch !== SINGLE_QUOTE) {
    return false;
  }

  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === SINGLE_QUOTE) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (ch === SINGLE_QUOTE) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (isEOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (
      state.position === state.lineStart &&
      testDocumentSeparator(state)
    ) {
      return throwError(
        state,
        "unexpected end of the document within a single quoted scalar",
      );
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  return throwError(
    state,
    "unexpected end of the stream within a single quoted scalar",
  );
}

function readDoubleQuotedScalar(
  state: LoaderState,
  nodeIndent: number,
): boolean {
  let ch = state.input.charCodeAt(state.position);

  if (ch !== DOUBLE_QUOTE) {
    return false;
  }

  state.kind = "scalar";
  state.result = "";
  state.position++;
  let captureEnd = state.position;
  let captureStart = state.position;
  let tmp: number;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === DOUBLE_QUOTE) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    }
    if (ch === BACKSLASH) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (isEOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && SIMPLE_ESCAPE_SEQUENCES.has(ch)) {
        state.result += SIMPLE_ESCAPE_SEQUENCES.get(ch);
        state.position++;
      } else if ((tmp = ESCAPED_HEX_LENGTHS.get(ch) ?? 0) > 0) {
        let hexLength = tmp;
        let hexResult = 0;

        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);

          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            return throwError(state, "expected hexadecimal character");
          }
        }

        state.result += charFromCodepoint(hexResult);

        state.position++;
      } else {
        return throwError(state, "unknown escape sequence");
      }

      captureStart = captureEnd = state.position;
    } else if (isEOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (
      state.position === state.lineStart &&
      testDocumentSeparator(state)
    ) {
      return throwError(
        state,
        "unexpected end of the document within a double quoted scalar",
      );
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  return throwError(
    state,
    "unexpected end of the stream within a double quoted scalar",
  );
}

function readFlowCollection(state: LoaderState, nodeIndent: number): boolean {
  let ch = state.input.charCodeAt(state.position);
  let terminator: number;
  let isMapping = true;
  let result: ResultType = {};
  if (ch === LEFT_SQUARE_BRACKET) {
    terminator = RIGHT_SQUARE_BRACKET;
    isMapping = false;
    result = [];
  } else if (ch === LEFT_CURLY_BRACKET) {
    terminator = RIGHT_CURLY_BRACKET;
  } else {
    return false;
  }

  if (state.anchor !== null && typeof state.anchor !== "undefined") {
    state.anchorMap[state.anchor] = result;
  }

  ch = state.input.charCodeAt(++state.position);

  const tag = state.tag;
  const anchor = state.anchor;
  let readNext = true;
  let valueNode = null;
  let keyNode = null;
  let keyTag: string | null = null;
  let isExplicitPair = false;
  let isPair = false;
  let following = 0;
  let line = 0;
  const overridableKeys: ArrayObject<boolean> = Object.create(null);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === terminator) {
      state.position++;
      state.tag = tag;
      state.anchor = anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = result;
      return true;
    }
    if (!readNext) {
      return throwError(state, "missed comma between flow collection entries");
    }

    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;

    if (ch === QUESTION) {
      following = state.input.charCodeAt(state.position + 1);

      if (isWsOrEol(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }

    line = state.line;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag || null;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if ((isExplicitPair || state.line === line) && ch === COLON) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }

    if (isMapping) {
      storeMappingPair(
        state,
        result,
        overridableKeys,
        keyTag,
        keyNode,
        valueNode,
      );
    } else if (isPair) {
      (result as ArrayObject[]).push(
        storeMappingPair(
          state,
          null,
          overridableKeys,
          keyTag,
          keyNode,
          valueNode,
        ),
      );
    } else {
      (result as ResultType[]).push(keyNode as ResultType);
    }

    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === COMMA) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }

  return throwError(
    state,
    "unexpected end of the stream within a flow collection",
  );
}

// Handles block scaler styles: e.g. '|', '>', '|-' and '>-'.
// https://yaml.org/spec/1.2.2/#81-block-scalar-styles
function readBlockScalar(state: LoaderState, nodeIndent: number): boolean {
  let chomping = CHOMPING_CLIP;
  let didReadContent = false;
  let detectedIndent = false;
  let textIndent = nodeIndent;
  let emptyLines = 0;
  let atMoreIndented = false;

  let ch = state.input.charCodeAt(state.position);

  let folding = false;
  if (ch === VERTICAL_LINE) {
    folding = false;
  } else if (ch === GREATER_THAN) {
    folding = true;
  } else {
    return false;
  }

  state.kind = "scalar";
  state.result = "";

  let tmp = 0;
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);

    if (ch === PLUS || ch === MINUS) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === PLUS ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        return throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        return throwError(
          state,
          "bad explicit indentation width of a block scalar; it cannot be less than one",
        );
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        return throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }

  if (isWhiteSpace(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (isWhiteSpace(ch));

    if (ch === SHARP) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!isEOL(ch) && ch !== 0);
    }
  }

  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;

    ch = state.input.charCodeAt(state.position);

    while (
      (!detectedIndent || state.lineIndent < textIndent) &&
      ch === SPACE
    ) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }

    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }

    if (isEOL(ch)) {
      emptyLines++;
      continue;
    }

    // End of the scalar.
    if (state.lineIndent < textIndent) {
      // Perform the chomping.
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat(
          "\n",
          didReadContent ? 1 + emptyLines : emptyLines,
        );
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          // i.e. only if the scalar is not empty.
          state.result += "\n";
        }
      }

      // Break this `while` cycle and go to the function's epilogue.
      break;
    }

    // Folded style: use fancy rules to handle line breaks.
    if (folding) {
      // Lines starting with white space characters (more-indented lines) are not folded.
      if (isWhiteSpace(ch)) {
        atMoreIndented = true;
        // except for the first content line (cf. Example 8.1)
        state.result += common.repeat(
          "\n",
          didReadContent ? 1 + emptyLines : emptyLines,
        );

        // End of more-indented block.
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);

        // Just one line break - perceive as the same line.
      } else if (emptyLines === 0) {
        if (didReadContent) {
          // i.e. only if we have already read some scalar content.
          state.result += " ";
        }

        // Several line breaks - perceive as different lines.
      } else {
        state.result += common.repeat("\n", emptyLines);
      }

      // Literal style: just add exact number of line breaks between content lines.
    } else {
      // Keep all line breaks except the header line break.
      state.result += common.repeat(
        "\n",
        didReadContent ? 1 + emptyLines : emptyLines,
      );
    }

    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    const captureStart = state.position;

    while (!isEOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, state.position, false);
  }

  return true;
}

function readBlockSequence(state: LoaderState, nodeIndent: number): boolean {
  let line: number;
  let following: number;
  let detected = false;
  let ch: number;
  const tag = state.tag;
  const anchor = state.anchor;
  const result: unknown[] = [];

  if (state.anchor !== null && typeof state.anchor !== "undefined") {
    state.anchorMap[state.anchor] = result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (ch !== MINUS) {
      break;
    }

    following = state.input.charCodeAt(state.position + 1);

    if (!isWsOrEol(following)) {
      break;
    }

    detected = true;
    state.position++;

    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }

    line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    result.push(state.result);
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if ((state.line === line || state.lineIndent > nodeIndent) && ch !== 0) {
      return throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  if (detected) {
    state.tag = tag;
    state.anchor = anchor;
    state.kind = "sequence";
    state.result = result;
    return true;
  }
  return false;
}

function readBlockMapping(
  state: LoaderState,
  nodeIndent: number,
  flowIndent: number,
): boolean {
  const tag = state.tag;
  const anchor = state.anchor;
  const result = {};
  const overridableKeys = Object.create(null);
  let following: number;
  let allowCompact = false;
  let line: number;
  let pos: number;
  let keyTag = null;
  let keyNode = null;
  let valueNode = null;
  let atExplicitKey = false;
  let detected = false;
  let ch: number;

  if (state.anchor !== null && typeof state.anchor !== "undefined") {
    state.anchorMap[state.anchor] = result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    following = state.input.charCodeAt(state.position + 1);
    line = state.line; // Save the current line.
    pos = state.position;

    //
    // Explicit notation case. There are two separate blocks:
    // first for the key (denoted by "?") and second for the value (denoted by ":")
    //
    if ((ch === QUESTION || ch === COLON) && isWsOrEol(following)) {
      if (ch === QUESTION) {
        if (atExplicitKey) {
          storeMappingPair(
            state,
            result,
            overridableKeys,
            keyTag as string,
            keyNode,
            null,
          );
          keyTag = keyNode = valueNode = null;
        }

        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        // i.e. 0x3A/* : */ === character after the explicit key.
        atExplicitKey = false;
        allowCompact = true;
      } else {
        return throwError(
          state,
          "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line",
        );
      }

      state.position += 1;
      ch = following;

      //
      // Implicit notation case. Flow-style node as the key first, then ":", and the value.
      //
    } else if (composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
      if (state.line === line) {
        ch = state.input.charCodeAt(state.position);

        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        if (ch === COLON) {
          ch = state.input.charCodeAt(++state.position);

          if (!isWsOrEol(ch)) {
            return throwError(
              state,
              "a whitespace character is expected after the key-value separator within a block mapping",
            );
          }

          if (atExplicitKey) {
            storeMappingPair(
              state,
              result,
              overridableKeys,
              keyTag as string,
              keyNode,
              null,
            );
            keyTag = keyNode = valueNode = null;
          }

          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          return throwError(
            state,
            "can not read an implicit mapping pair; a colon is missed",
          );
        } else {
          state.tag = tag;
          state.anchor = anchor;
          return true; // Keep the result of `composeNode`.
        }
      } else if (detected) {
        return throwError(
          state,
          "can not read a block mapping entry; a multiline key may not be an implicit key",
        );
      } else {
        state.tag = tag;
        state.anchor = anchor;
        return true; // Keep the result of `composeNode`.
      }
    } else {
      break; // Reading is done. Go to the epilogue.
    }

    //
    // Common reading code for both explicit and implicit notations.
    //
    if (state.line === line || state.lineIndent > nodeIndent) {
      if (
        composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)
      ) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }

      if (!atExplicitKey) {
        storeMappingPair(
          state,
          result,
          overridableKeys,
          keyTag as string,
          keyNode,
          valueNode,
          line,
          pos,
        );
        keyTag = keyNode = valueNode = null;
      }

      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }

    if (state.lineIndent > nodeIndent && ch !== 0) {
      return throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  //
  // Epilogue.
  //

  // Special case: last mapping's node contains only the key in explicit notation.
  if (atExplicitKey) {
    storeMappingPair(
      state,
      result,
      overridableKeys,
      keyTag as string,
      keyNode,
      null,
    );
  }

  // Expose the resulting mapping.
  if (detected) {
    state.tag = tag;
    state.anchor = anchor;
    state.kind = "mapping";
    state.result = result;
  }

  return detected;
}

function readTagProperty(state: LoaderState): boolean {
  let position: number;
  let isVerbatim = false;
  let isNamed = false;
  let tagHandle = "";
  let tagName: string;
  let ch: number;

  ch = state.input.charCodeAt(state.position);

  if (ch !== EXCLAMATION) return false;

  if (state.tag !== null) {
    return throwError(state, "duplication of a tag property");
  }

  ch = state.input.charCodeAt(++state.position);

  if (ch === SMALLER_THAN) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === EXCLAMATION) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }

  position = state.position;

  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== GREATER_THAN);

    if (state.position < state.length) {
      tagName = state.input.slice(position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      return throwError(
        state,
        "unexpected end of the stream within a verbatim tag",
      );
    }
  } else {
    while (ch !== 0 && !isWsOrEol(ch)) {
      if (ch === EXCLAMATION) {
        if (!isNamed) {
          tagHandle = state.input.slice(position - 1, state.position + 1);

          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            return throwError(
              state,
              "named tag handle cannot contain such characters",
            );
          }

          isNamed = true;
          position = state.position + 1;
        } else {
          return throwError(
            state,
            "tag suffix cannot contain exclamation marks",
          );
        }
      }

      ch = state.input.charCodeAt(++state.position);
    }

    tagName = state.input.slice(position, state.position);

    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      return throwError(
        state,
        "tag suffix cannot contain flow indicator characters",
      );
    }
  }

  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    return throwError(
      state,
      `tag name cannot contain such characters: ${tagName}`,
    );
  }

  if (isVerbatim) {
    state.tag = tagName;
  } else if (Object.hasOwn(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = `!${tagName}`;
  } else if (tagHandle === "!!") {
    state.tag = `tag:yaml.org,2002:${tagName}`;
  } else {
    return throwError(state, `undeclared tag handle "${tagHandle}"`);
  }

  return true;
}

function readAnchorProperty(state: LoaderState): boolean {
  let ch = state.input.charCodeAt(state.position);
  if (ch !== AMPERSAND) return false;

  if (state.anchor !== null) {
    return throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);

  const position = state.position;
  while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === position) {
    return throwError(
      state,
      "name of an anchor node must contain at least one character",
    );
  }

  state.anchor = state.input.slice(position, state.position);
  return true;
}

function readAlias(state: LoaderState): boolean {
  let ch = state.input.charCodeAt(state.position);

  if (ch !== ASTERISK) return false;

  ch = state.input.charCodeAt(++state.position);
  const _position = state.position;

  while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    return throwError(
      state,
      "name of an alias node must contain at least one character",
    );
  }

  const alias = state.input.slice(_position, state.position);
  if (!Object.hasOwn(state.anchorMap, alias)) {
    return throwError(state, `unidentified alias "${alias}"`);
  }

  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}

function composeNode(
  state: LoaderState,
  parentIndent: number,
  nodeContext: number,
  allowToSeek: boolean,
  allowCompact: boolean,
): boolean {
  let allowBlockScalars: boolean;
  let allowBlockCollections: boolean;
  let indentStatus = 1; // 1: this>parent, 0: this=parent, -1: this<parent
  let atNewLine = false;
  let hasContent = false;
  let type: Type;
  let flowIndent: number;
  let blockIndent: number;

  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;

  const allowBlockStyles = (allowBlockScalars =
    allowBlockCollections =
      CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext);

  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;

      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }

  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;

        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }

  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }

  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    const cond = CONTEXT_FLOW_IN === nodeContext ||
      CONTEXT_FLOW_OUT === nodeContext;
    flowIndent = cond ? parentIndent : parentIndent + 1;

    blockIndent = state.position - state.lineStart;

    if (indentStatus === 1) {
      if (
        (allowBlockCollections &&
          (readBlockSequence(state, blockIndent) ||
            readBlockMapping(state, blockIndent, flowIndent))) ||
        readFlowCollection(state, flowIndent)
      ) {
        hasContent = true;
      } else {
        if (
          (allowBlockScalars && readBlockScalar(state, flowIndent)) ||
          readSingleQuotedScalar(state, flowIndent) ||
          readDoubleQuotedScalar(state, flowIndent)
        ) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;

          if (state.tag !== null || state.anchor !== null) {
            return throwError(
              state,
              "alias node should not have Any properties",
            );
          }
        } else if (
          readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)
        ) {
          hasContent = true;

          if (state.tag === null) {
            state.tag = "?";
          }
        }

        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      // Special case: block sequences are allowed to have same indentation level as the parent.
      // http://www.yaml.org/spec/1.2/spec.html#id2799784
      hasContent = allowBlockCollections &&
        readBlockSequence(state, blockIndent);
    }
  }

  if (state.tag !== null && state.tag !== "!") {
    if (state.tag === "?") {
      for (
        let typeIndex = 0;
        typeIndex < state.implicitTypes.length;
        typeIndex++
      ) {
        type = state.implicitTypes[typeIndex]!;

        // Implicit resolving is not allowed for non-scalar types, and '?'
        // non-specific tag is only assigned to plain scalars. So, it isn't
        // needed to check for 'kind' conformity.

        if (type.resolve(state.result)) {
          // `state.result` updated in resolver if matched
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
          break;
        }
      }
    } else if (
      Object.hasOwn(state.typeMap[state.kind || "fallback"], state.tag)
    ) {
      type = state.typeMap[state.kind || "fallback"][state.tag]!;

      if (state.result !== null && type.kind !== state.kind) {
        return throwError(
          state,
          `unacceptable node kind for !<${state.tag}> tag; it should be "${type.kind}", not "${state.kind}"`,
        );
      }

      if (!type.resolve(state.result)) {
        // `state.result` updated in resolver if matched
        return throwError(
          state,
          `cannot resolve a node with !<${state.tag}> explicit tag`,
        );
      } else {
        state.result = type.construct(state.result);
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else {
      return throwError(state, `unknown tag !<${state.tag}>`);
    }
  }

  return state.tag !== null || state.anchor !== null || hasContent;
}

function* readDocument(state: LoaderState) {
  const documentStart = state.position;
  let position: number;
  let directiveName: string;
  let directiveArgs: string[];
  let hasDirectives = false;
  let ch: number;

  state.version = null;
  state.checkLineBreaks = false;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if (state.lineIndent > 0 || ch !== PERCENT) {
      break;
    }

    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    position = state.position;

    while (ch !== 0 && !isWsOrEol(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    directiveName = state.input.slice(position, state.position);
    directiveArgs = [];

    if (directiveName.length < 1) {
      return throwError(
        state,
        "directive name must not be less than one character in length",
      );
    }

    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (ch === SHARP) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !isEOL(ch));
        break;
      }

      if (isEOL(ch)) break;

      position = state.position;

      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      directiveArgs.push(state.input.slice(position, state.position));
    }

    if (ch !== 0) readLineBreak(state);

    switch (directiveName) {
      case "YAML":
        yamlDirectiveHandler(state, ...directiveArgs);
        break;
      case "TAG":
        tagDirectiveHandler(state, ...directiveArgs);
        break;
      default:
        throwWarning(state, `unknown document directive "${directiveName}"`);
        break;
    }
  }

  skipSeparationSpace(state, true, -1);

  if (
    state.lineIndent === 0 &&
    state.input.charCodeAt(state.position) === MINUS &&
    state.input.charCodeAt(state.position + 1) === MINUS &&
    state.input.charCodeAt(state.position + 2) === MINUS
  ) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    return throwError(state, "directives end mark is expected");
  }

  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);

  if (
    state.checkLineBreaks &&
    PATTERN_NON_ASCII_LINE_BREAKS.test(
      state.input.slice(documentStart, state.position),
    )
  ) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }

  yield state.result;

  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === DOT) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }

  if (state.position < state.length - 1) {
    return throwError(
      state,
      "end of the stream or a document separator is expected",
    );
  }
}

function* readDocuments(state: LoaderState) {
  while (state.position < state.length - 1) {
    yield* readDocument(state);
  }
}

function sanitizeInput(input: string) {
  input = String(input);

  if (input.length !== 0) {
    // Add tailing `\n` if not exists
    if (
      input.charCodeAt(input.length - 1) !== LINE_FEED &&
      input.charCodeAt(input.length - 1) !== CARRIAGE_RETURN
    ) {
      input += "\n";
    }

    // Strip BOM
    if (input.charCodeAt(0) === 0xfeff) {
      input = input.slice(1);
    }
  }

  // Use 0 as string terminator. That significantly simplifies bounds check.
  input += "\0";

  return input;
}

export function loadDocuments(
  input: string,
  options: LoaderStateOptions = {},
): unknown[] {
  input = sanitizeInput(input);
  const state = new LoaderState(input, options);
  const documents = [];
  for (const document of readDocuments(state)) {
    documents.push(document);
  }
  return documents;
}

export function load(input: string, options: LoaderStateOptions = {}): unknown {
  input = sanitizeInput(input);
  const state = new LoaderState(input, options);
  const documentGenerator = readDocuments(state);
  const document = documentGenerator.next().value;
  if (!documentGenerator.next().done) {
    throw new YamlError(
      "expected a single document in the stream, but found more",
    );
  }
  return document ?? null;
}
