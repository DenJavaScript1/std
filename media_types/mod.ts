// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** Provides utility functions for media types.
 *
 * This API is inspired by the GoLang [`mime`](https://pkg.go.dev/mime) package
 * and [jshttp/mime-types](https://github.com/jshttp/mime-types).
 *
 * @module
 */

import db from "https://raw.githubusercontent.com/jshttp/mime-db/v1.52.0/db.json" assert {
  type: "json",
};
import { extname } from "../path/mod.ts";
import {
  consumeMediaParam,
  decode2331Encoding,
  isIterator,
  isToken,
  needsEncoding,
} from "./_util.ts";

interface DBEntry {
  source: string;
  compressible?: boolean;
  charset?: string;
  extensions?: string[];
}

type KeyOfDb = keyof typeof db;

/** A map of extensions for a given media type. */
export const extensions = new Map<string, string[]>();

/** A map of the media type for a given extension */
export const types = new Map<string, KeyOfDb>();

/** Internal function to populate the maps based on the Mime DB. */
(function populateMaps(): void {
  const preference = ["nginx", "apache", undefined, "iana"];

  for (const type of Object.keys(db) as KeyOfDb[]) {
    const mime = db[type] as DBEntry;
    const exts = mime.extensions;

    if (!exts || !exts.length) {
      continue;
    }

    extensions.set(type, exts);

    for (const ext of exts) {
      const current = types.get(ext);
      if (current) {
        const from = preference.indexOf((db[current] as DBEntry).source);
        const to = preference.indexOf(mime.source);

        if (
          current !== "application/octet-stream" &&
          (from > to ||
            // @ts-ignore work around denoland/dnt#148
            (from === to && current.startsWith("application/")))
        ) {
          continue;
        }
      }

      types.set(ext, type);
    }
  }
})();

/** Given an extension or media type, return a full `Content-Type` or
 * `Content-Disposition` header value.
 *
 * Returns `undefined` if unable to resolve the media type.
 *
 * ### Examples
 *
 * ```ts
 * import { contentType } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 *
 * contentType(".json"); // `application/json; charset=UTF-8`
 * contentType("text/html"); // `text/html; charset=UTF-8`
 * contentType("txt"); // `text/plain; charset=UTF-8`
 * contentType("foo"); // undefined
 * ```
 */
export function contentType(extensionOrType: string): string | undefined {
  try {
    const [mediaType, params = {}] = extensionOrType.includes("/")
      ? parseMediaType(extensionOrType)
      : [typeByExtension(extensionOrType), undefined];
    if (!mediaType) {
      return undefined;
    }
    if (!("charset" in params)) {
      const charset = getCharset(mediaType);
      if (charset) {
        params.charset = charset;
      }
    }
    return formatMediaType(mediaType, params);
  } catch {
    // just swallow returning undefined
  }
  return undefined;
}

/** For a given media type, return the most relevant extension, or `undefined`
 * if no extension can be found.
 *
 * Extensions are returned without a leading `.`.
 *
 * ### Examples
 *
 * ```ts
 * import { extension } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 *
 * extension("text/plain"); // `txt`
 * extension("application/json"); // `json`
 * extension("text/html; charset=UTF-8"); // `html`
 * extension("application/foo"); // undefined
 * ```
 */
export function extension(type: string): string | undefined {
  const exts = extensionsByType(type);
  if (exts) {
    return exts[0];
  }
  return undefined;
}

/** Returns the extensions known to be associated with the media type `type`.
 * The returned extensions will each begin with a leading dot, as in `.html`.
 *
 * When `type` has no associated extensions, the function returns `undefined`.
 *
 * Extensions are returned without a leading `.`.
 *
 * ### Examples
 *
 * ```ts
 * import { extensionsByType } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 *
 * extensionsByType("application/json"); // ["js", "mjs"]
 * extensionsByType("text/html; charset=UTF-8"); // ["html", "htm", "shtml"]
 * extensionsByType("application/foo"); // undefined
 * ```
 */
export function extensionsByType(type: string): string[] | undefined {
  try {
    const [mediaType] = parseMediaType(type);
    return extensions.get(mediaType);
  } catch {
    // just swallow errors, returning undefined
  }
}

/** Serializes the media type and the optional parameters as a media type
 * conforming to RFC 2045 and RFC 2616.
 *
 * The type and parameter names are written in lower-case.
 *
 * When any of the arguments results in a standard violation then the return
 * value will be an empty string (`""`).
 *
 * ### Example
 *
 * ```ts
 * import { formatMediaType } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 *
 * formatMediaType("text/plain", { charset: "UTF-8" }); // `text/plain; charset=UTF-8`
 * ```
 */
export function formatMediaType(
  type: string,
  param?: Record<string, string> | Iterable<[string, string]>,
): string {
  let b = "";
  const [major, sub] = type.split("/");
  if (!sub) {
    if (!isToken(type)) {
      return "";
    }
    b += type.toLowerCase();
  } else {
    if (!isToken(major) || !isToken(sub)) {
      return "";
    }
    b += `${major.toLowerCase()}/${sub.toLowerCase()}`;
  }

  if (param) {
    param = isIterator(param) ? Object.fromEntries(param) : param;
    const attrs = Object.keys(param);
    attrs.sort();

    for (const attribute of attrs) {
      if (!isToken(attribute)) {
        return "";
      }
      const value = param[attribute];
      b += `; ${attribute.toLowerCase()}`;

      const needEnc = needsEncoding(value);
      if (needEnc) {
        b += "*";
      }
      b += "=";

      if (needEnc) {
        b += `utf-8''${encodeURIComponent(value)}`;
        continue;
      }

      if (isToken(value)) {
        b += value;
        continue;
      }
      b += `"${value.replace(/["\\]/gi, (m) => `\\${m}`)}"`;
    }
  }
  return b;
}

/** Given a media type or header value, identify the encoding charset. If the
 * charset cannot be determined, the function returns `undefined`.
 *
 * ### Examples
 *
 * ```ts
 * import { getCharset } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 *
 * getCharset("text/plain"); // `UTF-8`
 * getCharset("application/foo"); // undefined
 * getCharset("application/news-checkgroups"); // `US-ASCII`
 * getCharset("application/news-checkgroups; charset=UTF-8"); // `UTF-8`
 * ```
 */
export function getCharset(type: string): string | undefined {
  try {
    const [mediaType, params] = parseMediaType(type);
    if (params && params["charset"]) {
      return params["charset"];
    }
    const entry = db[mediaType as KeyOfDb] as DBEntry;
    if (entry && entry.charset) {
      return entry.charset;
    }
    if (mediaType.startsWith("text/")) {
      return "UTF-8";
    }
  } catch {
    // just swallow errors, returning undefined
  }
  return undefined;
}

/** Parses the media type and any optional parameters, per
 * [RFC 1521](https://datatracker.ietf.org/doc/html/rfc1521). Media types are
 * the values in `Content-Type` and `Content-Disposition` headers. On success
 * the function returns a tuple where the first element is the media type and
 * the second element is the optional parameters or `undefined` if there are
 * none.
 *
 * The function will throw if the parsed value is invalid.
 *
 * The returned media type will be normalized to be lower case, and returned
 * params keys will be normalized to lower case, but preserves the casing of
 * the value.
 *
 * ### Examples
 *
 * ```ts
 * import { parseMediaType } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/testing/asserts.ts";
 *
 * assertEquals(
 *   parseMediaType("application/JSON"),
 *   [
 *     "application/json",
 *     undefined
 *   ]
 * );
 *
 * assertEquals(
 *   parseMediaType("text/html; charset=UTF-8"),
 *   [
 *     "application/json",
 *     { charset: "UTF-8" },
 *   ]
 * );
 * ```
 */
export function parseMediaType(
  v: string,
): [mediaType: string, params: Record<string, string> | undefined] {
  const [base] = v.split(";");
  const mediaType = base.toLowerCase().trim();

  const params: Record<string, string> = {};
  // Map of base parameter name -> parameter name -> value
  // for parameters containing a '*' character.
  const continuation = new Map<string, Record<string, string>>();

  v = v.slice(base.length);
  while (v.length) {
    v = v.trimStart();
    if (v.length === 0) {
      break;
    }
    const [key, value, rest] = consumeMediaParam(v);
    if (!key) {
      if (rest.trim() === ";") {
        // ignore trailing semicolons
        break;
      }
      throw new TypeError("Invalid media parameter.");
    }

    let pmap = params;
    const [baseName, rest2] = key.split("*");
    if (baseName && rest2 != null) {
      if (!continuation.has(baseName)) {
        continuation.set(baseName, {});
      }
      pmap = continuation.get(baseName)!;
    }
    if (key in pmap) {
      throw new TypeError("Duplicate key parsed.");
    }
    pmap[key] = value;
    v = rest;
  }

  // Stitch together any continuations or things with stars
  // (i.e. RFC 2231 things with stars: "foo*0" or "foo*")
  let str = "";
  for (const [key, pieceMap] of continuation) {
    const singlePartKey = `${key}*`;
    const v = pieceMap[singlePartKey];
    if (v) {
      const decv = decode2331Encoding(v);
      if (decv) {
        params[key] = decv;
      }
      continue;
    }

    str = "";
    let valid = false;
    for (let n = 0;; n++) {
      const simplePart = `${key}*${n}`;
      let v = pieceMap[simplePart];
      if (v) {
        valid = true;
        str += v;
        continue;
      }
      const encodedPart = `${simplePart}*`;
      v = pieceMap[encodedPart];
      if (!v) {
        break;
      }
      valid = true;
      if (n === 0) {
        const decv = decode2331Encoding(v);
        if (decv) {
          str += decv;
        }
      } else {
        const decv = decodeURI(v);
        str += decv;
      }
    }
    if (valid) {
      params[key] = str;
    }
  }

  return Object.keys(params).length
    ? [mediaType, params]
    : [mediaType, undefined];
}

/** Returns the media type associated with the file extension. Values are
 * normalized to lower case and matched irrespective of a leading `.`.
 *
 * When `extension` has no associated type, the function returns `undefined`.
 *
 * ### Examples
 *
 * ```ts
 * import { typeByExtension } from "https://deno.land/std@$STD_VERSION/media_types/mod.ts";
 *
 * typeByExtension("js"); // `application/json`
 * typeByExtension(".HTML"); // `text/html`
 * typeByExtension("foo"); // undefined
 * ```
 */
export function typeByExtension(extension: string): string | undefined {
  extension = extname(`x.${extension}`).toLowerCase().slice(1);
  // @ts-ignore workaround around denoland/dnt#148
  return types.get(extension);
}
