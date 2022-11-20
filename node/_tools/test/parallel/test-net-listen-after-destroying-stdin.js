// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 18.12.0
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

'use strict';
// Just test that destroying stdin doesn't mess up listening on a server.
// This is a regression test for
// https://github.com/nodejs/node-v0.x-archive/issues/746.

const common = require('../common');
const net = require('net');

process.stdin.destroy();

const server = net.createServer(common.mustCall((socket) => {
  console.log('accepted...');
  socket.end(common.mustCall(() => { console.log('finished...'); }));
  server.close(common.mustCall(() => { console.log('closed'); }));
}));


server.listen(0, common.mustCall(() => {
  console.log('listening...');

  net.createConnection(server.address().port);
}));
