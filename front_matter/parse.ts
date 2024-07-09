// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { createExtractor, type Parser } from "./_create_extractor.ts";
import type { Extractor } from "./_types.ts";
import { parse as parseYAML } from "../yaml/parse.ts";
import { parse as parseTOML } from "../toml/parse.ts";

export const parse: Extractor = createExtractor({
  yaml: parseYAML as Parser,
  toml: parseTOML as Parser,
  json: JSON.parse as Parser,
});
