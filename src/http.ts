import { TCPConn, onWrite, onRead } from "./socket";

export type HTTPReq = {
    method: string,
    uri: Buffer,
    version: string,
    headers: Buffer[],
};

export type HTTPRes = {
    code: number,
    headers: Buffer[],
    body: BodyReader,
};

export type BodyReader = {
    length: number,
    read: () => Promise<Buffer>,
};

export class HTTPError extends Error {
    constructor(public code: number, message: string) {
        super(message);
    }
}

export function readerFromReq(conn: TCPConn, buf: Buffer, req: HTTPReq): BodyReader {
    let bodyLen = -1;
    const contentLen = fieldGet(req.headers, 'Content-Length');
    if (contentLen) {
        bodyLen = parseDec(contentLen.toString('latin1'));
        if (isNaN(bodyLen)) {
            throw new HTTPError(400, 'Bad Content-Length.');
        }
    }

    const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD');
    const chunked = fieldGet(req.headers, 'Transfer-Encoding')?.toString().toLowerCase() === 'chunked';

    if (!bodyAllowed && (bodyLen > 0 || chunked)) {
        throw new HTTPError(400, 'HTTP body not allowed.');
    }

    if (!bodyAllowed) {
        bodyLen = 0;
    }

    if (bodyLen >= 0) {
        return readerFromConnLength(conn, buf, bodyLen);
    } else if (chunked) {
        throw new HTTPError(501, 'Chunked encoding not supported yet.');
    } else {
        throw new HTTPError(501, 'No Content-Length or chunked encoding.');
    }
}

export function fieldGet(headers: Buffer[], target: string): Buffer | undefined {
    const lowerTarget = target.toLowerCase();
    for (const h of headers) {
        const [key, value] = h.toString().split(/:\s*/, 2);
        if (key.toLowerCase() === lowerTarget) {
            return Buffer.from(value);
        }
    }
    return undefined;
}

export function parseDec(content: string): number {
    const n = parseInt(content, 10);
    return isNaN(n) ? -1 : n;
}

export function readerFromConnLength(conn: TCPConn, buf: Buffer, len: number): BodyReader {
    let readBytes = 0;
    let leftover = Buffer.from(buf);

    return {
        length: len,
        read: async (): Promise<Buffer> => {
            if (readBytes >= len) {
                return Buffer.alloc(0);
            }

            if (leftover.length > 0) {
                const take = Math.min(len - readBytes, leftover.length);
                const chunk = leftover.slice(0, take);
                leftover = leftover.slice(take);
                readBytes += chunk.length;
                return chunk;
            }

            const chunk = await onRead(conn);
            const take = Math.min(len - readBytes, chunk.length);
            const result = chunk.slice(0, take);
            leftover = chunk.slice(take);
            readBytes += result.length;
            return result;
        }
    };
}

export async function handleReq(req: HTTPReq, conn: TCPConn, buf: Buffer): Promise<HTTPRes> {
    let body: BodyReader;

    try {
        body = readerFromReq(conn, buf, req);
    } catch (err) {
        if (err instanceof HTTPError) {
            return {
                code: err.code,
                headers: [],
                body: readerFromMemory(Buffer.from(err.message)),
            };
        }
        throw err;
    }

    const data = await body.read();
    const bodyText = data.toString();

    return {
        code: 200,
        headers: [
            Buffer.from("Content-Type: text/plain"),
            Buffer.from("Server: test-server"),
        ],
        body: readerFromMemory(Buffer.from(`You sent: ${bodyText}`)),
    };
}

export function splitLines(data: Buffer): Buffer[] {
    return data.toString().split(/\r\n/).map(line => Buffer.from(line));
}

export function validateHeader(data: Buffer): boolean {
    return /^[^:\s]+:\s?.+$/.test(data.toString());
}

export function parseRequestLine(data: Buffer): [string, Buffer, string] {
    const parts = data.toString().split(" ");
    if (parts.length !== 3) throw new HTTPError(400, "Malformed request line.");
    return [parts[0], Buffer.from(parts[1]), parts[2]];
}

export async function writeHTTPRes(conn: TCPConn, res: HTTPRes): Promise<void> {
    if (res.body.length < 0) {
        throw new Error("chunked encoding not implemented");
    }

    res.headers.push(Buffer.from(`Content-Length: ${res.body.length}`));

    await onWrite(conn, encodeHTTPResp(res));

    while (true) {
        const chunk = await res.body.read();
        if (chunk.length === 0) break;
        await onWrite(conn, chunk);
    }
}

export function encodeHTTPResp(res: HTTPRes): Buffer {
    const statusLine = `HTTP/1.1 ${res.code} ${httpStatusText(res.code)}\r\n`;
    const headers = res.headers.map(h => h.toString()).join("\r\n") + "\r\n\r\n";
    return Buffer.from(statusLine + headers);
}

export function httpStatusText(code: number): string {
    const map: Record<number, string> = {
        200: "OK",
        400: "Bad Request",
        404: "Not Found",
        501: "Not Implemented",
    };
    return map[code] || "Unknown";
}

export function readerFromMemory(data: Buffer): BodyReader {
    let done = false;
    return {
        length: data.length,
        read: async (): Promise<Buffer> => {
            if (done) return Buffer.alloc(0);
            done = true;
            return data;
        }
    };
}
