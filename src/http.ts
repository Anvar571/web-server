import { TCPConn, onWrite } from "./socket"

export type HTTPReq = {
    method: string,
    uri: Buffer,
    version: string,
    headers: Buffer[],
}

export type HTTPRes = {
    code: number,
    headers: Buffer[],
    body: BodyReader,
}

export type BodyReader = {
    length: number,
    read: () => Promise<Buffer>,
}

export class HTTPError extends Error {
    constructor(code: number, message: string) {
        super(message);
    }
}

export function readerFromReq(conn: TCPConn, buf: Buffer, req: HTTPReq) {
    let bodyLen = -1;
    const contentLen = fieldGet(req.headers, 'Content-Length');
    if (contentLen) {
        bodyLen = parseDec(contentLen.toString('latin1'));
        if (isNaN(bodyLen)) {
            throw new HTTPError(400, 'bad Content-Length.');
        }
    }
    const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD');
    const chunked = fieldGet(req.headers, 'Transfer-Encoding')
        ?.equals(Buffer.from('chunked')) || false;
    if (!bodyAllowed && (bodyLen > 0 || chunked)) {
        throw new HTTPError(400, 'HTTP body not allowed.');
    }
    if (!bodyAllowed) {
        bodyLen = 0;
    }

    if (bodyLen >= 0) {
        // "Content-Length" is present
        return readerFromConnLength(conn, buf, bodyLen);
    } else if (chunked) {
        // chunked encoding
        throw new HTTPError(501, 'TODO');
    } else {
        // read the rest of the connection
        throw new HTTPError(501, 'TODO');
    }
}

// todo
export function fieldGet(headers: Buffer[], target: string): Buffer {
    return Buffer.from('');
}

// todo
export function parseDec(content: string): number {
    return 1
}

export function readerFromConnLength(conn: TCPConn, buf: Buffer, len: number) {
    return;
}

export async function handleReq(): Promise<HTTPRes> {
    // todo
    return {
        code: 200,
        body: {} as BodyReader, // todo
        headers: [Buffer.from("server: server-test")]
    }
}

export function parseHeaderReq() {

}

export function parseHTTPReq(data: Buffer) {
    const lines: Buffer[] = splitLines(data);

    const [method, uri, version] = parseRequestLine(lines[0]);

    const headers: Buffer[] = [];

    for (let i = 1; i < lines.length - 1; i++) {
        const h = Buffer.from(lines[i]);
        if (!validateHeader(h)) {
            throw new HTTPError(400, 'Bad field');
        }
        headers.push(h);
    }

    return {
        method, uri, version, headers
    }
}

// todo
export function splitLines(data: Buffer): Buffer[] {
    return []
}

// todo
export function validateHeader(data: Buffer): boolean {
    return true;
}

// todo
export function parseRequestLine(data: Buffer): any {
    return {}
}

export async function writeHTTPRes(conn: TCPConn, res: HTTPRes): Promise<void> {
    if (res.body.length < 0) {
        throw new Error("chunked encoding");
    }

    res.headers.push(Buffer.from(`Content-length: ${res.body.length}`));

    await onWrite(conn, encodeHTTPResp(res));

    while(true) {
        const data = await res.body.read();
        if (data.length === 0) {
            break;
        }
        await onWrite(conn, data);
    }

}

// todo
export function encodeHTTPResp(res: HTTPRes): Buffer {
    return Buffer.from('');
}

export function readerFromMemory(data: Buffer): BodyReader {
    let done = false;
    return {
        length: data.length,
        read: async (): Promise<Buffer> => {
            if (done) {
                return Buffer.from('') // EOF
            } else {
                done = true;
                return data;
            }
        }
    }
}
