// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import {
  assert,
  assertNotEquals,
  assertStrContains,
  assertArrayContains,
  assertMatch,
  assertEquals,
  assertThrows,
  AssertionError,
  equal,
  fail,
  unimplemented,
  unreachable
} from "./asserts.ts";
import { test } from "./mod.ts";

test(function testingEqual(): void {
  assert(equal("world", "world"));
  assert(!equal("hello", "world"));
  assert(equal(5, 5));
  assert(!equal(5, 6));
  assert(equal(NaN, NaN));
  assert(equal({ hello: "world" }, { hello: "world" }));
  assert(!equal({ world: "hello" }, { hello: "world" }));
  assert(
    equal(
      { hello: "world", hi: { there: "everyone" } },
      { hello: "world", hi: { there: "everyone" } }
    )
  );
  assert(
    !equal(
      { hello: "world", hi: { there: "everyone" } },
      { hello: "world", hi: { there: "everyone else" } }
    )
  );
  assert(equal(/deno/, /deno/));
  assert(!equal(/deno/, /node/));
  assert(equal(new Date(2019, 0, 3), new Date(2019, 0, 3)));
  assert(!equal(new Date(2019, 0, 3), new Date(2019, 1, 3)));
  assert(equal(new Set([1]), new Set([1])));
  assert(!equal(new Set([1]), new Set([2])));
  assert(equal(new Set([1, 2, 3]), new Set([3, 2, 1])));
  assert(!equal(new Set([1, 2]), new Set([3, 2, 1])));
  assert(!equal(new Set([1, 2, 3]), new Set([4, 5, 6])));
  assert(equal(new Set("denosaurus"), new Set("denosaurussss")));
});

test(function testingNotEquals(): void {
  const a = { foo: "bar" };
  const b = { bar: "foo" };
  assertNotEquals(a, b);
  assertNotEquals("Denosaurus", "Tyrannosaurus");
  let didThrow;
  try {
    assertNotEquals("Raptor", "Raptor");
    didThrow = false;
  } catch (e) {
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assertEquals(didThrow, true);
});

test(function testingAssertStringContains(): void {
  assertStrContains("Denosaurus", "saur");
  assertStrContains("Denosaurus", "Deno");
  assertStrContains("Denosaurus", "rus");
  let didThrow;
  try {
    assertStrContains("Denosaurus", "Raptor");
    didThrow = false;
  } catch (e) {
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assertEquals(didThrow, true);
});

test(function testingArrayContains(): void {
  const fixture = ["deno", "iz", "luv"];
  const fixtureObject = [{ deno: "luv" }, { deno: "Js" }];
  assertArrayContains(fixture, ["deno"]);
  assertArrayContains(fixtureObject, [{ deno: "luv" }]);
  let didThrow;
  try {
    assertArrayContains(fixtureObject, [{ deno: "node" }]);
    didThrow = false;
  } catch (e) {
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assertEquals(didThrow, true);
});

test(function testingAssertStringContainsThrow(): void {
  let didThrow = false;
  try {
    assertStrContains("Denosaurus from Jurassic", "Raptor");
  } catch (e) {
    assert(
      e.message ===
        `actual: "Denosaurus from Jurassic" expected to contains: "Raptor"`
    );
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assert(didThrow);
});

test(function testingAssertStringMatching(): void {
  assertMatch("foobar@deno.com", RegExp(/[a-zA-Z]+@[a-zA-Z]+.com/));
});

test(function testingAssertStringMatchingThrows(): void {
  let didThrow = false;
  try {
    assertMatch("Denosaurus from Jurassic", RegExp(/Raptor/));
  } catch (e) {
    assert(
      e.message ===
        `actual: "Denosaurus from Jurassic" expected to match: "/Raptor/"`
    );
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assert(didThrow);
});

test(function testingAssertsUnimplemented(): void {
  let didThrow = false;
  try {
    unimplemented();
  } catch (e) {
    assert(e.message === "unimplemented");
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assert(didThrow);
});

test(function testingAssertsUnreachable(): void {
  let didThrow = false;
  try {
    unreachable();
  } catch (e) {
    assert(e.message === "unreachable");
    assert(e instanceof AssertionError);
    didThrow = true;
  }
  assert(didThrow);
});

test(function testingAssertFail(): void {
  assertThrows(fail, AssertionError, "Failed assertion.");
  assertThrows(
    () => {
      fail("foo");
    },
    AssertionError,
    "Failed assertion: foo"
  );
});
