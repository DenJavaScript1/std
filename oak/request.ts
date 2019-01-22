// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { serve } from "./deps.ts";
import { preferredEncodings } from "./encoding.ts";
import { preferredMediaTypes } from "./mediaType.ts";
import { HTTPMethods } from "./types.ts";

type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
type UnpackAsyncIterator<T> = T extends AsyncIterableIterator<infer U>
  ? U
  : any;

export type ServerRequest = UnpackAsyncIterator<ReturnType<typeof serve>>;

export class Request {
  private _path: string;
  private _search?: string;
  private _searchParams: URLSearchParams;
  private _serverRequest: ServerRequest;

  /** The `Headers` supplied in the request. */
  get headers(): Headers {
    return this._serverRequest.headers;
  }

  /** The HTTP Method used by the request. */
  get method(): HTTPMethods {
    return this._serverRequest.method as HTTPMethods;
  }

  /** The path of the request. */
  get path(): string {
    return this._path;
  }

  /** The search part of the URL of the request. */
  get search(): string | undefined {
    return this._search;
  }

  /** The parsed `URLSearchParams` of the request. */
  get searchParams(): URLSearchParams {
    return this._searchParams;
  }

  /** The URL of the request. */
  get url(): string {
    return this._serverRequest.url;
  }

  constructor(serverRequest: ServerRequest) {
    this._serverRequest = serverRequest;
    const [path, search] = serverRequest.url.split("?");
    this._path = path;
    this._search = search ? `?${search}` : undefined;
    this._searchParams = new URLSearchParams(search);
  }

  /** Returns an array of media types, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * `undefined` is returned.
   */
  accepts(): string[];
  /** For a given set of media types, return the best match accepted by the
   * requestor.  If there are no encoding that match, then the method returns
   * `undefined`.
   */
  accepts(...types: string[]): string | undefined;
  accepts(...types: string[]): string | string[] | undefined {
    const acceptValue = this._serverRequest.headers.get("Accept");
    if (!acceptValue) {
      return;
    }
    if (types.length) {
      return preferredMediaTypes(acceptValue, types)[0];
    }
    return preferredMediaTypes(acceptValue);
  }

  /** Returns an array of encodings, accepted by the requestor, in order of
   * preference.  If there are no encodings supplied by the requestor,
   * `undefined` is returned.
   */
  acceptsEncodings(): string[];
  /** For a given set of encodings, return the best match accepted by the
   * requestor.  If there are no encodings that match, then the method returns
   * `undefined`.
   *
   * **NOTE:** You should always supply `identity` as one of the encodings
   * to ensure that there is a match when the `Accept-Encoding` header is part
   * of the request.
   */
  acceptsEncodings(...encodings: string[]): string | undefined;
  acceptsEncodings(...encodings: string[]): string[] | string | undefined {
    const acceptEncodingValue = this._serverRequest.headers.get(
      "Accept-Encoding"
    );
    if (!acceptEncodingValue) {
      return;
    }
    if (encodings.length) {
      return preferredEncodings(acceptEncodingValue, encodings)[0];
    }
    return preferredEncodings(acceptEncodingValue);
  }

  acceptsCharsets(): string[];
  acceptsCharsets(...charsets: string[]): string | undefined;
  acceptsCharsets(...charsets: string[]): string[] | string | undefined {
    return undefined;
  }

  acceptsLanguages(): string[];
  acceptsLanguages(...langs: string[]): string | undefined;
  acceptsLanguages(...langs: string[]): string[] | string | undefined {
    return undefined;
  }
}
