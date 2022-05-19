// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { join } from "../../path/mod.ts";

/**
 * The test suite matches the folders inside the `test` folder inside the
 * node repo
 *
 * Each test suite contains a list of files (which can be paths
 * or a regex to match) that will be pulled from the node repo
 */
type TestSuites = Record<string, string[]>;

interface Config {
  nodeVersion: string;
  /** Ignored files won't regenerated by the update script */
  ignore: TestSuites;
  /**
   * The files that will be run by the test suite
   *
   * The files to be generated with the update script must be listed here as well,
   * but they won't be regenerated if they are listed in the `ignore` configuration
   */
  tests: TestSuites;
  windowsIgnore: TestSuites;
  suitesFolder: string;
  versionsFolder: string;
}

export const config: Config = JSON.parse(
  await Deno.readTextFile(new URL("./config.json", import.meta.url)),
);

export const ignoreList = Object.entries(config.ignore).reduce(
  (total: RegExp[], [suite, paths]) => {
    paths.forEach((path) => total.push(new RegExp(join(suite, path))));
    return total;
  },
  [],
);

export function getPathsFromTestSuites(suites: TestSuites): string[] {
  const testPaths: string[] = [];
  for (const [dir, paths] of Object.entries(suites)) {
    if (["parallel", "internet", "pummel", "sequential"].includes(dir)) {
      for (const path of paths) {
        testPaths.push(join(dir, path));
      }
    }
  }
  return testPaths;
}
