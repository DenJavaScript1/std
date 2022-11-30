// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

// This module provides an interface to `Deno.core`. For environments
// that don't have access to `Deno.core` some APIs are polyfilled, while
// some are unavailble and throw on call.

// deno-lint-ignore no-explicit-any
export let core: any;

// deno-lint-ignore no-explicit-any
const { Deno } = globalThis as any;

// @ts-ignore Deno.core is not defined in types
if (Deno?.core) {
  // @ts-ignore Deno.core is not defined in types
  core = Deno.core;
} else {
  core = {
    runMicrotasks() {
      throw new Error(
        "Deno.core.runMicrotasks() is not supported in this environment",
      );
    },
    setHasTickScheduled() {
      throw new Error(
        "Deno.core.setHasTickScheduled() is not supported in this environment",
      );
    },
    hasTickScheduled() {
      throw new Error(
        "Deno.core.hasTickScheduled() is not supported in this environment",
      );
    },
    setNextTickCallback() {
      throw new Error(
        "Deno.core.setNextTickCallback() is not supported in this environment",
      );
    },
    setMacrotaskCallback() {
      throw new Error(
        "Deno.core.setNextTickCallback() is not supported in this environment",
      );
    },
    evalContext(_code: string, _filename: string) {
      throw new Error(
        "Deno.core.evalContext is not supported in this environment",
      );
    },
    encode(chunk: string): Uint8Array {
      return new TextEncoder().encode(chunk);
    },
    eventLoopHasMoreWork(): boolean {
      return false;
    },
    ops: {
      op_napi_open(_filename: string) {
        throw new Error(
          "Node API is not supported in this environment",
        );
      },
    },
  };
}
