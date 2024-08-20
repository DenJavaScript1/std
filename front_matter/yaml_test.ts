// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

import { test } from "./test.ts";
import { extract } from "./yaml.ts";
import {
  runExtractTypeErrorTests,
  runExtractYamlTests1,
  runExtractYamlTests2,
  runTestInvalidInputTests,
  runTestValidInputTests,
} from "./_test_utils.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test("yaml() tests valid input true", () => {
  runTestValidInputTests("yaml", test);
});

Deno.test("yaml() tests invalid input false", () => {
  runTestInvalidInputTests("yaml", test);
});

Deno.test("yaml() extracts type error on invalid input", () => {
  runExtractTypeErrorTests("yaml", extract);
});

Deno.test("yaml() parses yaml delineate by `---`", async () => {
  await runExtractYamlTests1(extract);
});

Deno.test("yaml() parses yaml delineate by `---yaml`", async () => {
  await runExtractYamlTests2(extract);
});

Deno.test("extractYaml() allows whitespaces after the header", () => {
  assertEquals(extract("---  \nfoo: 0\n---\n").attrs, { foo: 0 });
  assertEquals(extract("---yaml  \nfoo: 0\n--- \n").attrs, { foo: 0 });
  assertEquals(extract("= yaml =  \nfoo: 0\n---\n").attrs, { foo: 0 });
});
