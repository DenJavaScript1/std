// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { listenAndServe } from "../http/server.ts";
import { assertStrictEquals } from "../testing/asserts.ts";
import { dirname, fromFileUrl } from "../path/mod.ts";

const moduleDir = dirname(fromFileUrl(import.meta.url));

Deno.test({
  name: "[examples/curl] send a request to a specified url",
  fn: async () => {
    const abortController = new AbortController();
    const serverPromise = listenAndServe(
      { port: 8081 },
      () => new Response("Hello world"),
      { signal: abortController.signal },
    );
    const decoder = new TextDecoder();
    const { stdout } = await Deno.spawn(Deno.execPath(), {
      args: [
        "run",
        "--quiet",
        "--allow-net",
        "curl.ts",
        "http://localhost:8081",
      ],
      cwd: moduleDir,
    });

    try {
      const actual = decoder.decode(stdout).trim();
      const expected = "Hello world";

      assertStrictEquals(actual, expected);
    } finally {
      abortController.abort();
      await serverPromise;
    }
  },
});
