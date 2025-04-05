import { onAccept, onListen, requestHandler, TCPConn } from "./socket";

async function newConn(connection: TCPConn): Promise<void> {
    try {
        await requestHandler(connection);   
    } catch (error) {
        console.error('exception:', error);
    }
}

const server = onListen(8000);

(async () => {
        const conn = await onAccept({ server });
        console.log('new connection');
        newConn(conn);
    }
)();
