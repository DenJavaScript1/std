// deno-fmt-ignore-file
// deno-lint-ignore-file

// Copyright Joyent and Node contributors. All rights reserved. MIT license.
// Taken from Node 15.5.1
// This file is automatically generated by "node/_tools/setup.ts". Do not modify this file manually

// TODO(cmorten): enable remaining tests as net module is completed.

// 'use strict';
// const common = require('../common');
// const assert = require('assert');
// const net = require('net');

// function check(addressType, cb) {
//   const server = net.createServer(function(client) {
//     client.end();
//     server.close();
//     cb && cb();
//   });

//   const address = addressType === 4 ? common.localhostIPv4 : '::1';
//   server.listen(0, address, common.mustCall(function() {
//     net.connect({
//       port: this.address().port,
//       host: 'localhost',
//       family: addressType,
//       lookup: lookup
//     }).on('lookup', common.mustCall(function(err, ip, type) {
//       assert.strictEqual(err, null);
//       assert.strictEqual(address, ip);
//       assert.strictEqual(type, addressType);
//     }));
//   }));

//   function lookup(host, dnsopts, cb) {
//     dnsopts.family = addressType;
//     if (addressType === 4) {
//       process.nextTick(function() {
//         cb(null, common.localhostIPv4, 4);
//       });
//     } else {
//       process.nextTick(function() {
//         cb(null, '::1', 6);
//       });
//     }
//   }
// }

// check(4, function() {
//   // common.hasIPv6 && check(6);
//   check(6);
// });

// // Verify that bad lookup() IPs are handled.
// {
//   net.connect({
//     host: 'localhost',
//     port: 80,
//     lookup(host, dnsopts, cb) {
//       cb(null, undefined, 4);
//     }
//   }).on('error', common.expectsError({ code: 'ERR_INVALID_IP_ADDRESS' }));
// }