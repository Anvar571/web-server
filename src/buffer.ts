import { HTTPError, HTTPReq, parseHTTPReq } from "./http";

export type DynBuf = {
    data: Buffer,
    length: number,
}

// max length of a HTTP header
const kMaxHeaderLen = 1024 * 8;

// Buffer.concat([]) O(n^2) instead of Buffer.alloc()
export function bufPush(buf: DynBuf, data: Buffer) {
    const newLen = buf.length + data.length;
    if (buf.data.length < newLen) {
        let cap = Math.max(buf.data.length, 32);

        while (cap < newLen) {
            cap *= 2;
        }

        const grow = Buffer.alloc(cap);
        buf.data.copy(grow, 0,0);
        buf.data = grow;
    }
    data.copy(buf.data, buf.length, 0);
    buf.length = newLen;
}

export function cutMessage(buf: DynBuf): null | HTTPReq {
    const idx = buf.data.subarray(0, buf.length).indexOf('\r\n\r\n');
    if (idx < 0) {
        if (buf.length >= kMaxHeaderLen) {
            throw new HTTPError(413, "Header is too large");
        }
        return null;
    }
    const msg = parseHTTPReq(buf.data.subarray(0, idx + 4));
    bufPop(buf, idx+4);
    return msg;
}

export function bufPop(buf: DynBuf, len: number) {
    buf.data.copyWithin(0, len, buf.length);
    buf.length -= len;
}
