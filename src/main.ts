import * as net from "node:net";

function newConn(socket: net.Socket): void {
    console.log('new connection', socket.remoteAddress, socket.remotePort);

    socket.on('end', () => {
        console.log('EOF.');
    });
    socket.on('data', (data: Buffer) => {
        console.log('data:', data);
        socket.write(data);

        if (data.includes('q')) {
            console.log('closing.');
            socket.end();
        }
    });
}

const server = net.createServer();

server.on("connection", newConn);

server.listen(8080, () => {
    console.log("Server listening on port 8080");
});