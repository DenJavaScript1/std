// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 16.13.0
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

'use strict';
const common = require('../common');
const http = require('http');

const server = http.createServer((req, res) => res.flushHeaders());

server.listen(common.mustCall(() => {
  const req =
    http.get({ port: server.address().port }, common.mustCall((res) => {
      res.on('timeout', common.mustCall(() => req.destroy()));
      res.setTimeout(1);
      server.close();
    }));
}));
