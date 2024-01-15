// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { assertEquals } from "../assert/assert_equals.ts";
// import { warnDeprecatedApi } from "./warn_deprecated_api.ts";

Deno.test("warnDeprecatedApi()", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--quiet", "--no-lock", "./tools/testdata/fn.ts"],
  });
  const { success, stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);

  assertEquals(success, true);
  assertEquals(
    output,
    `Warning Use of deprecated API \`fn()\`. This API will be removed in 1.0.0 of the Deno Standard Library. Use \`y\` instead.
Hello, world!
Hello, world!
`,
  );
});
