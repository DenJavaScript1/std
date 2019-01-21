// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

/*
 * This is a basic example of a test server which provides a logger middleware,
 * a response time middleware, and a basic "Hello World!" middleware.
 */

// Importing some console colors
import { green, cyan, bold, yellow } from "../../colors/mod.ts";

import { Application } from "../mod.ts";

(async () => {
  const app = new Application();

  // Logger
  app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(
      `${green(ctx.request.method)} ${cyan(ctx.request.url)} - ${bold(
        String(rt)
      )}`
    );
  });

  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
  });

  app.use(ctx => {
    ctx.response.body = "Hello World!";
  });

  const address = "127.0.0.1:8000";
  console.log(bold("Start listening on ") + yellow(address));
  await app.listen(address);
  console.log(bold("Finished."));
})();
