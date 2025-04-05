import * as net from "node:net";
import { onAccept, onListen, serverClient } from "./socket";

async function newConn(socket: net.Socket): Promise<void> {
    try {
        await serverClient(socket);   
    } catch (error) {
        console.error('exception:', error);
    } finally {
        socket.destroy();
    }
}

const server = onListen(8000);

(async () => {
    const conn = await onAccept({ server });
    console.log('new connection');
    newConn(conn.socket);
}
)();
