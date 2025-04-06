export type DynBuf = {
    data: Buffer,
    length: number,
}

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

export function cutMessage(buf: DynBuf): null | Buffer {
    const idx = buf.data.subarray(0, buf.length).indexOf('\n');
    if (idx < 0) {
        return null;
    }
    const msg = Buffer.from(buf.data.subarray(0, idx + 1));
    bufPop(buf, idx+1);
    return msg;
}

export function bufPop(buf: DynBuf, len: number) {
    buf.data.copyWithin(0, len, buf.length);
    buf.length -= len;
}
