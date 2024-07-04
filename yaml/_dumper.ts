// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import {
  AMPERSAND,
  ASTERISK,
  COLON,
  COMMA,
  COMMERCIAL_AT,
  DOUBLE_QUOTE,
  EXCLAMATION,
  GRAVE_ACCENT,
  GREATER_THAN,
  LEFT_CURLY_BRACKET,
  LEFT_SQUARE_BRACKET,
  LINE_FEED,
  MINUS,
  PERCENT,
  QUESTION,
  RIGHT_CURLY_BRACKET,
  RIGHT_SQUARE_BRACKET,
  SHARP,
  SINGLE_QUOTE,
  SPACE,
  TAB,
  VERTICAL_LINE,
} from "./_chars.ts";
import { YamlError } from "./_error.ts";
import { DEFAULT_SCHEMA, type Schema } from "./_schema.ts";
import type { RepresentFn, StyleVariant, Type } from "./_type.ts";
import * as common from "./_utils.ts";

type Any = common.Any;
type ArrayObject<T = Any> = common.ArrayObject<T>;

const ESCAPE_SEQUENCES = new Map<number, string>([
  [0x00, "\\0"],
  [0x07, "\\a"],
  [0x08, "\\b"],
  [0x09, "\\t"],
  [0x0a, "\\n"],
  [0x0b, "\\v"],
  [0x0c, "\\f"],
  [0x0d, "\\r"],
  [0x1b, "\\e"],
  [0x22, '\\"'],
  [0x5c, "\\\\"],
  [0x85, "\\N"],
  [0xa0, "\\_"],
  [0x2028, "\\L"],
  [0x2029, "\\P"],
]);

const DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF",
];

function compileStyleMap(
  schema: Schema,
  map?: ArrayObject<StyleVariant> | null,
): ArrayObject<StyleVariant> {
  if (typeof map === "undefined" || map === null) return {};

  const result: ArrayObject<StyleVariant> = {};
  for (let tag of Object.keys(map)) {
    let style = String(map[tag]) as StyleVariant;
    if (tag.slice(0, 2) === "!!") {
      tag = `tag:yaml.org,2002:${tag.slice(2)}`;
    }
    const type = schema.compiledTypeMap.fallback[tag];

    if (type?.styleAliases && Object.hasOwn(type.styleAliases, style)) {
      style = type.styleAliases[style];
    }

    result[tag] = style;
  }

  return result;
}

export interface DumperStateOptions {
  /** indentation width to use (in spaces). */
  indent?: number;
  /** when true, adds an indentation level to array elements */
  arrayIndent?: boolean;
  /**
   * do not throw on invalid types (like function in the safe schema)
   * and skip pairs and single values with such types.
   */
  skipInvalid?: boolean;
  /**
   * specifies level of nesting, when to switch from
   * block to flow style for collections. -1 means block style everywhere
   */
  flowLevel?: number;
  /** Each tag may have own set of styles.	- "tag" => "style" map. */
  styles?: ArrayObject<StyleVariant> | null;
  /** specifies a schema to use. */
  schema?: Schema;
  /**
   * If true, sort keys when dumping YAML in ascending, ASCII character order.
   * If a function, use the function to sort the keys. (default: false)
   * If a function is specified, the function must return a negative value
   * if first argument is less than second argument, zero if they're equal
   * and a positive value otherwise.
   */
  sortKeys?: boolean | ((a: string, b: string) => number);
  /** set max line width. (default: 80) */
  lineWidth?: number;
  /**
   * if true, don't convert duplicate objects
   * into references (default: false)
   */
  noRefs?: boolean;
  /**
   * if false don't try to be compatible with older yaml versions.
   * Currently: don't quote "yes", "no" and so on,
   * as required for YAML 1.1 (default: true)
   */
  compatMode?: boolean;
  /**
   * if true flow sequences will be condensed, omitting the
   * space between `key: value` or `a, b`. Eg. `'[a,b]'` or `{a:{b:c}}`.
   * Can be useful when using yaml for pretty URL query params
   * as spaces are %-encoded. (default: false).
   */
  condenseFlow?: boolean;
}

export class DumperState {
  schema: Schema;
  indent: number;
  arrayIndent: boolean;
  skipInvalid: boolean;
  flowLevel: number;
  sortKeys: boolean | ((a: Any, b: Any) => number);
  lineWidth: number;
  noRefs: boolean;
  compatMode: boolean;
  condenseFlow: boolean;
  implicitTypes: Type[];
  explicitTypes: Type[];
  tag: string | null = null;
  result = "";
  duplicates: Any[] = [];
  usedDuplicates: Any[] = []; // changed from null to []
  styleMap: ArrayObject<StyleVariant>;
  dump: Any;

  constructor({
    schema = DEFAULT_SCHEMA,
    indent = 2,
    arrayIndent = true,
    skipInvalid = false,
    flowLevel = -1,
    styles = null,
    sortKeys = false,
    lineWidth = 80,
    noRefs = false,
    compatMode = true,
    condenseFlow = false,
  }: DumperStateOptions) {
    this.schema = schema;
    this.indent = Math.max(1, indent);
    this.arrayIndent = arrayIndent;
    this.skipInvalid = skipInvalid;
    this.flowLevel = flowLevel;
    this.styleMap = compileStyleMap(this.schema, styles);
    this.sortKeys = sortKeys;
    this.lineWidth = lineWidth;
    this.noRefs = noRefs;
    this.compatMode = compatMode;
    this.condenseFlow = condenseFlow;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
  }
}

function encodeHex(character: number): string {
  const string = character.toString(16).toUpperCase();

  let handle: string;
  let length: number;
  if (character <= 0xff) {
    handle = "x";
    length = 2;
  } else if (character <= 0xffff) {
    handle = "u";
    length = 4;
  } else if (character <= 0xffffffff) {
    handle = "U";
    length = 8;
  } else {
    throw new YamlError(
      "code point within a string may not be greater than 0xFFFFFFFF",
    );
  }

  return `\\${handle + "0".repeat(length - string.length) + string}`;
}

// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString(string: string, spaces: number): string {
  const ind = common.repeat(" ", spaces);
  const length = string.length;
  let position = 0;
  let next = -1;
  let result = "";
  let line: string;

  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }

    if (line.length && line !== "\n") result += ind;

    result += line;
  }

  return result;
}

function generateNextLine(state: DumperState, level: number): string {
  return `\n${common.repeat(" ", state.indent * level)}`;
}

function testImplicitResolving(state: DumperState, str: string): boolean {
  return state.implicitTypes.some((type) => type.resolve(str));
}

// [33] s-white ::= s-space | s-tab
function isWhitespace(c: number): boolean {
  return c === SPACE || c === TAB;
}

// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable(c: number): boolean {
  return (
    (0x00020 <= c && c <= 0x00007e) ||
    (0x000a1 <= c && c <= 0x00d7ff && c !== 0x2028 && c !== 0x2029) ||
    (0x0e000 <= c && c <= 0x00fffd && c !== 0xfeff) /* BOM */ ||
    (0x10000 <= c && c <= 0x10ffff)
  );
}

// Simplified test for values allowed after the first character in plain style.
function isPlainSafe(c: number): boolean {
  // Uses a subset of nb-char - c-flow-indicator - ":" - "#"
  // where nb-char ::= c-printable - b-char - c-byte-order-mark.
  return (
    isPrintable(c) &&
    c !== 0xfeff &&
    // - c-flow-indicator
    c !== COMMA &&
    c !== LEFT_SQUARE_BRACKET &&
    c !== RIGHT_SQUARE_BRACKET &&
    c !== LEFT_CURLY_BRACKET &&
    c !== RIGHT_CURLY_BRACKET &&
    // - ":" - "#"
    c !== COLON &&
    c !== SHARP
  );
}

// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst(c: number): boolean {
  // Uses a subset of ns-char - c-indicator
  // where ns-char = nb-char - s-white.
  return (
    isPrintable(c) &&
    c !== 0xfeff &&
    !isWhitespace(c) && // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    c !== MINUS &&
    c !== QUESTION &&
    c !== COLON &&
    c !== COMMA &&
    c !== LEFT_SQUARE_BRACKET &&
    c !== RIGHT_SQUARE_BRACKET &&
    c !== LEFT_CURLY_BRACKET &&
    c !== RIGHT_CURLY_BRACKET &&
    // | “#” | “&” | “*” | “!” | “|” | “>” | “'” | “"”
    c !== SHARP &&
    c !== AMPERSAND &&
    c !== ASTERISK &&
    c !== EXCLAMATION &&
    c !== VERTICAL_LINE &&
    c !== GREATER_THAN &&
    c !== SINGLE_QUOTE &&
    c !== DOUBLE_QUOTE &&
    // | “%” | “@” | “`”)
    c !== PERCENT &&
    c !== COMMERCIAL_AT &&
    c !== GRAVE_ACCENT
  );
}

// Determines whether block indentation indicator is required.
function needIndentIndicator(string: string): boolean {
  const leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}

const STYLE_PLAIN = 1;
const STYLE_SINGLE = 2;
const STYLE_LITERAL = 3;
const STYLE_FOLDED = 4;
const STYLE_DOUBLE = 5;

// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//  STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//  STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//  STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth !== -1).
function chooseScalarStyle(
  string: string,
  singleLineOnly: boolean,
  indentPerLevel: number,
  lineWidth: number,
  testAmbiguousType: (...args: Any[]) => Any,
): number {
  const shouldTrackWidth = lineWidth !== -1;
  let hasLineBreak = false;
  let hasFoldableLine = false; // only checked if shouldTrackWidth
  let previousLineBreak = -1; // count the first line correctly
  let plain = isPlainSafeFirst(string.charCodeAt(0)) &&
    !isWhitespace(string.charCodeAt(string.length - 1));

  let char: number;
  let i: number;
  if (singleLineOnly) {
    // Case: no block styles.
    // Check for disallowed characters to rule out plain and single.
    for (i = 0; i < string.length; i++) {
      char = string.charCodeAt(i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char);
    }
  } else {
    // Case: block styles permitted.
    for (i = 0; i < string.length; i++) {
      char = string.charCodeAt(i);
      if (char === LINE_FEED) {
        hasLineBreak = true;
        // Check if any line can be folded.
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine ||
            // Foldable line = too long, and not more-indented.
            (i - previousLineBreak - 1 > lineWidth &&
              string[previousLineBreak + 1] !== " ");
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char);
    }
    // in case the end is missing a \n
    hasFoldableLine = hasFoldableLine ||
      (shouldTrackWidth &&
        i - previousLineBreak - 1 > lineWidth &&
        string[previousLineBreak + 1] !== " ");
  }
  // Although every style can represent \n without escaping, prefer block styles
  // for multiline, since they're more readable and they don't add empty lines.
  // Also prefer folding a super-long line.
  if (!hasLineBreak && !hasFoldableLine) {
    // Strings interpretable as another type have to be quoted;
    // e.g. the string 'true' vs. the boolean true.
    return plain && !testAmbiguousType(string) ? STYLE_PLAIN : STYLE_SINGLE;
  }
  // Edge case: block indentation indicator can only have one digit.
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  // At this point we know block styles are valid.
  // Prefer literal style unless we want to fold.
  return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
}

// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine(line: string, width: number): string {
  if (line === "" || line[0] === " ") return line;

  // Since a more-indented line adds a \n, breaks can't be followed by a space.
  const breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
  let match;
  // start is an inclusive index. end, curr, and next are exclusive.
  let start = 0;
  let end;
  let curr = 0;
  let next = 0;
  let result = "";

  // Invariants: 0 <= start <= length-1.
  //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
  // Inside the loop:
  //   A match implies length >= 2, so curr and next are <= length-2.
  // tslint:disable-next-line:no-conditional-assignment
  while ((match = breakRe.exec(line))) {
    next = match.index;
    // maintain invariant: curr - start <= width
    if (next - start > width) {
      end = curr > start ? curr : next; // derive end <= length-2
      result += `\n${line.slice(start, end)}`;
      // skip the space that was output as \n
      start = end + 1; // derive start <= length-1
    }
    curr = next;
  }

  // By the invariants, start <= length-1, so there is something left over.
  // It is either the whole string or a part starting from non-whitespace.
  result += "\n";
  // Insert a break if the remainder is too long and there is a break available.
  if (line.length - start > width && curr > start) {
    result += `${line.slice(start, curr)}\n${line.slice(curr + 1)}`;
  } else {
    result += line.slice(start);
  }

  return result.slice(1); // drop extra \n joiner
}

// (See the note for writeScalar.)
function dropEndingNewline(string: string): string {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}

// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString(string: string, width: number): string {
  // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
  // unless they're before or after a more-indented line, or at the very
  // beginning or end, in which case $k$ maps to $k$.
  // Therefore, parse each chunk as newline(s) followed by a content line.
  const lineRe = /(\n+)([^\n]*)/g;

  // first line (possibly an empty line)
  let result = ((): string => {
    let nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  })();
  // If we haven't reached the first content line yet, don't add an extra \n.
  let prevMoreIndented = string[0] === "\n" || string[0] === " ";
  let moreIndented;

  // rest of the lines
  let match;
  // tslint:disable-next-line:no-conditional-assignment
  while ((match = lineRe.exec(string))) {
    const prefix = match[1];
    const line = match[2] || "";
    moreIndented = line[0] === " ";
    result += prefix +
      (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") +
      foldLine(line, width);
    prevMoreIndented = moreIndented;
  }

  return result;
}

// Escapes a double-quoted string.
function escapeString(string: string): string {
  let result = "";
  let char;
  let nextChar;
  let escapeSeq;

  for (let i = 0; i < string.length; i++) {
    char = string.charCodeAt(i);
    // Check for surrogate pairs (reference Unicode 3.0 section "3.7 Surrogates").
    if (char >= 0xd800 && char <= 0xdbff /* high surrogate */) {
      nextChar = string.charCodeAt(i + 1);
      if (nextChar >= 0xdc00 && nextChar <= 0xdfff /* low surrogate */) {
        // Combine the surrogate pair and store it escaped.
        result += encodeHex(
          (char - 0xd800) * 0x400 + nextChar - 0xdc00 + 0x10000,
        );
        // Advance index one extra since we already used that char here.
        i++;
        continue;
      }
    }
    escapeSeq = ESCAPE_SEQUENCES.get(char);
    result += !escapeSeq && isPrintable(char)
      ? string[i]
      : escapeSeq || encodeHex(char);
  }

  return result;
}

// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader(string: string, indentPerLevel: number): string {
  const indentIndicator = needIndentIndicator(string)
    ? String(indentPerLevel)
    : "";

  // note the special case: the string '\n' counts as a "trailing" empty line.
  const clip = string[string.length - 1] === "\n";
  const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  const chomp = keep ? "+" : clip ? "" : "-";

  return `${indentIndicator}${chomp}\n`;
}

// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar(
  state: DumperState,
  string: string,
  level: number,
  iskey: boolean,
) {
  state.dump = ((): string => {
    if (string.length === 0) {
      return "''";
    }
    if (
      state.compatMode &&
      DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1
    ) {
      return `'${string}'`;
    }

    const indent = state.indent * Math.max(1, level); // no 0-indent scalars
    // As indentation gets deeper, let the width decrease monotonically
    // to the lower bound min(state.lineWidth, 40).
    // Note that this implies
    //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
    //  state.lineWidth > 40 + state.indent: width decreases until the lower
    //  bound.
    // This behaves better than a constant minimum width which disallows
    // narrower options, or an indent threshold which causes the width
    // to suddenly increase.
    const lineWidth = state.lineWidth === -1
      ? -1
      : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

    // Without knowing if keys are implicit/explicit,
    // assume implicit for safety.
    const singleLineOnly = iskey ||
      // No block styles in flow mode.
      (state.flowLevel > -1 && level >= state.flowLevel);
    function testAmbiguity(str: string): boolean {
      return testImplicitResolving(state, str);
    }

    switch (
      chooseScalarStyle(
        string,
        singleLineOnly,
        state.indent,
        lineWidth,
        testAmbiguity,
      )
    ) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return `'${string.replace(/'/g, "''")}'`;
      case STYLE_LITERAL:
        return `|${blockHeader(string, state.indent)}${
          dropEndingNewline(
            indentString(string, indent),
          )
        }`;
      case STYLE_FOLDED:
        return `>${blockHeader(string, state.indent)}${
          dropEndingNewline(
            indentString(foldString(string, lineWidth), indent),
          )
        }`;
      case STYLE_DOUBLE:
        return `"${escapeString(string)}"`;
      default:
        throw new YamlError("impossible error: invalid scalar style");
    }
  })();
}

function writeFlowSequence(
  state: DumperState,
  level: number,
  object: Any,
) {
  let _result = "";
  const _tag = state.tag;

  for (let index = 0; index < object.length; index += 1) {
    // Write only valid elements.
    if (writeNode(state, level, object[index], false, false)) {
      if (index !== 0) _result += `,${!state.condenseFlow ? " " : ""}`;
      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = `[${_result}]`;
}

function writeBlockSequence(
  state: DumperState,
  level: number,
  object: Any,
  compact = false,
) {
  let _result = "";
  const _tag = state.tag;

  for (let index = 0; index < object.length; index += 1) {
    // Write only valid elements.
    if (writeNode(state, level + 1, object[index], true, true)) {
      if (!compact || index !== 0) {
        _result += generateNextLine(state, level);
      }

      if (state.dump && LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }

      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = _result || "[]"; // Empty sequence if no valid values.
}

function writeFlowMapping(
  state: DumperState,
  level: number,
  object: Any,
) {
  let _result = "";
  const _tag = state.tag;
  const objectKeyList = Object.keys(object);

  for (const [index, objectKey] of objectKeyList.entries()) {
    let pairBuffer = state.condenseFlow ? '"' : "";

    if (index !== 0) pairBuffer += ", ";

    const objectValue = object[objectKey];

    if (!writeNode(state, level, objectKey, false, false)) {
      continue; // Skip this pair because of invalid key;
    }

    if (state.dump.length > 1024) pairBuffer += "? ";

    pairBuffer += `${state.dump}${state.condenseFlow ? '"' : ""}:${
      state.condenseFlow ? "" : " "
    }`;

    if (!writeNode(state, level, objectValue, false, false)) {
      continue; // Skip this pair because of invalid value.
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = `{${_result}}`;
}

function writeBlockMapping(
  state: DumperState,
  level: number,
  object: Any,
  compact = false,
) {
  const _tag = state.tag;
  const objectKeyList = Object.keys(object);
  let _result = "";

  // Allow sorting keys so that the output file is deterministic
  if (state.sortKeys === true) {
    // Default sorting
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    // Custom sort function
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    // Something is wrong
    throw new YamlError("sortKeys must be a boolean or a function");
  }

  for (const [index, objectKey] of objectKeyList.entries()) {
    let pairBuffer = "";

    if (!compact || index !== 0) {
      pairBuffer += generateNextLine(state, level);
    }

    const objectValue = object[objectKey];

    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue; // Skip this pair because of invalid key.
    }

    const explicitPair = (state.tag !== null && state.tag !== "?") ||
      (state.dump && state.dump.length > 1024);

    if (explicitPair) {
      if (state.dump && LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }

    pairBuffer += state.dump;

    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }

    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue; // Skip this pair because of invalid value.
    }

    if (state.dump && LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = _result || "{}"; // Empty mapping if no valid pairs.
}

function detectType(
  state: DumperState,
  object: Any,
  explicit = false,
): boolean {
  const typeList = explicit ? state.explicitTypes : state.implicitTypes;

  for (const type of typeList) {
    let _result: string;

    if (
      (type.instanceOf || type.predicate) &&
      (!type.instanceOf ||
        (typeof object === "object" && object instanceof type.instanceOf)) &&
      (!type.predicate || type.predicate(object))
    ) {
      state.tag = explicit ? type.tag : "?";

      if (type.represent) {
        const style = state.styleMap[type.tag]! || type.defaultStyle;

        if (typeof type.represent === "function") {
          _result = (type.represent as RepresentFn)(object, style);
        } else if (Object.hasOwn(type.represent, style)) {
          _result = (type.represent as ArrayObject<RepresentFn>)[style]!(
            object,
            style,
          );
        } else {
          throw new YamlError(
            `!<${type.tag}> tag resolver accepts not "${style}" style`,
          );
        }

        state.dump = _result;
      }

      return true;
    }
  }

  return false;
}

// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode(
  state: DumperState,
  level: number,
  object: Any,
  block: boolean,
  compact: boolean,
  iskey = false,
): boolean {
  state.tag = null;
  state.dump = object;

  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }

  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }

  const objectOrArray = common.isObject(state.dump) ||
    Array.isArray(state.dump);

  let duplicateIndex = -1;
  let duplicate = false;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }

  if (
    (state.tag !== null && state.tag !== "?") ||
    duplicate ||
    (state.indent !== 2 && level > 0)
  ) {
    compact = false;
  }

  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = `*ref_${duplicateIndex}`;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (common.isObject(state.dump) && !Array.isArray(state.dump)) {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = `&ref_${duplicateIndex}${state.dump}`;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = `&ref_${duplicateIndex} ${state.dump}`;
        }
      }
    } else if (Array.isArray(state.dump)) {
      const arrayLevel = !state.arrayIndent && level > 0 ? level - 1 : level;
      if (block && state.dump.length !== 0) {
        writeBlockSequence(state, arrayLevel, state.dump, compact);
        if (duplicate) {
          state.dump = `&ref_${duplicateIndex}${state.dump}`;
        }
      } else {
        writeFlowSequence(state, arrayLevel, state.dump);
        if (duplicate) {
          state.dump = `&ref_${duplicateIndex} ${state.dump}`;
        }
      }
    } else if (typeof state.dump === "string") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey);
      }
    } else {
      if (state.skipInvalid) return false;
      throw new YamlError(
        `unacceptable kind of an object to dump ${
          Object.prototype.toString.call(state.dump)
        }`,
      );
    }

    if (state.tag !== null && state.tag !== "?") {
      state.dump = `!<${state.tag}> ${state.dump}`;
    }
  }

  return true;
}

function inspectNode(
  object: Any,
  objects: Any[],
  duplicatesIndexes: number[],
) {
  if (object !== null && typeof object === "object") {
    const index = objects.indexOf(object);
    if (index !== -1) {
      if (!duplicatesIndexes.includes(index)) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);

      if (Array.isArray(object)) {
        for (let idx = 0; idx < object.length; idx += 1) {
          inspectNode(object[idx], objects, duplicatesIndexes);
        }
      } else {
        for (const objectKey of Object.keys(object)) {
          inspectNode(object[objectKey], objects, duplicatesIndexes);
        }
      }
    }
  }
}

function getDuplicateReferences(
  object: Record<string, unknown>,
  state: DumperState,
) {
  const objects: Any[] = [];
  const duplicatesIndexes: number[] = [];

  inspectNode(object, objects, duplicatesIndexes);

  for (const idx of duplicatesIndexes) {
    state.duplicates.push(objects[idx]);
  }
  state.usedDuplicates = Array.from({ length: duplicatesIndexes.length });
}

export function dump(input: Any, options: DumperStateOptions = {}): string {
  const state = new DumperState(options);

  if (!state.noRefs) getDuplicateReferences(input, state);

  if (writeNode(state, 0, input, true, true)) return `${state.dump}\n`;

  return "";
}
