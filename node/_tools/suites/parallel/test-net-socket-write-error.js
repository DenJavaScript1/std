// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 15.5.1
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

'use strict';

const common = require('../common');
const net = require('net');
const assert = require('assert');

const server = net.createServer().listen(0, connectToServer);

function connectToServer() {
  const client = net.createConnection(this.address().port, () => {
    client.on('error', common.mustNotCall());
    assert.throws(() => {
      client.write(1337);
    }, {
      code: 'ERR_INVALID_ARG_TYPE',
      name: 'TypeError'
    });

    client.destroy();
  })
  .on('close', () => server.close());
}
