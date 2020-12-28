import express from "express";
import http from "http";
import path from "path";
import * as socketio from "socket.io";

const app = express();
const httpServer = http.createServer(app);
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
    private callbacks: { [eventName: string]: (socketInfo: SocketInfo, data?: any) => void | Promise<void> } = {};

    constructor(private socketInfo: SocketInfo) {
        socketInfo.io.on("connection", (socket) => {
            socket.on("resendEvent", (data: any) => this.dispatchEvent("resendEvent", socket, data));
            return this.dispatchEvent("connection", socket);
        });
    }

    private async dispatchEvent(eventName: CallbackEvent, socket?: socketio.Socket, data?: any): Promise<void> {
        console.log(eventName);
        if (this.callbacks.hasOwnProperty(eventName)) {
            const fn = this.callbacks[eventName];
            const socketInfo = Object.assign({ socket }, this.socketInfo);
            await Promise.resolve(fn(socketInfo, data));
        }
    }

    sendNewSubscriptionEvent(ev: any) {
        io.emit("newSubscriptionEvent", ev);
    }

    registerCallback(eventName: CallbackEvent, fn: (socketInfo: SocketInfo, data?: any) => void | Promise<void>) {
        this.callbacks[eventName] = fn;
    }
}

type CallbackEvent = "connection" | "resendEvent";

export interface SocketInfo {
    server: http.Server,
    io: socketio.Server,
    socket?: socketio.Socket
}