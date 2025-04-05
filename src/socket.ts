import * as net from "net";

type TCPConn = {
    socket: net.Socket;

    error: null|Error;

    ended: boolean;

    reader: null | {
        resolve: (data: Buffer) => void;
        reject: (reason: Error) => void;
    }
}

function onInit(socket: net.Socket) {
    const conn: TCPConn = {
        socket,
        error: null,
        ended: false,
        reader: null
    };
    socket.on("data", (data: Buffer) => {
        conn.socket.pause();
        
        conn.reader!.resolve(data);
        conn.reader = null;
    });

    socket.on("error", (err: Error) => {
        conn.error = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });

    socket.on('end', () => {
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from(""));
            conn.reader = null;
        }
    })

    return conn;
}

function onRead(conn: TCPConn) {
    return new Promise<Buffer>((resolve, reject) => {
        if (conn.ended) {
            resolve(Buffer.from(""));
            return;
        }
        if (conn.error) {
            reject(conn.error);
            return;
        }
        conn.reader = { resolve, reject };
        conn.socket.resume();
    });
}

function onWrite(conn: TCPConn, data: Buffer) {
    return new Promise<void>((resolve, reject) => {
        if (conn.ended) {
            resolve();
            return;
        }
        if (conn.error) {
            reject(conn.error);
            return;
        }
        conn.socket.write(data, (err?: Error) => {
            if (err) {
                conn.error = err;
                reject(err);
                return;
            }
            resolve();
        });
    });
}

async function serverClient(socket: net.Socket): Promise<void> {
    const conn: TCPConn = onInit(socket);
    while (true) {
        const data = await onRead(conn);
        if (data.length === 0) {
            console.log('end connection');
            break;
        }

        console.log('data', data);
        await onWrite(conn, data);
    }
}

export {
    onInit,
    onRead,
    onWrite,
    serverClient
}