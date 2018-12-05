import { listen, Conn } from "deno";
import { BufReader, BufState, BufWriter } from "./bufio.ts";
import { TextProtoReader } from "./textproto.ts";
import { STATUS_TEXT } from "./http_status";
import { assert } from "./util";

interface Deferred {
  promise: Promise<{}>;
  resolve: () => void;
  reject: () => void;
}

function deferred(): Deferred {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise, resolve, reject,
  };
}

export async function* serve(addr: string) {
  const listener = listen("tcp", addr);
  let serveDeferred = deferred();
  let reqQueue: ServerRequest[] = []; // in case multiple promises are ready

  // Continuously read more requests from conn until EOF
  // Mutually calling with handleReq
  const readRequestsFromConn = async (conn: Conn) => {
    const [req, _err] = await readRequest(conn);
    if (_err) {
      conn.close(); // assume EOF, for now
      return;
    }
    handleReq(conn, req);
  }
  const handleReq = (conn: Conn, req: ServerRequest) => {
    reqQueue.push(req); // push req to queue
    readRequestsFromConn(conn); // try read more (reusing connection)
    serveDeferred.resolve(); // signal while loop to process it
  }

  // Routine that keeps calling accept
  const acceptRoutine = () => {
    const handleConn = (conn: Conn) => {
      readRequestsFromConn(conn); // don't block
      scheduleAccept(); // schedule next accept
    }
    const scheduleAccept = () => {
      listener.accept().then(handleConn);
    }
    scheduleAccept();
  }

  acceptRoutine();

  // Loop hack to allow yield (yield won't work in callbacks)
  while (true) {
    await serveDeferred.promise;
    serveDeferred = deferred(); // use a new deferred
    let queueToProcess = reqQueue;
    reqQueue = [];
    for (const result of queueToProcess) {
      yield result;
    }
  }
  listener.close();
}

interface Response {
  status?: number;
  headers?: Headers;
  body?: Uint8Array;
}

function setContentLength(r: Response): void {
  if (r.body) {
    if (!r.headers) {
      r.headers = new Headers();
    }
    if (!r.headers.has("content-length")) {
      r.headers.append("Content-Length", r.body.byteLength.toString());
    }
  }
}

class ServerRequest {
  url: string;
  method: string;
  proto: string;
  headers: Headers;
  w: BufWriter;

  async respond(r: Response): Promise<void> {
    const protoMajor = 1;
    const protoMinor = 1;
    const statusCode = r.status || 200;
    const statusText = STATUS_TEXT.get(statusCode);
    if (!statusText) {
      throw Error("bad status code");
    }

    let out = `HTTP/${protoMajor}.${protoMinor} ${r.status} ${statusText}\r\n`;

    setContentLength(r);

    if (r.headers) {
      for (const [key, value] of r.headers) {
        out += `${key}: ${value}\r\n`;
      }
    }
    out += "\r\n";

    const header = new TextEncoder().encode(out);
    let n = await this.w.write(header);
    assert(header.byteLength == n);
    if (r.body) {
      n = await this.w.write(r.body);
      assert(r.body.byteLength == n);
    }

    await this.w.flush();
  }
}

async function readRequest(c: Conn): Promise<[ServerRequest, BufState]> {
  const bufr = new BufReader(c);
  const bufw = new BufWriter(c);
  const req = new ServerRequest();
  req.w = bufw;
  const tp = new TextProtoReader(bufr);

  let s: string;
  let err: BufState;

  // First line: GET /index.html HTTP/1.0
  [s, err] = await tp.readLine();
  if (err) {
    return [null, err];
  }
  [req.method, req.url, req.proto] = s.split(" ", 3);

  [req.headers, err] = await tp.readMIMEHeader();

  // TODO: handle body

  return [req, err];
}
