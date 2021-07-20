// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { assertEquals, assertThrowsAsync } from "../testing/asserts.ts";
import { deferred } from "./deferred.ts";

Deno.test("[async] deferred: resolve", async function () {
  const d = deferred<string>();
  assertEquals(d.status, "pending");
  d.resolve("🦕");
  assertEquals(await d, "🦕");
  assertEquals(d.status, "fulfilled");
});

Deno.test("[async] deferred: reject", async function () {
  const d = deferred<number>();
  assertEquals(d.status, "pending");
  d.reject(new Error("A deno error 🦕"));
  await assertThrowsAsync(async () => {
    await d;
  });
  assertEquals(d.status, "rejected");
});
