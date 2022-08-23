// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { assertEquals } from "../testing/asserts.ts";
import { detect, EOL, format } from "./eol.ts";

const CRLFinput = "deno\r\nis not\r\nnode";
const Mixedinput = "deno\nis not\r\nnode";
const Mixedinput2 = "deno\r\nis not\nnode";
const LFinput = "deno\nis not\nnode";
const NoNLinput = "deno is not node";

Deno.test({
  name: "Detect CR LF",
  fn(): void {
    assertEquals(detect(CRLFinput), EOL.CRLF);
  },
});

Deno.test({
  name: "Detect LF",
  fn(): void {
    assertEquals(detect(LFinput), EOL.LF);
  },
});

Deno.test({
  name: "Detect No New Line",
  fn(): void {
    assertEquals(detect(NoNLinput), null);
  },
});

Deno.test({
  name: "Detect Mixed",
  fn(): void {
    assertEquals(detect(Mixedinput), EOL.CRLF);
    assertEquals(detect(Mixedinput2), EOL.CRLF);
  },
});

Deno.test({
  name: "Format",
  fn(): void {
    assertEquals(format(CRLFinput, EOL.LF), LFinput);
    assertEquals(format(LFinput, EOL.LF), LFinput);
    assertEquals(format(LFinput, EOL.CRLF), CRLFinput);
    assertEquals(format(CRLFinput, EOL.CRLF), CRLFinput);
    assertEquals(format(CRLFinput, EOL.CRLF), CRLFinput);
    assertEquals(format(NoNLinput, EOL.CRLF), NoNLinput);
    assertEquals(format(Mixedinput, EOL.CRLF), CRLFinput);
    assertEquals(format(Mixedinput, EOL.LF), LFinput);
    assertEquals(format(Mixedinput2, EOL.CRLF), CRLFinput);
    assertEquals(format(Mixedinput2, EOL.LF), LFinput);
  },
});
