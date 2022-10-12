// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Status, STATUS_TEXT } from "./http_status.ts";
import { deepMerge } from "../collections/deep_merge.ts";

/** Returns true if the etags match. Weak etag comparisons are handled. */
export function compareEtag(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  if (a.startsWith("W/") && !b.startsWith("W/")) {
    return a.slice(2) === b;
  }
  if (!a.startsWith("W/") && b.startsWith("W/")) {
    return a === b.slice(2);
  }
  return false;
}

/**
 * Small utility for returning a standardized response, automatically defining the body, status code and status text, according to the response type.
 *
 * @example
 * ```ts
 * import { commonResponse, Status } from "https://deno.land/std@$STD_VERSION/http/mod.ts";
 *
 * const response = commonResponse(Status.NotFound);
 *
 * console.log(await response.text()); // "Not Found"
 * console.log(response.status); // 404
 * console.log(response.statusText); // "Not Found"
 * ```
 */
export function commonResponse(
  status: Status,
  body?: BodyInit | null,
  init?: ResponseInit,
): Response {
  if (body === undefined) {
    body = STATUS_TEXT[status];
  }
  init = deepMerge({
    status,
    statusText: STATUS_TEXT[status],
  }, init ?? {});
  return new Response(body, init);
}
