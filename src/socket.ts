import * as net from "net";
import { DynBuf, bufPush, cutMessage } from "./buffer";

export type TCPConn = {
    socket: net.Socket;

    error: null|Error;

    ended: boolean;

    reader: null | {
        resolve: (data: Buffer) => void;
        reject: (reason: Error) => void;
    }
}

type TCPListener = {
    server: net.Server;
}

export function onInit(socket: net.Socket): TCPConn {
    const conn: TCPConn = {
        socket, error: null, ended: false, reader: null,
    }

    socket.on('data', (buffer) => {
        conn.socket.pause();

        conn.reader!.resolve(buffer);
        conn.reader = null;
    });

    socket.on('error', (err) => {
        conn.error = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });

    socket.on('end', () => {
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from(''));
            conn.reader = null;
        }
    });
    return conn;
}

export function onRead(conn: TCPConn): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        if (conn.ended) {
            resolve(Buffer.from(''));
            return;
        }

        if (conn.error) {
            reject(conn.error);
            return;
        }

        conn.reader = { resolve, reject };
        conn.socket.resume();
    })
}

export function onWrite(conn: TCPConn, data: Buffer): Promise<void> {
    return new Promise<void>((res, rej) => {
        if (conn.ended) {
            res();
            return;
        }
        if (conn.error) {
            rej(conn.error);
            return;
        }

        conn.socket.write(data, (err) => {
            if (err) {
                conn.error = err;
                rej(err);
                return;
            }
            res();
        })
    })
}

export function onListen(port = 8000) {
    const server = net.createServer({pauseOnConnect: true});
    server.listen(port);
    return server;
}

export function onAccept(listener: TCPListener): Promise<TCPConn> {
    return new Promise<TCPConn>((done, fail) => {
        listener.server.once('connection', (socket) => {
            const conn = onInit(socket);
            done(conn);  
        })
    });
}

export async function requestHandler(conn: TCPConn) {
    const buf: DynBuf = { data: Buffer.alloc(0), length: 0 };
    while (true) {
        const msg = cutMessage(buf);
        if (!msg) {
            const data = await onRead(conn);
            bufPush(buf, data);
            if (data.length === 0) {
                return;
            }
            continue;
        }

        if (msg.equals(Buffer.from('quit\n'))) {
            await onWrite(conn, Buffer.from("Goodbye!"));
            conn.socket.destroy();
        }else {
            const reply = Buffer.concat([Buffer.from('Echo: '), msg]);
            await onWrite(conn, reply);
        }
    }
}
