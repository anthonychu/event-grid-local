import express from "express";
const app = express();
import http from "http";
const httpServer = http.createServer(app);
import path from "path";
import * as socketio from "socket.io";
const io = new socketio.Server(httpServer);

const port = 8081;

app.use(express.static(path.join(__dirname, "..", "..", "www")));

export function startServer(): SocketServer {
    const server = httpServer.listen(port, () => {
        console.log(`Dashboard running at http://localhost:${port}/`);
    });
    return new SocketServer({ server, io });
}

export class SocketServer {
    private callbacks: { [eventName: string]: (socketInfo: SocketInfo) => void | Promise<void> } = {};

    constructor(private socketInfo: SocketInfo) {
        socketInfo.io.on("connection", (socket) => this.dispatchEvent("connection", socket));
    }

    private async dispatchEvent(eventName: CallbackEvent, socket?: socketio.Socket): Promise<void> {
        if (this.callbacks.hasOwnProperty(eventName)) {
            const fn = this.callbacks[eventName];
            const socketInfo = Object.assign({ socket }, this.socketInfo);
            await Promise.resolve(fn(socketInfo));
        }
    }

    registerCallback(eventName: CallbackEvent, fn: (socketInfo: SocketInfo) => void | Promise<void>) {
        this.callbacks[eventName] = fn;
    }
}

type CallbackEvent = "connection";

export interface SocketInfo {
    server: http.Server,
    io: socketio.Server,
    socket?: socketio.Socket
}