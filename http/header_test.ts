// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { HEADER } from "./header.ts";
import { assertEquals } from "@std/assert";

Deno.test({
  name: "HEADER",
  fn() {
    // just spot check a few common codes
    assertEquals(HEADER.Accept, "Accept");
    assertEquals(HEADER.AIm, "A-IM");
    assertEquals(HEADER.ClientCertChain, "Client-Cert-Chain");
    assertEquals(HEADER.Connection, "Connection");
    assertEquals(HEADER.Origin, "Origin");
    assertEquals(HEADER.Referer, "Referer");
  },
});
