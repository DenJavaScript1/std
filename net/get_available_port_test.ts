// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

import { getAvailablePort } from "./get_available_port.ts";
import { assert } from "../assert/assert.ts";

Deno.test("getAvailablePort() gets an available port", async () => {
  const port = getAvailablePort();

  const server = Deno.serve({
    port,
    async onListen() {
      const resp = await fetch(`http://localhost:${port}`);
      const text = await resp.text();
      assert(text, "hello");
      server.shutdown();
    },
  }, () => new Response("hello"));

  await server.finished;
});
