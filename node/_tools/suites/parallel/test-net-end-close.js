// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 15.5.1
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

// Flags: --expose-internals
'use strict';
require('../common');
const assert = require('assert');
const net = require('net');

const s = new net.Socket({
  handle: {
    readStart: function() {
      setImmediate(() => {
        // Test differs slightly from Node due to change of the onread
        // interface
        this.onread(new Uint8Array(), -4095);
      });
    },
    close: (cb) => setImmediate(cb)
  },
  writable: false
});
assert.strictEqual(s, s.resume());

const events = [];

s.on('end', () => {
  events.push('end');
});
s.on('close', () => {
  events.push('close');
});

process.on('exit', () => {
  assert.deepStrictEqual(events, [ 'end', 'close' ]);
});
