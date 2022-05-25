#!/usr/bin/env -S deno run --allow-all
// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

import * as base64 from "../../encoding/base64.ts";

const home = Deno.env.get("HOME");
const root = new URL(".", import.meta.url).pathname;

if (new URL(import.meta.url).protocol === "file:") {
  // Run in the same directory as this script is located.
  Deno.chdir(root);
} else {
  console.error("build.ts can only be run locally (from a file: URL).");
  Deno.exit(1);
}

// 1. Build WASM from Rust.
const { status: cargoStatus } = await Deno.spawn("cargo", {
  args: [
    "build",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
  ],
  env: {
    // eliminate some potential sources of non-determinism
    SOURCE_DATE_EPOCH: "1600000000",
    TZ: "UTC",
    LC_ALL: "C",
    RUSTFLAGS: `--remap-path-prefix=${root}=. --remap-path-prefix=${home}=~`,
  },
  stdout: "inherit",
  stderr: "inherit",
});

if (!cargoStatus.success) {
  console.error(`Failed to build wasm: ${cargoStatus.code}`);
  Deno.exit(1);
}

// 2. Generated JavaScript bindings for WASM.
const { status: bindgenStatus } = await Deno.spawn("wasm-bindgen", {
  args: [
    "./target/wasm32-unknown-unknown/release/deno_hash.wasm",
    "--target",
    "deno",
    "--weak-refs",
    "--out-dir",
    "./out/",
  ],
  stdout: "inherit",
  stderr: "inherit",
});

if (!bindgenStatus.success) {
  console.error(`Failed to generated wasm bindings: ${bindgenStatus.code}`);
  Deno.exit(1);
}

const generatedScript = await Deno.readTextFile("./out/deno_hash.js");
const generatedWasm = await Deno.readFile("./out/deno_hash_bg.wasm");

// Replace the lines loading the WASM from an external file with our inlined
// copy, to avoid the need for net or read permissions.
const inlinedScript = `\
  // deno-lint-ignore-file
  import * as base64 from "../../encoding/base64.ts"; ${
  generatedScript.replace(
    /^const file =.*?;\nconst wasmFile =.*?;\nconst wasmModule =.*?;\n/sm,
    `
      const wasmModule = new WebAssembly.Module(base64.decode("${
      base64.encode(generatedWasm).replace(/.{78}/g, "$&\\\n")
    }"));`,
  )
}

  // only exposed for testing
  export const _wasm = wasm;
`;

await Deno.writeFile("wasm.js", new TextEncoder().encode(inlinedScript));

// 4. Format generated code.
const { status: fmtStatus } = await Deno.spawn("deno", {
  args: ["fmt", "wasm.js"],
  stdout: "inherit",
  stderr: "inherit",
});

if (!fmtStatus.success) {
  console.error(`Failed to format generated code: ${fmtStatus.code}`);
  Deno.exit(1);
}
