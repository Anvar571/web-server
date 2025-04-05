import * as net from "node:net";
import { serverClient } from "./socket";

async function newConn(socket: net.Socket): Promise<void> {
    try {
        await serverClient(socket);   
    } catch (error) {
        console.error('exception:', error);
    } finally {
        socket.destroy();
    }
}

const server = net.createServer({ pauseOnConnect: true });

server.on("connection", newConn);

server.listen(8080, () => {
    console.log("Server listening on port 8080");
});