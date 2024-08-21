// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
import { TtlCache } from "./ttl_cache.ts";
import { assertEquals } from "@std/assert";
import { FakeTime } from "@std/testing/time";

const UNSET = Symbol("UNSET");

function assertEntries<K extends unknown, V extends unknown>(
  cache: TtlCache<K, V>,
  entries: [key: K, value: V | typeof UNSET][],
) {
  const filteredEntries = entries.filter(([, value]) => value !== UNSET);
  const filteredKeys = filteredEntries.map(([key]) => key);
  const filteredValues = filteredEntries.map(([, value]) => value);

  assertEquals(cache.size, filteredEntries.length);

  assertEquals([...cache.entries()], filteredEntries);
  assertEquals([...cache.keys()], filteredKeys);
  assertEquals([...cache.values()], filteredValues);

  for (const [key, value] of entries) {
    assertEquals(cache.has(key), value !== UNSET);
    assertEquals(cache.get(key), value === UNSET ? undefined : value);
  }
}

Deno.test("TtlCache deletes entries after they expire", async (t) => {
  await t.step("default TTL (passed in constructor)", () => {
    using time = new FakeTime(0);

    const cache = new TtlCache<number, string>(10);

    cache.set(1, "one");
    cache.set(2, "two");

    time.now = 1;
    assertEntries(cache, [[1, "one"], [2, "two"]]);

    time.now = 5;
    assertEntries(cache, [[1, "one"], [2, "two"]]);
    // setting again resets TTL countdown for key 1
    cache.set(1, "one");

    time.now = 10;
    assertEntries(cache, [[1, "one"], [2, UNSET]]);

    time.now = 15;
    assertEntries(cache, [[1, UNSET], [2, UNSET]]);
  });

  await t.step("custom TTL (passed in `set`)", () => {
    using time = new FakeTime(0);

    const cache = new TtlCache<number, string>(10);

    cache.set(1, "one");
    cache.set(2, "two", 3);

    time.now = 1;
    assertEntries(cache, [[1, "one"], [2, "two"]]);

    time.now = 3;
    assertEntries(cache, [[1, "one"], [2, UNSET]]);

    time.now = 10;
    assertEntries(cache, [[1, UNSET], [2, UNSET]]);
  });
});
