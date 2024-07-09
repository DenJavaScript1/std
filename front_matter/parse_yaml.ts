// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { createExtractor, type Parser } from "./_create_extractor.ts";
import { parse } from "../yaml/parse.ts";
import type { Extractor } from "./_types.ts";

export const parseYaml: Extractor = createExtractor({
  ["yaml"]: parse as Parser,
});