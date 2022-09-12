// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 18.8.0
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

'use strict';
const common = require('../common');
const { Readable } = require('stream');

const readable = new Readable();

readable.read();
readable.on('error', common.expectsError({
  code: 'ERR_METHOD_NOT_IMPLEMENTED',
  name: 'Error',
  message: 'The _read() method is not implemented'
}));
readable.on('close', common.mustCall());
