// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import type { HTTPOptions } from "./server.ts";
import { _parseAddrFromStr } from "./server.ts";
import { MuxAsyncIterator } from "../async/mod.ts";

/** Options for creating a server. */
export type AddrOptions = undefined | null | number | string | HTTPOptions;

/** Information about the connection a request arrived on. */
export interface ConnInfo {
  /** The local address of the connection. */
  readonly localAddr: Deno.Addr;
  /** The remote address of the connection. */
  readonly remoteAddr: Deno.Addr;
}

/** A handler for HTTP requests. Consumes a request and returns a response. */
export type HttpHandler = (
  req: Request,
  connInfo: ConnInfo,
) => Response | Promise<Response>;

class ServerRequest implements Deno.RequestEvent {
  #request: Request;
  #connInfo: ConnInfo;
  #resolver!: (value: Response | Promise<Response>) => void;
  #responsePromise: Promise<void>;
  #done = false;

  /**
   * Constructs a new ServerRequest instance.
   *
   * @param {Deno.RequestEvent} requestEvent
   * @param {Deno.Conn} conn
   */
  constructor(requestEvent: Deno.RequestEvent, conn: Deno.Conn) {
    this.#request = requestEvent.request;
    this.#connInfo = {
      localAddr: conn.localAddr,
      remoteAddr: conn.remoteAddr,
    };

    const wrappedResponse = new Promise<Response>((resolve) => {
      this.#resolver = resolve;
    });

    this.#responsePromise = requestEvent.respondWith(wrappedResponse);
  }

  /** Get the Request instance. */
  get request(): Request {
    return this.#request;
  }

  /**
   * Get the connection info.
   */
  get connInfo(): ConnInfo {
    return this.#connInfo;
  }

  /** Determine whether the response has completed. */
  get done(): Promise<void> {
    return this.#responsePromise;
  }

  /**
   * Send a response to the request.
   *
   * @param {Response|Promise<Response>} response
   * @returns {Promise<void>}
   * @throws {Deno.errors.BadResource} When the response has already been sent.
   */
  respondWith(response: Response | Promise<Response>): Promise<void> {
    if (this.#done) {
      throw new Deno.errors.BadResource("Response already sent.");
    }

    this.#resolver(response);
    this.#done = true;

    return this.#responsePromise;
  }
}

class Server implements AsyncIterable<ServerRequest> {
  #closing = false;
  #httpConnections: Set<Deno.HttpConn> = new Set();

  /**
   * Creates a new Server instance.
   *
   * @param {Deno.Listener} listener
   */
  constructor(public listener: Deno.Listener) {}

  /** Close the server and any associated http connections. */
  close(): void {
    this.#closing = true;
    this.listener.close();

    for (const httpConn of this.#httpConnections) {
      try {
        httpConn.close();
      } catch (error) {
        if (!(error instanceof Deno.errors.BadResource)) {
          throw error;
        }
      }
    }

    this.#httpConnections.clear();
  }

  /**
   * Yields all HTTP requests on a single TCP connection.
   *
   * @param {HttpConn} httpConn The HTTP connection to yield requests from.
   * @yields {ServerRequest} HTTP request events
   * @private
   */
  private async *iterateHttpRequests(
    httpConn: Deno.HttpConn,
    conn: Deno.Conn,
  ): AsyncIterableIterator<ServerRequest> {
    while (!this.#closing) {
      let requestEvent!: Deno.RequestEvent | null;

      try {
        // Yield the new HTTP request on the connection.
        requestEvent = await httpConn.nextRequest();
      } catch (_) {
        // Connection has been closed.
        break;
      }

      if (requestEvent === null) {
        // Connection has been closed.
        break;
      }

      // Wrap request event so can gracefully handle and await async ops.
      const serverRequest = new ServerRequest(requestEvent, conn);

      // Consumer can handle the request event.
      yield serverRequest;

      try {
        // Wait for the request to be processed before we accept a new request on
        // this connection.
        await serverRequest.done;
      } catch {
        // Connection has been closed.
        break;
      }
    }

    this.untrackConnection(httpConn);

    try {
      httpConn.close();
    } catch (error) {
      if (!(error instanceof Deno.errors.BadResource)) {
        throw error;
      }
    }
  }

  /**
   * Accepts a new TCP connection and yields all HTTP requests that arrive on
   * it. When a connection is accepted, it also creates a new iterator of the
   * same kind and adds it to the request multiplexer so that another TCP
   * connection can be accepted.
   *
   * @param {MuxAsyncIterator<ServerRequest>} mux
   * @yields {ServerRequest}
   * @private
   */
  private async *acceptConnAndIterateHttpRequests(
    mux: MuxAsyncIterator<ServerRequest>,
  ): AsyncIterableIterator<ServerRequest> {
    if (this.#closing) {
      return;
    }

    // Wait for a new connection.
    let conn: Deno.Conn;

    try {
      conn = await this.listener.accept();
    } catch (error) {
      if (
        // The listener is closed
        error instanceof Deno.errors.BadResource ||
        // TLS handshake errors
        error instanceof Deno.errors.InvalidData ||
        error instanceof Deno.errors.UnexpectedEof ||
        error instanceof Deno.errors.ConnectionReset
      ) {
        return mux.add(this.acceptConnAndIterateHttpRequests(mux));
      }

      throw error;
    }

    // "Upgrade" the network connection into a HTTP connection
    const httpConn = Deno.serveHttp(conn);

    // Closing the underlying server will not close the HTTP connection,
    // so we track it for closure upon shutdown.
    this.trackConnection(httpConn);

    // Try to accept another connection and add it to the multiplexer.
    mux.add(this.acceptConnAndIterateHttpRequests(mux));

    // Yield the requests that arrive on the just-accepted connection.
    yield* this.iterateHttpRequests(httpConn, conn);
  }

  /**
   * Adds the HTTP connection to the internal tracking list.
   *
   * @param {HttpConn} httpConn
   * @private
   */
  private trackConnection(httpConn: Deno.HttpConn): void {
    this.#httpConnections.add(httpConn);
  }

  /**
   * Removes the HTTP connection from the internal tracking list.
   *
   * @param {HttpConn} httpConn
   * @private
   */
  private untrackConnection(httpConn: Deno.HttpConn): void {
    this.#httpConnections.delete(httpConn);
  }

  /**
   * Implementation of Async Iterator to allow consumers to loop over
   * HTTP requests.
   *
   * @returns {AsyncIterableIterator<ServerRequest>} The async iterator.
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<ServerRequest> {
    const mux: MuxAsyncIterator<ServerRequest> = new MuxAsyncIterator();
    mux.add(this.acceptConnAndIterateHttpRequests(mux));

    return mux.iterate();
  }
}

/**
 * Accept incoming connections on the given listener, and handle requests on
 * these connections with the given handler.
 *
 *     const listener = Deno.listen({ port: 8000 });
 *     serve(listener, (request) => {
 *       const body = `Your user-agent is:\n\n${request.headers.get(
 *         "user-agent",
 *       ) ?? "Unknown"}`;
 *
 *       return new Response(body, { status: 200 });
 *     });
 *
 * @param {Deno.Listener} listener The listener to accept connections from.
 * @param {HttpHandler} handler The handler for individual HTTP requests.
 */
export async function serve(
  listener: Deno.Listener,
  handler: HttpHandler,
): Promise<void> {
  const server = new Server(listener);

  for await (const requestEvent of server) {
    requestEvent.respondWith(
      handler(requestEvent.request, requestEvent.connInfo),
    );
  }
}

/**
 * Create a listener on the given address, accept incoming connections, and
 * handle requests on these connections with the given handler.
 *
 *     const options = { port: 8000 };
 *
 *     listenAndServe(options, (request) => {
 *       const body = `Your user-agent is:\n\n${request.headers.get(
 *         "user-agent",
 *       ) ?? "Unknown"}`;
 *
 *       return new Response(body, { status: 200 });
 *     });
 *
 * @param {AddrOptions} addr The TCP address to listen on.
 * @param {HttpHandler} handler The handler for individual HTTP requests.
 */
export async function listenAndServe(
  addr: AddrOptions,
  handler: HttpHandler,
): Promise<void> {
  let listenOptions;

  if (typeof addr === "undefined" || addr === null) {
    listenOptions = { port: 80 };
  } else if (typeof addr === "number") {
    listenOptions = { port: addr };
  } else if (typeof addr === "string") {
    listenOptions = _parseAddrFromStr(addr);
  } else {
    listenOptions = addr;
  }

  const listener = Deno.listen(listenOptions);

  await serve(listener, handler);
}

/**
 * Create a listener on the given address, accept incoming connections, upgrade
 * them to TLS, and handle requests on these connections with the given handler.
 *
 *     const options = { port: 8000 };
 *     const certFile = "/path/to/localhost.crt"
 *     const keyFile = "/path/to/localhost.key"
 *
 *     listenAndServeTls(options, certFile, keyFile, (request) => {
 *       const body = `Your user-agent is:\n\n${request.headers.get(
 *         "user-agent",
 *       ) ?? "Unknown"}`;
 *
 *       return new Response(body, { status: 200 });
 *     });
 *
 * @param {AddrOptions} addr The TCP address to listen on.
 * @param {string} certFile The path to the file containing the TLS certificate.
 * @param {string} keyFile The path to the file containing the TLS private key.
 * @param {HttpHandler} handler The handler for individual HTTP requests.
 */
export async function listenAndServeTls(
  addr: AddrOptions,
  certFile: string,
  keyFile: string,
  handler: HttpHandler,
): Promise<void> {
  let listenOptions;

  if (typeof addr === "undefined" || addr === null) {
    listenOptions = { port: 80 };
  } else if (typeof addr === "number") {
    listenOptions = { port: addr };
  } else if (typeof addr === "string") {
    listenOptions = _parseAddrFromStr(addr);
  } else {
    listenOptions = addr;
  }

  const listener = Deno.listenTls({
    ...listenOptions,
    certFile,
    keyFile,
    // Not yet stable.
    // alpnProtocols: ["h2", "http/1.1"],
  });

  await serve(listener, handler);
}
