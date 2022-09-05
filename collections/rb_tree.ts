// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/** This module is browser compatible. */

import { RedBlackTree } from "./red_black_tree.ts";
export * from "./_comparators.ts";

/** @deprecated (will be removed in 0.157.0) use RedBlackTree instead */
export { RedBlackTree as RBTree };
