#!/usr/bin/env node

import EventGridTunnel from "./lib/EventGridTunnel";
import createSubscriptions from "./lib/createSubscriptions";
import { startServer } from "./lib/server";

if (process.argv.length > 2 && process.argv[2] === "subscribe") {
    createSubscriptions();
} else {
    const socketServer = startServer();
    const tunnel = new EventGridTunnel(socketServer);
    tunnel.start();
}
