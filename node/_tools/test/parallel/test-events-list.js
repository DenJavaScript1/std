// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 18.12.0
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

'use strict';

require('../common');
const EventEmitter = require('events');
const assert = require('assert');

const EE = new EventEmitter();
const m = () => {};
EE.on('foo', () => {});
assert.deepStrictEqual(['foo'], EE.eventNames());
EE.on('bar', m);
assert.deepStrictEqual(['foo', 'bar'], EE.eventNames());
EE.removeListener('bar', m);
assert.deepStrictEqual(['foo'], EE.eventNames());
const s = Symbol('s');
EE.on(s, m);
assert.deepStrictEqual(['foo', s], EE.eventNames());
EE.removeListener(s, m);
assert.deepStrictEqual(['foo'], EE.eventNames());
