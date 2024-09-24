// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

import { isEOL } from "./_chars.ts";
import { LoaderState } from "./_loader_state.ts";
import {
  addExplicitTypeToSchema,
  SCHEMA_MAP,
  type SchemaType,
} from "./_schema.ts";
import type { KindType } from "./_type.ts";

export type { KindType };

/** The custom type definition for parsing */
export type Type = {
  /** The tag of the type */
  tag: string;
  /** The kind of the type. */
  kind: KindType;
  /** The function to create a value of this type from the given YAML text. */
  // deno-lint-ignore no-explicit-any
  construct: (data: any) => unknown;
};

/** Options for {@linkcode parse}. */
export interface ParseOptions {
  /**
   * Name of the schema to use.
   *
   * @default {"default"}
   */
  schema?: SchemaType;
  /**
   * If `true`, duplicate keys will overwrite previous values. Otherwise,
   * duplicate keys will throw a {@linkcode SyntaxError}.
   *
   * @default {false}
   */
  allowDuplicateKeys?: boolean;
  /**
   * If defined, a function to call on warning messages taking an
   * {@linkcode Error} as its only argument.
   */
  onWarning?(error: Error): void;
  /** The custom types to use */
  types?: Type[];
}

function sanitizeInput(input: string) {
  input = String(input);

  if (input.length > 0) {
    // Add trailing `\n` if not exists
    if (!isEOL(input.charCodeAt(input.length - 1))) input += "\n";

    // Strip BOM
    if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);
  }

  // Use 0 as string terminator. That significantly simplifies bounds check.
  input += "\0";

  return input;
}

/**
 * Parse and return a YAML string as a parsed YAML document object.
 *
 * Note: This does not support functions. Untrusted data is safe to parse.
 *
 * @example Usage
 * ```ts
 * import { parse } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert";
 *
 * const data = parse(`
 * id: 1
 * name: Alice
 * `);
 *
 * assertEquals(data, { id: 1, name: "Alice" });
 * ```
 *
 * @throws {SyntaxError} Throws error on invalid YAML.
 * @param content YAML string to parse.
 * @param options Parsing options.
 * @returns Parsed document.
 */
export function parse(
  content: string,
  options: ParseOptions = {},
): unknown {
  content = sanitizeInput(content);
  const schema = SCHEMA_MAP.get(options.schema!) ?? SCHEMA_MAP.get("default")!;
  if (options.types) {
    for (const type of options.types) {
      addExplicitTypeToSchema(schema, { ...type, resolve: () => true });
    }
  }
  const state = new LoaderState(content, { ...options, schema });
  const documentGenerator = state.readDocuments();
  const document = documentGenerator.next().value;
  if (!documentGenerator.next().done) {
    throw new SyntaxError(
      "Found more than 1 document in the stream: expected a single document",
    );
  }
  return document ?? null;
}

/**
 * Same as {@linkcode parse}, but understands multi-document YAML sources, and
 * returns multiple parsed YAML document objects.
 *
 * @example Usage
 * ```ts
 * import { parseAll } from "@std/yaml/parse";
 * import { assertEquals } from "@std/assert";
 *
 * const data = parseAll(`
 * ---
 * id: 1
 * name: Alice
 * ---
 * id: 2
 * name: Bob
 * ---
 * id: 3
 * name: Eve
 * `);
 * assertEquals(data, [ { id: 1, name: "Alice" }, { id: 2, name: "Bob" }, { id: 3, name: "Eve" }]);
 * ```
 *
 * @param content YAML string to parse.
 * @param options Parsing options.
 * @returns Array of parsed documents.
 */
export function parseAll(content: string, options: ParseOptions = {}): unknown {
  content = sanitizeInput(content);
  const schema = SCHEMA_MAP.get(options.schema!) ?? SCHEMA_MAP.get("default")!;
  if (options.types) {
    for (const type of options.types) {
      addExplicitTypeToSchema(schema, { ...type, resolve: () => true });
    }
  }
  const state = new LoaderState(content, { ...options, schema });
  return [...state.readDocuments()];
}
