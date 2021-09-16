// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// This module ports:
// - https://github.com/nodejs/node/blob/master/src/tcp_wrap.cc
// - https://github.com/nodejs/node/blob/master/src/tcp_wrap.h

import { notImplemented } from "../_utils.ts";
import { unreachable } from "../../testing/asserts.ts";
import { ConnectionWrap } from "./connection_wrap.ts";
import { AsyncWrap, providerType } from "./async_wrap.ts";
import { ownerSymbol } from "./symbols.ts";
import {
  UV_EADDRINUSE,
  UV_EADDRNOTAVAIL,
  UV_ECONNREFUSED,
  UV_UNKNOWN,
} from "./uv.ts";
import { delay } from "../../async/mod.ts";
import { kStreamBaseField } from "./stream_wrap.ts";

/** The type of TCP socket. */
enum socketType {
  SOCKET,
  SERVER,
}

interface AddressInfo {
  address: string;
  family?: string;
  port: number;
}

/** Initial backoff delay of 5ms following a temporary accept failure. */
const INITIAL_ACCEPT_BACKOFF_DELAY = 5;

/** Max backoff delay of 1s following a temporary accept failure. */
const MAX_ACCEPT_BACKOFF_DELAY = 1000;

/**
 * @param n Number to act on.
 * @return The number rounded up to the nearest power of 2.
 */
function _ceilPowOf2(n: number) {
  const roundPowOf2 = 1 << 31 - Math.clz32(n);

  return roundPowOf2 < n ? roundPowOf2 * 2 : roundPowOf2;
}

export class TCPConnectWrap extends AsyncWrap {
  oncomplete!: (
    status: number,
    handle: ConnectionWrap,
    req: TCPConnectWrap,
    readable: boolean,
    writeable: boolean,
  ) => void;
  address!: string;
  port!: number;
  localAddress!: string;
  localPort!: number;

  constructor() {
    super(providerType.TCPCONNECTWRAP);
  }
}

export enum constants {
  SOCKET = socketType.SOCKET,
  SERVER = socketType.SERVER,
  UV_TCP_IPV6ONLY,
}

export class TCP extends ConnectionWrap {
  [ownerSymbol]: unknown = null;
  reading = false;

  #address?: string;
  #port?: number;

  #remoteAddress?: string;
  #remoteFamily?: string;
  #remotePort?: number;

  #backlog?: number;
  #listener!: Deno.Listener;
  #connections: Set<TCP> = new Set();

  #closed = false;
  #acceptBackoffDelay?: number;

  /**
   * Creates a new TCP class instance.
   * @param type The socket type.
   * @param conn Optional connection object to wrap.
   */
  constructor(type: number, conn?: Deno.Conn) {
    let provider: providerType;

    switch (type) {
      case socketType.SOCKET: {
        provider = providerType.TCPWRAP;

        break;
      }
      case socketType.SERVER: {
        provider = providerType.TCPSERVERWRAP;

        break;
      }
      default: {
        unreachable();
      }
    }

    super(provider, conn);

    // TODO(cmorten): the handling of new connections and construction feels
    // a little off. Suspect duplicating in some fashion.
    if (conn && providerType.TCPWRAP) {
      const localAddr = conn.localAddr as Deno.NetAddr;
      this.#address = localAddr.hostname;
      this.#port = localAddr.port;

      const remoteAddr = conn.remoteAddr as Deno.NetAddr;
      this.#remoteAddress = remoteAddr.hostname;
      this.#remotePort = remoteAddr.port;
    }
  }

  /**
   * Opens a file descriptor.
   * @param fd The file descriptor to open.
   * @return An error status code.
   */
  open(_fd: number): number {
    // REF: https://github.com/denoland/deno/issues/6529
    notImplemented();
  }

  /**
   * Bind to an IPv4 address.
   * @param address The hostname to bind to.
   * @param port The port to bind to
   * @return An error status code.
   */
  bind(address: string, port: number): number {
    return this.#bind(address, port, 0);
  }

  /**
   * Bind to an IPv4 address.
   * @param address The hostname to bind to.
   * @param port The port to bind to
   * @return An error status code.
   */
  bind6(address: string, port: number, flags: number): number {
    return this.#bind(address, port, flags);
  }

  /**
   * Connect to an IPv4 address.
   * @param req A TCPConnectWrap instance.
   * @param address The hostname to connect to.
   * @param port The port to connect to.
   * @return An error status code.
   */
  connect(req: TCPConnectWrap, address: string, port: number): number {
    return this.#connect(req, address, port);
  }

  /**
   * Connect to an IPv6 address.
   * @param req A TCPConnectWrap instance.
   * @param address The hostname to connect to.
   * @param port The port to connect to.
   * @return An error status code.
   */
  connect6(req: TCPConnectWrap, address: string, port: number): number {
    return this.#connect(req, address, port);
  }

  /**
   * Listen for new connections.
   * @param backlog
   * @return An error status code.
   */
  listen(backlog: number): number {
    this.#backlog = _ceilPowOf2(backlog + 1);

    const listenOptions = {
      hostname: this.#address!,
      port: this.#port!,
      transport: "tcp" as const,
    };

    let listener;

    try {
      listener = Deno.listen(listenOptions);
    } catch (e) {
      if (e instanceof Deno.errors.AddrInUse) {
        return UV_EADDRINUSE;
      } else if (e instanceof Deno.errors.AddrNotAvailable) {
        return UV_EADDRNOTAVAIL;
      }

      // TODO(cmorten): map errors to appropriate error codes.
      return UV_UNKNOWN;
    }

    const address = listener.addr as Deno.NetAddr;
    this.#address = address.hostname;
    this.#port = address.port;

    this.#listener = listener;
    this.#accept();

    return 0;
  }

  /**
   * Populates the provided object with local address entries.
   * @param sockname An object to add the local address entries to.
   * @return An error status code.
   */
  getsockname(sockname: Record<string, never> | AddressInfo): number {
    if (
      typeof this.#address === "undefined" || typeof this.#port === "undefined"
    ) {
      return UV_EADDRNOTAVAIL;
    }

    sockname.address = this.#address;
    sockname.port = this.#port;

    return 0;
  }

  /**
   * Populates the provided object with remote address entries.
   * @param peername An object to add the remote address entries to.
   * @return An error status code.
   */
  getpeername(peername: Record<string, never> | AddressInfo): number {
    if (
      typeof this.#remoteAddress === "undefined" ||
      typeof this.#remotePort === "undefined"
    ) {
      return UV_EADDRNOTAVAIL;
    }

    peername.address = this.#remoteAddress;
    peername.port = this.#remotePort;
    // TODO(cmorten): this isn't being set currently
    peername.family = this.#remoteFamily;

    return 0;
  }

  /**
   * @param noDelay
   * @return An error status code.
   */
  setNoDelay(_noDelay: boolean): number {
    notImplemented();
  }

  /**
   * @param enable
   * @param initialDelay
   * @return An error status code.
   */
  setKeepAlive(_enable: boolean, _initialDelay: number): number {
    notImplemented();
  }

  /**
   * Windows only.
   *
   * Deprecated by Node.
   * REF: https://github.com/nodejs/node/blob/master/lib/net.js#L1731
   *
   * @param enable
   * @return An error status code.
   * @deprecated
   */
  setSimultaneousAccepts(_enable: boolean) {
    // Low priority to implement owing to it being deprecated in Node.
    notImplemented();
  }

  /**
   * Bind to an IPv4 or IPv6 address.
   * @param address The hostname to bind to.
   * @param port The port to bind to
   * @param flags
   * @return An error status code.
   */
  #bind(address: string, port: number, _flags: number): number {
    // Deno doesn't currently separate bind from connect. For now we noop under
    // the assumption we will connect shortly.
    // REF: https://doc.deno.land/builtin/stable#Deno.connect
    //
    // This also means we won't be connecting from the specified local address
    // and port as providing these is not an option in Deno.
    // REF: https://doc.deno.land/builtin/stable#Deno.ConnectOptions
    this.#address = address;
    this.#port = port;

    return 0;
  }

  /**
   * Connect to an IPv4 or IPv6 address.
   * @param req A TCPConnectWrap instance.
   * @param address The hostname to connect to.
   * @param port The port to connect to.
   * @return An error status code.
   */
  #connect(req: TCPConnectWrap, address: string, port: number): number {
    this.#remoteAddress = address;
    this.#remotePort = port;

    const connectOptions: Deno.ConnectOptions = {
      hostname: address,
      port,
      transport: "tcp",
    };

    Deno.connect(connectOptions).then((conn: Deno.Conn) => {
      // Incorrect / backwards, but correcting the local address and port with
      // what was actually used given we can't actually specify these in Deno.
      const localAddr = conn.localAddr as Deno.NetAddr;
      this.#address = req.localAddress = localAddr.hostname;
      this.#port = req.localPort = localAddr.port;

      try {
        this.afterConnect(req, 0);
      } catch {
        // swallow callback errors.
      }
    }, () => {
      try {
        // TODO(cmorten): correct mapping of connection error to status code.
        this.afterConnect(req, UV_ECONNREFUSED);
      } catch {
        // swallow callback errors.
      }
    });

    return 0;
  }

  /** Handle backoff delays following an unsuccessful accept. */
  async #acceptBackoff(): Promise<void> {
    // Backoff after transient errors to allow time for the system to
    // recover, and avoid blocking up the event loop with a continuously
    // running loop.
    if (!this.#acceptBackoffDelay) {
      this.#acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;
    } else {
      this.#acceptBackoffDelay *= 2;
    }

    if (this.#acceptBackoffDelay >= MAX_ACCEPT_BACKOFF_DELAY) {
      this.#acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY;
    }

    await delay(this.#acceptBackoffDelay);

    this.#accept();
  }

  /** Accept new connections. */
  async #accept(): Promise<void> {
    if (this.#closed) {
      return;
    }

    if (this.#connections.size > this.#backlog!) {
      this.#acceptBackoff();

      return;
    }

    let connection: Deno.Conn;

    try {
      connection = await this.#listener.accept();
    } catch (e) {
      if (e instanceof Deno.errors.BadResource && this.#closed) {
        // Listener and server has closed.
        return;
      }

      try {
        // TODO(cmorten): map errors to appropriate error codes.
        this.onconnection!(UV_UNKNOWN, undefined);
      } catch {
        // swallow callback errors.
      }

      this.#acceptBackoff();

      return;
    }

    // Reset the backoff delay upon successful accept.
    this.#acceptBackoffDelay = undefined;

    const connectionHandle = new TCP(socketType.SOCKET, connection);
    // TODO(cmorten): do we need to keep a refer to this here or will that get
    // handled via the onconnection callback?
    this.#connections.add(connectionHandle);

    try {
      this.onconnection!(0, connectionHandle);
    } catch {
      // swallow callback errors.
    }

    return this.#accept();
  }

  /** Handle server closure. */
  _onClose(): void {
    // TODO(cmorten): this isn't quite right
    this.#closed = true;
    this.reading = false;

    this.#address = undefined;
    this.#port = undefined;

    this.#remoteAddress = undefined;
    this.#remoteFamily = undefined;
    this.#remotePort = undefined;

    this.#backlog = undefined;
    this.#acceptBackoffDelay = undefined;

    for (const connection of this.#connections) {
      try {
        connection.close();
        connection[kStreamBaseField]!.close();
      } catch {
        // connection already closed
      }
    }

    this.#connections.clear();

    try {
      this.#listener.close();
    } catch {
      // listener already closed
    }
  }
}
