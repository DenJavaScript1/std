// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
const response = await fetch(
  "https://raw.githubusercontent.com/jshttp/mime-db/master/db.json",
);

const db = await response.text();
const result =
  `// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
// deno-fmt-ignore-file

export default ${db.slice(0, -1)} as const;`;
await Deno.writeTextFile(new URL("./db.ts", import.meta.url), result);
